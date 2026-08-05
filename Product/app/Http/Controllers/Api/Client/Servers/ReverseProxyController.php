<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\ReverseProxy;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Exceptions\DisplayException;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\Servers\ReverseProxy\GetReverseProxiesRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\ReverseProxy\CreateReverseProxyRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\ReverseProxy\DeleteReverseProxyRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\ReverseProxy\CheckDomainRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\ReverseProxy\ConfirmReverseProxyDnsRequest;
use Pterodactyl\Jobs\ReverseProxy\ConfigureReverseProxyJob;
use Pterodactyl\Jobs\ReverseProxy\DeleteReverseProxyJob;

class ReverseProxyController extends ClientApiController
{
    private $reverseProxyService;

    public function __construct()
    {
        parent::__construct();
        $this->reverseProxyService = class_exists(\Pterodactyl\Services\ReverseProxy\ReverseProxyService::class)
            ? app(\Pterodactyl\Services\ReverseProxy\ReverseProxyService::class)
            : null;
    }

    public function index(GetReverseProxiesRequest $request, Server $server): JsonResponse
    {
        if (!$this->reverseProxyService) {
            return response()->json([
                'status' => [
                    'enabled' => false,
                    'configured' => false,
                    'proxy_type' => 'nginx',
                    'ssl_type' => 'none',
                    'max_per_server' => 0,
                    'egg_allowed' => false,
                ],
                'proxies' => [],
                'allocations' => $server->allocations->map(fn ($allocation) => [
                    'id' => $allocation->id,
                    'ip' => $allocation->ip,
                    'port' => $allocation->port,
                    'alias' => $allocation->alias,
                    'is_primary' => $allocation->id === $server->allocation_id,
                ])->toArray(),
            ]);
        }

        $status = $this->reverseProxyService::getStatus($server);
        $proxies = $this->reverseProxyService::getProxiesForServer($server);

        return response()->json([
            'status' => $status,
            'proxies' => $proxies,
            'allocations' => $server->allocations->map(fn ($allocation) => [
                'id' => $allocation->id,
                'ip' => $allocation->ip,
                'port' => $allocation->port,
                'alias' => $allocation->alias,
                'is_primary' => $allocation->id === $server->allocation_id,
            ])->toArray(),
        ]);
    }

    public function create(CreateReverseProxyRequest $request, Server $server): JsonResponse
    {
        if (!$this->reverseProxyService) {
            throw new DisplayException('Reverse Proxy Manager is not installed.');
        }

        if (!$this->reverseProxyService::isEnabled()) {
            throw new DisplayException('Reverse Proxy Manager is disabled.');
        }

        if (!$this->reverseProxyService::canUserCreateProxy($server, $request->user())) {
            throw new DisplayException('You do not have permission to create reverse proxies for this server.');
        }

        $allocation = $server->allocations()->where('id', $request->input('allocation_id'))->firstOrFail();

        if ($this->reverseProxyService::getExpectedDnsIp($allocation) === '') {
            throw new DisplayException('No valid IPv4 address could be determined for this allocation.');
        }

        $domain = $this->reverseProxyService::normalizeDomainInput($request->input('domain'));
        
        if (!$this->reverseProxyService::validateDomain($domain)) {
            throw new DisplayException('Invalid domain format.');
        }

        if (!$this->reverseProxyService::isDomainAvailable($domain)) {
            throw new DisplayException('This domain is already in use.');
        }

        $sslEnabled = $request->boolean('ssl_enabled', false);
        $sslType = $sslEnabled ? $this->reverseProxyService::getSslType() : ReverseProxy::SSL_TYPE_NONE;
        $expectedDnsIp = $this->reverseProxyService::getExpectedDnsIp($allocation);

        $proxy = ReverseProxy::create([
            'server_id' => $server->id,
            'allocation_id' => $allocation->id,
            'domain' => $domain,
            'proxy_type' => $this->reverseProxyService::getProxyType(),
            'ssl_enabled' => $sslEnabled,
            'ssl_type' => $sslType,
            'status' => ReverseProxy::STATUS_PENDING,
            'created_by' => $request->user()->id,
        ]);

        Activity::event('server:reverse_proxy.create')
            ->property(['domain' => $proxy->domain])
            ->log();

        return response()->json([
            'success' => true,
            'proxy' => [
                'id' => $proxy->id,
                'domain' => $proxy->domain,
                'proxy_type' => $proxy->proxy_type,
                'ssl_enabled' => $proxy->ssl_enabled,
                'ssl_type' => $proxy->ssl_type,
                'status' => $proxy->status,
                'dns_verified' => false,
                'expected_dns_ip' => $expectedDnsIp,
                'allocation' => [
                    'id' => $allocation->id,
                    'ip' => $allocation->ip,
                    'port' => $allocation->port,
                    'alias' => $allocation->alias,
                ],
                'created_at' => $proxy->created_at->toIso8601String(),
            ],
        ], 201);
    }

    public function confirmDns(ConfirmReverseProxyDnsRequest $request, Server $server, int $proxy): JsonResponse
    {
        if (!$this->reverseProxyService || !class_exists(\Pterodactyl\Models\ReverseProxy::class)) {
            throw new DisplayException('Reverse Proxy Manager is not installed.');
        }

        $proxyModel = ReverseProxy::where('id', $proxy)
            ->where('server_id', $server->id)
            ->with('allocation')
            ->firstOrFail();

        if ($proxyModel->status === ReverseProxy::STATUS_DELETING) {
            throw new DisplayException('This reverse proxy is currently being deleted.');
        }

        if ($proxyModel->status === ReverseProxy::STATUS_ACTIVE) {
            return response()->json([
                'success' => true,
                'message' => 'This reverse proxy is already active.',
            ]);
        }

        $allocation = $proxyModel->allocation;
        if (!$allocation) {
            throw new DisplayException('The selected allocation for this reverse proxy could not be found.');
        }

        $domainCheck = $this->reverseProxyService::getDomainCheck($proxyModel->domain, $allocation);
        if (!$domainCheck['dns_matches']) {
            throw new DisplayException("Add an A record for {$domainCheck['domain']} pointing to {$domainCheck['expected_ip']} before confirming.");
        }

        $proxyModel->forceFill([
            'status' => ReverseProxy::STATUS_PENDING,
            'error_message' => null,
            'dns_verified_at' => now(),
        ])->save();

        ConfigureReverseProxyJob::dispatch($proxyModel->id);

        Activity::event('server:reverse_proxy.confirm_dns')
            ->property(['domain' => $proxyModel->domain])
            ->log();

        return response()->json([
            'success' => true,
            'message' => 'DNS confirmed. Reverse proxy configuration has started.',
            'proxy' => $this->reverseProxyService::getProxiesForServer($server),
        ]);
    }

    public function delete(DeleteReverseProxyRequest $request, Server $server, int $proxy): JsonResponse
    {
        if (!$this->reverseProxyService || !class_exists(\Pterodactyl\Models\ReverseProxy::class)) {
            throw new DisplayException('Reverse Proxy Manager is not installed.');
        }

        $proxyModel = ReverseProxy::where('id', $proxy)
            ->where('server_id', $server->id)
            ->firstOrFail();

        $domain = $proxyModel->domain;

        try {
            $proxyModel->update(['status' => ReverseProxy::STATUS_DELETING]);
            
            DeleteReverseProxyJob::dispatch($proxyModel->id);
        } catch (\Exception $e) {
            Log::error("Failed to delete reverse proxy {$domain}: " . $e->getMessage());
            throw new DisplayException('Failed to delete reverse proxy. Please try again.');
        }

        Activity::event('server:reverse_proxy.delete')
            ->property(['domain' => $domain])
            ->log();

        return new JsonResponse([], JsonResponse::HTTP_NO_CONTENT);
    }

    public function checkDomain(CheckDomainRequest $request, Server $server): JsonResponse
    {
        if (!$this->reverseProxyService) {
            throw new DisplayException('Reverse Proxy Manager is not installed.');
        }

        $domain = $this->reverseProxyService::normalizeDomainInput($request->input('domain'));
        $allocationId = $request->input('allocation_id');
        $allocation = null;

        if ($allocationId) {
            $allocation = $server->allocations()->where('id', $allocationId)->firstOrFail();
            if ($this->reverseProxyService::getExpectedDnsIp($allocation) === '') {
                throw new DisplayException('No valid IPv4 address could be determined for this allocation.');
            }
        }

        return response()->json($this->reverseProxyService::getDomainCheck($domain, $allocation));
    }
}
