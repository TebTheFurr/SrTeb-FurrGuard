<?php

namespace Pterodactyl\Services\Servers;

use Pterodactyl\Models\Server;
use Pterodactyl\Models\ServerVariable;
use Pterodactyl\Models\Allocation;
use Pterodactyl\Services\Servers\ServerCreationService;

class ServerCloningService
{
    public function __construct(
        private ServerCreationService $creationService
    ) {
    }

    public function handle(Server $server): Server
    {
        $originalVariables = ServerVariable::where('server_id', $server->id)->get();

        $environment = [];
        foreach ($originalVariables as $variable) {
            $eggVariable = $variable->variable;
            if ($eggVariable) {
                $environment[$eggVariable->env_variable] = $variable->variable_value;
            }
        }

        $data = [
            'name' => 'Copy of ' . $server->name,
            'description' => $server->description,
            'owner_id' => $server->owner_id,
            'nest_id' => $server->nest_id,
            'egg_id' => $server->egg_id,
            'memory' => $server->memory,
            'swap' => $server->swap,
            'disk' => $server->disk,
            'io' => $server->io,
            'cpu' => $server->cpu,
            'threads' => $server->threads,
            'oom_disabled' => $server->oom_disabled,
            'startup' => $server->startup,
            'image' => $server->image,
            'database_limit' => $server->database_limit,
            'allocation_limit' => $server->allocation_limit,
            'backup_limit' => $server->backup_limit,
            'subdomain_limit' => $server->subdomain_limit,
            'reverse_proxy_limit' => $server->reverse_proxy_limit,
            'split_limit' => $server->split_limit,
            'skip_scripts' => $server->skip_scripts,
            'environment' => $environment,
        ];

        if ($server->external_id) {
            $data['external_id'] = $server->external_id . '-clone-' . time();
        }

        $data['allocation_id'] = $this->findAvailableAllocation($server->node_id);
        $data['node_id'] = $server->node_id;

        $newServer = $this->creationService->handle($data);

        return $newServer;
    }

    protected function findAvailableAllocation(int $nodeId): int
    {
        $allocation = Allocation::where('node_id', $nodeId)
            ->whereNull('server_id')
            ->first();

        if (!$allocation) {
            throw new \Exception('No available allocations on the node.');
        }

        return $allocation->id;
    }
}
