<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Pterodactyl\Models\Server;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Services\EggChanger\EggChangerService;
use Pterodactyl\Http\Requests\Api\Client\Servers\EggChange\GetAvailableEggsRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\EggChange\ChangeEggRequest;

class EggChangeController extends ClientApiController
{
    public function __construct(
        private EggChangerService $eggChangerService,
    ) {
        parent::__construct();
    }

    public function status(GetAvailableEggsRequest $request, Server $server): JsonResponse
    {
        if (!EggChangerService::isEnabled()) {
            return response()->json([
                'enabled' => false,
                'eggs' => [],
                'current_egg_id' => $server->egg_id,
                'always_reinstall' => false,
                'always_change_startup' => false,
            ]);
        }

        $availableEggs = $this->eggChangerService->getAvailableEggsForServer($server);

        $srvConfig = EggChangerService::getEggSrvConfig($server->egg_id);

        $eggSrvConfigs = [];
        foreach ($availableEggs as $egg) {
            $eggSrvConfigs[$egg['id']] = EggChangerService::getEggSrvConfig($egg['id']);
        }

        $allocation = $server->allocation;

        return response()->json([
            'enabled' => true,
            'eggs' => $availableEggs,
            'current_egg_id' => $server->egg_id,
            'current_egg_name' => $server->egg?->name ?? 'Unknown',
            'always_reinstall' => EggChangerService::isAlwaysReinstall(),
            'always_change_startup' => EggChangerService::isAlwaysChangeStartup(),
            'nest_locked' => EggChangerService::isNestLocked(),
            'srv_config' => $srvConfig,
            'egg_srv_configs' => (object) $eggSrvConfigs,
            'connection_display_mode' => $srvConfig['connection_display_mode'] ?? 'srv',
            'allocation_ip' => $allocation?->ip_alias ?? $allocation?->ip ?? '',
            'allocation_port' => $allocation?->port ?? 0,
        ]);
    }

    public function change(ChangeEggRequest $request, Server $server): JsonResponse
    {
        if (!EggChangerService::isEnabled()) {
            return response()->json(['error' => 'Egg Changer addon is disabled.'], 403);
        }

        $eggId = (int) $request->input('egg_id');
        $reinstall = (bool) $request->input('reinstall', false);
        $changeStartup = (bool) $request->input('change_startup', false);
        $clearFiles = (bool) $request->input('clear_files', false);

        $oldEggName = $server->egg?->name ?? 'Unknown';

        $server = $this->eggChangerService->changeEgg($server, $eggId, $reinstall, $changeStartup, $clearFiles);

        $newEggName = $server->egg?->name ?? 'Unknown';

        Activity::event('server:egg.change')
            ->property([
                'old_egg' => $oldEggName,
                'new_egg' => $newEggName,
                'reinstall' => $reinstall || EggChangerService::isAlwaysReinstall(),
                'change_startup' => $changeStartup || EggChangerService::isAlwaysChangeStartup(),
                'clear_files' => $clearFiles,
            ])
            ->log();

        return response()->json([
            'success' => true,
            'message' => 'Egg changed successfully.',
            'new_egg_id' => $server->egg_id,
            'new_egg_name' => $newEggName,
            'reinstalled' => $reinstall || EggChangerService::isAlwaysReinstall(),
            'files_cleared' => $clearFiles,
        ]);
    }
}
