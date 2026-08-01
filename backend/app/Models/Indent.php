<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Indent extends Model
{
    protected $fillable = [
        'indent_no',
        'project_name',
        'site_name',
        'status',
        'created_by',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(IndentItem::class);
    }

    public function movements(): HasMany
    {
        return $this->hasMany(MaterialMovement::class);
    }
}
