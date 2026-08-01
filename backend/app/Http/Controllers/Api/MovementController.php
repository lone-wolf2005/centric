<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Approval;
use App\Models\MaterialMovement;
use App\Models\MovementItem;
use App\Models\ScanSession;
use App\Services\AiDetectionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class MovementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $movements = MaterialMovement::query()
            ->with([
                'supervisor',
                'tallyOrder',
                'quotation',
                'indent',
                'sourceLocation',
                'destinationLocation',
                'items.material',
                'items.materialSize',
            ])
            ->when($request->type, fn ($query, $type) => $query->where('type', $type))
            ->orderByDesc('created_at')
            ->get();

        return response()->json($movements);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', 'in:inward,outward'],
            'tally_order_id' => ['nullable', 'exists:tally_orders,id'],
            'quotation_id' => ['nullable', 'exists:quotations,id'],
            'indent_id' => ['nullable', 'exists:indents,id'],
            'source_location_id' => ['nullable', 'exists:locations,id'],
            'destination_location_id' => ['nullable', 'exists:locations,id'],
            'return_condition' => ['nullable', 'in:normal,damaged,scrap,repairable'],
            'destination' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.material_id' => ['required', 'exists:materials,id'],
            'items.*.material_size_id' => ['nullable', 'exists:material_sizes,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ]);

        $movement = MaterialMovement::create([
            'type' => $data['type'],
            'tally_order_id' => $data['tally_order_id'] ?? null,
            'quotation_id' => $data['quotation_id'] ?? null,
            'indent_id' => $data['indent_id'] ?? null,
            'source_location_id' => $data['source_location_id'] ?? null,
            'destination_location_id' => $data['destination_location_id'] ?? null,
            'return_condition' => $data['type'] === 'inward' ? ($data['return_condition'] ?? 'normal') : null,
            'supervisor_id' => $request->user()->id,
            'destination' => $data['destination'] ?? null,
            'notes' => $data['notes'] ?? null,
            'status' => 'draft',
            'approval_status' => 'pending',
        ]);

        foreach ($data['items'] as $item) {
            MovementItem::create([
                'material_movement_id' => $movement->id,
                'material_id' => $item['material_id'],
                'material_size_id' => $item['material_size_id'] ?? null,
                'quantity' => $item['quantity'],
            ]);
        }

        return response()->json(
            $movement->load([
                'supervisor',
                'tallyOrder',
                'quotation',
                'indent',
                'sourceLocation',
                'destinationLocation',
                'items.material',
                'items.materialSize',
            ]),
            201
        );
    }

    public function show(MaterialMovement $movement): JsonResponse
    {
        return response()->json(
            $movement->load([
                'supervisor',
                'tallyOrder',
                'quotation',
                'indent',
                'sourceLocation',
                'destinationLocation',
                'items.material',
                'items.materialSize',
            ])
        );
    }

    public function activeScan(Request $request): JsonResponse
    {
        $movement = MaterialMovement::query()
            ->where('supervisor_id', $request->user()->id)
            ->where('status', 'scanning')
            ->with([
                'supervisor',
                'tallyOrder',
                'quotation',
                'indent',
                'sourceLocation',
                'destinationLocation',
                'items.material',
                'items.materialSize',
            ])
            ->orderByDesc('started_at')
            ->first();

        if (! $movement) {
            return response()->json([
                'movement' => null,
                'session' => null,
            ]);
        }

        $session = ScanSession::query()
            ->where('material_movement_id', $movement->id)
            ->where('status', 'active')
            ->with(['material', 'materialSize'])
            ->orderByDesc('id')
            ->first();

        return response()->json([
            'movement' => $movement,
            'session' => $session,
        ]);
    }

    public function showScanSession(ScanSession $session): JsonResponse
    {
        return response()->json($session->load(['material', 'materialSize']));
    }

    public function startScan(Request $request, MaterialMovement $movement): JsonResponse
    {
        $data = $request->validate([
            'material_id' => ['required', 'exists:materials,id'],
            'material_size_id' => ['nullable', 'exists:material_sizes,id'],
        ]);

        $movement->update([
            'status' => 'scanning',
            'started_at' => $movement->started_at ?? now(),
        ]);

        $existingSession = ScanSession::query()
            ->where('material_movement_id', $movement->id)
            ->where('status', 'active')
            ->where('material_id', $data['material_id'])
            ->when(
                $data['material_size_id'] ?? null,
                fn ($query, $sizeId) => $query->where('material_size_id', $sizeId),
                fn ($query) => $query->whereNull('material_size_id')
            )
            ->first();

        if ($existingSession) {
            return response()->json($existingSession->load(['material', 'materialSize']));
        }

        $session = ScanSession::create([
            'material_movement_id' => $movement->id,
            'material_id' => $data['material_id'],
            'material_size_id' => $data['material_size_id'] ?? null,
            'status' => 'active',
        ]);

        return response()->json($session->load(['material', 'materialSize']));
    }

    public function recordScan(Request $request, ScanSession $session, AiDetectionService $ai): JsonResponse
    {
        $data = $request->validate([
            'detected_material_id' => ['required', 'exists:materials,id'],
            'confidence' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'manually_verified' => ['sometimes', 'boolean'],
        ]);

        return response()->json($ai->recordDetection($session, [
            'material_code' => null,
            'confidence' => $data['confidence'] ?? null,
            'detected_material_id' => $data['detected_material_id'],
        ], $data['manually_verified'] ?? false, (int) $data['detected_material_id']));
    }

    public function detectFromImage(
        Request $request,
        ScanSession $session,
        AiDetectionService $ai,
    ): JsonResponse {
        $request->validate([
            'image' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,bmp,gif', 'max:20480'],
        ]);

        try {
            $detection = $ai->detectFromImage($request->file('image'));
        } catch (\RuntimeException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 503);
        }

        if (! ($detection['detected'] ?? false)) {
            return response()->json([
                'message' => $detection['message'] ?? 'No centric elements detected',
                'detection' => $detection,
            ], 422);
        }

        try {
            return response()->json($ai->recordDetection($session, $detection));
        } catch (\RuntimeException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'detection' => $detection,
            ], 422);
        }
    }

    public function updateExpectedMaterial(Request $request, ScanSession $session): JsonResponse
    {
        $data = $request->validate([
            'material_id' => ['required', 'exists:materials,id'],
            'material_size_id' => ['nullable', 'exists:material_sizes,id'],
        ]);

        $session->update($data);

        return response()->json($session->fresh(['material', 'materialSize']));
    }

    public function complete(MaterialMovement $movement): JsonResponse
    {
        $prefix = $movement->type === 'outward' ? 'DC' : 'GRN';
        $number = $prefix.'-'.now()->format('Ymd').'-'.Str::upper(Str::random(4));

        $movement->update([
            'status' => 'completed',
            'completed_at' => now(),
            'dc_number' => $movement->type === 'outward' ? $number : $movement->dc_number,
            'grn_number' => $movement->type === 'inward' ? $number : $movement->grn_number,
        ]);

        ScanSession::query()
            ->where('material_movement_id', $movement->id)
            ->where('status', 'active')
            ->update(['status' => 'completed']);

        Approval::create([
            'approvable_type' => MaterialMovement::class,
            'approvable_id' => $movement->id,
            'type' => $movement->type === 'outward' ? 'delivery' : 'return',
            'status' => 'pending',
            'requested_by' => $movement->supervisor_id,
        ]);

        return response()->json([
            'message' => 'Movement completed and synced to Tally workflow',
            'movement' => $movement->fresh(['supervisor', 'tallyOrder', 'items.material']),
        ]);
    }
}
