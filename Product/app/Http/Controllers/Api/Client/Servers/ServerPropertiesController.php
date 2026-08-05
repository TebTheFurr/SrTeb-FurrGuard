<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\Server;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Services\ServerProperties\ServerPropertiesService;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Pterodactyl\Services\Servers\FileAccessValidationService;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;
use Pterodactyl\Exceptions\Http\HttpForbiddenException;

class ServerPropertiesController extends ClientApiController
{
    public function __construct(
        private DaemonFileRepository $fileRepository,
        private FileAccessValidationService $fileAccessValidationService,
    ) {
        parent::__construct();
    }

    public function index(ClientApiRequest $request, Server $server): JsonResponse
    {
        if (!ServerPropertiesService::isEnabled()) {
            return response()->json([
                'error' => 'Server Properties Editor addon is disabled',
            ], 403);
        }

        if (!ServerPropertiesService::isEggAllowed($server->egg_id)) {
            return response()->json([
                'error' => 'This egg is not allowed to use the Server Properties Editor',
            ], 403);
        }

        $this->fileAccessValidationService->validateSubuserFileAccess($request->user(), $server, '/server.properties');

        try {
            $content = $this->fileRepository
                ->setServer($server)
                ->getContent('/server.properties', config('pterodactyl.files.max_edit_size'));

            $properties = ServerPropertiesService::parseProperties($content);
            $definitions = ServerPropertiesService::getPropertyDefinitions();

            return response()->json([
                'properties' => $properties,
                'definitions' => $definitions,
                'accessMode' => [
                    'file' => ServerPropertiesService::canAccessViaFile(),
                    'sidebar' => ServerPropertiesService::canAccessViaSidebar(),
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to read server.properties file',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    public function update(ClientApiRequest $request, Server $server): JsonResponse
    {
        if (!ServerPropertiesService::isEnabled()) {
            return response()->json([
                'error' => 'Server Properties Editor addon is disabled',
            ], 403);
        }

        if (!ServerPropertiesService::isEggAllowed($server->egg_id)) {
            return response()->json([
                'error' => 'This egg is not allowed to use the Server Properties Editor',
            ], 403);
        }

        $this->fileAccessValidationService->validateSubuserFileAccess($request->user(), $server, '/server.properties');

        $request->validate([
            'properties' => 'required|array',
        ]);

        $properties = $request->input('properties');
        $content = ServerPropertiesService::generatePropertiesContent($properties);

        try {
            $this->fileRepository
                ->setServer($server)
                ->putContent('/server.properties', $content);

            Activity::event('server:file.write')
                ->property('file', '/server.properties')
                ->log();

            return response()->json([
                'success' => true,
                'message' => 'Server properties updated successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to update server.properties file',
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}
