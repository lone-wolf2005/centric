<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class MaterialMovement extends Model
{
    protected $fillable = [
        'type',
        'tally_order_id',
        'quotation_id',
        'indent_id',
        'dc_number',
        'grn_number',
        'linked_dc_number',
        'supervisor_id',
        'destination',
        'source_location_id',
        'destination_location_id',
        'status',
        'return_condition',
        'approval_status',
        'receiver_confirmed_by',
        'receiver_confirmed_at',
        'notes',
        'started_at',
        'completed_at',
        'due_date',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'receiver_confirmed_at' => 'datetime',
            'due_date' => 'date',
        ];
    }

    public function tallyOrder(): BelongsTo
    {
        return $this->belongsTo(TallyOrder::class);
    }

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class);
    }

    public function indent(): BelongsTo
    {
        return $this->belongsTo(Indent::class);
    }

    public function supervisor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supervisor_id');
    }

    public function sourceLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'source_location_id');
    }

    public function destinationLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'destination_location_id');
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'receiver_confirmed_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(MovementItem::class);
    }

    public function scanSessions(): HasMany
    {
        return $this->hasMany(ScanSession::class);
    }

    public function approvals(): MorphMany
    {
        return $this->morphMany(Approval::class, 'approvable');
    }
}
