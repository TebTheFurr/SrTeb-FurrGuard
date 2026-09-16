<?php

declare(strict_types=1);

namespace Pterodactyl\Console\Commands\Vault;

use Pterodactyl\Models\Backup;
use Pterodactyl\Models\Server;
use Illuminate\Console\Command;
use Pterodactyl\Models\VaultServer;
use Illuminate\Support\Facades\Log;
use Pterodactyl\Services\Vault\VaultClient;
use Pterodactyl\Exceptions\Vault\VaultException;
use Pterodactyl\Services\Vault\VaultDispatcher;
use Pterodactyl\Services\Backups\DeleteBackupService;
use Pterodactyl\Services\Vault\VaultServerSyncService;
use Pterodactyl\Exceptions\Service\Backup\BackupLockedException;
use Pterodactyl\Exceptions\Http\Connection\DaemonConnectionException;

/**
 * Runs every minute from the scheduler (§4.5 of the contract):
 *
 *  1. dispatches the jobs the vault has ready (daily copies, imports, retries);
 *  2. closes the finished ones: lifts `restoring_backup`, deletes imported
 *     native backups, and confirms them with `visto`;
 *  3. reconciles which servers are active (and their names and nodes) between
 *     the panel, which is the source of truth, and the vault.
 */
class TickCommand extends Command
{
    protected $signature = 'vault:tick';

    protected $description = 'Dispatches pending Tebby Vault jobs to Wings, closes finished ones and reconciles the activation of servers with the vault.';

    private const TRABAJO_REGEX = '/^[A-Za-z0-9_-]{8,64}$/';

    public function __construct(
        private VaultClient $client,
        private VaultDispatcher $dispatcher,
        private VaultServerSyncService $sync,
        private DeleteBackupService $deleteBackupService,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        if (!VaultClient::configured()) {
            $this->line('The Tebby Vault is not configured (VAULT_URL / VAULT_PANEL_KEY): nothing to do.');

            return self::SUCCESS;
        }

        $ok = true;

        try {
            $pendientes = $this->client->get('/api/panel/pendientes');
        } catch (VaultException $exception) {
            $this->warn(sprintf('Could not read the pending Vault jobs: [%s] %s', $exception->getCodigo(), $exception->getMessage()));
            $pendientes = [];
            $ok = false;
        }

        foreach ($this->items($pendientes['despachar'] ?? null) as $item) {
            $this->dispatchItem($item);
        }

        foreach ($this->items($pendientes['terminados'] ?? null) as $item) {
            try {
                $this->finishItem($item);
            } catch (VaultException $exception) {
                $this->warn(sprintf('Could not close a finished Vault job: [%s] %s', $exception->getCodigo(), $exception->getMessage()));
                $ok = false;
            }
        }

        try {
            $this->reconcile();
        } catch (VaultException $exception) {
            $this->warn(sprintf('Could not reconcile the servers with the Vault: [%s] %s', $exception->getCodigo(), $exception->getMessage()));
            $ok = false;
        }

        return $ok ? self::SUCCESS : self::FAILURE;
    }

    /**
     * @return array<int, array>
     */
    private function items(mixed $list): array
    {
        return is_array($list) ? array_values(array_filter($list, 'is_array')) : [];
    }

    private function dispatchItem(array $item): void
    {
        $trabajo = is_array($item['trabajo'] ?? null) ? $item['trabajo'] : [];
        $trabajoId = is_string($trabajo['id'] ?? null) ? $trabajo['id'] : '';
        $short = $trabajo['servidor'] ?? null;

        if (preg_match(self::TRABAJO_REGEX, $trabajoId) !== 1) {
            $this->warn('Skipping a pending Vault job without a valid id.');

            return;
        }

        $server = is_string($short) ? Server::query()->with('vaultServer')->where('uuidShort', $short)->first() : null;

        if (!$server instanceof Server || !$server->hasVaultEnabled()) {
            $this->dispatcher->fail($trabajoId, 'El servidor no existe en el panel o no tiene el Vault activo.');
            $this->warn(sprintf('Vault job %s: server %s is unknown or has the Vault disabled, reported as failed.', $trabajoId, is_string($short) ? $short : '?'));

            return;
        }

        try {
            $this->dispatcher->dispatch($item, $server);
            $this->info(sprintf('Vault job %s dispatched to server %s.', $trabajoId, $server->uuidShort));
        } catch (VaultException $exception) {
            // The dispatcher already reported the failure to the vault.
            $this->warn(sprintf('Vault job %s could not be dispatched: %s', $trabajoId, $exception->getMessage()));
        } catch (\Throwable $exception) {
            Log::error('Unexpected error while dispatching a Tebby Vault job.', [
                'trabajo' => $trabajoId,
                'server' => $server->uuidShort,
                'exception' => $exception,
            ]);
            $this->dispatcher->fail($trabajoId, 'Error interno del panel al despachar el trabajo.');
            $this->error(sprintf('Vault job %s failed unexpectedly: %s', $trabajoId, $exception->getMessage()));
        }
    }

    /**
     * @throws VaultException
     */
    private function finishItem(array $item): void
    {
        $trabajo = is_array($item['trabajo'] ?? null) ? $item['trabajo'] : [];
        $trabajoId = is_string($trabajo['id'] ?? null) ? $trabajo['id'] : '';
        $short = $trabajo['servidor'] ?? null;

        if (preg_match(self::TRABAJO_REGEX, $trabajoId) !== 1) {
            $this->warn('Skipping a finished Vault job without a valid id.');

            return;
        }

        $server = is_string($short) ? Server::query()->where('uuidShort', $short)->first() : null;

        if ($server instanceof Server) {
            if (($item['detener'] ?? false) === true && $this->dispatcher->clearRestoring($server, $trabajoId)) {
                $this->info(sprintf('Server %s is no longer restoring (job %s).', $server->uuidShort, $trabajoId));
            }

            $original = is_array($item['borrar_original'] ?? null) ? ($item['borrar_original']['uuid'] ?? null) : null;
            if (is_string($original) && ($trabajo['estado'] ?? null) === 'ok' && !$this->deleteOriginal($server, $original, $trabajoId)) {
                // Wings could not be reached: keep the job unconfirmed so the next
                // tick tries to delete the native backup again.
                return;
            }
        }

        $this->client->post(VaultClient::path('/api/panel/trabajos/%s/visto', $trabajoId));
    }

    /**
     * Deletes a native backup the vault has verified. Returns false only when
     * the deletion should be retried later.
     */
    private function deleteOriginal(Server $server, string $uuid, string $trabajoId): bool
    {
        /** @var Backup|null $backup */
        $backup = $server->backups()->where('uuid', $uuid)->first();
        if (is_null($backup)) {
            return true;
        }

        if ($backup->is_locked && $backup->is_successful && !is_null($backup->completed_at)) {
            $this->line(sprintf('Native backup %s of server %s is locked: it was imported but is not deleted.', $uuid, $server->uuidShort));

            return true;
        }

        try {
            $this->deleteBackupService->handle($backup);
            $this->info(sprintf('Native backup %s of server %s deleted after its import (job %s).', $uuid, $server->uuidShort, $trabajoId));
        } catch (BackupLockedException) {
            $this->line(sprintf('Native backup %s of server %s is locked: it was imported but is not deleted.', $uuid, $server->uuidShort));
        } catch (DaemonConnectionException $exception) {
            $this->warn(sprintf('Could not delete native backup %s of server %s, will retry: %s', $uuid, $server->uuidShort, $exception->getMessage()));

            return false;
        } catch (\Throwable $exception) {
            Log::error('Could not delete an imported native backup.', ['backup' => $uuid, 'server' => $server->uuidShort, 'exception' => $exception]);
            $this->error(sprintf('Could not delete native backup %s of server %s: %s', $uuid, $server->uuidShort, $exception->getMessage()));
        }

        return true;
    }

    /**
     * Pushes to the vault every difference between what the panel says (active,
     * name, node) and what the vault has, and deactivates on the vault servers
     * whose panel server no longer exists.
     *
     * @throws VaultException
     */
    private function reconcile(): void
    {
        $estado = $this->client->get('/api/panel/estado');

        // Keys are prefixed: an all-digit short such as "00001234" would otherwise
        // become an integer array key and stop matching.
        $remote = [];
        foreach ($this->items($estado['servidores'] ?? null) as $entry) {
            if (is_string($entry['short'] ?? null) && preg_match('/^[0-9a-f]{8}$/', $entry['short']) === 1) {
                $remote['s:' . $entry['short']] = $entry;
            }
        }

        $local = [];
        foreach (VaultServer::query()->with('server.node')->get() as $row) {
            if ($row->server instanceof Server) {
                $local['s:' . $row->server->uuidShort] = $row;
            }
        }

        foreach ($local as $key => $row) {
            $expected = $this->sync->payload($row->server, $row->enabled);

            if (!isset($remote[$key])) {
                // Enabled while the vault was unreachable: register it now.
                if ($row->enabled) {
                    $this->pushSafely($row->server, $expected);
                }

                continue;
            }

            if ($this->differs($remote[$key], $expected)) {
                $this->pushSafely($row->server, $expected);
            }
        }

        // Active on the vault but without an activation row in the panel.
        $orphans = array_filter(
            array_diff_key($remote, $local),
            fn (array $entry) => ($entry['activo'] ?? false) === true
        );

        $existing = [];
        if ($orphans !== []) {
            $shorts = array_map(fn (string $key) => substr($key, 2), array_keys($orphans));
            foreach (Server::query()->with('node')->whereIn('uuidShort', $shorts)->get() as $server) {
                $existing['s:' . $server->uuidShort] = $server;
            }
        }

        foreach ($orphans as $key => $entry) {
            $short = substr($key, 2);

            if (isset($existing[$key])) {
                $this->pushSafely($existing[$key], $this->sync->payload($existing[$key], false));

                continue;
            }

            // The panel server is gone: deactivate it with the data the vault has.
            try {
                $this->client->put(VaultClient::path('/api/panel/servidores/%s', $short), [
                    'uuid' => (string) ($entry['uuid'] ?? ''),
                    'nombre' => (string) ($entry['nombre'] ?? ''),
                    'nodo' => (string) ($entry['nodo'] ?? ''),
                    'activo' => false,
                ]);
                $this->info(sprintf('Server %s no longer exists in the panel: deactivated on the Vault.', $short));
            } catch (VaultException $exception) {
                $this->warn(sprintf('Could not deactivate the deleted server %s on the Vault: %s', $short, $exception->getMessage()));
            }
        }
    }

    private function differs(array $remote, array $expected): bool
    {
        return ($remote['activo'] ?? null) !== $expected['activo']
            || strtolower((string) ($remote['uuid'] ?? '')) !== $expected['uuid']
            || (string) ($remote['nombre'] ?? '') !== $expected['nombre']
            || (string) ($remote['nodo'] ?? '') !== $expected['nodo'];
    }

    private function pushSafely(Server $server, array $expected): void
    {
        try {
            $this->sync->push($server, $expected['activo']);
            $this->info(sprintf('Server %s synchronised with the Vault (active: %s).', $server->uuidShort, $expected['activo'] ? 'yes' : 'no'));
        } catch (VaultException $exception) {
            $this->warn(sprintf('Could not synchronise server %s with the Vault: %s', $server->uuidShort, $exception->getMessage()));
        }
    }
}
