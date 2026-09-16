<?php

declare(strict_types=1);

namespace Pterodactyl\Console\Commands\Vault;

use Pterodactyl\Models\Server;
use Illuminate\Console\Command;
use Pterodactyl\Models\VaultServer;
use Pterodactyl\Services\Vault\VaultClient;
use Pterodactyl\Exceptions\Vault\VaultException;
use Pterodactyl\Services\Vault\VaultImportService;

/**
 * Queues the import of native Wings backups (finished correctly) into the vault
 * for one server or for every server with the Vault active.
 */
class ImportBackupsCommand extends Command
{
    protected $signature = 'vault:import-backups
        {server? : Server id, uuidShort or uuid}
        {--all : Every server with the Vault active}
        {--delete-originals : Delete each native backup once the vault has verified it}';

    protected $description = 'Imports the native Wings backups of servers with the Tebby Vault active into the vault.';

    public function __construct(private VaultImportService $importer)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        if (!VaultClient::configured()) {
            $this->line('The Tebby Vault is not configured (VAULT_URL / VAULT_PANEL_KEY): nothing to do.');

            return self::SUCCESS;
        }

        $identifier = $this->argument('server');
        $all = (bool) $this->option('all');

        if (is_null($identifier) === !$all) {
            $this->error('Pass either a server (id, uuidShort or uuid) or --all.');

            return self::INVALID;
        }

        $servers = $all ? $this->enabledServers() : $this->findServer((string) $identifier);
        if (is_null($servers)) {
            return self::FAILURE;
        }

        $deleteOriginals = (bool) $this->option('delete-originals');
        $failed = false;

        foreach ($servers as $server) {
            try {
                $pending = $this->importer->pending($server);

                if ($pending->isEmpty()) {
                    $this->line(sprintf('%s (%s): no native backups left to import.', $server->name, $server->uuidShort));

                    continue;
                }

                $trabajos = $this->importer->import($server, $pending, $deleteOriginals);
                $this->info(sprintf('%s (%s): %d backups queued for import.', $server->name, $server->uuidShort, count($trabajos)));
            } catch (VaultException $exception) {
                $this->error(sprintf('%s (%s): [%s] %s', $server->name, $server->uuidShort, $exception->getCodigo(), $exception->getMessage()));
                $failed = true;
            }
        }

        return $failed ? self::FAILURE : self::SUCCESS;
    }

    /**
     * @return Server[]
     */
    private function enabledServers(): array
    {
        return VaultServer::query()
            ->where('enabled', true)
            ->with('server')
            ->get()
            ->map(fn (VaultServer $row) => $row->server)
            ->filter(fn ($server) => $server instanceof Server)
            ->values()
            ->all();
    }

    /**
     * @return Server[]|null
     */
    private function findServer(string $identifier): ?array
    {
        $server = Server::query()->with('vaultServer')
            ->when(
                ctype_digit($identifier) && strlen($identifier) !== 8,
                fn ($query) => $query->where('id', (int) $identifier),
                fn ($query) => $query->where(strlen($identifier) === 8 ? 'uuidShort' : 'uuid', $identifier)
            )
            ->first();

        if (!$server instanceof Server) {
            $this->error(sprintf('Server "%s" not found.', $identifier));

            return null;
        }

        if (!$server->hasVaultEnabled()) {
            $this->error(sprintf('%s (%s) does not have the Vault active.', $server->name, $server->uuidShort));

            return null;
        }

        return [$server];
    }
}
