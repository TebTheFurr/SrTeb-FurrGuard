<?php

declare(strict_types=1);

/**
 * FurrGuard - puente con el panel de Pterodactyl (docs/API.md §9).
 *
 * El panel (otra máquina) firma cada petición con HMAC-SHA256 y la clave compartida
 * `PTERODACTYL_PANEL_KEY`. El usuario final entra con Discord a través del panel y su sesión es una
 * fila normal de `admin_sessions`: el panel guarda el token en SU sesión de servidor y lo manda en
 * `X-FurrGuard-Session`; el navegador nunca lo ve. Las acciones, roles y límites son los del panel
 * propio (admin/api/router.php); aquí solo cambia cómo se autentica la petición.
 */

if (!defined('FURRGUARD_ROOT')) {
    http_response_code(404);
    exit;
}

require_once FURRGUARD_ROOT . '/includes/discord.php';
require_once FURRGUARD_ROOT . '/admin/api/router.php';

const PANEL_BRIDGE_SIGNATURE_HEADER = 'HTTP_X_FURRGUARD_SIGNATURE';
const PANEL_BRIDGE_SESSION_HEADER = 'HTTP_X_FURRGUARD_SESSION';
const PANEL_BRIDGE_CLIENT_IP_HEADER = 'HTTP_X_FURRGUARD_CLIENT_IP';
const PANEL_BRIDGE_ACTOR_HEADER = 'HTTP_X_FURRGUARD_ACTOR';
/** Desfase máximo entre los relojes del panel y de FurrGuard. */
const PANEL_BRIDGE_MAX_CLOCK_SKEW = 120;
/** Un nonce no se acepta dos veces mientras su marca de tiempo siga siendo válida. */
const PANEL_BRIDGE_NONCE_TTL = 300;
const PANEL_BRIDGE_STATE_TTL = 600;
/** Firmas inválidas por IP de origen y minuto. */
const PANEL_BRIDGE_IP_RATE_LIMIT = 60;
/** Canjes de código OAuth por navegador cada 5 min (igual que admin/callback.php). */
const PANEL_BRIDGE_OAUTH_ATTEMPTS = 10;
const PANEL_BRIDGE_OAUTH_WINDOW = 300;
const PANEL_BRIDGE_ACTOR_MAX = 120;

// ─── Configuración ──────────────────────────────────────────────────────────

/**
 * Sin clave o sin URL del panel el puente no existe (404), como si el archivo no estuviera.
 */
function panelBridgeEnabled(): bool
{
    return PTERODACTYL_PANEL_KEY !== '' && PTERODACTYL_URL !== '';
}

/**
 * URL de vuelta de Discord: siempre la del panel, registrada en la aplicación de Discord.
 */
function panelBridgeRedirectUri(): string
{
    return PTERODACTYL_URL . '/furrguard/callback';
}

// ─── Firma ──────────────────────────────────────────────────────────────────

/**
 * `t=<unix>,n=<nonce>,f=<hmac hex>` → sus partes, o null si el formato no es el esperado.
 *
 * @return array{t: int, n: string, f: string}|null
 */
function panelBridgeParseSignature(?string $header): ?array
{
    if (!is_string($header) || preg_match('/^t=(\d{1,12}),n=([A-Za-z0-9_-]{16,64}),f=([0-9a-f]{64})\z/', $header, $m) !== 1) {
        return null;
    }
    return ['t' => (int) $m[1], 'n' => $m[2], 'f' => $m[3]];
}

/**
 * Firma que debe llevar una petición: HMAC-SHA256(clave, MÉTODO \n RUTA \n t \n nonce \n sha256(cuerpo)).
 */
function panelBridgeExpectedSignature(string $key, string $method, string $target, int $timestamp, string $nonce, string $body): string
{
    return hash_hmac('sha256', implode("\n", [strtoupper($method), $target, (string) $timestamp, $nonce, hash('sha256', $body)]), $key);
}

/**
 * Comprueba la cabecera de firma de una petición. Devuelve el nonce si es válida, o null si falta,
 * no coincide o su marca de tiempo está fuera de la ventana (comparación en tiempo constante).
 */
function panelBridgeCheckSignature(string $key, ?string $header, string $method, string $target, string $body, ?int $now = null): ?string
{
    $parts = panelBridgeParseSignature($header);
    if ($key === '' || $parts === null || abs(($now ?? time()) - $parts['t']) > PANEL_BRIDGE_MAX_CLOCK_SKEW) {
        return null;
    }
    $expected = panelBridgeExpectedSignature($key, $method, $target, $parts['t'], $parts['n'], $body);
    return hash_equals($expected, $parts['f']) ? $parts['n'] : null;
}

/**
 * Registra el nonce y devuelve false si ya se había usado (repetición). La tabla se limpia de paso:
 * un nonce más viejo que la ventana de firma no puede volver a valer de todos modos.
 */
function panelBridgeConsumeNonce(PDO $db, string $nonce): bool
{
    $db->prepare('DELETE FROM panel_nonces WHERE created_at < NOW() - INTERVAL ? SECOND')->execute([PANEL_BRIDGE_NONCE_TTL]);
    try {
        $db->prepare('INSERT INTO panel_nonces (nonce) VALUES (?)')->execute([$nonce]);
    } catch (PDOException $e) {
        if (($e->errorInfo[1] ?? null) === 1062) {
            return false;
        }
        throw $e;
    }
    return true;
}

// ─── Estado OAuth ───────────────────────────────────────────────────────────

/**
 * `state` de Discord sin almacenamiento: `<unix>.<nonce>.<hmac>`. El panel lo guarda en su sesión
 * y lo compara con el que devuelve Discord (un solo uso); aquí se comprueba la firma y la edad.
 */
function panelBridgeMakeState(string $key, ?int $now = null): string
{
    $payload = ($now ?? time()) . '.' . bin2hex(random_bytes(16));
    return $payload . '.' . hash_hmac('sha256', $payload, $key);
}

function panelBridgeStateValid(string $key, string $state, ?int $now = null): bool
{
    if ($key === '' || preg_match('/^(\d{1,12})\.([0-9a-f]{32})\.([0-9a-f]{64})\z/', $state, $m) !== 1) {
        return false;
    }
    $age = ($now ?? time()) - (int) $m[1];
    return $age >= -PANEL_BRIDGE_MAX_CLOCK_SKEW && $age <= PANEL_BRIDGE_STATE_TTL
        && hash_equals(hash_hmac('sha256', $m[1] . '.' . $m[2], $key), $m[3]);
}

// ─── Usuario ────────────────────────────────────────────────────────────────

/**
 * Lo que el panel necesita saber de la sesión: quién es, qué secciones ve y si ve IPs.
 *
 * @param AdminUser $user
 * @return array<string, mixed>
 */
function panelBridgeUserPayload(array $user): array
{
    return [
        'user' => [
            'discord_id' => $user['discord_id'],
            'username' => $user['username'] ?? $user['discord_id'],
            'avatar' => $user['avatar'],
            'role' => $user['role'],
        ],
        'permissions' => rolePermissions($user['role']),
        'can_see_ips' => hasPermission($user['role'], 'ips'),
        'version' => FURRGUARD_VERSION,
    ];
}

/**
 * Sesión por token de `X-FurrGuard-Session` o 401 con el motivo como código (§4.2).
 *
 * @param array<string, mixed> $server
 * @return AdminUser
 */
function panelBridgeAuthenticate(PDO $db, array $server): array
{
    $token = $server[PANEL_BRIDGE_SESSION_HEADER] ?? null;
    if (!is_string($token) || $token === '') {
        throw new HttpError(401, 'unauthorized', 'Inicia sesión con Discord para usar FurrGuard.');
    }
    $validation = adminSessionValidateToken($db, $token);
    if ($validation['user'] === null) {
        throw new HttpError(401, $validation['error'] ?? 'unauthorized', 'Tu sesión de FurrGuard ha caducado. Vuelve a entrar con Discord.');
    }
    adminApiThrottle('panel_user:' . $validation['user']['discord_id'], ADMIN_USER_RATE_LIMIT);
    return $validation['user'];
}

// ─── Acciones propias del puente ────────────────────────────────────────────

/**
 * `oauth_start`: URL de Discord y `state` para que el panel redirija al navegador.
 *
 * @return array{url: string, state: string}
 */
function panelBridgeOauthStart(): array
{
    if (DISCORD_CLIENT_ID === '' || DISCORD_CLIENT_SECRET === '') {
        throw new HttpError(503, 'discord_unconfigured', 'FurrGuard no tiene configurada la aplicación de Discord.');
    }
    $state = panelBridgeMakeState(PTERODACTYL_PANEL_KEY);
    return ['url' => discordAuthorizeUrl(panelBridgeRedirectUri(), $state), 'state' => $state];
}

/**
 * `oauth_exchange`: canjea el código con Discord, comprueba el rol y abre la sesión. Sin rol →
 * 403 `no_access` con quién intentó entrar, para que el panel lo pueda decir.
 *
 * @param array<string, mixed> $in
 * @return array<string, mixed>
 */
function panelBridgeOauthExchange(PDO $db, array $in, string $actor): array
{
    $ip = getClientIp();
    $attempts = rateLimitCheck('admin_oauth_callback:' . $ip, PANEL_BRIDGE_OAUTH_ATTEMPTS, PANEL_BRIDGE_OAUTH_WINDOW);
    if (!$attempts['allowed']) {
        throw new RateLimitedError($attempts['retry_after']);
    }
    $state = inputString($in, 'state', 200);
    if (!panelBridgeStateValid(PTERODACTYL_PANEL_KEY, $state)) {
        throw new HttpError(400, 'invalid_state', 'El inicio de sesión ha caducado. Vuelve a intentarlo.');
    }
    $code = inputString($in, 'code', 200);
    if (preg_match(DISCORD_CODE_PATTERN, $code) !== 1) {
        throw new HttpError(400, 'invalid_code', 'El código de Discord no es válido.');
    }

    $accessToken = discordExchangeCode($code, panelBridgeRedirectUri());
    $discordUser = $accessToken === null ? null : discordFetchUser($accessToken);
    if ($discordUser === null) {
        throw new HttpError(502, 'discord_error', 'Discord no pudo completar el inicio de sesión. Vuelve a intentarlo en un momento.');
    }

    $via = 'desde Pterodactyl' . ($actor === '' ? '' : " (usuario del panel {$actor})");
    $role = getUserRole($db, $discordUser['id']);
    if ($role === null) {
        logActivity($db, 'auth', 'login_denied', "{$discordUser['username']} ({$discordUser['id']}) no tiene acceso al panel {$via}.");
        throw new HttpError(403, 'no_access', 'Esa cuenta de Discord no tiene acceso a FurrGuard.');
    }
    $created = adminSessionCreate($db, ['discord_id' => $discordUser['id'], 'username' => $discordUser['username'], 'avatar' => $discordUser['avatar']], $ip);
    logActivity($db, 'auth', 'login', "{$discordUser['username']} ({$discordUser['id']}) inició sesión como {$role} {$via}.");

    return [
        'token' => $created['token'],
        'expires_in' => ADMIN_SESSION_ABSOLUTE_TTL,
        'idle_timeout' => ADMIN_SESSION_IDLE_TTL,
    ] + panelBridgeUserPayload([
        'discord_id' => $discordUser['id'],
        'username' => $discordUser['username'],
        'avatar' => $discordUser['avatar'],
        'role' => $role,
        'session_id' => $created['session_id'],
    ]);
}

/**
 * `logout`: revoca la fila de la sesión (el panel olvida el token por su cuenta).
 *
 * @param AdminUser $user
 */
function panelBridgeLogout(PDO $db, array $user): null
{
    logActivity($db, 'auth', 'logout', adminActor($user) . " ({$user['discord_id']}) cerró sesión desde Pterodactyl");
    adminSessionRevokeById($db, $user['session_id']);
    return null;
}

// ─── Petición ───────────────────────────────────────────────────────────────

/**
 * Cabecera opcional con quién es en Pterodactyl (`id:usuario`), solo ASCII imprimible, para la
 * auditoría del inicio de sesión.
 *
 * @param array<string, mixed> $server
 */
function panelBridgeActor(array $server): string
{
    $raw = $server[PANEL_BRIDGE_ACTOR_HEADER] ?? '';
    if (!is_string($raw)) {
        return '';
    }
    return substr(trim((string) preg_replace('/[^\x20-\x7E]/u', '?', $raw)), 0, PANEL_BRIDGE_ACTOR_MAX);
}

/**
 * Firma, nonce y lista de IPs del panel, o 401 `panel_signature` / 403 `panel_ip`. Los intentos
 * fallidos cuentan por IP de origen para que nadie pueda probar claves a ciegas.
 *
 * @param array<string, mixed> $server
 */
function panelBridgeVerifyRequest(PDO $db, array $server, string $body): void
{
    $panelIp = getClientIp($server);
    if (PTERODACTYL_PANEL_IPS !== [] && !isTrustedProxy($panelIp, PTERODACTYL_PANEL_IPS)) {
        adminApiThrottle('panel_bridge_ip:' . $panelIp, PANEL_BRIDGE_IP_RATE_LIMIT);
        error_log("FurrGuard puente: petición desde {$panelIp}, que no está en PTERODACTYL_PANEL_IPS");
        throw new HttpError(403, 'panel_ip', 'Este panel no está autorizado.');
    }
    $target = is_string($server['REQUEST_URI'] ?? null) ? $server['REQUEST_URI'] : '';
    $method = is_string($server['REQUEST_METHOD'] ?? null) ? $server['REQUEST_METHOD'] : '';
    $header = $server[PANEL_BRIDGE_SIGNATURE_HEADER] ?? null;
    $nonce = panelBridgeCheckSignature(PTERODACTYL_PANEL_KEY, is_string($header) ? $header : null, $method, $target, $body);
    if ($nonce === null || !panelBridgeConsumeNonce($db, $nonce)) {
        adminApiThrottle('panel_bridge_ip:' . $panelIp, PANEL_BRIDGE_IP_RATE_LIMIT);
        throw new HttpError(401, 'panel_signature', 'Firma del panel inválida. Revisa PTERODACTYL_PANEL_KEY y la hora de ambas máquinas.');
    }
}

/**
 * El panel es un proxy autenticado del navegador: a partir de aquí la IP del cliente (auditoría,
 * sesiones, límites por IP) es la que él indica en `X-FurrGuard-Client-IP`, no la del propio panel.
 */
function panelBridgeAdoptClientIp(): void
{
    $ip = normalizeIp(is_string($_SERVER[PANEL_BRIDGE_CLIENT_IP_HEADER] ?? null) ? $_SERVER[PANEL_BRIDGE_CLIENT_IP_HEADER] : null);
    if ($ip === null) {
        return;
    }
    $_SERVER['REMOTE_ADDR'] = $ip;
    unset($_SERVER['HTTP_X_FORWARDED_FOR'], $_SERVER['HTTP_CF_CONNECTING_IP']);
}

/**
 * Acciones del puente y, para cualquier otra, las del panel (mismo mapa, mismos permisos).
 *
 * @param array<string, mixed> $input
 */
function panelBridgeDispatch(PDO $db, array $input): mixed
{
    $action = $input['action'] ?? null;
    if (!is_string($action)) {
        throw new HttpError(404, 'unknown_action', 'Acción desconocida.');
    }
    return match ($action) {
        'oauth_start' => panelBridgeOauthStart(),
        'oauth_exchange' => panelBridgeOauthExchange($db, $input, panelBridgeActor($_SERVER)),
        'session' => panelBridgeUserPayload(panelBridgeAuthenticate($db, $_SERVER)),
        'logout' => panelBridgeLogout($db, panelBridgeAuthenticate($db, $_SERVER)),
        default => adminApiDispatch($db, panelBridgeAuthenticate($db, $_SERVER), $input),
    };
}

/**
 * POST /api/panel.php con cuerpo JSON `{"action": …}`; responde en el formato del panel (§4.2).
 */
function panelBridgeRun(): never
{
    try {
        if (!panelBridgeEnabled()) {
            throw new HttpError(404, 'not_found', 'No encontrado.');
        }
        if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? '')) !== 'POST') {
            header('Allow: POST');
            throw new HttpError(405, 'method_not_allowed', 'Esta API solo acepta POST.');
        }
        $body = file_get_contents('php://input', false, null, 0, JSON_BODY_MAX_BYTES + 1);
        if (!is_string($body)) {
            throw new HttpError(400, 'invalid_body', 'No se pudo leer la solicitud.');
        }
        if (strlen($body) > JSON_BODY_MAX_BYTES) {
            throw new HttpError(400, 'body_too_large', 'La solicitud es demasiado grande.');
        }
        $db = db() ?? throw new HttpError(503, 'database_unavailable', 'Base de datos no disponible.');
        panelBridgeVerifyRequest($db, $_SERVER, $body);
        panelBridgeAdoptClientIp();
        respondPanelOk(panelBridgeDispatch($db, parseJsonObject($body)));
    } catch (RateLimitedError $e) {
        respondTooManyRequests($e->retryAfter, 'panel');
    } catch (HttpError $e) {
        respondHttpError($e, 'panel');
    } catch (PDOException $e) {
        error_log('FurrGuard puente Pterodactyl: ' . $e->getMessage());
        if (isDatabaseUnavailableError($e)) {
            respondPanelError(503, 'Base de datos no disponible. Inténtalo de nuevo en unos segundos.', 'database_unavailable');
        }
        respondPanelError(500, 'Error interno del servidor.', 'internal_error');
    } catch (Throwable $e) {
        error_log('FurrGuard puente Pterodactyl: ' . $e);
        respondPanelError(500, 'Error interno del servidor.', 'internal_error');
    }
}
