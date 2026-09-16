<?php

declare(strict_types=1);

namespace Pterodactyl\Http\Controllers\Base;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Pterodactyl\Models\Server;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\RedirectResponse;
use Psr\Http\Message\ResponseInterface;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Services\Vault\VaultClient;
use Pterodactyl\Services\Vault\VaultContext;
use Symfony\Component\HttpFoundation\HeaderUtils;
use Pterodactyl\Exceptions\Vault\VaultException;
use Pterodactyl\Services\Vault\VaultAccessService;
use Pterodactyl\Services\Vault\VaultSessionStore;
use Pterodactyl\Services\Vault\VaultDownloadTickets;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/**
 * Browser-facing routes of the Vault: the Discord login bridge (§4.2 of the
 * contract) and the streamed downloads behind signed URLs.
 */
class VaultAuthController extends Controller
{
    private const DISCORD_HOSTS = ['discord.com', 'discordapp.com', 'ptb.discord.com', 'canary.discord.com'];

    private const CODE_REGEX = '/^[A-Za-z0-9._~-]{1,512}$/';

    private const STREAM_CHUNK_BYTES = 262144;

    /** Consecutive empty reads tolerated before a stalled stream is dropped. */
    private const MAX_EMPTY_READS = 1000;

    /** Headers of the vault download passed on to the browser as they are. */
    private const PASSTHROUGH_HEADERS = ['Content-Length', 'Content-Range', 'Accept-Ranges', 'Last-Modified', 'ETag'];

    public function __construct(
        private VaultClient $client,
        private VaultSessionStore $sessions,
        private VaultAccessService $access,
        private VaultDownloadTickets $tickets,
    ) {
    }

    /**
     * GET /vault/login?servidor=<uuidShort>: starts the Discord login on the vault
     * and sends the browser to Discord.
     */
    public function login(Request $request): RedirectResponse
    {
        $server = $this->access->findUsableServer($request->user(), $request->query('servidor'));
        if (is_null($server)) {
            throw new NotFoundHttpException();
        }

        try {
            $data = $this->client->post('/api/panel/oauth/inicio', ['servidor' => $server->uuidShort], VaultContext::forRequest($request));
        } catch (VaultException) {
            return $this->toVaultPage($server, ['error' => 'discord']);
        }

        $url = is_string($data['url'] ?? null) ? $data['url'] : '';
        $estado = is_string($data['estado'] ?? null) ? $data['estado'] : '';

        if (!$this->isDiscordUrl($url) || !$this->sessions->putOauth($request, $estado, $server->uuidShort)) {
            Log::warning('The Tebby Vault returned an unusable OAuth start response.', ['server' => $server->uuidShort]);

            return $this->toVaultPage($server, ['error' => 'discord']);
        }

        return redirect()->away($url);
    }

    /**
     * GET /vault/callback: Discord comes back here; the code is exchanged by the
     * vault and the resulting session is kept in the panel session.
     */
    public function callback(Request $request): RedirectResponse
    {
        $oauth = $this->sessions->pullOauth($request);
        if (is_null($oauth)) {
            return redirect()->to('/');
        }

        $server = $this->access->findUsableServer($request->user(), $oauth['servidor']);
        if (is_null($server)) {
            throw new NotFoundHttpException();
        }

        $state = $request->query('state');
        if ($oauth['expired'] || !is_string($state) || !hash_equals($oauth['estado'], $state)) {
            return $this->toVaultPage($server, ['error' => 'discord']);
        }

        // Discord redirects with ?error=access_denied when the user cancels.
        if (!is_null($request->query('error'))) {
            return $this->toVaultPage($server, ['error' => 'cancelado']);
        }

        $code = $request->query('code');
        if (!is_string($code) || preg_match(self::CODE_REGEX, $code) !== 1) {
            return $this->toVaultPage($server, ['error' => 'discord']);
        }

        try {
            $data = $this->client->post('/api/panel/oauth/canje', [
                'estado' => $oauth['estado'],
                'code' => $code,
                'servidor' => $server->uuidShort,
            ], VaultContext::forRequest($request));
        } catch (VaultException $exception) {
            if ($exception->is(VaultException::SIN_ACCESO)) {
                // The identity just chosen is the one that matters: drop any older one.
                $this->sessions->forget($request);
                $nombre = $exception->getDatos()['nombre'] ?? '';

                return $this->toVaultPage($server, [
                    'error' => 'sin_acceso',
                    'nombre' => is_string($nombre) ? mb_substr($nombre, 0, 100) : '',
                ]);
            }

            return $this->toVaultPage($server, ['error' => 'discord']);
        }

        if (!$this->sessions->put($request, $data)) {
            Log::warning('The Tebby Vault returned an unusable OAuth exchange response.', ['server' => $server->uuidShort]);

            return $this->toVaultPage($server, ['error' => 'discord']);
        }

        return $this->toVaultPage($server);
    }

    /**
     * GET /vault/descarga/{ticket}: streams a file or a zip from the vault. Only
     * reachable through the signed URL the client API issued to this same user.
     */
    public function descarga(Request $request, string $ticket): Response|RedirectResponse|StreamedResponse
    {
        if (!$request->hasValidRelativeSignature()) {
            throw new AccessDeniedHttpException('El enlace de descarga no es válido o ha caducado.');
        }

        $payload = $this->tickets->resolve($ticket);
        if (is_null($payload) || $payload['usuario'] !== $request->user()->id) {
            throw new NotFoundHttpException();
        }

        $server = Server::query()->with('vaultServer')->find($payload['servidor']);
        if (!$server instanceof Server || !$this->access->canUse($request->user(), $server)) {
            throw new NotFoundHttpException();
        }

        $sesion = $this->sessions->get($request);
        if (is_null($sesion)) {
            return $this->toVaultPage($server);
        }

        set_time_limit(0);
        $context = VaultContext::forRequest($request, $sesion['token']);

        try {
            if ($payload['tipo'] === VaultDownloadTickets::TIPO_ZIP) {
                // Zip tickets are single use on the vault anyway.
                $this->tickets->consume($ticket);
                $upstream = $this->client->stream(VaultClient::path('/api/panel/zip/%s', (string) $payload['billete']), [], $context);
                $filename = $server->uuidShort . '.zip';
            } else {
                $upstream = $this->client->stream(
                    VaultClient::path('/api/panel/servidores/%s/descargar', $server->uuidShort),
                    ['carpeta' => (string) $payload['carpeta'], 'ruta' => (string) $payload['ruta']],
                    $context,
                    $this->rangeHeader($request)
                );
                $filename = basename(str_replace('\\', '/', (string) $payload['ruta']));
            }
        } catch (VaultException $exception) {
            if ($exception->is(VaultException::SESION_PANEL)) {
                $this->sessions->forget($request);

                return $this->toVaultPage($server);
            }

            return new Response($exception->getMessage(), $exception->getStatusCode(), [
                'Content-Type' => 'text/plain; charset=utf-8',
                'Cache-Control' => 'no-store',
            ]);
        }

        return $this->streamToBrowser($upstream, $filename !== '' ? $filename : 'descarga');
    }

    private function streamToBrowser(ResponseInterface $upstream, string $filename): StreamedResponse
    {
        $headers = [
            'Content-Type' => $this->contentType($upstream->getHeaderLine('Content-Type')),
            'Content-Disposition' => $this->disposition($upstream->getHeaderLine('Content-Disposition'), $filename),
            'Cache-Control' => 'no-store',
            'X-Accel-Buffering' => 'no',
            'X-Content-Type-Options' => 'nosniff',
            // Whatever the file is, it must never run as a page of the panel.
            'Content-Security-Policy' => "default-src 'none'; sandbox",
        ];

        foreach (self::PASSTHROUGH_HEADERS as $name) {
            $value = $upstream->getHeaderLine($name);
            if ($value !== '' && preg_match('/[\r\n]/', $value) !== 1) {
                $headers[$name] = $value;
            }
        }

        $body = $upstream->getBody();

        return new StreamedResponse(function () use ($body) {
            set_time_limit(0);
            $emptyReads = 0;

            try {
                while (!$body->eof()) {
                    $chunk = $body->read(self::STREAM_CHUNK_BYTES);

                    if ($chunk === '') {
                        if ($body->getMetadata('timed_out') === true || ++$emptyReads > self::MAX_EMPTY_READS) {
                            break;
                        }

                        continue;
                    }

                    $emptyReads = 0;
                    echo $chunk;

                    if (ob_get_level() > 0) {
                        ob_flush();
                    }
                    flush();

                    if (connection_aborted()) {
                        break;
                    }
                }
            } catch (\RuntimeException $exception) {
                Log::info('A Tebby Vault download was interrupted.', ['error' => $exception->getMessage()]);
            } finally {
                $body->close();
            }
        }, $upstream->getStatusCode(), $headers);
    }

    /**
     * Only simple byte ranges are forwarded, so the vault can resume downloads.
     *
     * @return array<string, string>
     */
    private function rangeHeader(Request $request): array
    {
        $range = $request->headers->get('Range');

        return is_string($range) && preg_match('/^bytes=[0-9]*-[0-9]*(,\s*[0-9]*-[0-9]*){0,4}$/', $range) === 1
            ? ['Range' => $range]
            : [];
    }

    private function contentType(string $value): string
    {
        return preg_match('#^[A-Za-z0-9.+-]+/[A-Za-z0-9.+-]+(\s*;\s*[A-Za-z0-9.+-]+=("[^"\r\n]*"|[A-Za-z0-9.+-]+))*$#', $value) === 1
            ? $value
            : 'application/octet-stream';
    }

    /**
     * Always an attachment: a vault file must never be rendered inline.
     */
    private function disposition(string $value, string $filename): string
    {
        if ($value !== '' && preg_match('/[\r\n]/', $value) !== 1) {
            if (preg_match('/^\s*attachment\b/i', $value) === 1) {
                return $value;
            }

            if (preg_match('/^\s*inline\b/i', $value) === 1) {
                return (string) preg_replace('/^\s*inline\b/i', 'attachment', $value);
            }
        }

        $fallback = preg_replace('/[^\x20-\x7E]|[\/\\\\%"]/', '_', $filename) ?: 'descarga';

        return HeaderUtils::makeDisposition(HeaderUtils::DISPOSITION_ATTACHMENT, $filename, $fallback);
    }

    private function isDiscordUrl(string $url): bool
    {
        $parts = parse_url($url);
        if (!is_array($parts) || !isset($parts['scheme'], $parts['host'])) {
            return false;
        }

        $scheme = strtolower($parts['scheme']);

        // The vault's development server fakes Discord on a local address.
        if (app()->environment('local')) {
            return in_array($scheme, ['http', 'https'], true);
        }

        return $scheme === 'https' && in_array(strtolower($parts['host']), self::DISCORD_HOSTS, true);
    }

    /**
     * Redirects to the VAULT page of the server, optionally with ?error=... for
     * the page to explain what happened.
     */
    private function toVaultPage(Server $server, array $query = []): RedirectResponse
    {
        $url = '/server/' . $server->uuidShort . '/vault';

        return redirect()->to($query === [] ? $url : $url . '?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986));
    }
}
