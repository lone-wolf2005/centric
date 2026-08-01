<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MaterialSize extends Model
{
    protected $fillable = [
        'material_id',
        'label',
        'rate_per_month',
        'rate_per_day',
        'unit',
    ];

    protected function casts(): array
    {
        return [
            'rate_per_month' => 'decimal:2',
            'rate_per_day' => 'decimal:6',
        ];
    }

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class);
    }
}
