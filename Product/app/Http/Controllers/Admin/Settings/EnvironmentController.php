<?php

namespace Pterodactyl\Http\Controllers\Admin\Settings;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Exceptions\PterodactylException;

class EnvironmentController extends Controller
{
    protected array $protectedKeys = [
        'APP_KEY',
    ];

    protected array $sensitiveKeys = [
        'APP_KEY',
        'DB_PASSWORD',
        'MAIL_PASSWORD',
        'HASHIDS_SALT',
        'HASHIDS_LENGTH',
    ];

    public function index(): JsonResponse
    {
        $variables = $this->readEnvironmentFile();

        return response()->json([
            'success' => true,
            'variables' => $variables,
            'writable' => $this->isEnvWritable(),
            'demo' => $this->isDemo(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $request->validate([
            'key' => 'required|string|regex:/^[A-Z][A-Z0-9_]*$/',
            'value' => 'nullable|string',
            'original_key' => 'nullable|string',
        ]);

        if (!$this->isEnvWritable()) {
            return response()->json([
                'success' => false,
                'error' => $this->isDemo()
                    ? 'Environment variables cannot be edited in demo mode.'
                    : 'The .env file is not writable. Please check file permissions.',
            ], 403);
        }

        $key = strtoupper($request->input('key'));
        $value = $request->input('value', '');
        $originalKey = $request->input('original_key');

        if (in_array($key, $this->protectedKeys)) {
            return response()->json([
                'success' => false,
                'error' => 'This environment variable cannot be modified for security reasons.',
            ], 403);
        }

        try {
            if ($originalKey && $originalKey !== $key) {
                $this->deleteFromEnvironment($originalKey);
            }

            $this->writeToEnvironment([$key => $value]);

            return response()->json([
                'success' => true,
                'message' => 'Environment variable updated successfully.',
                'variables' => $this->readEnvironmentFile(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Failed to update environment variable: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'key' => 'required|string|regex:/^[A-Z][A-Z0-9_]*$/',
            'value' => 'nullable|string',
        ]);

        if (!$this->isEnvWritable()) {
            return response()->json([
                'success' => false,
                'error' => $this->isDemo()
                    ? 'Environment variables cannot be edited in demo mode.'
                    : 'The .env file is not writable. Please check file permissions.',
            ], 403);
        }

        $key = strtoupper($request->input('key'));
        $value = $request->input('value', '');

        $existing = $this->readEnvironmentFile();
        if (isset($existing[$key])) {
            return response()->json([
                'success' => false,
                'error' => 'An environment variable with this key already exists.',
            ], 422);
        }

        try {
            $this->writeToEnvironment([$key => $value]);

            return response()->json([
                'success' => true,
                'message' => 'Environment variable created successfully.',
                'variables' => $this->readEnvironmentFile(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Failed to create environment variable: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function destroy(Request $request): JsonResponse
    {
        $request->validate([
            'key' => 'required|string',
        ]);

        if (!$this->isEnvWritable()) {
            return response()->json([
                'success' => false,
                'error' => $this->isDemo()
                    ? 'Environment variables cannot be edited in demo mode.'
                    : 'The .env file is not writable. Please check file permissions.',
            ], 403);
        }

        $key = strtoupper($request->input('key'));

        if (in_array($key, $this->protectedKeys)) {
            return response()->json([
                'success' => false,
                'error' => 'This environment variable cannot be deleted for security reasons.',
            ], 403);
        }

        try {
            $this->deleteFromEnvironment($key);

            return response()->json([
                'success' => true,
                'message' => 'Environment variable deleted successfully.',
                'variables' => $this->readEnvironmentFile(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Failed to delete environment variable: ' . $e->getMessage(),
            ], 500);
        }
    }

    protected function isDemo(): bool
    {
        return filter_var(env('IS_DEMO', false), FILTER_VALIDATE_BOOLEAN);
    }

    protected function isEnvWritable(): bool
    {
        if ($this->isDemo()) {
            return false;
        }

        $path = base_path('.env');
        return file_exists($path) && is_writable($path);
    }

    protected function readEnvironmentFile(): array
    {
        $path = base_path('.env');
        if (!file_exists($path)) {
            return [];
        }

        $contents = file_get_contents($path);
        $lines = explode("\n", $contents);
        $variables = [];

        foreach ($lines as $line) {
            $line = trim($line);

            if (empty($line) || str_starts_with($line, '#')) {
                continue;
            }

            if (str_contains($line, '=')) {
                [$key, $value] = explode('=', $line, 2);
                $key = trim($key);
                $value = trim($value);

                if (preg_match('/^"(.*)"$/', $value, $matches)) {
                    $value = $matches[1];
                } elseif (preg_match("/^'(.*)'$/", $value, $matches)) {
                    $value = $matches[1];
                }

                $isSensitive = in_array($key, $this->sensitiveKeys);
                $isProtected = in_array($key, $this->protectedKeys);

                $variables[$key] = [
                    'value' => $isSensitive ? str_repeat('*', min(strlen($value), 20)) : $value,
                    'sensitive' => $isSensitive,
                    'protected' => $isProtected,
                    'raw' => !$isSensitive ? $value : null,
                ];
            }
        }

        return $variables;
    }

    protected function escapeEnvironmentValue(?string $value): string
    {
        if (is_null($value)) {
            return '';
        }

        if (!preg_match('/^"(.*)"$/', $value) && preg_match('/([^\w.\-+\/])+/', $value)) {
            return sprintf('"%s"', addslashes($value));
        }

        return $value;
    }

    protected function writeToEnvironment(array $values = []): void
    {
        $path = base_path('.env');
        if (!file_exists($path)) {
            throw new PterodactylException('Cannot locate .env file, was this software installed correctly?');
        }

        $saveContents = file_get_contents($path);
        collect($values)->each(function ($value, $key) use (&$saveContents) {
            $key = strtoupper($key);
            $saveValue = sprintf('%s=%s', $key, $this->escapeEnvironmentValue($value));

            if (preg_match_all('/^' . $key . '=(.*)$/m', $saveContents) < 1) {
                $saveContents = $saveContents . PHP_EOL . $saveValue;
            } else {
                $saveContents = preg_replace('/^' . $key . '=(.*)$/m', $saveValue, $saveContents);
            }
        });

        file_put_contents($path, $saveContents);
    }

    protected function deleteFromEnvironment(string $key): void
    {
        $path = base_path('.env');
        if (!file_exists($path)) {
            throw new PterodactylException('Cannot locate .env file, was this software installed correctly?');
        }

        $key = strtoupper($key);
        $contents = file_get_contents($path);
        $contents = preg_replace('/^' . preg_quote($key, '/') . '=.*$\n?/m', '', $contents);
        $contents = preg_replace('/\n{3,}/', "\n\n", $contents);

        file_put_contents($path, $contents);
    }
}
