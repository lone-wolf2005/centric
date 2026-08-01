<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Approval;
use App\Models\Indent;
use App\Models\Location;
use App\Models\MaterialMovement;
use App\Models\Quotation;
use App\Models\SiteTransfer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class FrdController extends Controller
{
    public function quotations(): JsonResponse
    {
        return response()->json(
            Quotation::with('creator')->orderByDesc('created_at')->get()
        );
    }

    public function storeQuotation(Request $request): JsonResponse
    {
        $data = $request->validate([
            'customer_name' => ['required', 'string', 'max:255'],
            'site_name' => ['nullable', 'string', 'max:255'],
            'estimated_amount' => ['nullable', 'numeric', 'min:0'],
            'valid_until' => ['nullable', 'date'],
        ]);

        $quotation = Quotation::create([
            ...$data,
            'quote_no' => 'QT-'.now()->format('Ymd').'-'.Str::upper(Str::random(4)),
            'status' => 'draft',
            'created_by' => $request->user()->id,
        ]);

        return response()->json($quotation->load('creator'), 201);
    }

    public function reviseQuotation(Quotation $quotation): JsonResponse
    {
        $quotation->update([
            'revision' => $quotation->revision + 1,
            'status' => 'revised',
        ]);

        return response()->json($quotation->fresh('creator'));
    }

    public function indents(): JsonResponse
    {
        return response()->json(
            Indent::with('creator')->orderByDesc('created_at')->get()
        );
    }

    public function storeIndent(Request $request): JsonResponse
    {
        $data = $request->validate([
            'project_name' => ['required', 'string', 'max:255'],
            'site_name' => ['nullable', 'string', 'max:255'],
        ]);

        $indent = Indent::create([
            ...$data,
            'indent_no' => 'IND-'.now()->format('Ymd').'-'.Str::upper(Str::random(4)),
            'status' => 'open',
            'created_by' => $request->user()->id,
        ]);

        return response()->json($indent->load('creator'), 201);
    }

    public function locations(): JsonResponse
    {
        return response()->json(
            Location::where('is_active', true)->orderBy('name')->get()
        );
    }

    public function siteTransfers(): JsonResponse
    {
        return response()->json(
            SiteTransfer::with(['fromLocation', 'toLocation', 'creator'])
                ->orderByDesc('created_at')
                ->get()
        );
    }

    public function storeSiteTransfer(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from_location_id' => ['required', 'exists:locations,id'],
            'to_location_id' => ['required', 'exists:locations,id', 'different:from_location_id'],
            'notes' => ['nullable', 'string'],
        ]);

        $transfer = SiteTransfer::create([
            ...$data,
            'transfer_no' => 'ST-'.now()->format('Ymd').'-'.Str::upper(Str::random(4)),
            'created_by' => $request->user()->id,
        ]);

        Approval::create([
            'approvable_type' => SiteTransfer::class,
            'approvable_id' => $transfer->id,
            'type' => 'transfer',
            'requested_by' => $request->user()->id,
        ]);

        return response()->json($transfer->load(['fromLocation', 'toLocation', 'creator']), 201);
    }

    public function approveSiteTransfer(Request $request, SiteTransfer $transfer): JsonResponse
    {
        $data = $request->validate([
            'role' => ['required', 'in:sender,receiver,authority'],
            'decision' => ['required', 'in:approved,rejected'],
            'notes' => ['nullable', 'string'],
        ]);

        $field = $data['role'].'_approval';
        $transfer->update([$field => $data['decision']]);

        if (
            $transfer->sender_approval === 'approved'
            && $transfer->receiver_approval === 'approved'
            && $transfer->authority_approval === 'approved'
        ) {
            $transfer->update(['status' => 'completed']);
        }

        Approval::create([
            'approvable_type' => SiteTransfer::class,
            'approvable_id' => $transfer->id,
            'type' => 'transfer',
            'status' => $data['decision'],
            'requested_by' => $request->user()->id,
            'approved_by' => $request->user()->id,
            'notes' => $data['notes'] ?? null,
            'acted_at' => now(),
        ]);

        return response()->json($transfer->fresh(['fromLocation', 'toLocation']));
    }

    public function approvals(): JsonResponse
    {
        return response()->json(
            Approval::with(['requester', 'approver', 'approvable'])
                ->orderByDesc('created_at')
                ->limit(100)
                ->get()
        );
    }

    public function approveMovement(Request $request, MaterialMovement $movement): JsonResponse
    {
        $data = $request->validate([
            'decision' => ['required', 'in:approved,rejected'],
            'notes' => ['nullable', 'string'],
        ]);

        $movement->update([
            'approval_status' => $data['decision'],
            'receiver_confirmed_by' => $request->user()->id,
            'receiver_confirmed_at' => now(),
        ]);

        Approval::create([
            'approvable_type' => MaterialMovement::class,
            'approvable_id' => $movement->id,
            'type' => $movement->type === 'outward' ? 'delivery' : 'return',
            'status' => $data['decision'],
            'requested_by' => $movement->supervisor_id,
            'approved_by' => $request->user()->id,
            'notes' => $data['notes'] ?? null,
            'acted_at' => now(),
        ]);

        return response()->json($movement->fresh(['supervisor', 'receiver']));
    }

    public function stock(): JsonResponse
    {
        $locations = Location::with([
            'outgoingMovements' => fn ($q) => $q->where('status', 'completed')->latest()->limit(5),
            'incomingMovements' => fn ($q) => $q->where('status', 'completed')->latest()->limit(5),
        ])->where('is_active', true)->get();

        return response()->json($locations);
    }

    public function scanHistory(): JsonResponse
    {
        return response()->json(
            \App\Models\ScanEvent::with([
                'detectedMaterial',
                'expectedSize',
                'session.material',
                'session.materialSize',
                'session.movement.supervisor',
            ])
                ->orderByDesc('scanned_at')
                ->limit(200)
                ->get()
        );
    }
}
