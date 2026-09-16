<?php

declare(strict_types=1);

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\Request;
use Pterodactyl\Models\Server;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Pterodactyl\Services\Vault\VaultClient;
use Pterodactyl\Services\Vault\VaultContext;
use Pterodactyl\Exceptions\Vault\VaultException;
use Pterodactyl\Services\Vault\VaultDispatcher;
use Pterodactyl\Services\Vault\VaultSessionStore;
use Pterodactyl\Services\Vault\VaultDownloadTickets;
use Pterodactyl\Repositories\Wings\DaemonVaultRepository;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\Servers\Vault\ZipRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Vault\VaultRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Vault\ListarRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Vault\PaginaRequest;
use Pterodactyl\Exceptions\Http\Connection\DaemonConnectionException;
use Pterodactyl\Http\Requests\Api\Client\Servers\Vault\DescargarRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Vault\RestaurarRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Vault\CrearBackupRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Vault\ExclusionesRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Vault\FijarBackupRequest;

/**
 * Client API of the VAULT page (`/api/client/servers/{server}/vault/...`).
 *
 * A thin proxy: it adds the Discord session kept in the panel session plus the
 * audit headers, returns the vault's `data` untouched and renders vault errors
 * in Pterodactyl's error format. Jobs that need Wings are dispatched here, and
 * the job token for Wings never leaves the panel.
 */
class VaultController extends ClientApiController
{
    /** Backup names as they can travel in a URL path segment. */
    private const BACKUP_NAME_REGEX = '/^(?!\.{1,2}$)[^\/\\\\\x00-\x1F\x7F]{1,255}$/u';

    private const TRABAJO_REGEX = '/^[A-Za-z0-9_-]{8,64}$/';

    private const MAX_JOBS = 50;

    private const FINISHED_STATES = ['ok', 'fallo', 'cancelado'];

    public function __construct(
        private VaultClient $client,
        private VaultDispatcher $dispatcher,
        private VaultSessionStore $sessions,
        private VaultDownloadTickets $tickets,
        private DaemonVaultRepository $daemonRepository,
    ) {
        parent::__construct();
    }

    /**
     * Without a Discord session: `{sesion: null}`. With one: the public profile
     * and the page summary.
     *
     * @throws VaultException
     */
    public function index(VaultRequest $request, Server $server): JsonResponse
    {
        $sesion = $this->sessions->get($request);
        if (is_null($sesion)) {
            return $this->json(['sesion' => null]);
        }

        return $this->withSession($request, function (VaultContext $context) use ($server, $sesion) {
            return [
                'sesion' => $sesion['usuario'],
                'resumen' => $this->client->get($this->serverPath($server, 'resumen'), [], $context),
            ];
        });
    }

    /**
     * Closes the Discord session. The panel forgets it even if the vault cannot
     * be told, so the user is logged out of the Vault page either way.
     */
    public function logout(VaultRequest $request, Server $server): JsonResponse
    {
        $sesion = $this->sessions->get($request);
        $this->sessions->forget($request);

        if (!is_null($sesion)) {
            try {
                $this->client->post('/api/panel/sesion/cerrar', null, VaultContext::forRequest($request, $sesion['token']));
            } catch (VaultException $exception) {
                Log::info('Could not close a Tebby Vault session on the vault; it will expire on its own.', [
                    'codigo' => $exception->getCodigo(),
                ]);
            }
        }

        return $this->json([]);
    }

    /**
     * @throws VaultException
     */
    public function listar(ListarRequest $request, Server $server): JsonResponse
    {
        return $this->withSession($request, fn (VaultContext $context) => $this->client->get(
            $this->serverPath($server, 'listar'),
            [
                'carpeta' => $request->validated('carpeta'),
                'ruta' => $request->validated('ruta'),
                'cursor' => $request->validated('cursor'),
                'limite' => $request->validated('limite'),
            ],
            $context
        ));
    }

    /**
     * Returns a signed panel URL that streams the file from the vault.
     *
     * @throws VaultException
     */
    public function descargar(DescargarRequest $request, Server $server): JsonResponse
    {
        $this->requireSession($request);

        return $this->json([
            'url' => $this->tickets->forFile(
                $request->user(),
                $server,
                (string) $request->validated('carpeta'),
                (string) $request->validated('ruta')
            ),
        ]);
    }

    /**
     * Asks the vault for a zip ticket and returns a signed panel URL for it.
     *
     * @throws VaultException
     */
    public function zip(ZipRequest $request, Server $server): JsonResponse
    {
        return $this->withSession($request, function (VaultContext $context) use ($request, $server) {
            $body = [
                'carpeta' => (string) $request->validated('carpeta'),
                'ruta' => (string) ($request->validated('ruta') ?? ''),
            ];

            if ($request->has('nombres')) {
                $body['nombres'] = array_values((array) $request->validated('nombres'));
            }

            $data = $this->client->post($this->serverPath($server, 'zip'), $body, $context);
            $billete = $data['billete'] ?? null;

            if (!is_string($billete) || preg_match('/^[A-Za-z0-9_-]{8,256}$/', $billete) !== 1) {
                throw new VaultException(502, 'respuesta_invalida', 'El Vault devolvió una respuesta inesperada');
            }

            return ['url' => $this->tickets->forZip($request->user(), $server, $billete)];
        });
    }

    /**
     * Creates a manual backup (M-Backup) and starts the upload on Wings.
     *
     * @throws VaultException
     */
    public function crearBackup(CrearBackupRequest $request, Server $server): JsonResponse
    {
        return $this->withSession($request, function (VaultContext $context) use ($request, $server) {
            $body = ['alcance' => (string) $request->validated('alcance')];

            if ($request->has('rutas')) {
                $body['rutas'] = array_values((array) $request->validated('rutas'));
            }

            if (!is_null($request->validated('nota'))) {
                $body['nota'] = (string) $request->validated('nota');
            }

            return $this->startJob($server, $this->client->post($this->serverPath($server, 'backups'), $body, $context));
        });
    }

    /**
     * @throws VaultException
     */
    public function borrarBackup(VaultRequest $request, Server $server, string $carpeta, string $nombre): JsonResponse
    {
        $this->assertBackupName($nombre);

        return $this->withSession($request, fn (VaultContext $context) => $this->client->delete(
            $this->serverPath($server, 'backups/%s/%s', $carpeta, $nombre),
            $context
        ));
    }

    /**
     * @throws VaultException
     */
    public function fijarBackup(FijarBackupRequest $request, Server $server, string $carpeta, string $nombre): JsonResponse
    {
        $this->assertBackupName($nombre);

        return $this->withSession($request, fn (VaultContext $context) => $this->client->post(
            $this->serverPath($server, 'backups/%s/%s/fijar', $carpeta, $nombre),
            ['fijada' => $request->boolean('fijada')],
            $context
        ));
    }

    /**
     * Creates a restore job and starts it on Wings.
     *
     * @throws VaultException
     */
    public function restaurar(RestaurarRequest $request, Server $server): JsonResponse
    {
        return $this->withSession($request, function (VaultContext $context) use ($request, $server) {
            $body = [
                'carpeta' => (string) $request->validated('carpeta'),
                'backup' => $request->validated('backup'),
            ];

            if ($request->has('rutas')) {
                $body['rutas'] = array_values((array) $request->validated('rutas'));
            }

            if (!is_null($request->validated('destino'))) {
                $body['destino'] = (string) $request->validated('destino');
            }

            foreach (['detener', 'vaciar', 'encender'] as $flag) {
                if ($request->has($flag)) {
                    $body[$flag] = $request->boolean($flag);
                }
            }

            return $this->startJob($server, $this->client->post($this->serverPath($server, 'restaurar'), $body, $context));
        });
    }

    /**
     * Starts a synchronisation of the mirrors on Wings.
     *
     * @throws VaultException
     */
    public function sincronizar(VaultRequest $request, Server $server): JsonResponse
    {
        return $this->withSession($request, fn (VaultContext $context) => $this->startJob(
            $server,
            $this->client->post($this->serverPath($server, 'sincronizar'), null, $context)
        ));
    }

    /**
     * @throws VaultException
     */
    public function exclusiones(ExclusionesRequest $request, Server $server): JsonResponse
    {
        return $this->withSession($request, fn (VaultContext $context) => $this->client->put(
            $this->serverPath($server, 'exclusiones'),
            ['exclusiones' => array_values((array) $request->validated('exclusiones'))],
            $context
        ));
    }

    /**
     * @throws VaultException
     */
    public function trabajos(PaginaRequest $request, Server $server): JsonResponse
    {
        $limite = $request->validated('limite');

        return $this->withSession($request, fn (VaultContext $context) => $this->client->get(
            $this->serverPath($server, 'trabajos'),
            ['limite' => is_null($limite) ? null : min((int) $limite, self::MAX_JOBS)],
            $context
        ));
    }

    /**
     * @throws VaultException
     */
    public function trabajo(VaultRequest $request, Server $server, string $trabajo): JsonResponse
    {
        return $this->withSession($request, function (VaultContext $context) use ($server, $trabajo) {
            $data = $this->findJob($server, $trabajo, $context);

            $this->releaseFinishedRestore($server, $data['trabajo']);

            return $data;
        });
    }

    /**
     * Cancels a job on the vault and, if it is running, on Wings too.
     *
     * @throws VaultException
     */
    public function cancelar(VaultRequest $request, Server $server, string $trabajo): JsonResponse
    {
        return $this->withSession($request, function (VaultContext $context) use ($server, $trabajo) {
            // Make sure the job belongs to this server before touching it: the
            // Discord identity may have access to other servers the panel user
            // cannot see.
            $this->findJob($server, $trabajo, $context);

            $data = $this->client->post(VaultClient::path('/api/panel/trabajos/%s/cancelar', $trabajo), null, $context);

            try {
                $this->daemonRepository->setServer($server)->cancelar($trabajo);
            } catch (DaemonConnectionException $exception) {
                // Not fatal: a job that is not running on Wings has nothing to stop,
                // and a running one is also told to abort through its progress calls.
                Log::info('Wings did not cancel a Tebby Vault job.', [
                    'server' => $server->uuidShort,
                    'trabajo' => $trabajo,
                    'error' => $exception->getMessage(),
                ]);
            }

            return $data;
        });
    }

    /**
     * @throws VaultException
     */
    public function actividad(PaginaRequest $request, Server $server): JsonResponse
    {
        return $this->withSession($request, fn (VaultContext $context) => $this->client->get(
            $this->serverPath($server, 'actividad'),
            ['cursor' => $request->validated('cursor'), 'limite' => $request->validated('limite')],
            $context
        ));
    }

    /**
     * Runs a vault call with the stored Discord session, translating the errors
     * that concern the session itself.
     *
     * @param \Closure(VaultContext, array): array $callback
     *
     * @throws VaultException
     */
    private function withSession(Request $request, \Closure $callback): JsonResponse
    {
        $sesion = $this->requireSession($request);

        try {
            return $this->json($callback(VaultContext::forRequest($request, $sesion['token']), $sesion));
        } catch (VaultException $exception) {
            if ($exception->is(VaultException::SESION_PANEL)) {
                $this->sessions->forget($request);

                throw new VaultException(401, VaultException::SESION_PANEL, $exception->getMessage());
            }

            // The page shows who is logged in when access is denied; the vault may
            // not repeat the identity on every endpoint, the stored profile has it.
            if ($exception->is(VaultException::SIN_ACCESO) && $exception->getDatos() === []) {
                throw $exception->withDatos([
                    'discord_id' => $sesion['usuario']['id'] ?? '',
                    'nombre' => $sesion['usuario']['nombre'] ?? '',
                ]);
            }

            throw $exception;
        }
    }

    /**
     * @throws VaultException
     */
    private function requireSession(Request $request): array
    {
        $sesion = $this->sessions->get($request);

        if (is_null($sesion)) {
            throw new VaultException(401, VaultException::SESION_PANEL, 'Inicia sesión con Discord para usar el Vault');
        }

        return $sesion;
    }

    /**
     * Sends the job the vault just created to Wings and returns only the job:
     * the `wings` part carries the job token and must not reach the browser.
     *
     * @throws VaultException
     */
    private function startJob(Server $server, array $data): array
    {
        if (!is_array($data['trabajo'] ?? null)) {
            throw new VaultException(502, 'respuesta_invalida', 'El Vault devolvió una respuesta inesperada');
        }

        // Without instructions for Wings the job stays queued on the vault and
        // vault:tick dispatches it when the vault lists it as pending.
        if (!is_array($data['wings'] ?? null)) {
            return ['trabajo' => $data['trabajo']];
        }

        return ['trabajo' => $this->dispatcher->dispatch($data, $server)];
    }

    /**
     * The page polls its restore until it ends: lift `restoring_backup` as soon as
     * the vault reports the job finished instead of waiting up to a minute for
     * vault:tick (which still clears it too; both are idempotent). Only the job
     * the dispatcher recorded as having stopped the server can do it.
     */
    private function releaseFinishedRestore(Server $server, array $trabajo): void
    {
        $id = $trabajo['id'] ?? null;

        if (
            $server->status !== Server::STATUS_RESTORING_BACKUP
            || ($trabajo['tipo'] ?? null) !== 'restaurar'
            || !in_array($trabajo['estado'] ?? null, self::FINISHED_STATES, true)
            || !is_string($id)
        ) {
            return;
        }

        $this->dispatcher->clearRestoring($server, $id, true);
    }

    /**
     * @throws VaultException
     */
    private function findJob(Server $server, string $trabajo, VaultContext $context): array
    {
        if (preg_match(self::TRABAJO_REGEX, $trabajo) !== 1) {
            throw new VaultException(404, 'trabajo', 'Trabajo desconocido');
        }

        $data = $this->client->get(VaultClient::path('/api/panel/trabajos/%s', $trabajo), [], $context);

        if (($data['trabajo']['servidor'] ?? null) !== $server->uuidShort) {
            throw new VaultException(404, 'trabajo', 'Trabajo desconocido');
        }

        return $data;
    }

    /**
     * @throws VaultException
     */
    private function assertBackupName(string $nombre): void
    {
        if (preg_match(self::BACKUP_NAME_REGEX, $nombre) !== 1) {
            throw new VaultException(404, 'backup', 'Copia desconocida');
        }
    }

    private function serverPath(Server $server, string $suffix, string ...$segments): string
    {
        return VaultClient::path('/api/panel/servidores/%s/' . $suffix, $server->uuidShort, ...$segments);
    }

    /**
     * The vault's data as JSON, keeping an empty object as `{}`.
     */
    private function json(array $data): JsonResponse
    {
        return new JsonResponse($data === [] ? new \stdClass() : $data, JsonResponse::HTTP_OK, [], VaultClient::JSON_FLAGS);
    }
}
