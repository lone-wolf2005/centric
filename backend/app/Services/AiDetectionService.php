<?php

namespace App\Services;

use App\Models\Material;
use App\Models\MovementItem;
use App\Models\ScanEvent;
use App\Models\ScanSession;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class AiDetectionService
{
    public function detectFromImage(UploadedFile $image): array
    {
        try {
            $response = Http::timeout(120)
                ->asMultipart()
                ->attach(
                    'image',
                    file_get_contents($image->getRealPath()),
                    $image->getClientOriginalName() ?: 'scan.jpg',
                    ['Content-Type' => $image->getMimeType() ?: 'image/jpeg']
                )
                ->post(rtrim(config('centric.ai_service_url'), '/').'/detect');
        } catch (ConnectionException) {
            throw new RuntimeException(
                'AI detection service is not running. Start it with: cd ai-service && uvicorn main:app --host 127.0.0.1 --port 5001'
            );
        }

        if (! $response->successful()) {
            $detail = $response->json('detail') ?? $response->json('message') ?? $response->body();
            throw new RuntimeException(is_string($detail) ? $detail : 'AI detection service unavailable');
        }

        return $response->json();
    }

    public function resolveMaterialId(array $detection): ?int
    {
        if (! empty($detection['detected_material_id'])) {
            return (int) $detection['detected_material_id'];
        }

        $materialCode = $detection['material_code'] ?? null;

        if (! $materialCode) {
            return null;
        }

        return Material::query()->where('code', $materialCode)->value('id');
    }

    public function recordDetection(
        ScanSession $session,
        array $detection,
        bool $manuallyVerified = false,
        ?int $overrideMaterialId = null,
    ): array {
        $materialId = $overrideMaterialId ?? $this->resolveMaterialId($detection);

        if (! $materialId) {
            throw new RuntimeException('Detected class is not mapped to a Centric material category');
        }

        $isMatch = (int) $materialId === (int) $session->material_id;

        $event = ScanEvent::create([
            'scan_session_id' => $session->id,
            'detected_material_id' => $materialId,
            'expected_size_id' => $session->material_size_id,
            'is_match' => $isMatch,
            'size_mismatch' => false,
            'confidence' => $detection['confidence'] ?? null,
            'feedback' => $isMatch ? 'match' : 'mismatch',
            'action_taken' => $isMatch ? 'counted' : 'rejected_wrong_material',
            'manually_verified' => $manuallyVerified,
            'scanned_at' => now(),
        ]);

        $movementItem = MovementItem::query()
            ->where('material_movement_id', $session->material_movement_id)
            ->where('material_id', $session->material_id)
            ->when(
                $session->material_size_id,
                fn ($query) => $query->where('material_size_id', $session->material_size_id)
            )
            ->first();

        $expectedQuantity = $movementItem?->quantity ?? 0;
        $quantityStatus = 'ok';

        if ($isMatch) {
            $session->increment('matched_count');

            if ($movementItem) {
                $movementItem->increment('scanned_count');
                $movementItem->refresh();
            }

            $scannedCount = $movementItem?->scanned_count ?? $session->fresh()->matched_count;

            if ($expectedQuantity > 0) {
                if ($scannedCount > $expectedQuantity) {
                    $quantityStatus = 'exceeded';
                } elseif ($scannedCount >= $expectedQuantity) {
                    $quantityStatus = 'reached';
                }
            }
        } else {
            $session->increment('mismatch_count');
            $scannedCount = $movementItem?->scanned_count ?? 0;
        }

        return [
            'event' => $event->load('detectedMaterial'),
            'session' => $session->fresh(['material', 'materialSize']),
            'feedback' => $isMatch ? 'match' : 'mismatch',
            'detection' => $detection,
            'quantity_status' => $quantityStatus,
            'expected_quantity' => $expectedQuantity,
            'scanned_count' => $scannedCount ?? ($movementItem?->scanned_count ?? 0),
        ];
    }
}
