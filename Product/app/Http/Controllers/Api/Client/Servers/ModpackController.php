<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use GuzzleHttp\Client;
use Pterodactyl\Models\Egg;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\ServerVariable;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Facades\Activity;
use Illuminate\Support\Facades\DB;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Pterodactyl\Services\Servers\FileAccessValidationService;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\Servers\Modpacks\SearchModpacksRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Modpacks\GetModpackVersionsRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Modpacks\GetModpackDownloadUrlRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Modpacks\GetModpackDetailsRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Modpacks\SwitchModpackEggRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Modpacks\FixModpackPermissionsRequest;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ModpackController extends ClientApiController
{
    private const SERVICE_CLASS = 'Pterodactyl\Services\Modpacks\ModpackSearchService';

    private const FILE_MODE = '666';

    private const DIRECTORY_MODE = '777';

    public function __construct(
        private FileAccessValidationService $fileAccessValidationService,
    )
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

    public function search(SearchModpacksRequest $request, Server $server): JsonResponse
    {
        $service = $this->getService();

        if ($service === null) {
            return new JsonResponse([
                'error' => 'Modpack Installer addon is not installed.',
                'installed' => false,
            ], 503);
        }

        $result = $service->search([
            'query' => $request->input('query', ''),
            'platforms' => $request->input('platforms', ['modrinth', 'curseforge']),
            'gameVersion' => $request->input('gameVersion'),
            'loader' => $request->input('loader'),
            'page' => $request->input('page', 1),
            'pageSize' => $request->input('pageSize', 20),
        ]);

        return new JsonResponse($result);
    }

    public function versions(GetModpackVersionsRequest $request, Server $server): JsonResponse
    {
        $service = $this->getService();

        if ($service === null) {
            return new JsonResponse([
                'error' => 'Modpack Installer addon is not installed.',
                'installed' => false,
            ], 503);
        }

        $versions = $service->getVersions(
            $request->input('platform'),
            $request->input('modpackId'),
            $request->input('gameVersion'),
            $request->input('loader')
        );

        return new JsonResponse(['versions' => $versions]);
    }

    public function downloadUrl(GetModpackDownloadUrlRequest $request, Server $server): JsonResponse
    {
        $service = $this->getService();

        if ($service === null) {
            return new JsonResponse([
                'error' => 'Modpack Installer addon is not installed.',
                'installed' => false,
            ], 503);
        }

        $result = $service->getVersionDownloadUrl(
            $request->input('platform'),
            $request->input('modpackId'),
            $request->input('versionId')
        );

        if ($result === null) {
            return new JsonResponse([
                'downloadUrl' => null,
                'fileName' => null,
                'useHeader' => false,
                'error' => 'Could not resolve a download URL for this modpack version.',
            ]);
        }

        return new JsonResponse($result);
    }

    public function details(GetModpackDetailsRequest $request, Server $server): JsonResponse
    {
        $service = $this->getService();

        if ($service === null) {
            return new JsonResponse([
                'error' => 'Modpack Installer addon is not installed.',
                'installed' => false,
            ], 503);
        }

        $details = $service->getDetails(
            $request->input('platform'),
            $request->input('modpackId')
        );

        return new JsonResponse(['details' => $details]);
    }

    public function minecraftVersions(): JsonResponse
    {
        $service = $this->getService();

        if ($service === null) {
            return new JsonResponse([
                'error' => 'Modpack Installer addon is not installed.',
                'installed' => false,
            ], 503);
        }

        $versions = $service->getMinecraftVersions();

        return new JsonResponse(['versions' => $versions]);
    }

    public function installerUrl(Request $request, Server $server): JsonResponse
    {
        $service = $this->getService();

        if ($service === null) {
            return new JsonResponse(['url' => null, 'filename' => null]);
        }

        $result = $service->getInstallerUrl(
            (string) $request->input('loader', ''),
            (string) $request->input('loaderVersion', ''),
            (string) $request->input('mcVersion', '')
        );

        return new JsonResponse($result ?? ['url' => null, 'filename' => null]);
    }

    public function serverJarUrl(Request $request, Server $server): JsonResponse
    {
        $service = $this->getService();

        if ($service === null) {
            return new JsonResponse(['url' => null, 'filename' => null]);
        }

        $result = $service->getLoaderServerJar(
            (string) $request->input('loader', ''),
            (string) $request->input('mcVersion', ''),
            (string) $request->input('loaderVersion', '')
        );

        return new JsonResponse($result ?? ['url' => null, 'filename' => null]);
    }

    public function installServerJar(Request $request, Server $server): JsonResponse
    {
        $service = $this->getService();

        if ($service === null) {
            return new JsonResponse([
                'success' => false,
                'error' => 'Modpack Installer addon is not installed.',
            ], 503);
        }

        $this->fileAccessValidationService->validateSubuserFileAccess($request->user(), $server, '/server.jar');

        $jar = $service->getLoaderServerJar(
            (string) $request->input('loader', ''),
            (string) $request->input('mcVersion', ''),
            (string) $request->input('loaderVersion', '')
        );

        if ($jar === null || empty($jar['url'])) {
            return new JsonResponse([
                'success' => false,
                'error' => 'Could not resolve a server jar download for this loader.',
            ]);
        }

        try {
            $client = new Client(['timeout' => 120]);
            $contents = (string) $client->get($jar['url'])->getBody();
        } catch (\Exception $exception) {
            return new JsonResponse([
                'success' => false,
                'error' => 'Failed to download the server jar from the loader provider.',
            ]);
        }

        if ($contents === '') {
            return new JsonResponse([
                'success' => false,
                'error' => 'The downloaded server jar was empty.',
            ]);
        }

        try {
            app(DaemonFileRepository::class)->setServer($server)->putContent('/server.jar', $contents);
        } catch (\Exception $exception) {
            return new JsonResponse([
                'success' => false,
                'error' => 'Failed to write server.jar to the server disk.',
            ]);
        }

        return new JsonResponse(['success' => true]);
    }

    public function fixPermissions(FixModpackPermissionsRequest $request, Server $server): JsonResponse
    {
        $service = $this->getService();

        if ($service === null) {
            return new JsonResponse([
                'success' => false,
                'error' => 'Modpack Installer addon is not installed.',
            ], 503);
        }

        if ($this->fileAccessValidationService->hasExcludedFilenames($request->user(), $server)) {
            throw new NotFoundHttpException();
        }

        $files = app(DaemonFileRepository::class)->setServer($server);

        try {
            $files->createDirectory('config', '/');
        } catch (\Exception $exception) {
        }

        try {
            $this->fixDirectoryPermissions($files, '/');
        } catch (\Exception $exception) {
            return new JsonResponse([
                'success' => false,
                'error' => 'Failed to update server file permissions.',
            ]);
        }

        return new JsonResponse(['success' => true]);
    }

    public function switchEgg(SwitchModpackEggRequest $request, Server $server): JsonResponse
    {
        $targetEggId = (int) $request->input('target_egg_id');
        $mcVersion = (string) $request->input('mc_version', '');
        $loaderType = (string) $request->input('loader_type', '');
        $loaderVersion = (string) $request->input('loader_version', '');
        $targetEgg = Egg::findOrFail($targetEggId);

        if ((int) $server->egg_id === $targetEggId) {
            $desiredImage = $this->pickJavaImage($targetEgg->docker_images, $mcVersion, $loaderType);
            if ($desiredImage !== null && $server->image !== $desiredImage) {
                $server->forceFill(['image' => $desiredImage])->save();
            }
            $this->updateLoaderVariables($server, $targetEgg, $mcVersion, $loaderType, $loaderVersion);

            return new JsonResponse([
                'success' => true,
                'message' => 'Server is already using the requested egg.',
                'new_egg_id' => $server->egg_id,
                'new_egg_name' => $server->egg?->name ?? 'Unknown',
            ]);
        }

        $oldEggName = $server->egg?->name ?? 'Unknown';

        $updatedServer = DB::transaction(function () use ($server, $targetEgg, $mcVersion, $loaderType, $loaderVersion) {
            $updateData = [
                'egg_id' => $targetEgg->id,
                'nest_id' => $targetEgg->nest_id,
                'startup' => $targetEgg->startup,
            ];

            $dockerImages = $targetEgg->docker_images;
            if (!empty($dockerImages)) {
                $chosen = $this->pickJavaImage($dockerImages, $mcVersion, $loaderType);
                if ($chosen === null) {
                    $chosen = is_array($dockerImages) ? reset($dockerImages) : $dockerImages;
                }
                $updateData['image'] = $chosen;
            }

            $server->forceFill($updateData)->save();
            $this->updateLoaderVariables($server, $targetEgg, $mcVersion, $loaderType, $loaderVersion);

            return $server->refresh();
        });

        $newEggName = $updatedServer->egg?->name ?? 'Unknown';

        Activity::event('server:modpacks.egg.switch')
            ->property([
                'old_egg' => $oldEggName,
                'new_egg' => $newEggName,
                'target_egg_id' => $targetEggId,
            ])
            ->log();

        return new JsonResponse([
            'success' => true,
            'message' => 'Server egg switched successfully.',
            'new_egg_id' => $updatedServer->egg_id,
            'new_egg_name' => $newEggName,
        ]);
    }

    public function javaCompatibility(Request $request, Server $server): JsonResponse
    {
        $targetEggId = (int) $request->input('target_egg_id', 0);
        $mcVersion = (string) $request->input('mc_version', '');
        $loaderType = (string) $request->input('loader_type', '');

        if ($targetEggId <= 0) {
            return new JsonResponse([
                'has_egg' => false,
                'minimum_java' => $this->minimumJavaMajor($mcVersion),
                'available_java' => [],
                'selected_java' => null,
                'selected_image' => null,
                'sufficient' => false,
            ]);
        }

        $targetEgg = Egg::find($targetEggId);
        if ($targetEgg === null) {
            return new JsonResponse([
                'has_egg' => false,
                'minimum_java' => $this->minimumJavaMajor($mcVersion),
                'available_java' => [],
                'selected_java' => null,
                'selected_image' => null,
                'sufficient' => false,
            ]);
        }

        $minimum = $this->minimumJavaMajor($mcVersion);
        $candidates = $this->extractJavaCandidates($targetEgg->docker_images);
        $versions = array_values(array_unique(array_map(fn ($c) => $c['version'], $candidates)));
        sort($versions);

        $selectedImage = $this->pickJavaImage($targetEgg->docker_images, $mcVersion, $loaderType);
        $selectedJava = null;
        if ($selectedImage !== null) {
            foreach ($candidates as $candidate) {
                if ($candidate['image'] === $selectedImage) {
                    $selectedJava = $candidate['version'];
                    break;
                }
            }
        }

        return new JsonResponse([
            'has_egg' => true,
            'egg_name' => $targetEgg->name,
            'minimum_java' => $minimum,
            'available_java' => $versions,
            'selected_java' => $selectedJava,
            'selected_image' => $selectedImage,
            'sufficient' => $selectedJava !== null && $selectedJava >= $minimum,
        ]);
    }

    private function updateLoaderVariables(Server $server, Egg $egg, string $mcVersion, string $loaderType, string $loaderVersion): void
    {
        $updates = [];
        if ($mcVersion !== '') {
            $updates['MC_VERSION'] = $mcVersion;
            $updates['MINECRAFT_VERSION'] = $mcVersion;
        }

        if (in_array($loaderType, ['forge', 'neoforge', 'fabric', 'quilt'], true)) {
            $updates['SERVER_JARFILE'] = 'server.jar';
            $updates['SERVER_JAR'] = 'server.jar';
        }

        if ($loaderVersion !== '') {
            if ($loaderType === 'neoforge') {
                $updates['NEOFORGE_VERSION'] = $loaderVersion;
                $updates['NEO_VERSION'] = $loaderVersion;
            } elseif ($loaderType === 'forge') {
                $forgeVersion = $this->normaliseForgeVersion($mcVersion, $loaderVersion);
                $updates['FORGE_VERSION'] = $forgeVersion;
                $updates['FORGEVERSION'] = $forgeVersion;
            } elseif ($loaderType === 'fabric') {
                $updates['FABRIC_LOADER_VERSION'] = $loaderVersion;
                $updates['FABRIC_VERSION'] = $loaderVersion;
                $updates['LOADER_VERSION'] = $loaderVersion;
            } elseif ($loaderType === 'quilt') {
                $updates['QUILT_LOADER_VERSION'] = $loaderVersion;
                $updates['QUILT_VERSION'] = $loaderVersion;
                $updates['LOADER_VERSION'] = $loaderVersion;
            }
        }

        if (empty($updates)) {
            return;
        }

        $variables = $egg->variables()->whereIn('env_variable', array_keys($updates))->get();
        foreach ($variables as $variable) {
            ServerVariable::query()->updateOrCreate(
                [
                    'server_id' => $server->id,
                    'variable_id' => $variable->id,
                ],
                [
                    'variable_value' => (string) $updates[$variable->env_variable],
                ]
            );
        }
    }

    private function normaliseForgeVersion(string $mcVersion, string $loaderVersion): string
    {
        $trimmedMinecraft = trim($mcVersion);
        $trimmedLoader = trim($loaderVersion);

        if ($trimmedMinecraft === '' || $trimmedLoader === '') {
            return $trimmedLoader;
        }

        if (str_starts_with($trimmedLoader, $trimmedMinecraft . '-')) {
            return $trimmedLoader;
        }

        return $trimmedMinecraft . '-' . $trimmedLoader;
    }

    private function extractJavaCandidates($dockerImages): array
    {
        if (empty($dockerImages) || !is_array($dockerImages)) {
            return [];
        }

        $candidates = [];
        foreach ($dockerImages as $label => $image) {
            $haystack = strtolower($label . ' ' . $image);
            if (!preg_match_all('/java[^0-9]*([0-9]{1,2})|(?:^|[^0-9])j([0-9]{1,2})(?:[^0-9]|$)/', $haystack, $found)) {
                continue;
            }

            $numbers = array_merge(
                array_map('intval', array_filter($found[1])),
                array_map('intval', array_filter($found[2]))
            );

            foreach ($numbers as $number) {
                if ($number >= 8 && $number <= 40) {
                    $candidates[] = ['version' => $number, 'image' => $image];
                    break;
                }
            }
        }

        return $candidates;
    }

    private function minimumJavaMajor(string $mcVersion): int
    {
        $trimmed = trim($mcVersion);
        if ($trimmed === '') {
            return 21;
        }

        if (!preg_match('/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/', $trimmed, $matches)) {
            return 21;
        }

        $major = (int) ($matches[1] ?? 0);
        $minor = (int) ($matches[2] ?? 0);
        $patch = (int) ($matches[3] ?? 0);

        if ($major < 1) {
            return 21;
        }

        if ($minor >= 21) {
            return 21;
        }
        if ($minor === 20 && $patch >= 5) {
            return 21;
        }
        if ($minor >= 18) {
            return 17;
        }
        if ($minor === 17) {
            return 16;
        }
        return 8;
    }

    private function pickJavaImage($dockerImages, string $mcVersion, string $loaderType = ''): ?string
    {
        if (empty($dockerImages)) {
            return null;
        }

        if (!is_array($dockerImages)) {
            return (string) $dockerImages;
        }

        $minimum = $this->minimumJavaMajor($mcVersion);
        $candidates = $this->extractJavaCandidates($dockerImages);

        if (empty($candidates)) {
            return null;
        }

        $eligible = array_values(array_filter($candidates, fn ($c) => $c['version'] >= $minimum));

        if (!empty($eligible)) {
            if ($loaderType === 'neoforge') {
                usort($eligible, fn ($a, $b) => $b['version'] <=> $a['version']);
                return $eligible[0]['image'];
            }

            usort($eligible, fn ($a, $b) => $a['version'] <=> $b['version']);
            return $eligible[0]['image'];
        }

        usort($candidates, fn ($a, $b) => $b['version'] <=> $a['version']);
        return $candidates[0]['image'];
    }

    private function entryIsDirectory(array $entry): bool
    {
        if (!empty($entry['directory'])) {
            return true;
        }

        if (array_key_exists('file', $entry)) {
            return $entry['file'] === false;
        }

        return false;
    }

    private function fixDirectoryPermissions(DaemonFileRepository $files, string $directory, int $depth = 0): void
    {
        if ($depth > 15) {
            return;
        }

        try {
            $entries = $files->getDirectory($directory);
        } catch (\Exception $exception) {
            return;
        }

        if (!is_array($entries) || count($entries) === 0) {
            return;
        }

        $chmodEntries = [];
        $childDirectories = [];

        foreach ($entries as $entry) {
            if (!is_array($entry)) {
                continue;
            }

            $name = (string) ($entry['name'] ?? '');
            if ($name === '' || $name === '.' || $name === '..') {
                continue;
            }

            $isFile = !$this->entryIsDirectory($entry);
            $chmodEntries[] = [
                'file' => $name,
                'mode' => $isFile ? self::FILE_MODE : self::DIRECTORY_MODE,
            ];

            if (!$isFile) {
                if ($directory === '/') {
                    $childDirectories[] = '/' . $name;
                } else {
                    $childDirectories[] = $directory . '/' . $name;
                }
            }
        }

        if (count($chmodEntries) > 0) {
            try {
                $files->chmodFiles($directory, $chmodEntries);
            } catch (\Exception $exception) {
            }
        }

        foreach ($childDirectories as $childDirectory) {
            $this->fixDirectoryPermissions($files, $childDirectory, $depth + 1);
        }
    }
}
