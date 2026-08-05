<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SignupOfferClaim extends Model
{
    protected $table = 'signup_offer_claims';

    public const STATUS_PENDING = 'pending';
    public const STATUS_CLAIMED = 'claimed';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_SERVER_EXPIRED = 'server_expired';

    protected $fillable = [
        'offer_id',
        'user_id',
        'server_id',
        'status',
        'claimed_at',
        'claim_expires_at',
        'server_expires_at',
        'server_expiry_days_override',
    ];

    protected $casts = [
        'claimed_at' => 'datetime',
        'claim_expires_at' => 'datetime',
        'server_expires_at' => 'datetime',
        'server_expiry_days_override' => 'integer',
    ];

    public function offer(): BelongsTo
    {
        return $this->belongsTo(SignupOffer::class, 'offer_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function isClaimExpired(): bool
    {
        if (!$this->claim_expires_at) {
            return false;
        }

        return $this->claim_expires_at->isPast();
    }
}
