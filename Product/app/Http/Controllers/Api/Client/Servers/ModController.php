<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Pterodactyl\Models\Server;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\Servers\Mods\SearchModsRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Mods\GetModVersionsRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Mods\GetModGameVersionsRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Mods\GetModCategoriesRequest;

class ModController extends ClientApiController
{
    private const SERVICE_CLASS = 'Pterodactyl\Services\Mods\ModSearchService';

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

    public function search(SearchModsRequest $request, Server $server): JsonResponse
    {
        $service = $this->getService();

        if ($service === null) {
            return new JsonResponse([
                'error' => 'Mod Installer addon is not installed.',
                'installed' => false,
            ], 503);
        }

        $result = $service->search([
            'game' => $request->input('game', 'minecraft'),
            'query' => $request->input('query', ''),
            'platforms' => $request->input('platforms', ['modrinth', 'curseforge']),
            'gameVersion' => $request->input('gameVersion'),
            'loader' => $request->input('loader'),
            'category' => $request->input('category'),
            'page' => $request->input('page', 1),
            'pageSize' => $request->input('pageSize', 20),
        ]);

        return new JsonResponse($result);
    }

    public function versions(GetModVersionsRequest $request, Server $server): JsonResponse
    {
        $service = $this->getService();

        if ($service === null) {
            return new JsonResponse([
                'error' => 'Mod Installer addon is not installed.',
                'installed' => false,
            ], 503);
        }

        $versions = $service->getVersions(
            $request->input('platform'),
            $request->input('modId'),
            $request->input('gameVersion'),
            $request->input('loader'),
            $request->input('game', 'minecraft')
        );

        return new JsonResponse(['versions' => $versions]);
    }

    public function gameVersions(GetModGameVersionsRequest $request): JsonResponse
    {
        $service = $this->getService();

        if ($service === null) {
            return new JsonResponse([
                'error' => 'Mod Installer addon is not installed.',
                'installed' => false,
            ], 503);
        }

        $versions = $service->getGameVersions($request->input('game', 'minecraft'));

        return new JsonResponse(['versions' => $versions]);
    }

    public function minecraftVersions(): JsonResponse
    {
        $service = $this->getService();

        if ($service === null) {
            return new JsonResponse([
                'error' => 'Mod Installer addon is not installed.',
                'installed' => false,
            ], 503);
        }

        $versions = $service->getMinecraftVersions();

        return new JsonResponse(['versions' => $versions]);
    }

    public function categories(GetModCategoriesRequest $request): JsonResponse
    {
        $service = $this->getService();

        if ($service === null) {
            return new JsonResponse([
                'error' => 'Mod Installer addon is not installed.',
                'installed' => false,
            ], 503);
        }

        $categories = $service->getCategories($request->input('game', 'minecraft'));

        return new JsonResponse(['categories' => $categories]);
    }
}
