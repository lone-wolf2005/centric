<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Material;
use App\Models\MaterialMovement;
use App\Models\ScanEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function dashboard(): JsonResponse
    {
        $today = now()->toDateString();

        return response()->json([
            'today_inward' => MaterialMovement::where('type', 'inward')->whereDate('created_at', $today)->count(),
            'today_outward' => MaterialMovement::where('type', 'outward')->whereDate('created_at', $today)->count(),
            'active_scans' => MaterialMovement::where('status', 'scanning')->count(),
            'mismatches_today' => ScanEvent::where('is_match', false)->whereDate('created_at', $today)->count(),
            'material_categories' => Material::where('is_active', true)->count(),
        ]);
    }

    public function inward(Request $request): JsonResponse
    {
        return response()->json($this->movementReport('inward', $request));
    }

    public function outward(Request $request): JsonResponse
    {
        return response()->json($this->movementReport('outward', $request));
    }

    public function itemSummary(): JsonResponse
    {
        $summary = Material::query()
            ->leftJoin('movement_items', 'materials.id', '=', 'movement_items.material_id')
            ->leftJoin('material_movements', 'movement_items.material_movement_id', '=', 'material_movements.id')
            ->select([
                'materials.id',
                'materials.name',
                DB::raw("SUM(CASE WHEN material_movements.type = 'inward' THEN movement_items.scanned_count ELSE 0 END) as total_inward"),
                DB::raw("SUM(CASE WHEN material_movements.type = 'outward' THEN movement_items.scanned_count ELSE 0 END) as total_outward"),
            ])
            ->groupBy('materials.id', 'materials.name')
            ->orderBy('materials.name')
            ->get()
            ->map(function ($row) {
                $row->balance = (int) $row->total_inward - (int) $row->total_outward;

                return $row;
            });

        return response()->json($summary);
    }

    public function supervisorSummary(): JsonResponse
    {
        $summary = MaterialMovement::query()
            ->join('users', 'material_movements.supervisor_id', '=', 'users.id')
            ->join('movement_items', 'material_movements.id', '=', 'movement_items.material_movement_id')
            ->select([
                'users.id',
                'users.name as supervisor_name',
                DB::raw('COUNT(DISTINCT material_movements.id) as movement_count'),
                DB::raw('SUM(movement_items.scanned_count) as items_handled'),
            ])
            ->groupBy('users.id', 'users.name')
            ->orderByDesc('items_handled')
            ->get();

        return response()->json($summary);
    }

    public function aiAccuracy(): JsonResponse
    {
        $total = ScanEvent::count();
        $autoMatched = ScanEvent::where('is_match', true)->where('manually_verified', false)->count();
        $manual = ScanEvent::where('manually_verified', true)->count();
        $mismatches = ScanEvent::where('is_match', false)->count();

        return response()->json([
            'total_scans' => $total,
            'auto_matched' => $autoMatched,
            'manually_verified' => $manual,
            'mismatches' => $mismatches,
            'accuracy_percent' => $total > 0 ? round(($autoMatched / $total) * 100, 2) : 0,
        ]);
    }

    public function exceptions(): JsonResponse
    {
        $exceptions = ScanEvent::query()
            ->with(['session.material', 'session.materialSize', 'detectedMaterial', 'session.movement.supervisor'])
            ->where('is_match', false)
            ->orderByDesc('scanned_at')
            ->limit(100)
            ->get();

        return response()->json($exceptions);
    }

    public function dailyActivity(Request $request): JsonResponse
    {
        $date = $request->date('date')?->toDateString() ?? now()->toDateString();

        $movements = MaterialMovement::query()
            ->with(['supervisor', 'items.material'])
            ->whereDate('created_at', $date)
            ->orderBy('created_at')
            ->get();

        return response()->json([
            'date' => $date,
            'movements' => $movements,
            'totals' => [
                'inward' => $movements->where('type', 'inward')->count(),
                'outward' => $movements->where('type', 'outward')->count(),
                'items_scanned' => $movements->sum(fn ($movement) => $movement->items->sum('scanned_count')),
            ],
        ]);
    }

    public function pendingReturns(): JsonResponse
    {
        $pending = MaterialMovement::query()
            ->with(['supervisor', 'destinationLocation', 'items.material'])
            ->where('type', 'outward')
            ->where('status', 'completed')
            ->where('approval_status', 'approved')
            ->whereDoesntHave('items', fn ($q) => $q->whereColumn('scanned_count', '>=', 'quantity'))
            ->orderByDesc('completed_at')
            ->get();

        return response()->json($pending);
    }

    public function damageScrap(): JsonResponse
    {
        $records = MaterialMovement::query()
            ->with(['supervisor', 'items.material'])
            ->where('type', 'inward')
            ->whereIn('return_condition', ['damaged', 'scrap', 'repairable'])
            ->orderByDesc('created_at')
            ->get();

        return response()->json($records);
    }

    public function billingPending(): JsonResponse
    {
        $pending = MaterialMovement::query()
            ->with(['quotation', 'indent', 'tallyOrder', 'supervisor'])
            ->where('type', 'outward')
            ->where('status', 'completed')
            ->whereMonth('completed_at', now()->month)
            ->get()
            ->map(fn ($m) => [
                'id' => $m->id,
                'reference' => $m->dc_number,
                'customer' => $m->quotation?->customer_name ?? $m->tallyOrder?->customer_name,
                'project' => $m->indent?->project_name,
                'completed_at' => $m->completed_at?->toDateString(),
                'billing_status' => 'pending',
            ]);

        return response()->json($pending);
    }

    public function rentalStatus(): JsonResponse
    {
        $status = MaterialMovement::query()
            ->with(['quotation', 'indent', 'destinationLocation'])
            ->where('status', 'completed')
            ->orderByDesc('completed_at')
            ->limit(50)
            ->get();

        return response()->json($status);
    }

    public function approvalStatus(): JsonResponse
    {
        return response()->json(
            \App\Models\Approval::with(['requester', 'approver'])
                ->orderByDesc('created_at')
                ->limit(100)
                ->get()
        );
    }

    private function movementReport(string $type, Request $request): array
    {
        $movements = MaterialMovement::query()
            ->with(['supervisor', 'tallyOrder', 'items.material', 'items.materialSize'])
            ->where('type', $type)
            ->when($request->date('from'), fn ($query, $from) => $query->whereDate('created_at', '>=', $from))
            ->when($request->date('to'), fn ($query, $to) => $query->whereDate('created_at', '<=', $to))
            ->orderByDesc('created_at')
            ->get();

        return $movements->map(function (MaterialMovement $movement) use ($type) {
            return [
                'id' => $movement->id,
                'date' => $movement->created_at?->toDateString(),
                'supervisor' => $movement->supervisor?->name,
                'reference' => $type === 'outward' ? $movement->dc_number : $movement->grn_number,
                'destination' => $movement->destination,
                'customer' => $movement->tallyOrder?->customer_name,
                'site' => $movement->tallyOrder?->site_name,
                'items' => $movement->items->map(fn ($item) => [
                    'material' => $item->material?->name,
                    'size' => $item->materialSize?->label,
                    'quantity' => $item->quantity,
                    'scanned_count' => $item->scanned_count,
                ]),
            ];
        })->all();
    }
}
