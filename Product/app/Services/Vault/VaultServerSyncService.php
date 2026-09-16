<?php

declare(strict_types=1);

namespace Pterodactyl\Services\Vault;

use Carbon\CarbonImmutable;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\VaultServer;
use Illuminate\Database\ConnectionInterface;
use Pterodactyl\Exceptions\Vault\VaultException;

/**
 * Enables and disables the Vault for a server and keeps the vault's copy of the
 * server (`PUT /api/panel/servidores/{short}`) in line with the panel.
 */
class VaultServerSyncService
{
    /** The vault accepts up to 120 characters for names. */
    private const MAX_TEXT_LENGTH = 120;

    public function __construct(
        private VaultClient $client,
        private ConnectionInterface $connection,
    ) {
    }

    /**
     * What the vault should know about a server.
     *
     * @return array{uuid: string, nombre: string, nodo: string, activo: bool}
     */
    public function payload(Server $server, bool $activo): array
    {
        return [
            'uuid' => strtolower($server->uuid),
            'nombre' => mb_substr($server->name, 0, self::MAX_TEXT_LENGTH),
            'nodo' => mb_substr($server->node->name, 0, self::MAX_TEXT_LENGTH),
            'activo' => $activo,
        ];
    }

    /**
     * @return array `{servidor: ServidorAdmin}`
     *
     * @throws VaultException
     */
    public function push(Server $server, bool $activo, ?VaultContext $context = null): array
    {
        return $this->client->put(
            VaultClient::path('/api/panel/servidores/%s', $server->uuidShort),
            $this->payload($server, $activo),
            $context
        );
    }

    /**
     * Enables the Vault. The row and the registration in the vault happen in the
     * same transaction: if the vault cannot be reached nothing changes in the
     * panel and native backups keep working.
     *
     * @throws VaultException
     * @throws \Throwable
     */
    public function enable(Server $server, ?VaultContext $context = null): VaultServer
    {
        return $this->connection->transaction(function () use ($server, $context) {
            /** @var VaultServer $row */
            $row = VaultServer::query()->lockForUpdate()->firstOrNew(['server_id' => $server->id]);

            if (!$row->enabled || is_null($row->enabled_at)) {
                $row->enabled_at = CarbonImmutable::now();
            }

            $row->enabled = true;
            $row->save();

            $this->push($server, true, $context);

            $server->setRelation('vaultServer', $row);

            return $row;
        });
    }

    /**
     * Disables the Vault. The panel is the source of truth, so the row changes
     * first; if the vault cannot be told now vault:tick retries every minute.
     *
     * @return bool whether the vault was updated as well
     */
    public function disable(Server $server, ?VaultContext $context = null): bool
    {
        /** @var VaultServer|null $row */
        $row = VaultServer::query()->find($server->id);
        if (is_null($row) || !$row->enabled) {
            return true;
        }

        $row->enabled = false;
        $row->enabled_at = null;
        $row->save();

        $server->setRelation('vaultServer', $row);

        try {
            $this->push($server, false, $context);
        } catch (VaultException) {
            return false;
        }

        return true;
    }
}
