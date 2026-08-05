<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Subdomain extends Model
{
    public const RESOURCE_NAME = 'subdomain';

    protected $table = 'subdomains';

    protected $fillable = [
        'server_id',
        'allocation_id',
        'reverse_proxy_id',
        'subdomain',
        'domain',
        'full_domain',
        'cloudflare_record_id',
        'cloudflare_a_record_id',
        'proxied',
        'created_by',
    ];

    protected $casts = [
        'server_id' => 'integer',
        'allocation_id' => 'integer',
        'reverse_proxy_id' => 'integer',
        'proxied' => 'boolean',
        'created_by' => 'integer',
    ];

    public static array $validationRules = [
        'server_id' => 'required|integer|exists:servers,id',
        'allocation_id' => 'required|integer|exists:allocations,id',
        'reverse_proxy_id' => 'nullable|integer|exists:reverse_proxies,id',
        'subdomain' => 'required|string|min:1|max:63|regex:/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i',
        'domain' => 'required|string|max:191',
        'full_domain' => 'required|string|max:255|unique:subdomains,full_domain',
        'cloudflare_record_id' => 'nullable|string|max:191',
        'proxied' => 'boolean',
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

    public function reverseProxy(): BelongsTo
    {
        return $this->belongsTo(ReverseProxy::class, 'reverse_proxy_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
