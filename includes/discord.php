<?php

declare(strict_types=1);

/**
 * FurrGuard - Discord OAuth2 (inicio de sesión del panel y verificación de staff).
 *
 * cURL con timeouts, sin seguir redirecciones y comprobando el código HTTP. Nunca registra el código,
 * el token ni el secreto.
 */

const DISCORD_AUTHORIZE_URL = 'https://discord.com/api/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const DISCORD_ME_URL = 'https://discord.com/api/users/@me';
const DISCORD_CONNECT_TIMEOUT = 5;
const DISCORD_TIMEOUT = 10;
const DISCORD_CODE_PATTERN = '/^[A-Za-z0-9._~-]{1,200}\z/';

/**
 * URL de autorización. `prompt=consent` obliga a ver con qué cuenta de Discord se entra.
 */
function discordAuthorizeUrl(string $redirectUri, string $state): string
{
    return DISCORD_AUTHORIZE_URL . '?' . http_build_query([
        'client_id' => DISCORD_CLIENT_ID,
        'redirect_uri' => $redirectUri,
        'response_type' => 'code',
        'scope' => 'identify',
        'state' => $state,
        'prompt' => 'consent',
    ], '', '&', PHP_QUERY_RFC3986);
}

/**
 * Código OAuth → access token, o null si Discord no responde bien.
 */
function discordExchangeCode(string $code, string $redirectUri): ?string
{
    $response = discordRequest(DISCORD_TOKEN_URL, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query([
            'client_id' => DISCORD_CLIENT_ID,
            'client_secret' => DISCORD_CLIENT_SECRET,
            'grant_type' => 'authorization_code',
            'code' => $code,
            'redirect_uri' => $redirectUri,
        ]),
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded', 'Accept: application/json'],
    ]);
    $token = $response['access_token'] ?? null;
    return is_string($token) && $token !== '' ? $token : null;
}

/**
 * @return array{id: string, username: string, avatar: ?string}|null
 */
function discordFetchUser(string $accessToken): ?array
{
    $user = discordRequest(DISCORD_ME_URL, [CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $accessToken, 'Accept: application/json']]);
    $id = $user['id'] ?? null;
    if (!is_string($id) || preg_match('/^\d{1,20}\z/', $id) !== 1) {
        return null;
    }
    $username = is_string($user['username'] ?? null) && $user['username'] !== '' ? $user['username'] : $id;
    $avatar = $user['avatar'] ?? null;
    return [
        'id' => $id,
        'username' => mb_substr($username, 0, 100),
        'avatar' => is_string($avatar) && preg_match('/^(a_)?[0-9a-f]{32}\z/', $avatar) === 1 ? $avatar : null,
    ];
}

/**
 * @param array<int, mixed> $options
 * @return array<array-key, mixed>|null cuerpo JSON de una respuesta 200
 */
function discordRequest(string $url, array $options): ?array
{
    $ch = curl_init($url);
    if ($ch === false) {
        return null;
    }
    curl_setopt_array($ch, $options + [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => DISCORD_CONNECT_TIMEOUT,
        CURLOPT_TIMEOUT => DISCORD_TIMEOUT,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_USERAGENT => 'FurrGuard/' . FURRGUARD_VERSION,
    ]);
    $body = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    if (!is_string($body) || $status !== 200) {
        error_log(sprintf('FurrGuard Discord: %s respondió HTTP %d%s', (string) parse_url($url, PHP_URL_PATH), $status, $error === '' ? '' : " ({$error})"));
        return null;
    }
    $data = json_decode($body, true);
    return is_array($data) ? $data : null;
}
