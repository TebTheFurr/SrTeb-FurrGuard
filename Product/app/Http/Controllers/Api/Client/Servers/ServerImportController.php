<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Permission;
use Pterodactyl\Facades\Activity;
use Illuminate\Auth\Access\AuthorizationException;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class ServerImportController extends ClientApiController
{
    private const SERVICE_CLASS = 'Pterodactyl\Services\ServerImport\ServerImportService';

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

    private function notInstalledResponse(): JsonResponse
    {
        return new JsonResponse([
            'error' => 'Server Importer addon is not installed.',
            'installed' => false,
        ], 503);
    }

    private function guard(ClientApiRequest $request, Server $server): ?JsonResponse
    {
        if (!$this->isServiceAvailable()) {
            return $this->notInstalledResponse();
        }

        $serviceClass = self::SERVICE_CLASS;

        if (!$serviceClass::isEnabled()) {
            return new JsonResponse(['error' => 'The Server Importer addon is disabled.'], 403);
        }

        if (!$serviceClass::isEggAllowed($server->egg_id)) {
            return new JsonResponse(['error' => 'This server type is not allowed to use the Server Importer.'], 403);
        }

        if (!$request->user()->can(Permission::ACTION_FILE_CREATE, $server)) {
            throw new AuthorizationException();
        }

        return null;
    }

    private function actionResult(array $result): JsonResponse
    {
        return new JsonResponse($result, $result['success'] ? 200 : 422);
    }

    public function status(ClientApiRequest $request, Server $server): JsonResponse
    {
        if (!$this->isServiceAvailable()) {
            return new JsonResponse(['installed' => false, 'enabled' => false]);
        }

        $serviceClass = self::SERVICE_CLASS;

        return new JsonResponse(array_merge(
            [
                'installed' => true,
                'enabled' => $serviceClass::isEnabled(),
                'eggAllowed' => $serviceClass::isEggAllowed($server->egg_id),
                'maxFileSizeMb' => (int) $serviceClass::getSetting('max_file_size_mb', 256),
            ],
            $serviceClass::getStatus($server)
        ));
    }

    public function test(ClientApiRequest $request, Server $server): JsonResponse
    {
        if ($denied = $this->guard($request, $server)) {
            return $denied;
        }

        $credentials = $this->validateCredentials($request);
        $result = $this->getService()->verifySource($credentials);

        return $this->actionResult($result);
    }

    public function browse(ClientApiRequest $request, Server $server): JsonResponse
    {
        if ($denied = $this->guard($request, $server)) {
            return $denied;
        }

        $credentials = $this->validateCredentials($request);
        $path = (string) $request->input('path', $credentials['remote_path']);

        return $this->actionResult($this->getService()->listRemote($credentials, $path));
    }

    public function start(ClientApiRequest $request, Server $server): JsonResponse
    {
        if ($denied = $this->guard($request, $server)) {
            return $denied;
        }

        $request->validate([
            'paths' => 'nullable|array',
            'paths.*' => 'string|max:2048',
            'wipe' => 'nullable|boolean',
        ]);

        $credentials = $this->validateCredentials($request);
        $paths = array_values(array_filter((array) $request->input('paths', []), 'is_string'));
        $wipe = $request->boolean('wipe');

        $result = $this->getService()->start($server, $credentials, $paths, $wipe);

        if ($result['success']) {
            Activity::event('server:importer.start')
                ->property(['host' => $credentials['host'], 'protocol' => $credentials['protocol'], 'wipe' => $wipe])
                ->log();
        }

        return $this->actionResult($result);
    }

    public function step(ClientApiRequest $request, Server $server): JsonResponse
    {
        if ($denied = $this->guard($request, $server)) {
            return $denied;
        }

        return new JsonResponse($this->getService()->step($server));
    }

    public function cancel(ClientApiRequest $request, Server $server): JsonResponse
    {
        if ($denied = $this->guard($request, $server)) {
            return $denied;
        }

        Activity::event('server:importer.cancel')->log();

        return new JsonResponse($this->getService()->cancel($server));
    }

    public function reset(ClientApiRequest $request, Server $server): JsonResponse
    {
        if ($denied = $this->guard($request, $server)) {
            return $denied;
        }

        return new JsonResponse($this->getService()->reset($server));
    }

    private function validateCredentials(ClientApiRequest $request): array
    {
        $request->validate([
            'protocol' => 'required|string|in:sftp,ftp',
            'host' => 'required|string|max:255',
            'port' => 'nullable|numeric|min:1|max:65535',
            'username' => 'required|string|max:255',
            'password' => 'nullable|string|max:1024',
            'remote_path' => 'nullable|string|max:1024',
        ]);

        return self::SERVICE_CLASS::prepareCredentials([
            'protocol' => $request->input('protocol'),
            'host' => (string) $request->input('host'),
            'port' => $request->input('port'),
            'username' => (string) $request->input('username'),
            'password' => (string) $request->input('password', ''),
            'remote_path' => (string) $request->input('remote_path', '/'),
        ]);
    }
}
