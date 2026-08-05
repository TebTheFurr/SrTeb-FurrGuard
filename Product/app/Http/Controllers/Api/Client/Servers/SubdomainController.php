<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Pterodactyl\Models\Server;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Exceptions\DisplayException;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\Servers\Subdomains\GetSubdomainsRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Subdomains\CreateSubdomainRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Subdomains\DeleteSubdomainRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Subdomains\CheckSubdomainRequest;

class SubdomainController extends ClientApiController
{
    private $subdomainService;

    public function __construct()
    {
        parent::__construct();
        $this->subdomainService = class_exists(\Pterodactyl\Services\Subdomains\SubdomainService::class)
            ? app(\Pterodactyl\Services\Subdomains\SubdomainService::class)
            : null;
    }

    public function status(GetSubdomainsRequest $request, Server $server): JsonResponse
    {
        if (!$this->subdomainService) {
            return response()->json([
                'status' => [
                    'enabled' => false,
                    'configured' => false,
                    'domains' => [],
                    'maxPerServer' => 0,
                    'eggAllowed' => false,
                ],
                'subdomains' => [],
                'allocations' => $server->allocations->map(fn ($allocation) => [
                    'id' => $allocation->id,
                    'ip' => $allocation->ip,
                    'port' => $allocation->port,
                    'alias' => $allocation->alias,
                    'is_primary' => $allocation->id === $server->allocation_id,
                ])->toArray(),
            ]);
        }

        $status = $this->subdomainService->getStatus($server);
        $subdomains = $this->subdomainService->getSubdomainsForServer($server);
        $serverLimits = Server::query()->whereKey($server->id)->first(['subdomain_limit', 'allocation_limit']);
        if ($serverLimits) {
            if ($serverLimits->subdomain_limit !== null) {
                $status['maxPerServer'] = (int) $serverLimits->subdomain_limit;
            } elseif ($serverLimits->allocation_limit !== null) {
                $status['maxPerServer'] = (int) $serverLimits->allocation_limit;
            } else {
                $status['maxPerServer'] = $server->allocations()->count();
            }
        } else {
            $status['maxPerServer'] = $server->allocations()->count();
        }

        return response()->json([
            'status' => $status,
            'subdomains' => $subdomains,
            'allocations' => $server->allocations->map(fn ($allocation) => [
                'id' => $allocation->id,
                'ip' => $allocation->ip,
                'port' => $allocation->port,
                'alias' => $allocation->alias,
                'is_primary' => $allocation->id === $server->allocation_id,
            ])->toArray(),
        ]);
    }

    public function create(CreateSubdomainRequest $request, Server $server): JsonResponse
    {
        if (!$this->subdomainService) {
            throw new DisplayException('Subdomains Manager is not installed.');
        }

        $allocation = $server->allocations()->where('id', $request->input('allocation_id'))->firstOrFail();

        $subdomain = $this->subdomainService->createSubdomain(
            $server,
            $allocation,
            $request->input('subdomain'),
            $request->input('domain'),
            $request->user()->id
        );

        Activity::event('server:subdomain.create')
            ->property(['subdomain' => $subdomain->full_domain])
            ->log();

        return response()->json([
            'success' => true,
            'subdomain' => $subdomain->toArray(),
        ], 201);
    }

    public function delete(DeleteSubdomainRequest $request, Server $server, int $subdomain): JsonResponse
    {
        if (!$this->subdomainService || !class_exists(\Pterodactyl\Models\Subdomain::class)) {
            throw new DisplayException('Subdomains Manager is not installed.');
        }

        $subdomainModel = \Pterodactyl\Models\Subdomain::where('id', $subdomain)
            ->where('server_id', $server->id)
            ->firstOrFail();

        $fullDomain = $subdomainModel->full_domain;

        try {
            $this->subdomainService->deleteSubdomain($subdomainModel);
        } catch (\Exception $e) {
            Log::error("Failed to delete subdomain {$fullDomain}: " . $e->getMessage());
            throw new DisplayException('Failed to delete subdomain. Please try again.');
        }

        Activity::event('server:subdomain.delete')
            ->property(['subdomain' => $fullDomain])
            ->log();

        return new JsonResponse([], JsonResponse::HTTP_NO_CONTENT);
    }

    public function check(CheckSubdomainRequest $request, Server $server): JsonResponse
    {
        if (!$this->subdomainService) {
            throw new DisplayException('Subdomains Manager is not installed.');
        }

        $result = $this->subdomainService->checkSubdomainAvailability(
            $request->input('subdomain'),
            $request->input('domain')
        );

        return response()->json($result);
    }
}
