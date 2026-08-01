<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class SiteTransfer extends Model
{
    protected $fillable = [
        'transfer_no',
        'from_location_id',
        'to_location_id',
        'status',
        'sender_approval',
        'receiver_approval',
        'authority_approval',
        'created_by',
        'notes',
    ];

    public function fromLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'from_location_id');
    }

    public function toLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'to_location_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(SiteTransferItem::class);
    }

    public function approvals(): MorphMany
    {
        return $this->morphMany(Approval::class, 'approvable');
    }
}
