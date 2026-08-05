<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Validator;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Models\Egg;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\ServerVariable;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\Servers\MinecraftVersions\GetMinecraftVersionBuildsRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\MinecraftVersions\GetMinecraftVersionVersionsRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\MinecraftVersions\SwitchMinecraftVersionRequest;
use Pterodactyl\Services\MinecraftVersions\MinecraftVersionManagerService;

class MinecraftVersionController extends ClientApiController
{
    public function __construct(
        private MinecraftVersionManagerService $service,
    ) {
        parent::__construct();
    }

    public function status(Server $server): JsonResponse
    {
        return new JsonResponse([
            'installed' => true,
            'enabled' => MinecraftVersionManagerService::isEnabled(),
            'detected' => $this->service->detectCurrentState($server),
        ]);
    }

    public function forks(): JsonResponse
    {
        return new JsonResponse([
            'forks' => MinecraftVersionManagerService::isEnabled() ? $this->service->getForks() : [],
        ]);
    }

    public function versions(GetMinecraftVersionVersionsRequest $request): JsonResponse
    {
        return new JsonResponse([
            'versions' => $this->service->getVersions($request->input('fork')),
        ]);
    }

    public function builds(GetMinecraftVersionBuildsRequest $request): JsonResponse
    {
        return new JsonResponse([
            'builds' => $this->service->getBuilds(
                $request->input('fork'),
                $request->input('minecraftVersion')
            ),
        ]);
    }

    public function switch(SwitchMinecraftVersionRequest $request, Server $server): JsonResponse
    {
        if (!MinecraftVersionManagerService::isEnabled()) {
            return new JsonResponse(['error' => 'Minecraft Version Manager addon is disabled.'], 403);
        }

        $selection = [
            'fork' => (string) $request->input('fork'),
            'minecraftVersion' => $request->input('minecraftVersion'),
            'versionName' => $request->input('versionName'),
            'buildId' => $request->input('buildId'),
            'buildName' => $request->input('buildName'),
            'downloadName' => $request->input('downloadName'),
            'buildType' => $request->input('buildType'),
            'javaVersion' => $request->input('javaVersion'),
        ];

        $targetEggId = $request->filled('targetEggId')
            ? (int) $request->input('targetEggId')
            : ($this->service->getTargetEggId($selection['fork']) ?? 0);
        $requiredJava = max(8, (int) ($selection['javaVersion'] ?? 0));

        if ($targetEggId <= 0) {
            throw ValidationException::withMessages([
                'targetEggId' => ['No egg is configured for this fork. Set an egg in Minecraft Version Manager settings before installing.'],
            ]);
        }

        $server = DB::transaction(function () use ($server, $selection, $targetEggId, $requiredJava) {
            if ($targetEggId !== (int) $server->egg_id) {
                $targetEgg = Egg::findOrFail($targetEggId);
                $selectedImage = $this->pickJavaImageForRequiredVersion($targetEgg->docker_images, $requiredJava);

                if ($selectedImage === null) {
                    throw ValidationException::withMessages([
                        'javaVersion' => ["The selected egg does not provide a Java {$requiredJava} image. Update egg Docker images before installing this build."],
                    ]);
                }

                $server->forceFill([
                    'egg_id' => $targetEgg->id,
                    'nest_id' => $targetEgg->nest_id,
                    'startup' => $targetEgg->startup,
                    'image' => $selectedImage,
                ])->save();
                $server = $server->fresh(['egg', 'variables']);
            } else {
                $server->loadMissing(['egg', 'variables']);

                $selectedImage = $this->pickJavaImageForRequiredVersion($server->egg?->docker_images, $requiredJava);
                if ($selectedImage === null) {
                    throw ValidationException::withMessages([
                        'javaVersion' => ["The current egg does not provide a Java {$requiredJava} image. Update egg Docker images before installing this build."],
                    ]);
                }

                $update = [];
                if ($selectedImage !== $server->image) {
                    $update['image'] = $selectedImage;
                }
                if ($server->egg && $server->startup !== $server->egg->startup) {
                    $update['startup'] = $server->egg->startup;
                }
                if (!empty($update)) {
                    $server->forceFill($update)->save();
                    $server = $server->fresh(['egg', 'variables']);
                }
            }

            $environmentUpdates = $this->service->resolveEnvironmentUpdates($server, [
                'fork' => $selection['fork'],
                'minecraftVersion' => $selection['minecraftVersion'],
                'build' => $selection['buildId'],
                'downloadName' => $selection['downloadName'],
            ]);

            foreach ($environmentUpdates as $key => $value) {
                $variable = $server->variables()->where('env_variable', $key)->first();

                if ($variable === null) {
                    continue;
                }

                Validator::make(['value' => $value], ['value' => $variable->rules])->validate();

                ServerVariable::query()->updateOrCreate(
                    [
                        'server_id' => $server->id,
                        'variable_id' => $variable->id,
                    ],
                    [
                        'variable_value' => (string) $value,
                    ]
                );
            }

            return $server->fresh(['egg', 'variables']);
        });

        Activity::event('server:minecraft-versions.switch')
            ->property([
                'fork' => $selection['fork'],
                'minecraft_version' => $selection['minecraftVersion'],
                'build_id' => $selection['buildId'],
                'target_egg_id' => $targetEggId,
            ])
            ->log();

        return new JsonResponse([
            'success' => true,
            'detected' => $this->service->detectCurrentState($server),
            'selection' => array_merge($selection, ['targetEggId' => $targetEggId]),
        ]);
    }

    private function pickJavaImageForRequiredVersion($dockerImages, int $requiredJava): ?string
    {
        if ($requiredJava <= 0 || empty($dockerImages)) {
            return null;
        }

        if (!is_array($dockerImages)) {
            return (string) $dockerImages;
        }

        $candidates = [];
        foreach ($dockerImages as $label => $image) {
            $haystack = strtolower((string) $label . ' ' . (string) $image);
            if (!preg_match_all('/java[^0-9]*([0-9]{1,2})|(?:^|[^0-9])j([0-9]{1,2})(?:[^0-9]|$)/', $haystack, $found)) {
                continue;
            }

            $numbers = array_merge(
                array_map('intval', array_filter($found[1])),
                array_map('intval', array_filter($found[2]))
            );

            foreach ($numbers as $number) {
                if ($number >= 8 && $number <= 40) {
                    $candidates[] = ['version' => $number, 'image' => (string) $image];
                    break;
                }
            }
        }

        $eligible = array_values(array_filter($candidates, fn ($candidate) => $candidate['version'] >= $requiredJava));
        if (empty($eligible)) {
            return null;
        }

        usort($eligible, fn ($a, $b) => $a['version'] <=> $b['version']);

        return $eligible[0]['image'];
    }
}
