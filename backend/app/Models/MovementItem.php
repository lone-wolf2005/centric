<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MovementItem extends Model
{
    protected $fillable = [
        'material_movement_id',
        'material_id',
        'material_size_id',
        'quantity',
        'scanned_count',
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
}
