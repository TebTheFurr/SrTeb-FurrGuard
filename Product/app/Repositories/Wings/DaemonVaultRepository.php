<?php

namespace Pterodactyl\Repositories\Wings;

use Webmozart\Assert\Assert;
use Pterodactyl\Models\Server;
use Psr\Http\Message\ResponseInterface;
use GuzzleHttp\Exception\TransferException;
use Pterodactyl\Exceptions\Http\Connection\DaemonConnectionException;

/**
 * Vault jobs on the Tebby fork of Wings.
 *
 * The panel never builds these payloads itself: it forwards, untouched, the
 * `wings` object the vault created for the job (it carries the single-job
 * token Wings uses to talk to the vault).
 *
 * @method \Pterodactyl\Repositories\Wings\DaemonVaultRepository setNode(\Pterodactyl\Models\Node $node)
 * @method \Pterodactyl\Repositories\Wings\DaemonVaultRepository setServer(\Pterodactyl\Models\Server $server)
 */
class DaemonVaultRepository extends DaemonRepository
{
    public const ACCION_ENVIAR = 'enviar';
    public const ACCION_RECIBIR = 'recibir';
    public const ACCION_IMPORTAR = 'importar';

    public const ACCIONES = [self::ACCION_ENVIAR, self::ACCION_RECIBIR, self::ACCION_IMPORTAR];

    /**
     * Uploads the server files (or part of them) to the vault.
     *
     * @throws DaemonConnectionException
     */
    public function enviar(array $wings): ResponseInterface
    {
        return $this->start(self::ACCION_ENVIAR, $wings);
    }

    /**
     * Restores files from the vault into the server.
     *
     * @throws DaemonConnectionException
     */
    public function recibir(array $wings): ResponseInterface
    {
        return $this->start(self::ACCION_RECIBIR, $wings);
    }

    /**
     * Uploads a native backup archive to the vault.
     *
     * @throws DaemonConnectionException
     */
    public function importar(array $wings): ResponseInterface
    {
        return $this->start(self::ACCION_IMPORTAR, $wings);
    }

    /**
     * Cancels a vault job running on the node.
     *
     * @throws DaemonConnectionException
     */
    public function cancelar(string $trabajo): ResponseInterface
    {
        Assert::isInstanceOf($this->server, Server::class);

        try {
            return $this->getHttpClient()->delete(
                sprintf('/api/servers/%s/vault/%s', $this->server->uuid, rawurlencode($trabajo))
            );
        } catch (TransferException $exception) {
            throw new DaemonConnectionException($exception);
        }
    }

    /**
     * @throws DaemonConnectionException
     */
    private function start(string $accion, array $wings): ResponseInterface
    {
        Assert::isInstanceOf($this->server, Server::class);

        try {
            return $this->getHttpClient()->post(
                sprintf('/api/servers/%s/vault/%s', $this->server->uuid, $accion),
                ['json' => $wings]
            );
        } catch (TransferException $exception) {
            throw new DaemonConnectionException($exception);
        }
    }
}
