<?php

declare(strict_types=1);

namespace Pterodactyl\Services\FurrGuard;

use GuzzleHttp\Client;
use GuzzleHttp\ClientInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Pterodactyl\Models\User;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\Psr7\Request as PsrRequest;
use Psr\Http\Message\ResponseInterface;
use Pterodactyl\Exceptions\FurrGuard\FurrGuardException;

/**
 * HTTP client for the Pterodactyl bridge of FurrGuard (`POST /api/panel.php`,
 * FurrGuard docs/API.md §9).
 *
 * Every request is one JSON body `{"action": ..., ...params}` signed as FurrGuard
 * expects:
 *
 *   X-FurrGuard-Signature: t=<unix>,n=<nonce>,f=HMAC-SHA256(key, METHOD\nTARGET\nt\nn\nsha256hex(body))
 *
 * where TARGET is the path placed on the request line (`/api/panel.php`). The
 * JSON body is encoded once and that very string is both hashed and sent. The
 * FurrGuard session token (kept in the panel session, never in the browser)
 * travels in `X-FurrGuard-Session`; the browser IP and the panel user go in
 * `X-FurrGuard-Client-IP` / `X-FurrGuard-Actor` for FurrGuard's audit log.
 */
class FurrGuardClient
{
    public const PATH = '/api/panel.php';

    public const JSON_FLAGS = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION;

    private const USER_AGENT = 'Pterodactyl-Panel-FurrGuard/1.0';

    private const MAX_CONNECT_TIMEOUT = 5;

    private const MAX_MESSAGE_LENGTH = 500;

    private const MAX_ACTOR_LENGTH = 120;

    /** Codes meaning FurrGuard refused the panel itself (key, clock or IP). */
    private const PANEL_AUTH_CODES = ['panel_signature', 'panel_ip'];

    private ?ClientInterface $http;

    public function __construct(?ClientInterface $http = null)
    {
        $this->http = $http;
    }

    /**
     * Whether the integration is configured. With an empty URL or key the
     * FurrGuard button stays hidden and nothing tries to reach FurrGuard.
     */
    public static function configured(): bool
    {
        return trim((string) config('furrguard.url')) !== '' && (string) config('furrguard.key') !== '';
    }

    /**
     * Runs one action and returns its `data`, or throws the FurrGuard error.
     *
     * @param array<string, mixed> $params
     * @param string|null $session FurrGuard session token, for the actions that need one
     * @param Request|null $request browser request, for the audit headers
     *
     * @throws FurrGuardException
     */
    public function call(string $action, array $params = [], ?string $session = null, ?Request $request = null): mixed
    {
        if (!self::configured()) {
            throw FurrGuardException::notConfigured();
        }

        // `action` goes last so no parameter can replace it.
        try {
            $body = json_encode(array_merge($params, ['action' => $action]), self::JSON_FLAGS | JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new FurrGuardException(422, 'validation', 'Los datos enviados no son válidos');
        }

        $headers = [
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
            'User-Agent' => self::USER_AGENT,
            'X-FurrGuard-Signature' => $this->signature('POST', self::PATH, $body),
        ];
        if (!is_null($session) && $session !== '') {
            $headers['X-FurrGuard-Session'] = $session;
        }
        foreach ($this->auditHeaders($request) as $name => $value) {
            $headers[$name] = $value;
        }

        $timeout = max(1, (int) config('furrguard.timeout', 20));
        $psrRequest = new PsrRequest('POST', rtrim(trim((string) config('furrguard.url')), '/') . self::PATH, $headers, $body);

        try {
            $response = $this->client()->send($psrRequest, [
                'http_errors' => false,
                'allow_redirects' => false,
                'verify' => true,
                'connect_timeout' => min(self::MAX_CONNECT_TIMEOUT, $timeout),
                'timeout' => $timeout,
            ]);
        } catch (GuzzleException $exception) {
            Log::warning('Could not reach FurrGuard.', ['action' => $action, 'error' => $exception->getMessage()]);

            throw FurrGuardException::unreachable($exception);
        }

        return $this->decode($response, $action);
    }

    private function client(): ClientInterface
    {
        return $this->http ??= new Client();
    }

    private function signature(string $method, string $target, string $body): string
    {
        $timestamp = (string) time();
        $nonce = bin2hex(random_bytes(16));
        $payload = implode("\n", [$method, $target, $timestamp, $nonce, hash('sha256', $body)]);

        return sprintf('t=%s,n=%s,f=%s', $timestamp, $nonce, hash_hmac('sha256', $payload, (string) config('furrguard.key')));
    }

    /**
     * @return array<string, string>
     */
    private function auditHeaders(?Request $request): array
    {
        if (is_null($request)) {
            return [];
        }

        $headers = [];
        $ip = $request->ip();
        if (is_string($ip) && filter_var($ip, FILTER_VALIDATE_IP) !== false) {
            $headers['X-FurrGuard-Client-IP'] = $ip;
        }

        $user = $request->user();
        if ($user instanceof User) {
            // Header values must be plain printable ASCII: anything else is replaced so a
            // strange username can neither break the request nor smuggle a header.
            $actor = preg_replace('/[^\x20-\x7E]/', '?', $user->id . ':' . $user->username) ?? '';
            $headers['X-FurrGuard-Actor'] = substr(trim($actor), 0, self::MAX_ACTOR_LENGTH);
        }

        return $headers;
    }

    /**
     * FurrGuard answers `{success: true, data}` or `{success: false, error, code, ...}`.
     *
     * @throws FurrGuardException
     */
    private function decode(ResponseInterface $response, string $action): mixed
    {
        $status = $response->getStatusCode();
        $json = json_decode((string) $response->getBody(), true);

        if (!is_array($json) || !is_bool($json['success'] ?? null)) {
            Log::warning('FurrGuard returned a response that is not a valid envelope.', ['action' => $action, 'status' => $status]);

            // A bare 502/503/504 is the reverse proxy in front of a FurrGuard that is down.
            if (in_array($status, [502, 503, 504], true)) {
                throw FurrGuardException::unreachable();
            }

            throw new FurrGuardException(502, 'invalid_response', 'FurrGuard devolvió una respuesta inesperada');
        }

        if ($json['success'] && $status >= 200 && $status < 300) {
            return $json['data'] ?? null;
        }

        $code = is_string($json['code'] ?? null) && preg_match('/^[a-z0-9_]{1,64}$/', $json['code']) === 1 ? $json['code'] : 'error';
        $message = is_string($json['error'] ?? null) && trim($json['error']) !== ''
            ? mb_substr($json['error'], 0, self::MAX_MESSAGE_LENGTH)
            : 'FurrGuard no pudo completar la operación';

        if (in_array($code, self::PANEL_AUTH_CODES, true)) {
            // A bad key, a clock drift over two minutes or a panel IP missing from
            // PTERODACTYL_PANEL_IPS: nothing the end user can fix, so they get a
            // generic 503 and the admin gets the reason in the log.
            Log::error('FurrGuard rejected the panel. Check FURRGUARD_PANEL_KEY, PTERODACTYL_PANEL_IPS on FurrGuard and the clock of both hosts.', [
                'code' => $code,
                'action' => $action,
            ]);

            throw new FurrGuardException(503, $code, 'FurrGuard ha rechazado la conexión del panel. Avisa a un administrador.');
        }

        $meta = array_filter([
            'field' => is_string($json['field'] ?? null) ? $json['field'] : null,
            'retry_after' => is_numeric($json['retry_after'] ?? null) ? (int) $json['retry_after'] : null,
        ], fn ($value) => !is_null($value));

        throw new FurrGuardException($status >= 400 && $status <= 599 ? $status : 502, $code, $message, $meta);
    }
}
