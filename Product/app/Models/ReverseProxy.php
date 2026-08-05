<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReverseProxy extends Model
{
    public const RESOURCE_NAME = 'reverse_proxy';

    public const STATUS_PENDING = 'pending';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_FAILED = 'failed';
    public const STATUS_DELETING = 'deleting';

    public const PROXY_TYPE_NGINX = 'nginx';
    public const PROXY_TYPE_TRAEFIK = 'traefik';

    public const SSL_TYPE_NONE = 'none';
    public const SSL_TYPE_CERTBOT = 'certbot';
    public const SSL_TYPE_CLOUDFLARE_ORIGIN = 'cloudflare_origin';

    protected $table = 'reverse_proxies';

    protected $fillable = [
        'server_id',
        'allocation_id',
        'domain',
        'proxy_type',
        'ssl_enabled',
        'ssl_type',
        'ssl_certificate_path',
        'ssl_key_path',
        'config_file_path',
        'cloudflare_record_id',
        'status',
        'error_message',
        'dns_verified_at',
        'created_by',
    ];

    protected $casts = [
        'server_id' => 'integer',
        'allocation_id' => 'integer',
        'ssl_enabled' => 'boolean',
        'dns_verified_at' => 'datetime',
        'created_by' => 'integer',
    ];

    public static array $validationRules = [
        'server_id' => 'required|integer|exists:servers,id',
        'allocation_id' => 'required|integer|exists:allocations,id',
        'domain' => 'required|string|max:255|unique:reverse_proxies,domain',
        'proxy_type' => 'required|in:nginx,traefik',
        'ssl_enabled' => 'boolean',
        'ssl_type' => 'required|in:none,certbot,cloudflare_origin',
        'created_by' => 'required|integer|exists:users,id',
    ];

    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    public function allocation(): BelongsTo
    {
        return $this->belongsTo(Allocation::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeActive($query)
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    public function scopePending($query)
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    public function scopeFailed($query)
    {
        return $query->where('status', self::STATUS_FAILED);
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function isDnsVerified(): bool
    {
        return $this->dns_verified_at !== null;
    }

    public function isFailed(): bool
    {
        return $this->status === self::STATUS_FAILED;
    }
}
