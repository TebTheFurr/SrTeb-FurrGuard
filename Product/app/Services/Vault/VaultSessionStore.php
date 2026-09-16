<?php

declare(strict_types=1);

namespace Pterodactyl\Services\Vault;

use Illuminate\Http\Request;

/**
 * Keeps the vault's Discord session inside the panel's server-side session.
 *
 * The token never reaches the browser: the client only ever sees the public
 * `usuario` part through the panel API, and every call to the vault is made by
 * the panel with the token read from here.
 */
class VaultSessionStore
{
    public const SESSION_KEY = 'vault.sesion';
    public const OAUTH_KEY = 'vault.oauth';

    /** Discord's OAuth state is single use and valid for 10 minutes on the vault. */
    public const OAUTH_TTL_SECONDS = 600;

    private const TOKEN_REGEX = '/^[A-Za-z0-9._~+\/=-]{16,512}$/';

    private const STATE_REGEX = '/^[\x21-\x7E]{8,512}$/';

    private const MAX_TEXT_LENGTH = 512;

    /**
     * The stored vault session, or null if there is none or it has expired.
     *
     * @return array{token: string, expira_ts: float, usuario: array}|null
     */
    public function get(Request $request): ?array
    {
        if (!$request->hasSession()) {
            return null;
        }

        $sesion = $request->session()->get(self::SESSION_KEY);
        if (is_null($sesion)) {
            return null;
        }

        $valid = is_array($sesion)
            && is_string($sesion['token'] ?? null)
            && preg_match(self::TOKEN_REGEX, $sesion['token']) === 1
            && is_numeric($sesion['expira_ts'] ?? null)
            && is_array($sesion['usuario'] ?? null);

        if (!$valid || (float) $sesion['expira_ts'] <= microtime(true)) {
            $this->forget($request);

            return null;
        }

        return [
            'token' => $sesion['token'],
            'expira_ts' => (float) $sesion['expira_ts'],
            'usuario' => $sesion['usuario'],
        ];
    }

    /**
     * Stores the session returned by `oauth/canje`. Returns false (and stores
     * nothing) if the vault answered something that does not look like one.
     */
    public function put(Request $request, array $canje): bool
    {
        $token = $canje['token'] ?? null;
        $expiraTs = $canje['expira_ts'] ?? null;
        $usuario = $canje['usuario'] ?? null;

        if (
            !$request->hasSession()
            || !is_string($token)
            || preg_match(self::TOKEN_REGEX, $token) !== 1
            || !is_numeric($expiraTs)
            || (float) $expiraTs <= microtime(true)
            || !is_array($usuario)
        ) {
            return false;
        }

        $request->session()->put(self::SESSION_KEY, [
            'token' => $token,
            'expira_ts' => (float) $expiraTs,
            'usuario' => self::publicUser($usuario),
        ]);

        return true;
    }

    public function forget(Request $request): void
    {
        if ($request->hasSession()) {
            $request->session()->forget(self::SESSION_KEY);
        }
    }

    public function putOauth(Request $request, string $estado, string $servidor): bool
    {
        if (!$request->hasSession() || preg_match(self::STATE_REGEX, $estado) !== 1) {
            return false;
        }

        $request->session()->put(self::OAUTH_KEY, [
            'estado' => $estado,
            'servidor' => $servidor,
            'ts' => time(),
        ]);

        return true;
    }

    /**
     * Takes the pending OAuth state out of the session: it can only be used once.
     *
     * @return array{estado: string, servidor: string, expired: bool}|null
     */
    public function pullOauth(Request $request): ?array
    {
        if (!$request->hasSession()) {
            return null;
        }

        $oauth = $request->session()->pull(self::OAUTH_KEY);
        if (!is_array($oauth) || !is_string($oauth['estado'] ?? null) || !is_string($oauth['servidor'] ?? null)) {
            return null;
        }

        return [
            'estado' => $oauth['estado'],
            'servidor' => $oauth['servidor'],
            'expired' => !is_int($oauth['ts'] ?? null) || time() - $oauth['ts'] > self::OAUTH_TTL_SECONDS,
        ];
    }

    /**
     * Keeps only the public profile fields the client is allowed to see.
     */
    private static function publicUser(array $usuario): array
    {
        $text = fn (mixed $value): string => is_scalar($value) ? mb_substr((string) $value, 0, self::MAX_TEXT_LENGTH) : '';

        return [
            'id' => $text($usuario['id'] ?? ''),
            'nombre' => $text($usuario['nombre'] ?? ''),
            'avatar' => $text($usuario['avatar'] ?? ''),
            'rango' => is_string($usuario['rango'] ?? null) ? $text($usuario['rango']) : null,
        ];
    }
}
