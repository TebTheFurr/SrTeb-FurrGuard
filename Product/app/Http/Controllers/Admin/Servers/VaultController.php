<?php

declare(strict_types=1);

namespace Pterodactyl\Http\Controllers\Admin\Servers;

use Illuminate\View\View;
use Illuminate\Http\Request;
use Pterodactyl\Models\Server;
use Illuminate\Validation\Rule;
use Illuminate\Http\RedirectResponse;
use Prologue\Alerts\AlertsMessageBag;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Services\Vault\VaultClient;
use Pterodactyl\Services\Vault\VaultContext;
use Pterodactyl\Exceptions\Vault\VaultException;
use Pterodactyl\Services\Vault\VaultImportService;
use Pterodactyl\Services\Vault\VaultServerSyncService;

/**
 * «Vault» tab of a server in the Pterodactyl admin (§8.4 of the contract).
 */
class VaultController extends Controller
{
    public const EXCLUSION_PRESETS = [
        'logs/',
        'crash-reports/',
        'cache/',
        'plugins/dynmap/web/tiles/',
        'bluemap/web/maps/',
        '.paper-remapped/',
    ];

    public const NIVELES = ['ver', 'restaurar', 'gestionar'];

    public const CARPETAS_BACKUP = ['Backups', 'M-Backups'];

    private const MAX_ACCESSES = 200;
    private const MAX_EXCLUSIONS = 100;
    private const MAX_EXCLUSION_LENGTH = 256;
    private const MAX_EXTRA_WORLDS = 20;
    private const MAX_PATH_BYTES = 4096;

    private const BACKUP_NAME_REGEX = '/^(?!\.{1,2}$)[^\/\\\\\x00-\x1F\x7F]{1,255}$/u';

    public function __construct(
        private AlertsMessageBag $alert,
        private VaultClient $client,
        private VaultImportService $importer,
        private VaultServerSyncService $sync,
    ) {
    }

    public function index(Request $request, Server $server): View
    {
        $server->loadMissing(['vaultServer', 'node']);

        $configured = VaultClient::configured();
        $enabled = (bool) $server->vaultServer?->enabled;
        $detalle = null;
        $vaultError = null;

        if ($configured && $enabled) {
            try {
                $detalle = $this->client->get($this->serverPath($server), [], VaultContext::forRequest($request));
            } catch (VaultException $exception) {
                $vaultError = $exception->getMessage();
            }
        }

        $eligible = $this->importer->eligible($server);
        $pending = is_null($detalle) ? $eligible : $this->importer->withoutImported($eligible, $detalle);

        return view('admin.servers.view.vault', [
            'server' => $server,
            'configured' => $configured,
            'enabled' => $enabled,
            'vaultServer' => $server->vaultServer,
            'vaultError' => $vaultError,
            'servidor' => is_array($detalle['servidor'] ?? null) ? $detalle['servidor'] : null,
            'backups' => is_array($detalle['backups'] ?? null) ? $detalle['backups'] : [],
            'trabajos' => is_array($detalle['trabajos'] ?? null) ? $detalle['trabajos'] : [],
            'eligibleCount' => $eligible->count(),
            'pendingCount' => $pending->count(),
            'presets' => self::EXCLUSION_PRESETS,
            'niveles' => self::NIVELES,
        ]);
    }

    /**
     * Enables or disables the Vault for the server.
     */
    public function activation(Request $request, Server $server): RedirectResponse
    {
        $request->validate([
            'activo' => ['required', 'boolean'],
            'importar' => ['sometimes', 'boolean'],
            'borrar_originales' => ['sometimes', 'boolean'],
        ]);

        if (!VaultClient::configured()) {
            return $this->back($server, 'danger', __('vault.admin.alerts.not_configured'));
        }

        $context = VaultContext::forRequest($request);

        if (!$request->boolean('activo')) {
            $synced = $this->sync->disable($server, $context);

            return $synced
                ? $this->back($server, 'success', __('vault.admin.alerts.disabled'))
                : $this->back($server, 'warning', __('vault.admin.alerts.disabled_unsynced'));
        }

        try {
            $this->sync->enable($server, $context);
        } catch (VaultException $exception) {
            return $this->back($server, 'danger', __('vault.admin.alerts.enable_failed', ['error' => $exception->getMessage()]));
        }

        $this->alert->success(__('vault.admin.alerts.enabled'))->flash();

        if ($request->boolean('importar')) {
            $this->queueImports($request, $server, $request->boolean('borrar_originales'));
        }

        return redirect()->route('admin.servers.view.vault', $server->id);
    }

    /**
     * Imports the native backups that are not in the vault yet.
     */
    public function import(Request $request, Server $server): RedirectResponse
    {
        $request->validate(['borrar_originales' => ['sometimes', 'boolean']]);

        if (!$server->hasVaultEnabled()) {
            return $this->back($server, 'danger', __('vault.admin.alerts.not_enabled'));
        }

        $this->queueImports($request, $server, $request->boolean('borrar_originales'));

        return redirect()->route('admin.servers.view.vault', $server->id);
    }

    /**
     * Adds (or updates) and removes Discord accesses. The vault replaces the whole
     * list, so the current one is read first and sent back modified.
     */
    public function access(Request $request, Server $server): RedirectResponse
    {
        $data = $request->validate([
            'accion' => ['required', Rule::in(['add', 'remove'])],
            'discord_id' => ['required', 'string', 'regex:/^[0-9]{17,20}$/'],
            'nivel' => ['required_if:accion,add', 'nullable', Rule::in(self::NIVELES)],
            'nota' => ['nullable', 'string', 'max:200'],
        ]);

        if (!$server->hasVaultEnabled()) {
            return $this->back($server, 'danger', __('vault.admin.alerts.not_enabled'));
        }

        $context = VaultContext::forRequest($request);

        try {
            $detalle = $this->client->get($this->serverPath($server), [], $context);
            $accesos = $this->accessList($detalle);

            $accesos = array_values(array_filter($accesos, fn (array $acceso) => $acceso['discord_id'] !== $data['discord_id']));

            if ($data['accion'] === 'add') {
                if (count($accesos) >= self::MAX_ACCESSES) {
                    return $this->back($server, 'danger', __('vault.admin.alerts.too_many_accesses', ['max' => self::MAX_ACCESSES]));
                }

                $accesos[] = [
                    'discord_id' => $data['discord_id'],
                    'nivel' => $data['nivel'],
                    'nota' => (string) ($data['nota'] ?? ''),
                ];
            }

            $this->client->put($this->serverPath($server, 'accesos'), ['accesos' => $accesos], $context);
        } catch (VaultException $exception) {
            return $this->back($server, 'danger', __('vault.admin.alerts.vault_error', ['error' => $exception->getMessage()]));
        }

        return $this->back($server, 'success', __('vault.admin.alerts.accesses_saved'));
    }

    /**
     * Quota, exclusions, world consistency and extra world folders.
     */
    public function settings(Request $request, Server $server): RedirectResponse
    {
        $data = $request->validate([
            'cuota_gb' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
            'exclusiones' => ['nullable', 'string', 'max:30000'],
            'mundos_extra' => ['nullable', 'string', 'max:90000'],
            'consistencia' => ['sometimes', 'boolean'],
        ]);

        if (!$server->hasVaultEnabled()) {
            return $this->back($server, 'danger', __('vault.admin.alerts.not_enabled'));
        }

        $exclusiones = self::lines($data['exclusiones'] ?? null);
        if (count($exclusiones) > self::MAX_EXCLUSIONS) {
            return $this->back($server, 'danger', __('vault.admin.alerts.too_many_exclusions', ['max' => self::MAX_EXCLUSIONS]));
        }

        foreach ($exclusiones as $exclusion) {
            if (mb_strlen($exclusion) > self::MAX_EXCLUSION_LENGTH) {
                return $this->back($server, 'danger', __('vault.admin.alerts.exclusion_too_long', ['max' => self::MAX_EXCLUSION_LENGTH]));
            }
        }

        $mundosExtra = self::lines($data['mundos_extra'] ?? null);
        if (count($mundosExtra) > self::MAX_EXTRA_WORLDS) {
            return $this->back($server, 'danger', __('vault.admin.alerts.too_many_worlds', ['max' => self::MAX_EXTRA_WORLDS]));
        }

        foreach ($mundosExtra as $ruta) {
            if (!self::isRelativePath($ruta)) {
                return $this->back($server, 'danger', __('vault.admin.alerts.invalid_world_path', ['path' => $ruta]));
            }
        }

        try {
            $this->client->put($this->serverPath($server, 'ajustes'), [
                'cuota_gb' => is_null($data['cuota_gb'] ?? null) ? null : (float) $data['cuota_gb'],
                'exclusiones' => $exclusiones,
                'mundos_extra' => $mundosExtra,
                'consistencia' => $request->boolean('consistencia'),
            ], VaultContext::forRequest($request));
        } catch (VaultException $exception) {
            return $this->back($server, 'danger', __('vault.admin.alerts.vault_error', ['error' => $exception->getMessage()]));
        }

        return $this->back($server, 'success', __('vault.admin.alerts.settings_saved'));
    }

    /**
     * Pins or unpins a backup.
     */
    public function pin(Request $request, Server $server): RedirectResponse
    {
        $data = $this->validateBackup($request, ['fijada' => ['required', 'boolean']]);

        if (!$server->hasVaultEnabled()) {
            return $this->back($server, 'danger', __('vault.admin.alerts.not_enabled'));
        }

        try {
            $this->client->post(
                $this->serverPath($server, 'backups/%s/%s/fijar', $data['carpeta'], $data['nombre']),
                ['fijada' => $request->boolean('fijada')],
                VaultContext::forRequest($request)
            );
        } catch (VaultException $exception) {
            return $this->back($server, 'danger', __('vault.admin.alerts.vault_error', ['error' => $exception->getMessage()]));
        }

        return $this->back($server, 'success', __('vault.admin.alerts.backup_pinned'));
    }

    /**
     * Deletes a backup as admin (daily backups included).
     */
    public function deleteBackup(Request $request, Server $server): RedirectResponse
    {
        $data = $this->validateBackup($request);

        if (!$server->hasVaultEnabled()) {
            return $this->back($server, 'danger', __('vault.admin.alerts.not_enabled'));
        }

        try {
            $this->client->delete(
                $this->serverPath($server, 'backups/%s/%s', $data['carpeta'], $data['nombre']),
                VaultContext::forRequest($request)
            );
        } catch (VaultException $exception) {
            return $this->back($server, 'danger', __('vault.admin.alerts.vault_error', ['error' => $exception->getMessage()]));
        }

        return $this->back($server, 'success', __('vault.admin.alerts.backup_deleted'));
    }

    private function queueImports(Request $request, Server $server, bool $deleteOriginals): void
    {
        $context = VaultContext::forRequest($request);

        try {
            $pending = $this->importer->pending($server, $context);

            if ($pending->isEmpty()) {
                $this->alert->info(__('vault.admin.alerts.nothing_to_import'))->flash();

                return;
            }

            $trabajos = $this->importer->import($server, $pending, $deleteOriginals, $context);
            $this->alert->success(__('vault.admin.alerts.import_queued', ['count' => count($trabajos)]))->flash();
        } catch (VaultException $exception) {
            $this->alert->warning(__('vault.admin.alerts.import_failed', ['error' => $exception->getMessage()]))->flash();
        }
    }

    /**
     * @return array{carpeta: string, nombre: string}
     */
    private function validateBackup(Request $request, array $extra = []): array
    {
        return $request->validate(array_merge([
            'carpeta' => ['required', Rule::in(self::CARPETAS_BACKUP)],
            'nombre' => ['required', 'string', 'regex:' . self::BACKUP_NAME_REGEX],
        ], $extra));
    }

    /**
     * The current access list in the shape `PUT accesos` expects.
     *
     * @return array<int, array{discord_id: string, nivel: string, nota: string}>
     */
    private function accessList(array $detalle): array
    {
        $accesos = is_array($detalle['servidor']['accesos'] ?? null) ? $detalle['servidor']['accesos'] : [];

        return array_values(array_filter(array_map(function ($acceso) {
            if (!is_array($acceso) || !is_scalar($acceso['discord_id'] ?? null) || !in_array($acceso['nivel'] ?? null, self::NIVELES, true)) {
                return null;
            }

            return [
                'discord_id' => (string) $acceso['discord_id'],
                'nivel' => $acceso['nivel'],
                'nota' => is_string($acceso['nota'] ?? null) ? $acceso['nota'] : '',
            ];
        }, $accesos)));
    }

    /**
     * Non-empty, trimmed, de-duplicated lines of a textarea.
     *
     * @return string[]
     */
    private static function lines(?string $value): array
    {
        $lines = preg_split('/\r\n|\r|\n/', (string) $value) ?: [];

        return array_values(array_unique(array_filter(array_map('trim', $lines), fn (string $line) => $line !== '')));
    }

    /**
     * Relative path as the vault accepts it (§6.3 of the contract).
     */
    private static function isRelativePath(string $path): bool
    {
        if ($path === '' || strlen($path) > self::MAX_PATH_BYTES || !mb_check_encoding($path, 'UTF-8')) {
            return false;
        }

        if (str_starts_with($path, '/') || str_contains($path, "\0")) {
            return false;
        }

        foreach (explode('/', $path) as $segment) {
            if ($segment === '' || $segment === '.' || $segment === '..'
                || str_starts_with($segment, '.vault-subida-') || str_starts_with($segment, '.vault-borrando-')) {
                return false;
            }
        }

        return true;
    }

    private function serverPath(Server $server, string $suffix = '', string ...$segments): string
    {
        return VaultClient::path('/api/panel/servidores/%s' . ($suffix === '' ? '' : '/' . $suffix), $server->uuidShort, ...$segments);
    }

    private function back(Server $server, string $level, string $message): RedirectResponse
    {
        $this->alert->{$level}($message)->flash();

        return redirect()->route('admin.servers.view.vault', $server->id);
    }
}
