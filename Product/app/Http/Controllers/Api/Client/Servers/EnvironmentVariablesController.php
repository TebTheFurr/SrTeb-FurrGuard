<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;
use Pterodactyl\Models\Server;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Services\EnvironmentVariables\EnvironmentVariableService;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Pterodactyl\Services\Servers\FileAccessValidationService;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class EnvironmentVariablesController extends ClientApiController
{
    public function __construct(
        private DaemonFileRepository $fileRepository,
        private FileAccessValidationService $fileAccessValidationService,
    ) {
        parent::__construct();
    }

    public function index(ClientApiRequest $request, Server $server): JsonResponse
    {
        if (!EnvironmentVariableService::isEnabled()) {
            return response()->json([
                'error' => 'Environment Variable Manager addon is disabled',
            ], 403);
        }

        if (!EnvironmentVariableService::isEggAllowed($server->egg_id)) {
            return response()->json([
                'error' => 'This egg is not allowed to use the Environment Variable Manager',
            ], 403);
        }

        $request->validate([
            'path' => 'sometimes|nullable|string',
            'directory' => 'sometimes|nullable|string',
        ]);

        if ($request->filled('path')) {
            try {
                $filePath = EnvironmentVariableService::normaliseEnvFilePath((string) $request->query('path'));
            } catch (\InvalidArgumentException) {
                throw ValidationException::withMessages([
                    'path' => 'Invalid environment file path.',
                ]);
            }

            $baseName = basename($filePath);
            if (!EnvironmentVariableService::isManagedEnvFile($baseName)) {
                throw ValidationException::withMessages([
                    'path' => 'Invalid environment file path.',
                ]);
            }

            try {
                $directory = EnvironmentVariableService::directoryContainingEnvFilePath($filePath);
            } catch (\InvalidArgumentException) {
                throw ValidationException::withMessages([
                    'path' => 'Invalid environment file path.',
                ]);
            }
        } else {
            try {
                $directory = EnvironmentVariableService::normaliseEnvDirectory($request->query('directory'));
            } catch (\InvalidArgumentException) {
                throw ValidationException::withMessages([
                    'directory' => 'Invalid directory path.',
                ]);
            }
        }

        $managedFiles = EnvironmentVariableService::getManagedFiles();

        try {
            $directoryEntries = $this->fileRepository
                ->setServer($server)
                ->getDirectory($directory);

            $existingFiles = [];
            foreach ($directoryEntries as $entry) {
                if (!is_array($entry)) {
                    continue;
                }

                if (!empty($entry['directory'])) {
                    continue;
                }

                if (isset($entry['file']) && $entry['file'] !== true) {
                    continue;
                }

                $entryName = (string) ($entry['name'] ?? '');
                if (in_array($entryName, $managedFiles, true)) {
                    $existingFiles[] = $entryName;
                }
            }

            $files = [];
            foreach ($managedFiles as $fileName) {
                $exists = in_array($fileName, $existingFiles, true);
                $variables = [];

                if ($exists) {
                    $path = EnvironmentVariableService::buildEnvFilePath($directory, $fileName);

                    if ($this->fileAccessValidationService->isFileRestricted($request->user(), $server, $path)) {
                        $files[] = [
                            'name' => $fileName,
                            'type' => EnvironmentVariableService::getEnvironmentType($fileName),
                            'exists' => false,
                            'variables' => (object) [],
                        ];

                        continue;
                    }

                    try {
                        $content = $this->fileRepository
                            ->setServer($server)
                            ->getContent($path, config('pterodactyl.files.max_edit_size'));
                        $variables = EnvironmentVariableService::parseEnvContent($content);
                    } catch (\Throwable) {
                        $variables = [];
                    }
                }

                $files[] = [
                    'name' => $fileName,
                    'type' => EnvironmentVariableService::getEnvironmentType($fileName),
                    'exists' => $exists,
                    'variables' => (object) $variables,
                ];
            }

            return response()->json([
                'files' => $files,
                'directory' => $directory,
                'accessMode' => [
                    'file' => EnvironmentVariableService::canAccessViaFile(),
                    'sidebar' => EnvironmentVariableService::canAccessViaSidebar(),
                ],
            ]);
        } catch (\Throwable $exception) {
            return response()->json([
                'error' => 'Failed to load environment variables',
                'message' => $exception->getMessage(),
            ], 500);
        }
    }

    public function update(ClientApiRequest $request, Server $server): JsonResponse
    {
        if (!EnvironmentVariableService::isEnabled()) {
            return response()->json([
                'error' => 'Environment Variable Manager addon is disabled',
            ], 403);
        }

        if (!EnvironmentVariableService::isEggAllowed($server->egg_id)) {
            return response()->json([
                'error' => 'This egg is not allowed to use the Environment Variable Manager',
            ], 403);
        }

        $request->validate([
            'file' => 'required|string',
            'variables' => 'required|array',
            'directory' => 'sometimes|nullable|string',
        ]);

        try {
            $directory = EnvironmentVariableService::normaliseEnvDirectory($request->input('directory'));
        } catch (\InvalidArgumentException) {
            throw ValidationException::withMessages([
                'directory' => 'Invalid directory path.',
            ]);
        }

        $targetFile = trim((string) $request->input('file'));
        $managedFiles = EnvironmentVariableService::getManagedFiles();
        if (!in_array($targetFile, $managedFiles, true)) {
            throw ValidationException::withMessages([
                'file' => 'Invalid environment file selected.',
            ]);
        }

        $this->fileAccessValidationService->validateSubuserFileAccess(
            $request->user(),
            $server,
            EnvironmentVariableService::buildEnvFilePath($directory, $targetFile)
        );

        $incomingVariables = (array) $request->input('variables');
        $normalised = [];
        foreach ($incomingVariables as $rawKey => $rawValue) {
            $key = EnvironmentVariableService::normaliseVariableKey((string) $rawKey);
            if ($key === null) {
                throw ValidationException::withMessages([
                    'variables' => "Invalid environment variable key: {$rawKey}",
                ]);
            }

            $normalised[$key] = (string) $rawValue;
        }

        $content = EnvironmentVariableService::buildEnvContent($normalised);

        try {
            $path = EnvironmentVariableService::buildEnvFilePath($directory, $targetFile);
            $this->fileRepository
                ->setServer($server)
                ->putContent($path, $content);

            Activity::event('server:file.write')
                ->property('file', $path)
                ->log();

            return response()->json([
                'success' => true,
                'message' => 'Environment variables updated successfully',
            ]);
        } catch (\Throwable $exception) {
            return response()->json([ 
                'error' => 'Failed to save environment variables',
                'message' => $exception->getMessage(),
            ], 500);
        }
    }

    public function destroy(ClientApiRequest $request, Server $server): JsonResponse
    {
        if (!EnvironmentVariableService::isEnabled()) {
            return response()->json([
                'error' => 'Environment Variable Manager addon is disabled',
            ], 403);
        }

        if (!EnvironmentVariableService::isEggAllowed($server->egg_id)) {
            return response()->json([
                'error' => 'This egg is not allowed to use the Environment Variable Manager',
            ], 403);
        }

        $request->validate([
            'file' => 'required|string',
            'directory' => 'sometimes|nullable|string',
        ]);

        try {
            $directory = EnvironmentVariableService::normaliseEnvDirectory($request->input('directory'));
        } catch (\InvalidArgumentException) {
            throw ValidationException::withMessages([
                'directory' => 'Invalid directory path.',
            ]);
        }

        $targetFile = trim((string) $request->input('file'));
        $managedFiles = EnvironmentVariableService::getManagedFiles();
        if (!in_array($targetFile, $managedFiles, true)) {
            throw ValidationException::withMessages([
                'file' => 'Invalid environment file selected.',
            ]);
        }

        $this->fileAccessValidationService->validateSubuserFileAccess(
            $request->user(),
            $server,
            EnvironmentVariableService::buildEnvFilePath($directory, $targetFile)
        );

        try {
            $directoryEntries = $this->fileRepository
                ->setServer($server)
                ->getDirectory($directory);

            $exists = false;
            foreach ($directoryEntries as $entry) {
                if (!is_array($entry)) {
                    continue;
                }

                if (!empty($entry['directory'])) {
                    continue;
                }

                if (isset($entry['file']) && $entry['file'] !== true) {
                    continue;
                }

                if (((string) ($entry['name'] ?? '')) === $targetFile) {
                    $exists = true;
                    break;
                }
            }

            if (!$exists) {
                return response()->json([
                    'success' => true,
                    'deleted' => false,
                    'message' => 'Environment file does not exist.',
                ]);
            }

            $this->fileRepository
                ->setServer($server)
                ->deleteFiles($directory, [$targetFile]);

            Activity::event('server:file.delete')
                ->property('file', EnvironmentVariableService::buildEnvFilePath($directory, $targetFile))
                ->log();

            return response()->json([
                'success' => true,
                'deleted' => true,
                'message' => 'Environment file deleted successfully',
            ]);
        } catch (\Throwable $exception) {
            return response()->json([
                'error' => 'Failed to delete environment file',
                'message' => $exception->getMessage(),
            ], 500);
        }
    }
}
