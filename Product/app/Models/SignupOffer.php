<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SignupOffer extends Model
{
    public const AVAILABILITY_REGISTER = 'register';
    public const AVAILABILITY_ALL_USERS = 'all_users';

    protected $table = 'signup_offers';

    protected $fillable = [
        'name',
        'description',
        'server_name_template',
        'server_description',
        'egg_id',
        'nest_id',
        'location_ids',
        'dedicated_ip',
        'memory',
        'swap',
        'disk',
        'io',
        'cpu',
        'threads',
        'oom_disabled',
        'database_limit',
        'allocation_limit',
        'backup_limit',
        'startup',
        'image',
        'environment',
        'start_on_completion',
        'availability_type',
        'target_type',
        'target_users',
        'claim_expiry_days',
        'server_expiry_days',
        'enabled',
    ];

    protected $casts = [
        'location_ids' => 'array',
        'dedicated_ip' => 'boolean',
        'memory' => 'integer',
        'swap' => 'integer',
        'disk' => 'integer',
        'io' => 'integer',
        'cpu' => 'integer',
        'oom_disabled' => 'boolean',
        'database_limit' => 'integer',
        'allocation_limit' => 'integer',
        'backup_limit' => 'integer',
        'environment' => 'array',
        'start_on_completion' => 'boolean',
        'target_users' => 'array',
        'claim_expiry_days' => 'integer',
        'server_expiry_days' => 'integer',
        'enabled' => 'boolean',
    ];

    public function egg(): BelongsTo
    {
        return $this->belongsTo(Egg::class);
    }

    public function nest(): BelongsTo
    {
        return $this->belongsTo(Nest::class);
    }

    public function claims(): HasMany
    {
        return $this->hasMany(SignupOfferClaim::class, 'offer_id');
    }

    public function isAvailableForUser(User $user): bool
    {
        if ($this->target_type === 'specific') {
            return in_array($user->id, $this->target_users ?? []);
        }

        return true;
    }
}
