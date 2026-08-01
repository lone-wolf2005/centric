<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ScanSession extends Model
{
    protected $fillable = [
        'material_movement_id',
        'material_id',
        'material_size_id',
        'status',
        'matched_count',
        'mismatch_count',
    ];

    public function movement(): BelongsTo
    {
        return $this->belongsTo(MaterialMovement::class, 'material_movement_id');
    }

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class);
    }

    public function materialSize(): BelongsTo
    {
        return $this->belongsTo(MaterialSize::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(ScanEvent::class);
    }
}
