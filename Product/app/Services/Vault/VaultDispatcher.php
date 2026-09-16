<?php

declare(strict_types=1);

namespace Pterodactyl\Services\Vault;

use Pterodactyl\Models\Server;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use GuzzleHttp\Exception\RequestException;
use Pterodactyl\Exceptions\Vault\VaultException;
use Pterodactyl\Repositories\Wings\DaemonVaultRepository;
use Pterodactyl\Exceptions\Http\Connection\DaemonConnectionException;

/**
 * Hands vault jobs (`{trabajo, wings}`) over to the Wings fork of their server.
 *
 * If Wings cannot take the job the vault is told right away (`fallo`) so the
 * job does not sit in `despachado` until the vault gives up on it.
 */
class VaultDispatcher
{
    private const TRABAJO_REGEX = '/^[A-Za-z0-9_-]{8,64}$/';

    /**
     * Remembers which job put a server in `restoring_backup`, so finishing an
     * old job never clears the status set by a newer restore.
     */
    private const RESTORE_MARKER_PREFIX = 'vault:restaurando:';
    private const RESTORE_MARKER_TTL_SECONDS = 172800;

    public function __construct(
        private DaemonVaultRepository $repository,
        private VaultClient $client,
    ) {
    }

    /**
     * @param array $item `{trabajo: Trabajo, wings: WingsEnviar|WingsRecibir|WingsImportar}`
     *
     * @return array the Trabajo, as the vault returned it
     *
     * @throws VaultException if the job could not be started (the vault has
     *                        already been told about the failure)
     */
    public function dispatch(array $item, Server $server): array
    {
        $trabajo = is_array($item['trabajo'] ?? null) ? $item['trabajo'] : [];
        $wings = is_array($item['wings'] ?? null) ? $item['wings'] : [];
        $trabajoId = is_string($trabajo['id'] ?? null) ? $trabajo['id'] : '';

        if (preg_match(self::TRABAJO_REGEX, $trabajoId) !== 1) {
            Log::warning('The Tebby Vault returned a job without a valid id.', ['server' => $server->uuidShort]);

            throw new VaultException(502, 'respuesta_invalida', 'El Vault devolvió un trabajo no válido');
        }

        $accion = $wings['accion'] ?? null;
        if (!in_array($accion, DaemonVaultRepository::ACCIONES, true) || ($wings['trabajo'] ?? null) !== $trabajoId) {
            $this->fail($trabajoId, 'El panel recibió instrucciones para Wings mal formadas.');

            throw new VaultException(502, VaultException::DESPACHO, 'El Vault devolvió instrucciones para Wings no válidas', ['trabajo' => $trabajo]);
        }

        $problem = $this->stateProblem($accion, $server);
        if (!is_null($problem)) {
            $this->fail($trabajoId, $problem);

            throw new VaultException(409, 'estado_servidor', $problem, ['trabajo' => $trabajo]);
        }

        // Stopping the server for a restore locks it in the panel exactly like a
        // native backup restore does, until vault:tick sees the job finished.
        $restoring = $accion === DaemonVaultRepository::ACCION_RECIBIR && ($wings['detener'] ?? false) === true;
        if ($restoring) {
            $server->update(['status' => Server::STATUS_RESTORING_BACKUP]);
            Cache::put(self::markerKey($server), $trabajoId, self::RESTORE_MARKER_TTL_SECONDS);
        }

        try {
            $this->repository->setServer($server);

            match ($accion) {
                DaemonVaultRepository::ACCION_ENVIAR => $this->repository->enviar($wings),
                DaemonVaultRepository::ACCION_RECIBIR => $this->repository->recibir($wings),
                DaemonVaultRepository::ACCION_IMPORTAR => $this->repository->importar($wings),
            };
        } catch (DaemonConnectionException $exception) {
            if ($restoring) {
                $this->clearRestoring($server, $trabajoId);
            }

            $message = $this->wingsErrorMessage($exception);

            Log::warning('Wings did not accept a Tebby Vault job.', [
                'server' => $server->uuidShort,
                'trabajo' => $trabajoId,
                'accion' => $accion,
                'error' => $exception->getMessage(),
            ]);

            $this->fail($trabajoId, $message);

            throw new VaultException(502, VaultException::DESPACHO, $message, ['trabajo' => $trabajo], null, $exception);
        }

        return $trabajo;
    }

    /**
     * Tells the vault the panel could not dispatch a job. If even that fails the
     * vault re-queues the job on its own after ten minutes.
     */
    public function fail(string $trabajoId, string $error): void
    {
        try {
            $this->client->post(
                VaultClient::path('/api/panel/trabajos/%s/fallo', $trabajoId),
                ['error' => mb_substr($error, 0, 500)]
            );
        } catch (VaultException $exception) {
            Log::warning('Could not report a dispatch failure to the Tebby Vault.', [
                'trabajo' => $trabajoId,
                'codigo' => $exception->getCodigo(),
            ]);
        }
    }

    /**
     * Takes a server out of `restoring_backup` once the restore that set it is
     * over. Idempotent; returns whether the status was cleared.
     *
     * vault:tick knows from `terminados[].detener` that the job stopped the server,
     * so a missing marker (e.g. a flushed cache) does not stop it from clearing.
     * Other callers only see the Trabajo, which does not say whether it stopped
     * the server: they pass $requireMarker so only the job recorded here as the
     * one that set the status can clear it.
     */
    public function clearRestoring(Server $server, string $trabajoId, bool $requireMarker = false): bool
    {
        $key = self::markerKey($server);
        $marker = Cache::get($key);

        if ($requireMarker ? $marker !== $trabajoId : (!is_null($marker) && $marker !== $trabajoId)) {
            return false;
        }

        Cache::forget($key);

        if ($server->status !== Server::STATUS_RESTORING_BACKUP) {
            return false;
        }

        $server->update(['status' => null]);

        return true;
    }

    /**
     * Why the job cannot be sent to Wings right now, if there is a reason.
     */
    private function stateProblem(string $accion, Server $server): ?string
    {
        if (!$server->isInstalled()) {
            return 'El servidor todavía no está instalado.';
        }

        if (!is_null($server->transfer)) {
            return 'El servidor se está transfiriendo a otro nodo.';
        }

        if ($server->node->isUnderMaintenance()) {
            return 'El nodo del servidor está en mantenimiento.';
        }

        // A `restoring_backup` set by a Vault restore is not a conflict of the panel's
        // to enforce: the vault refuses new jobs while one is active (409 ocupado), so
        // if it handed out this one the restore is over and the status is only waiting
        // to be lifted. Without the marker the status comes from elsewhere and blocks.
        $vaultRestoring = $server->status === Server::STATUS_RESTORING_BACKUP && Cache::has(self::markerKey($server));

        if ($accion === DaemonVaultRepository::ACCION_RECIBIR && !is_null($server->status) && !$vaultRestoring) {
            return 'El servidor no está en un estado que permita restaurar (suspendido, restaurando o con la reinstalación fallida).';
        }

        if ($server->status === Server::STATUS_RESTORING_BACKUP && !$vaultRestoring) {
            return 'El servidor se está restaurando.';
        }

        return null;
    }

    private function wingsErrorMessage(DaemonConnectionException $exception): string
    {
        $previous = $exception->getPrevious();
        $status = $previous instanceof RequestException && $previous->hasResponse()
            ? $previous->getResponse()->getStatusCode()
            : null;

        return match (true) {
            $status === 404 => 'Wings no reconoce el servidor o no tiene el soporte del Vault instalado en ese nodo.',
            $status === 409 => 'Wings ya está ejecutando un trabajo del Vault en este servidor.',
            $status === 400 => 'Wings rechazó el trabajo: el servidor está suspendido o la petición no es válida.',
            !is_null($status) => 'Wings respondió con un error al recibir el trabajo.',
            default => 'No se pudo conectar con Wings en el nodo de este servidor.',
        };
    }

    private static function markerKey(Server $server): string
    {
        return self::RESTORE_MARKER_PREFIX . $server->id;
    }
}
