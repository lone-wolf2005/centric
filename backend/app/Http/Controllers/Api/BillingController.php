<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Models\Location;
use App\Models\MaterialSize;
use App\Models\RentalBill;
use App\Models\RentalBillLine;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BillingController extends Controller
{
    private const CENTERING_MATERIALS = [
        'Centering Sheet',
        'Adjustment Sheet',
        'Aluminium Channel',
        'Adjustable Props',
        'Adjustable Span',
    ];

    public function index(Request $request): JsonResponse
    {
        $bills = RentalBill::query()
            ->with(['location', 'generator'])
            ->when($request->location_id, fn ($q, $id) => $q->where('location_id', $id))
            ->when($request->status, fn ($q, $status) => $q->where('status', $status))
            ->orderByDesc('period_end')
            ->get();

        return response()->json($bills);
    }

    public function show(RentalBill $bill): JsonResponse
    {
        return response()->json(
            $bill->load(['location', 'generator', 'lines.material', 'lines.materialSize'])
        );
    }

    public function generate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'location_id' => ['required', 'exists:locations,id'],
            'period_start' => ['required', 'date'],
            'period_end' => ['required', 'date', 'after_or_equal:period_start'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.material_size_id' => ['required', 'exists:material_sizes,id'],
            'lines.*.quantity' => ['required', 'integer', 'min:1'],
            'lines.*.start_date' => ['required', 'date'],
            'lines.*.end_date' => ['required', 'date', 'after_or_equal:lines.*.start_date'],
            'lines.*.rate_per_month' => ['nullable', 'numeric', 'min:0'],
        ]);

        $location = Location::findOrFail($data['location_id']);

        $bill = DB::transaction(function () use ($data, $location, $request) {
            $bill = RentalBill::updateOrCreate(
                [
                    'location_id' => $location->id,
                    'period_start' => $data['period_start'],
                    'period_end' => $data['period_end'],
                ],
                [
                    'bill_no' => 'RB-'.now()->format('Ym').'-'.Str::upper(Str::random(5)),
                    'site_name' => $location->name,
                    'status' => 'draft',
                    'generated_by' => $request->user()->id,
                ]
            );

            $bill->lines()->delete();

            $centering = 0.0;
            $scaffolding = 0.0;

            foreach ($data['lines'] as $line) {
                $size = MaterialSize::with('material')->findOrFail($line['material_size_id']);
                $start = Carbon::parse($line['start_date'])->startOfDay();
                $end = Carbon::parse($line['end_date'])->startOfDay();
                $days = max(1, $start->diffInDays($end) + 1);
                $qty = (int) $line['quantity'];
                $rateMonth = (float) ($line['rate_per_month'] ?? $size->rate_per_month ?? 0);
                $rateDay = $rateMonth / 30;
                $consumed = $days * $qty;
                $amount = round($consumed * $rateDay, 2);
                $group = in_array($size->material->name, self::CENTERING_MATERIALS, true)
                    ? 'centering'
                    : 'scaffolding';

                RentalBillLine::create([
                    'rental_bill_id' => $bill->id,
                    'material_id' => $size->material_id,
                    'material_size_id' => $size->id,
                    'particulars' => $size->label,
                    'category_group' => $group,
                    'unit' => $size->unit ?? 'Nos',
                    'quantity' => $qty,
                    'start_date' => $start->toDateString(),
                    'end_date' => $end->toDateString(),
                    'days' => $days,
                    'total_consumed' => $consumed,
                    'rate_per_month' => $rateMonth,
                    'rate_per_day' => $rateDay,
                    'amount' => $amount,
                ]);

                if ($group === 'centering') {
                    $centering += $amount;
                } else {
                    $scaffolding += $amount;
                }
            }

            $bill->update([
                'centering_total' => round($centering, 2),
                'scaffolding_total' => round($scaffolding, 2),
                'grand_total' => round($centering + $scaffolding, 2),
            ]);

            return $bill->fresh(['location', 'generator', 'lines.material', 'lines.materialSize']);
        });

        return response()->json($bill, 201);
    }

    public function raise(RentalBill $bill): JsonResponse
    {
        $bill->update([
            'status' => 'raised',
            'raised_at' => now(),
        ]);

        return response()->json($bill->fresh(['location', 'lines']));
    }

    public function notifications(Request $request): JsonResponse
    {
        $this->refreshReminders($request->user()->id);

        return response()->json(
            AppNotification::query()
                ->where(function ($q) use ($request) {
                    $q->whereNull('user_id')->orWhere('user_id', $request->user()->id);
                })
                ->orderByDesc('created_at')
                ->limit(50)
                ->get()
        );
    }

    public function markNotificationRead(AppNotification $notification): JsonResponse
    {
        $notification->update(['read_at' => now()]);

        return response()->json($notification);
    }

    private function refreshReminders(int $userId): void
    {
        $pendingSites = Location::query()
            ->where('type', '!=', 'godown')
            ->whereDoesntHave('rentalBills', function ($q) {
                $q->where('period_start', '>=', now()->startOfMonth()->toDateString())
                    ->whereIn('status', ['raised', 'synced']);
            })
            ->limit(10)
            ->get();

        foreach ($pendingSites as $site) {
            AppNotification::firstOrCreate(
                [
                    'type' => 'billing_reminder',
                    'title' => 'Billing pending: '.$site->name,
                    'user_id' => $userId,
                ],
                [
                    'body' => 'Monthly rental bill has not been raised for '.$site->name.' this period.',
                    'meta' => ['location_id' => $site->id],
                ]
            );
        }

        $overdue = \App\Models\MaterialMovement::query()
            ->where('type', 'outward')
            ->where('status', 'completed')
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<=', now()->toDateString())
            ->whereDoesntHave('items') // keep query simple; filter in PHP if needed
            ->limit(0)
            ->get();

        // Overdue outward movements without matching completed inward
        $overdue = \App\Models\MaterialMovement::query()
            ->where('type', 'outward')
            ->where('status', 'completed')
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<=', now()->toDateString())
            ->whereNotNull('dc_number')
            ->whereDoesntHave('approvals', fn ($q) => $q->where('type', 'return')->where('status', 'approved'))
            ->limit(20)
            ->get();

        foreach ($overdue as $movement) {
            $returned = \App\Models\MaterialMovement::query()
                ->where('type', 'inward')
                ->where('linked_dc_number', $movement->dc_number)
                ->where('status', 'completed')
                ->exists();

            if ($returned) {
                continue;
            }

            AppNotification::firstOrCreate(
                [
                    'type' => 'return_due',
                    'title' => 'Return due: '.$movement->dc_number,
                    'user_id' => $userId,
                ],
                [
                    'body' => 'Material return is due/overdue for DC '.$movement->dc_number.' ('.$movement->destination.').',
                    'meta' => ['movement_id' => $movement->id, 'dc_number' => $movement->dc_number],
                ]
            );
        }
    }
}
