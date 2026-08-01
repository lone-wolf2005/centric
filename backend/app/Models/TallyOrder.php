<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TallyOrder extends Model
{
    protected $fillable = [
        'order_no',
        'type',
        'customer_name',
        'site_name',
        'status',
        'synced_at',
    ];

    protected function casts(): array
    {
        return [
            'synced_at' => 'datetime',
        ];
    }

    public function movements(): HasMany
    {
        return $this->hasMany(MaterialMovement::class);
    }
}
