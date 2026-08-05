<?php

namespace Pterodactyl\Transformers\Api\Client;

use Pterodactyl\Models\Egg;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Subuser;
use League\Fractal\Resource\Item;
use Pterodactyl\Models\Allocation;
use Pterodactyl\Models\Permission;
use Illuminate\Container\Container;
use Pterodactyl\Models\EggVariable;
use League\Fractal\Resource\Collection;
use League\Fractal\Resource\NullResource;
use Pterodactyl\Services\Servers\StartupCommandService;

class ServerTransformer extends BaseClientTransformer
{
    protected array $defaultIncludes = ['allocations', 'variables'];

    protected array $availableIncludes = ['egg', 'subusers'];

    public function getResourceName(): string
    {
        return Server::RESOURCE_NAME;
    }

    /**
     * Transform a server model into a representation that can be returned
     * to a client.
     */
    public function transform(Server $server): array
    {
        /** @var StartupCommandService $service */
        $service = Container::getInstance()->make(StartupCommandService::class);

        $user = $this->request->user();

        $primarySubdomain = $this->getPrimarySubdomain($server);

        $sftpHost = $this->getSftpHost($server);

        return [
            'server_owner' => $user->id === $server->owner_id,
            'identifier' => $server->uuidShort,
            'internal_id' => $server->id,
            'external_id' => $user->id === $server->owner_id ? $server->external_id : null,
            'uuid' => $server->uuid,
            'name' => $server->name,
            'node' => $server->node->name,
            'node_id' => $server->node_id,
            'node_location' => $server->node->location?->short,
            'is_node_under_maintenance' => $server->node->isUnderMaintenance(),
            'sftp_details' => [
                'ip' => $sftpHost,
                'port' => $server->node->daemonSFTP,
            ],
            'description' => $server->description,
            'limits' => [
                'memory' => $server->memory,
                'swap' => $server->swap,
                'disk' => $server->disk,
                'io' => $server->io,
                'cpu' => $server->cpu,
                'threads' => $server->threads,
                'oom_disabled' => $server->oom_disabled,
            ],
            'invocation' => $service->handle($server, !$user->can(Permission::ACTION_STARTUP_READ, $server)),
            'docker_image' => $server->image,
            'egg_features' => $server->egg->inherit_features,
            'feature_limits' => [
                'databases' => $server->database_limit,
                'allocations' => $server->allocation_limit,
                'backups' => $server->backup_limit,
                'subdomains' => $server->subdomain_limit,
                'reverse_proxies' => $server->reverse_proxy_limit,
            ],
            'status' => $server->status,
            'egg_id' => $server->egg_id,
            'primary_subdomain' => $primarySubdomain,
            // This field is deprecated, please use "status".
            'is_suspended' => $server->isSuspended(),
            // This field is deprecated, please use "status".
            'is_installing' => !$server->isInstalled(),
            'is_transferring' => !is_null($server->transfer),
        ];
    }

    protected function getSftpHost(Server $server): string
    {
        if (!class_exists(\Pterodactyl\Models\ThemeSettings::class)) {
            return $server->node->fqdn;
        }

        $overrides = \Pterodactyl\Models\ThemeSettings::getValue('advanced.sftp_host_overrides', []);

        if (!is_array($overrides)) {
            return $server->node->fqdn;
        }

        $nodeId = (string) $server->node_id;

        foreach ($overrides as $override) {
            if (!is_array($override)) {
                continue;
            }

            $overrideNodeId = (string) ($override['node_id'] ?? '');
            $enabled = (bool) ($override['enabled'] ?? false);
            $host = trim((string) ($override['host'] ?? ''));

            if ($overrideNodeId === $nodeId && $enabled && $host !== '') {
                return $host;
            }
        }

        return $server->node->fqdn;
    }

    protected function getPrimarySubdomain(Server $server): ?string
    {
        if (!class_exists(\Pterodactyl\Models\Subdomain::class)) {
            return null;
        }

        $subdomain = \Pterodactyl\Models\Subdomain::where('server_id', $server->id)
            ->where('allocation_id', $server->allocation_id)
            ->with('allocation')
            ->first();

        if (!$subdomain) {
            return null;
        }

        $port = $subdomain->allocation?->port;
        $hasSrvRecord = $subdomain->cloudflare_record_id && $subdomain->cloudflare_record_id !== $subdomain->cloudflare_a_record_id;

        if (($subdomain->proxied ?? false) || !empty($subdomain->reverse_proxy_id)) {
            return $subdomain->full_domain;
        }

        if (class_exists(\Pterodactyl\Services\EggChanger\EggChangerService::class)) {
            $eggConfig = \Pterodactyl\Services\EggChanger\EggChangerService::getEggSrvConfig($server->egg_id);
            $connectionDisplayMode = $eggConfig['connection_display_mode'] ?? 'srv';

            if ($connectionDisplayMode === 'ip_port' && $port) {
                return "{$subdomain->full_domain}:{$port}";
            }

            if ($connectionDisplayMode === 'srv' && $hasSrvRecord) {
                return $subdomain->full_domain;
            }
        }

        if ($hasSrvRecord || !$port) {
            return $subdomain->full_domain;
        }

        return "{$subdomain->full_domain}:{$port}";
    }

    /**
     * Returns the allocations associated with this server.
     *
     * @throws \Pterodactyl\Exceptions\Transformer\InvalidTransformerLevelException
     */
    public function includeAllocations(Server $server): Collection
    {
        $transformer = $this->makeTransformer(AllocationTransformer::class);

        $user = $this->request->user();
        // While we include this permission, we do need to actually handle it slightly different here
        // for the purpose of keeping things functionally working. If the user doesn't have read permissions
        // for the allocations we'll only return the primary server allocation, and any notes associated
        // with it will be hidden.
        //
        // This allows us to avoid too much permission regression, without also hiding information that
        // is generally needed for the frontend to make sense when browsing or searching results.
        if (!$user->can(Permission::ACTION_ALLOCATION_READ, $server)) {
            $primary = clone $server->allocation;
            $primary->notes = null;

            return $this->collection([$primary], $transformer, Allocation::RESOURCE_NAME);
        }

        return $this->collection($server->allocations, $transformer, Allocation::RESOURCE_NAME);
    }

    /**
     * @throws \Pterodactyl\Exceptions\Transformer\InvalidTransformerLevelException
     */
    public function includeVariables(Server $server): Collection|NullResource
    {
        if (!$this->request->user()->can(Permission::ACTION_STARTUP_READ, $server)) {
            return $this->null();
        }

        return $this->collection(
            $server->variables->where('user_viewable', true),
            $this->makeTransformer(EggVariableTransformer::class),
            EggVariable::RESOURCE_NAME
        );
    }

    /**
     * Returns the egg associated with this server.
     *
     * @throws \Pterodactyl\Exceptions\Transformer\InvalidTransformerLevelException
     */
    public function includeEgg(Server $server): Item
    {
        return $this->item($server->egg, $this->makeTransformer(EggTransformer::class), Egg::RESOURCE_NAME);
    }

    /**
     * Returns the subusers associated with this server.
     *
     * @throws \Pterodactyl\Exceptions\Transformer\InvalidTransformerLevelException
     */
    public function includeSubusers(Server $server): Collection|NullResource
    {
        if (!$this->request->user()->can(Permission::ACTION_USER_READ, $server)) {
            return $this->null();
        }

        return $this->collection($server->subusers, $this->makeTransformer(SubuserTransformer::class), Subuser::RESOURCE_NAME);
    }
}
