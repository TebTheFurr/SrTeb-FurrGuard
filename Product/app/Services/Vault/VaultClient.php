<?php

declare(strict_types=1);

namespace Pterodactyl\Services\Vault;

use GuzzleHttp\Client;
use GuzzleHttp\Psr7\Utils;
use GuzzleHttp\ClientInterface;
use Illuminate\Support\Facades\Log;
use Psr\Http\Message\ResponseInterface;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\Psr7\Request as PsrRequest;
use Pterodactyl\Exceptions\Vault\VaultException;

/**
 * HTTP client for the panel API of the Tebby Vault (`/api/panel/...`).
 *
 * Every request is signed as the vault expects:
 *
 *   X-Vault-Firma: t=<unix>,n=<nonce>,f=HMAC-SHA256(key, METHOD\nTARGET\nt\nn\nsha256hex(body))
 *
 * where TARGET is the exact path and query placed on the request line. To keep
 * that byte-for-byte true the query string is built here with RFC 3986 encoding
 * and the full URI is handed to Guzzle, whose URI normalisation leaves already
 * encoded strings untouched; JSON bodies are encoded once and that very string
 * is both hashed and sent.
 */
class VaultClient
{
    public const JSON_FLAGS = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION;

    private const USER_AGENT = 'Pterodactyl-Panel-Vault/1.0';

    private const MAX_CONNECT_TIMEOUT = 5;

    /** Seconds a download may stall between two reads before it is dropped. */
    private const STREAM_READ_TIMEOUT = 120;

    /** Largest error body read from a failed download. */
    private const MAX_ERROR_BODY = 65536;

    private const MAX_MESSAGE_LENGTH = 500;

    /** Codes meaning the vault refused the panel itself (signature, clock or IP). */
    private const PANEL_AUTH_CODES = ['panel_firma', 'panel_ip'];

    private ?ClientInterface $http;

    public function __construct(?ClientInterface $http = null)
    {
        $this->http = $http;
    }

    /**
     * Whether the integration is configured. With an empty URL or key the Vault
     * features stay hidden and nothing tries to reach the vault.
     */
    public static function configured(): bool
    {
        return trim((string) config('vault.url')) !== '' && (string) config('vault.key') !== '';
    }

    /**
     * Builds a vault path from a sprintf-style format, percent-encoding every
     * segment so the signed target is exactly the one sent.
     */
    public static function path(string $format, string ...$segments): string
    {
        return vsprintf($format, array_map('rawurlencode', $segments));
    }

    /**
     * @throws VaultException
     */
    public function get(string $path, array $query = [], ?VaultContext $context = null): array
    {
        return $this->decode($this->send('GET', $path, $query, null, $context), 'GET', $path);
    }

    /**
     * @param array|object|null $body null sends the request without a body
     *
     * @throws VaultException
     */
    public function post(string $path, array|object|null $body = null, ?VaultContext $context = null): array
    {
        return $this->decode($this->send('POST', $path, [], $this->encode($body), $context), 'POST', $path);
    }

    /**
     * @throws VaultException
     */
    public function put(string $path, array|object $body, ?VaultContext $context = null): array
    {
        return $this->decode($this->send('PUT', $path, [], $this->encode($body), $context), 'PUT', $path);
    }

    /**
     * @throws VaultException
     */
    public function delete(string $path, ?VaultContext $context = null): array
    {
        return $this->decode($this->send('DELETE', $path, [], null, $context), 'DELETE', $path);
    }

    /**
     * Sends a GET whose successful body is streamed instead of buffered (file
     * downloads and zips). The caller owns the returned body and must close it.
     *
     * @param array<string, string> $headers extra request headers (e.g. Range)
     *
     * @throws VaultException
     */
    public function stream(string $path, array $query = [], ?VaultContext $context = null, array $headers = []): ResponseInterface
    {
        $response = $this->send('GET', $path, $query, null, $context, true, $headers);
        $status = $response->getStatusCode();

        if ($status >= 200 && $status < 300) {
            return $response;
        }

        $body = $response->getBody();
        try {
            $raw = Utils::copyToString($body, self::MAX_ERROR_BODY);
        } catch (\RuntimeException) {
            $raw = '';
        } finally {
            $body->close();
        }

        $json = json_decode($raw, true);
        if (is_array($json) && ($json['ok'] ?? null) === false) {
            throw $this->errorFromEnvelope($status, is_array($json['error'] ?? null) ? $json['error'] : [], 'GET', $path);
        }

        throw $this->unexpectedResponse($status, 'GET', $path);
    }

    /**
     * @throws VaultException
     */
    private function send(
        string $method,
        string $path,
        array $query,
        ?string $body,
        ?VaultContext $context,
        bool $stream = false,
        array $extraHeaders = [],
    ): ResponseInterface {
        if (!self::configured()) {
            throw VaultException::noConfigurado();
        }

        if (!str_starts_with($path, '/')) {
            throw new \InvalidArgumentException('Vault paths must start with a slash.');
        }

        $headers = array_merge($extraHeaders, ($context ?? VaultContext::system())->headers(), [
            'Accept' => 'application/json',
            'User-Agent' => self::USER_AGENT,
        ]);

        if (!is_null($body)) {
            $headers['Content-Type'] = 'application/json';
        }

        $request = new PsrRequest($method, $this->uri($path, $query), $headers, $body ?? '');
        $request = $request->withHeader('X-Vault-Firma', $this->signature($method, $request->getRequestTarget(), $body ?? ''));

        $timeout = max(1, (int) config('vault.timeout', 20));

        try {
            return $this->client()->send($request, [
                'http_errors' => false,
                'allow_redirects' => false,
                'verify' => true,
                'connect_timeout' => min(self::MAX_CONNECT_TIMEOUT, $timeout),
                // For streams "timeout" bounds the connection and response headers
                // and "read_timeout" each read of the body afterwards.
                'timeout' => $timeout,
                'read_timeout' => $stream ? self::STREAM_READ_TIMEOUT : $timeout,
                'stream' => $stream,
            ]);
        } catch (GuzzleException $exception) {
            Log::warning('Could not reach the Tebby Vault.', [
                'method' => $method,
                'path' => $path,
                'error' => $exception->getMessage(),
            ]);

            throw VaultException::sinConexion($exception);
        }
    }

    private function client(): ClientInterface
    {
        return $this->http ??= new Client();
    }

    private function uri(string $path, array $query): string
    {
        $pairs = [];
        foreach ($query as $key => $value) {
            if (is_null($value)) {
                continue;
            }

            if (is_bool($value)) {
                $value = $value ? 'true' : 'false';
            }

            $pairs[] = rawurlencode((string) $key) . '=' . rawurlencode((string) $value);
        }

        $base = rtrim(trim((string) config('vault.url')), '/');

        return $base . $path . ($pairs === [] ? '' : '?' . implode('&', $pairs));
    }

    private function signature(string $method, string $target, string $body): string
    {
        $timestamp = (string) time();
        $nonce = bin2hex(random_bytes(16));
        $payload = implode("\n", [$method, $target, $timestamp, $nonce, hash('sha256', $body)]);

        return sprintf(
            't=%s,n=%s,f=%s',
            $timestamp,
            $nonce,
            hash_hmac('sha256', $payload, (string) config('vault.key'))
        );
    }

    /**
     * @throws VaultException
     */
    private function encode(array|object|null $body): ?string
    {
        if (is_null($body)) {
            return null;
        }

        try {
            return json_encode($body, self::JSON_FLAGS | JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new VaultException(422, 'invalido', 'Los datos enviados no son válidos');
        }
    }

    /**
     * Returns the `data` of a successful envelope or throws the vault error.
     *
     * @throws VaultException
     */
    private function decode(ResponseInterface $response, string $method, string $path): array
    {
        $status = $response->getStatusCode();
        $json = json_decode((string) $response->getBody(), true);

        if (!is_array($json) || !is_bool($json['ok'] ?? null)) {
            throw $this->unexpectedResponse($status, $method, $path);
        }

        if ($json['ok'] && $status >= 200 && $status < 300) {
            return is_array($json['data'] ?? null) ? $json['data'] : [];
        }

        throw $this->errorFromEnvelope($status, is_array($json['error'] ?? null) ? $json['error'] : [], $method, $path);
    }

    private function errorFromEnvelope(int $status, array $error, string $method, string $path): VaultException
    {
        $codigo = is_string($error['codigo'] ?? null) && preg_match('/^[a-z0-9_]{1,64}$/', $error['codigo']) === 1
            ? $error['codigo']
            : 'error';
        $mensaje = is_string($error['mensaje'] ?? null) && trim($error['mensaje']) !== ''
            ? mb_substr($error['mensaje'], 0, self::MAX_MESSAGE_LENGTH)
            : 'El Vault no pudo completar la operación';
        $datos = is_array($error['datos'] ?? null) ? $error['datos'] : [];
        $ref = is_string($error['ref'] ?? null) ? substr($error['ref'], 0, 64) : null;

        if (in_array($codigo, self::PANEL_AUTH_CODES, true)) {
            // A bad key, a clock drift over two minutes or a panel IP missing from
            // the vault config: nothing the end user can fix, so they get a
            // generic 503 and the admin gets the reason in the log.
            Log::error('The Tebby Vault rejected the panel. Check VAULT_PANEL_KEY, the vault panel_ips and the clock of both hosts.', [
                'codigo' => $codigo,
                'method' => $method,
                'path' => $path,
                'ref' => $ref,
            ]);

            return new VaultException(503, $codigo, 'El Vault ha rechazado la conexión del panel. Avisa a un administrador.', [], $ref);
        }

        return new VaultException($status >= 400 && $status <= 599 ? $status : 502, $codigo, $mensaje, $datos, $ref);
    }

    private function unexpectedResponse(int $status, string $method, string $path): VaultException
    {
        Log::warning('The Tebby Vault returned a response that is not a valid envelope.', [
            'method' => $method,
            'path' => $path,
            'status' => $status,
        ]);

        // A bare 502/503/504 is the reverse proxy in front of a vault that is down.
        if (in_array($status, [502, 503, 504], true)) {
            return VaultException::sinConexion();
        }

        return new VaultException(502, 'respuesta_invalida', 'El Vault devolvió una respuesta inesperada');
    }
}
