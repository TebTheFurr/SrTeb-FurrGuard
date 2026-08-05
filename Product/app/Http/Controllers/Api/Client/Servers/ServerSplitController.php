<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\Server;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;
use Pterodactyl\Services\ServerSplitter\ServerSplitterService;

class ServerSplitController extends ClientApiController
{
    public function __construct(private ServerSplitterService $splitter)
    {
        parent::__construct();
    }

    public function index(ClientApiRequest $request, Server $server): JsonResponse
    {
        $this->splitter->assertCanManageParent($server, $request->user());

        if (!ServerSplitterService::isEnabled()) {
            return response()->json([
                'status' => [
                    'enabled' => false,
                    'message' => 'Server Splitter addon is disabled.',
                ],
                'usage' => null,
                'splits' => [],
            ]);
        }

        if (ServerSplitterService::isSplit($server)) {
            return response()->json([
                'status' => [
                    'enabled' => false,
                    'message' => 'You cannot split this server because it is already a split.',
                ],
                'usage' => null,
                'splits' => [],
            ]);
        }

        return response()->json([
            'status' => $this->buildStatusPayload($server),
            'usage' => $this->splitter->getParentUsage($server),
            'splits' => $this->splitter->listSplits($server),
        ]);
    }

    public function store(ClientApiRequest $request, Server $server): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|min:1|max:191',
            'description' => 'nullable|string|max:191',
            'egg_id' => 'required|integer|exists:eggs,id',
            'memory' => 'required|integer|min:1',
            'cpu' => 'required|integer|min:1',
            'disk' => 'required|integer|min:1',
            'allocations' => 'sometimes|integer|min:1',
            'database_limit' => 'sometimes|integer|min:0',
            'backup_limit' => 'sometimes|integer|min:0',
            'swap' => 'sometimes|integer|min:-1',
            'io' => 'sometimes|integer|min:10|max:1000',
            'threads' => 'nullable|string',
            'docker_image' => 'nullable|string|max:191',
            'startup' => 'nullable|string',
            'environment' => 'sometimes|array',
            'skip_scripts' => 'sometimes|boolean',
            'oom_disabled' => 'sometimes|boolean',
            'start_on_completion' => 'sometimes|boolean',
        ]);

        $this->splitter->createSplit($server, $request->user(), $data);
        $server->refresh();

        return response()->json([
            'status' => $this->buildStatusPayload($server),
            'usage' => $this->splitter->getParentUsage($server),
            'splits' => $this->splitter->listSplits($server),
        ], 201);
    }

    public function delete(ClientApiRequest $request, Server $server, int $splitServerId): JsonResponse
    {
        $split = Server::query()->findOrFail($splitServerId);

        $this->splitter->deleteSplit($server, $split, $request->user(), $request->boolean('force'));

        return response()->json([], JsonResponse::HTTP_NO_CONTENT);
    }

    private function buildStatusPayload(Server $server): array
    {
        return [
            'enabled' => true,
            'users_may_delete' => ServerSplitterService::usersMayDelete(),
            'users_may_recreate' => ServerSplitterService::usersMayRecreate(),
            'limits' => [
                'max_splits' => ServerSplitterService::getIntSetting('max_splits', 5),
                'max_memory' => ServerSplitterService::getIntSetting('max_memory', 4096),
                'max_cpu' => ServerSplitterService::getIntSetting('max_cpu', 100),
                'max_disk' => ServerSplitterService::getIntSetting('max_disk', 10240),
                'max_allocations' => ServerSplitterService::getIntSetting('max_allocations', 1),
                'max_databases' => ServerSplitterService::getIntSetting('max_databases', 0),
                'max_backups' => ServerSplitterService::getIntSetting('max_backups', 0),
            ],
            'server_split_limit' => $server->split_limit,
            'parent_egg_id' => $server->egg_id,
            'split_eggs' => ServerSplitterService::getAvailableSplitEggs($server),
        ];
    }
}
