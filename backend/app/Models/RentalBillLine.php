<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RentalBillLine extends Model
{
    protected $fillable = [
        'rental_bill_id',
        'material_id',
        'material_size_id',
        'particulars',
        'category_group',
        'unit',
        'quantity',
        'start_date',
        'end_date',
        'days',
        'total_consumed',
        'rate_per_month',
        'rate_per_day',
        'amount',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'rate_per_month' => 'decimal:2',
            'rate_per_day' => 'decimal:6',
            'amount' => 'decimal:2',
        ];
    }

    public function bill(): BelongsTo
    {
        return $this->belongsTo(RentalBill::class, 'rental_bill_id');
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
