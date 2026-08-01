<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Quotation extends Model
{
    protected $fillable = [
        'quote_no',
        'revision',
        'customer_name',
        'site_name',
        'status',
        'estimated_amount',
        'valid_until',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'valid_until' => 'date',
            'estimated_amount' => 'decimal:2',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(QuotationItem::class);
    }

    public function movements(): HasMany
    {
        return $this->hasMany(MaterialMovement::class);
    }
}
