<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IndentItem extends Model
{
    protected $fillable = [
        'indent_id',
        'material_id',
        'material_size_id',
        'quantity',
    ];

    public function indent(): BelongsTo
    {
        return $this->belongsTo(Indent::class);
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
