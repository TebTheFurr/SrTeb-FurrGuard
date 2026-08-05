<?php

namespace Pterodactyl\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

class Announcement extends Model
{
    protected $fillable = [
        'enabled',
        'variation',
        'placement',
        'type',
        'icon',
        'title',
        'text',
        'button_label',
        'button_link',
        'egg_ids',
        'node_ids',
        'is_permanent',
        'expires_at',
        'order',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'egg_ids' => 'array',
        'node_ids' => 'array',
        'is_permanent' => 'boolean',
        'expires_at' => 'datetime',
    ];

    public function isActive(): bool
    {
        if (!$this->enabled) {
            return false;
        }

        if ($this->is_permanent) {
            return true;
        }

        if ($this->expires_at === null) {
            return true;
        }

        return Carbon::now()->lessThan($this->expires_at);
    }

    public function scopeActive($query)
    {
        return $query->where('enabled', true)
            ->where(function ($q) {
                $q->where('is_permanent', true)
                    ->orWhere(function ($subQuery) {
                        $subQuery->where('is_permanent', false)
                            ->where(function ($expiryQuery) {
                                $expiryQuery->whereNull('expires_at')
                                    ->orWhere('expires_at', '>', Carbon::now());
                            });
                    });
            });
    }

    public function scopeForNode($query, int $nodeId)
    {
        return $query->where(function ($q) use ($nodeId) {
            $q->whereNull('node_ids')
                ->orWhereJsonLength('node_ids', 0)
                ->orWhereJsonContains('node_ids', $nodeId);
        });
    }

    public function scopeForEggs($query, array $eggIds)
    {
        if (empty($eggIds)) {
            return $query;
        }

        return $query->where(function ($q) use ($eggIds) {
            $q->whereNull('egg_ids')
                ->orWhereJsonLength('egg_ids', 0)
                ->orWhere(function ($subQuery) use ($eggIds) {
                    foreach ($eggIds as $eggId) {
                        $subQuery->orWhereJsonContains('egg_ids', $eggId);
                    }
                });
        });
    }
}
