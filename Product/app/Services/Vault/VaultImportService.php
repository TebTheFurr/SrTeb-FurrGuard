<?php

declare(strict_types=1);

namespace Pterodactyl\Services\Vault;

use Pterodactyl\Models\Backup;
use Pterodactyl\Models\Server;
use Illuminate\Support\Collection;
use Pterodactyl\Exceptions\Vault\VaultException;

/**
 * Imports native Pterodactyl backups into the vault. The vault queues one
 * `importar` job per backup and vault:tick dispatches them to Wings.
 */
class VaultImportService
{
    private const MAX_NAME_LENGTH = 120;

    public function __construct(private VaultClient $client)
    {
    }

    /**
     * Native backups that can be imported: stored by Wings, finished correctly
     * and with a checksum the vault can verify the upload against.
     *
     * @return Collection<int, Backup>
     */
    public function eligible(Server $server): Collection
    {
        return $server->backups()
            ->where('disk', Backup::ADAPTER_WINGS)
            ->where('is_successful', true)
            ->whereNotNull('completed_at')
            ->whereNotNull('checksum')
            ->orderBy('created_at')
            ->get()
            ->toBase();
    }

    /**
     * Leaves out the backups the vault already holds, according to a server
     * detail (`GET /api/panel/servidores/{short}`) already fetched.
     *
     * @param Collection<int, Backup> $backups
     *
     * @return Collection<int, Backup>
     */
    public function withoutImported(Collection $backups, array $detalle): Collection
    {
        $imported = collect(is_array($detalle['backups'] ?? null) ? $detalle['backups'] : [])
            ->map(fn ($backup) => is_array($backup) && is_array($backup['importada'] ?? null) ? ($backup['importada']['uuid'] ?? null) : null)
            ->filter(fn ($uuid) => is_string($uuid))
            ->map(fn (string $uuid) => strtolower($uuid))
            ->all();

        return $backups->reject(fn (Backup $backup) => in_array(strtolower($backup->uuid), $imported, true))->values();
    }

    /**
     * Eligible backups the vault does not have yet.
     *
     * @return Collection<int, Backup>
     *
     * @throws VaultException
     */
    public function pending(Server $server, ?VaultContext $context = null): Collection
    {
        $detalle = $this->client->get(VaultClient::path('/api/panel/servidores/%s', $server->uuidShort), [], $context);

        return $this->withoutImported($this->eligible($server), $detalle);
    }

    /**
     * Queues the import of the given backups.
     *
     * @param Collection<int, Backup> $backups
     *
     * @return array the queued jobs
     *
     * @throws VaultException
     */
    public function import(Server $server, Collection $backups, bool $deleteOriginals, ?VaultContext $context = null): array
    {
        if ($backups->isEmpty()) {
            return [];
        }

        $data = $this->client->post(VaultClient::path('/api/panel/servidores/%s/importaciones', $server->uuidShort), [
            'backups' => $backups->map(fn (Backup $backup) => [
                'uuid' => strtolower($backup->uuid),
                'nombre' => mb_substr($backup->name, 0, self::MAX_NAME_LENGTH),
                'creado_ts' => (float) $backup->created_at->getTimestamp(),
                'bytes' => (int) $backup->bytes,
                'checksum' => (string) $backup->checksum,
            ])->values()->all(),
            'borrar_originales' => $deleteOriginals,
        ], $context);

        return is_array($data['trabajos'] ?? null) ? $data['trabajos'] : [];
    }
}
