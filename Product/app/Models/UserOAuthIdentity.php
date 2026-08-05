<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserOAuthIdentity extends Model
{
    protected $table = 'user_oauth_identities';

    protected $fillable = [
        'user_id',
        'oauth_provider_id',
        'provider_user_id',
        'provider_email',
        'provider_name',
        'provider_avatar',
    ];

    public static array $validationRules = [
        'user_id' => 'required|integer|exists:users,id',
        'oauth_provider_id' => 'required|integer|exists:oauth_providers,id',
        'provider_user_id' => 'required|string|max:191',
        'provider_email' => 'nullable|email|max:191',
        'provider_name' => 'nullable|string|max:191',
        'provider_avatar' => 'nullable|string|max:2048',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(OAuthProvider::class, 'oauth_provider_id');
    }

    public function toClientArray(): array
    {
        return [
            'id' => $this->id,
            'provider' => $this->provider?->toPublicArray(),
            'provider_email' => $this->provider_email,
            'provider_name' => $this->provider_name,
            'provider_avatar' => $this->provider_avatar,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
