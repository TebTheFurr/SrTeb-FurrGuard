<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class OAuthProvider extends Model
{
    protected $table = 'oauth_providers';

    protected $fillable = [
        'provider_key',
        'provider_type',
        'client_id',
        'client_secret',
        'redirect_uri',
        'enabled',
        'order',
    ];

    protected $casts = [
        'client_secret' => 'encrypted',
        'enabled' => 'boolean',
        'order' => 'integer',
    ];

    public static array $validationRules = [
        'provider_key' => 'required|string|max:191|unique:oauth_providers,provider_key',
        'provider_type' => 'required|string|in:discord,google|unique:oauth_providers,provider_type',
        'client_id' => 'required|string|max:2048',
        'client_secret' => 'nullable|string',
        'redirect_uri' => 'nullable|url|max:2048',
        'enabled' => 'boolean',
        'order' => 'integer',
    ];

    protected $attributes = [
        'enabled' => true,
        'order' => 0,
    ];

    public function identities(): HasMany
    {
        return $this->hasMany(UserOAuthIdentity::class);
    }

    public function callbackUrl(): string
    {
        return $this->redirect_uri ?: route('auth.oauth.callback', ['provider' => $this->provider_key]);
    }

    public function preset(): array
    {
        return self::presets()[$this->provider_type] ?? [];
    }

    public function presetValue(string $key, mixed $default = null): mixed
    {
        return $this->preset()[$key] ?? $default;
    }

    public static function presets(): array
    {
        return [
            'discord' => [
                'name' => 'Discord',
                'provider_key' => 'discord',
                'authorization_url' => 'https://discord.com/oauth2/authorize',
                'token_url' => 'https://discord.com/api/oauth2/token',
                'user_url' => 'https://discord.com/api/users/@me',
                'scopes' => 'identify email',
                'user_id_path' => 'id',
                'user_email_path' => 'email',
                'user_name_path' => 'global_name,username',
                'user_avatar_path' => 'avatar',
                'user_email_verified_path' => 'verified',
                'icon' => 'discord',
                'button_colour' => '#5865F2',
            ],
            'google' => [
                'name' => 'Google',
                'provider_key' => 'google',
                'authorization_url' => 'https://accounts.google.com/o/oauth2/v2/auth',
                'token_url' => 'https://oauth2.googleapis.com/token',
                'user_url' => 'https://www.googleapis.com/oauth2/v3/userinfo',
                'scopes' => 'openid email profile',
                'user_id_path' => 'sub',
                'user_email_path' => 'email',
                'user_name_path' => 'name',
                'user_avatar_path' => 'picture',
                'user_email_verified_path' => 'email_verified',
                'icon' => 'google',
                'button_colour' => '#ffffff',
            ],
        ];
    }

    public function toPublicArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->presetValue('name', ucfirst((string) $this->provider_type)),
            'provider_key' => $this->provider_key,
            'provider_type' => $this->provider_type,
            'icon' => $this->presetValue('icon', 'key'),
            'button_colour' => $this->presetValue('button_colour', '#5865F2'),
            'redirect_uri' => $this->callbackUrl(),
        ];
    }

    public function toAdminArray(): array
    {
        return array_merge($this->toPublicArray(), [
            'client_id' => $this->client_id,
            'client_secret' => '',
            'has_client_secret' => !empty($this->client_secret),
            'redirect_uri' => $this->redirect_uri,
            'enabled' => $this->enabled,
            'order' => $this->order,
        ]);
    }
}
