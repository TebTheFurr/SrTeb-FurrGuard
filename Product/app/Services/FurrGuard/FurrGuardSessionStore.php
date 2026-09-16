<?php

declare(strict_types=1);

namespace Pterodactyl\Services\FurrGuard;

use Illuminate\Http\Request;

/**
 * Keeps the FurrGuard Discord session inside the panel's server-side session.
 *
 * The token never reaches the browser: the page only ever sees the public
 * `user` / `permissions` part through the client API, and every call to
 * FurrGuard is made by the panel with the token read from here.
 */
class FurrGuardSessionStore
{
    public const SESSION_KEY = 'furrguard.session';
    public const OAUTH_KEY = 'furrguard.oauth';

    /** FurrGuard's OAuth state is valid for 10 minutes; the panel forgets it sooner rather than later. */
    public const OAUTH_TTL_SECONDS = 600;

    private const TOKEN_REGEX = '/^[0-9a-f]{64}$/';

    private const STATE_REGEX = '/^[\x21-\x7E]{8,512}$/';

    private const MAX_TEXT_LENGTH = 255;

    private const MAX_PERMISSIONS = 32;

    /**
     * The stored FurrGuard session, or null if there is none or it has expired.
     *
     * @return array{token: string, expires_ts: int, user: array, permissions: string[], can_see_ips: bool}|null
     */
    public function get(Request $request): ?array
    {
        if (!$request->hasSession()) {
            return null;
        }

        $session = $request->session()->get(self::SESSION_KEY);
        if (is_null($session)) {
            return null;
        }

        $valid = is_array($session)
            && is_string($session['token'] ?? null)
            && preg_match(self::TOKEN_REGEX, $session['token']) === 1
            && is_int($session['expires_ts'] ?? null)
            && is_array($session['user'] ?? null)
            && is_array($session['permissions'] ?? null);

        if (!$valid || $session['expires_ts'] <= time()) {
            $this->forget($request);

            return null;
        }

        return [
            'token' => $session['token'],
            'expires_ts' => $session['expires_ts'],
            'user' => $session['user'],
            'permissions' => $session['permissions'],
            'can_see_ips' => (bool) ($session['can_see_ips'] ?? false),
        ];
    }

    /**
     * Stores the session returned by `oauth_exchange`. Returns false (and stores
     * nothing) if FurrGuard answered something that does not look like one.
     */
    public function put(Request $request, array $exchange): bool
    {
        $token = $exchange['token'] ?? null;
        $expiresIn = $exchange['expires_in'] ?? null;

        if (
            !$request->hasSession()
            || !is_string($token)
            || preg_match(self::TOKEN_REGEX, $token) !== 1
            || !is_int($expiresIn)
            || $expiresIn <= 0
            || !is_array($exchange['user'] ?? null)
        ) {
            return false;
        }

        $request->session()->put(self::SESSION_KEY, [
            'token' => $token,
            'expires_ts' => time() + $expiresIn,
        ] + self::publicPart($exchange));

        return true;
    }

    /**
     * Refreshes the public part (role, permissions) from a `session` answer,
     * keeping the token and expiry.
     */
    public function refresh(Request $request, array $session): void
    {
        $current = $this->get($request);
        if (is_null($current) || !is_array($session['user'] ?? null)) {
            return;
        }

        $request->session()->put(self::SESSION_KEY, [
            'token' => $current['token'],
            'expires_ts' => $current['expires_ts'],
        ] + self::publicPart($session));
    }

    public function forget(Request $request): void
    {
        if ($request->hasSession()) {
            $request->session()->forget(self::SESSION_KEY);
        }
    }

    public function putOauth(Request $request, string $state): bool
    {
        if (!$request->hasSession() || preg_match(self::STATE_REGEX, $state) !== 1) {
            return false;
        }

        $request->session()->put(self::OAUTH_KEY, ['state' => $state, 'ts' => time()]);

        return true;
    }

    /**
     * Takes the pending OAuth state out of the session: it can only be used once.
     *
     * @return array{state: string, expired: bool}|null
     */
    public function pullOauth(Request $request): ?array
    {
        if (!$request->hasSession()) {
            return null;
        }

        $oauth = $request->session()->pull(self::OAUTH_KEY);
        if (!is_array($oauth) || !is_string($oauth['state'] ?? null)) {
            return null;
        }

        return [
            'state' => $oauth['state'],
            'expired' => !is_int($oauth['ts'] ?? null) || time() - $oauth['ts'] > self::OAUTH_TTL_SECONDS,
        ];
    }

    /**
     * Only the profile fields the page is allowed to see, in the shape of the
     * FurrGuard boot object (docs/API.md §4.1).
     *
     * @return array{user: array, permissions: string[], can_see_ips: bool}
     */
    public static function publicPart(array $payload): array
    {
        $text = fn (mixed $value): ?string => is_scalar($value) ? mb_substr((string) $value, 0, self::MAX_TEXT_LENGTH) : null;
        $user = is_array($payload['user'] ?? null) ? $payload['user'] : [];
        $permissions = is_array($payload['permissions'] ?? null) ? $payload['permissions'] : [];

        return [
            'user' => [
                'discord_id' => $text($user['discord_id'] ?? '') ?? '',
                'username' => $text($user['username'] ?? '') ?? '',
                'avatar' => $text($user['avatar'] ?? null),
                'role' => $text($user['role'] ?? '') ?? '',
            ],
            'permissions' => array_values(array_slice(array_filter($permissions, fn ($section) => is_string($section) && preg_match('/^[a-z_]{1,32}$/', $section) === 1), 0, self::MAX_PERMISSIONS)),
            'can_see_ips' => (bool) ($payload['can_see_ips'] ?? false),
        ];
    }
}
