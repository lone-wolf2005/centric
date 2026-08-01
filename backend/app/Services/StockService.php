<?php

namespace App\Services;

use App\Models\StockBalance;
use Illuminate\Support\Facades\DB;

class StockService
{
    public function adjust(
        int $locationId,
        int $materialId,
        ?int $materialSizeId,
        int $delta,
    ): StockBalance {
        return DB::transaction(function () use ($locationId, $materialId, $materialSizeId, $delta) {
            $balance = StockBalance::query()->firstOrCreate(
                [
                    'location_id' => $locationId,
                    'material_id' => $materialId,
                    'material_size_id' => $materialSizeId,
                ],
                ['quantity' => 0]
            );

            $balance->quantity = max(0, (int) $balance->quantity + $delta);
            $balance->save();

            return $balance;
        });
    }

    public function set(
        int $locationId,
        int $materialId,
        ?int $materialSizeId,
        int $quantity,
    ): StockBalance {
        return StockBalance::query()->updateOrCreate(
            [
                'location_id' => $locationId,
                'material_id' => $materialId,
                'material_size_id' => $materialSizeId,
            ],
            ['quantity' => max(0, $quantity)]
        );
    }
}
