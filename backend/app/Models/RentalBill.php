<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RentalBill extends Model
{
    protected $fillable = [
        'bill_no',
        'location_id',
        'site_name',
        'period_start',
        'period_end',
        'centering_total',
        'scaffolding_total',
        'grand_total',
        'status',
        'generated_by',
        'raised_at',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'centering_total' => 'decimal:2',
            'scaffolding_total' => 'decimal:2',
            'grand_total' => 'decimal:2',
            'raised_at' => 'datetime',
        ];
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function generator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'generated_by');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(RentalBillLine::class);
    }
}
