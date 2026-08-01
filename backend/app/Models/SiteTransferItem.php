<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SiteTransferItem extends Model
{
    protected $fillable = [
        'site_transfer_id',
        'material_id',
        'material_size_id',
        'quantity',
    ];

    public function siteTransfer(): BelongsTo
    {
        return $this->belongsTo(SiteTransfer::class);
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
