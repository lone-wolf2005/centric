<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TallyOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TallyOrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $orders = TallyOrder::query()
            ->when($request->status, fn ($query, $status) => $query->where('status', $status))
            ->orderByDesc('created_at')
            ->get();

        return response()->json($orders);
    }

    public function sync(): JsonResponse
    {
        $sampleOrders = [
            [
                'order_no' => 'ORD-2026-001',
                'type' => 'rental',
                'customer_name' => 'Sakthi Constructions',
                'site_name' => 'Erode Site A',
                'status' => 'open',
                'synced_at' => now(),
            ],
            [
                'order_no' => 'REQ-2026-014',
                'type' => 'project',
                'customer_name' => 'Internal Project',
                'site_name' => 'Coimbatore Yard',
                'status' => 'in_progress',
                'synced_at' => now(),
            ],
        ];

        foreach ($sampleOrders as $order) {
            TallyOrder::updateOrCreate(
                ['order_no' => $order['order_no']],
                $order
            );
        }

        return response()->json([
            'message' => 'Tally orders synchronized',
            'count' => count($sampleOrders),
        ]);
    }
}
