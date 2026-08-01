<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScanEvent extends Model
{
    protected $fillable = [
        'scan_session_id',
        'detected_material_id',
        'expected_size_id',
        'is_match',
        'size_mismatch',
        'confidence',
        'feedback',
        'action_taken',
        'manually_verified',
        'scanned_at',
    ];

    protected function casts(): array
    {
        return [
            'is_match' => 'boolean',
            'size_mismatch' => 'boolean',
            'manually_verified' => 'boolean',
            'scanned_at' => 'datetime',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(ScanSession::class, 'scan_session_id');
    }

    public function detectedMaterial(): BelongsTo
    {
        return $this->belongsTo(Material::class, 'detected_material_id');
    }

    public function expectedSize(): BelongsTo
    {
        return $this->belongsTo(MaterialSize::class, 'expected_size_id');
    }
}
