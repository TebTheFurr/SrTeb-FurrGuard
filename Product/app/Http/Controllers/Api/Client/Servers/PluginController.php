<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Pterodactyl\Models\Server;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\Servers\Plugins\SearchPluginsRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Plugins\GetPluginVersionsRequest;

class PluginController extends ClientApiController
{
    private const SERVICE_CLASS = 'Pterodactyl\Services\Plugins\PluginSearchService';

    public function __construct()
    {
        parent::__construct();
    }

    private function isServiceAvailable(): bool
    {
        return class_exists(self::SERVICE_CLASS);
    }

    private function getService()
    {
        if (!$this->isServiceAvailable()) {
            return null;
        }

        return app(self::SERVICE_CLASS);
    }

    public function status(): JsonResponse
    {
        return new JsonResponse([
            'installed' => $this->isServiceAvailable(),
        ]);
    }

    public function search(SearchPluginsRequest $request, Server $server): JsonResponse
    {
        $service = $this->getService();

        if ($service === null) {
            return new JsonResponse([
                'error' => 'Plugin Installer addon is not installed.',
                'installed' => false,
            ], 503);
        }

        $result = $service->search([
            'query' => $request->input('query', ''),
            'platforms' => $request->input('platforms', ['modrinth', 'hangar', 'spigot']),
            'gameVersion' => $request->input('gameVersion'),
            'loader' => $request->input('loader'),
            'page' => $request->input('page', 1),
            'pageSize' => $request->input('pageSize', 20),
        ]);

        return new JsonResponse($result);
    }

    public function versions(GetPluginVersionsRequest $request, Server $server): JsonResponse
    {
        $service = $this->getService();

        if ($service === null) {
            return new JsonResponse([
                'error' => 'Plugin Installer addon is not installed.',
                'installed' => false,
            ], 503);
        }

        $versions = $service->getVersions(
            $request->input('platform'),
            $request->input('pluginId'),
            $request->input('gameVersion'),
            $request->input('loader')
        );

        return new JsonResponse(['versions' => $versions]);
    }

    public function minecraftVersions(): JsonResponse
    {
        $service = $this->getService();

        if ($service === null) {
            return new JsonResponse([
                'error' => 'Plugin Installer addon is not installed.',
                'installed' => false,
            ], 503);
        }

        $versions = $service->getMinecraftVersions();

        return new JsonResponse(['versions' => $versions]);
    }
}
