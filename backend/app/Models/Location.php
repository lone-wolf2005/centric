<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Location extends Model
{
    protected $fillable = ['name', 'type', 'address', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function outgoingMovements(): HasMany
    {
        return $this->hasMany(MaterialMovement::class, 'source_location_id');
    }

    public function incomingMovements(): HasMany
    {
        return $this->hasMany(MaterialMovement::class, 'destination_location_id');
    }

    public function stockBalances(): HasMany
    {
        return $this->hasMany(StockBalance::class);
    }

    public function rentalBills(): HasMany
    {
        return $this->hasMany(RentalBill::class);
    }
}
