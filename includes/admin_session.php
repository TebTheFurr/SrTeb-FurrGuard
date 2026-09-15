<?php

declare(strict_types=1);

/**
 * FurrGuard - roles del panel y sesión de administrador (docs/API.md §4.3 y §5).
 *
 * La sesión PHP guarda un token aleatorio; la BD solo su SHA-256 (`admin_sessions.session_token_hash`).
 * Cada petición valida la fila: no revocada, caducidad absoluta 8 h, inactividad 2 h, IP por familia
 * (IPv4 exacta, IPv6 /64; un cambio IPv4↔IPv6 no invalida) y rol vigente en BD.
 */

const ROLE_PERMISSIONS = [
    'founder' => ['overview', 'players', 'connections', 'ips', 'whitelist', 'blacklist', 'sanctions', 'providers', 'countries', 'continents', 'messages', 'logs', 'settings', 'users', 'furrperms', 'furrsecurity'],
    'owner' => ['overview', 'players', 'connections', 'ips', 'whitelist', 'blacklist', 'sanctions', 'countries', 'continents', 'messages', 'logs', 'furrperms', 'furrsecurity'],
    'manager' => ['overview', 'players', 'connections', 'ips', 'whitelist', 'blacklist', 'sanctions'],
    'sradmin' => ['overview', 'players', 'whitelist', 'blacklist', 'sanctions'],
    'admin' => ['overview', 'players', 'whitelist', 'blacklist', 'sanctions'],
];

const ADMIN_SESSION_KEY = 'furrguard_admin';
const ADMIN_SESSION_OBSOLETE_KEY = 'furrguard_obsolete_at';
const ADMIN_SESSION_ABSOLUTE_TTL = 28800;
const ADMIN_SESSION_IDLE_TTL = 7200;
const ADMIN_SESSION_REGENERATE_EVERY = 1800;
const ADMIN_SESSION_OBSOLETE_GRACE = 60;
const ADMIN_SESSION_TOUCH_EVERY = 60;

// ─── Roles ──────────────────────────────────────────────────────────────────

/**
 * Rol vigente: `founder` si coincide con FOUNDER_DISCORD_ID; si no, el de `admin_users`; o null.
 * Los errores de BD se propagan (el endpoint responde 503; no se cierra la sesión por un fallo).
 */
function getUserRole(PDO $db, string $discordId): ?string
{
    if (preg_match('/^\d{1,20}\z/', $discordId) !== 1) {
        return null;
    }
    if (isFounderDiscordId($discordId)) {
        return 'founder';
    }
    $stmt = $db->prepare('SELECT role FROM admin_users WHERE discord_id = ?');
    $stmt->execute([$discordId]);
    $role = $stmt->fetchColumn();
    return is_string($role) && isset(ROLE_PERMISSIONS[$role]) ? $role : null;
}

/**
 * ¿Es el founder de FOUNDER_DISCORD_ID? (tiene acceso siempre y no se le puede quitar).
 */
function isFounderDiscordId(string $discordId): bool
{
    return FOUNDER_DISCORD_ID !== '' && hash_equals(FOUNDER_DISCORD_ID, $discordId);
}

function hasPermission(string $role, string $section): bool
{
    return in_array($section, ROLE_PERMISSIONS[$role] ?? [], true);
}

/**
 * @return list<string>
 */
function rolePermissions(string $role): array
{
    return ROLE_PERMISSIONS[$role] ?? [];
}

/**
 * URL de Discord OAuth del panel. Guarda un `state` aleatorio en la sesión.
 */
function getDiscordLoginUrl(): string
{
    $state = $_SESSION['oauth_state'] ?? null;
    if (!is_string($state) || strlen($state) !== 64) {
        $state = bin2hex(random_bytes(32));
        $_SESSION['oauth_state'] = $state;
    }
    return 'https://discord.com/api/oauth2/authorize?' . http_build_query([
        'client_id' => DISCORD_CLIENT_ID,
        'redirect_uri' => DISCORD_REDIRECT_URI !== '' ? DISCORD_REDIRECT_URI : APP_URL . '/admin/callback.php',
        'response_type' => 'code',
        'scope' => 'identify',
        'state' => $state,
    ], '', '&', PHP_QUERY_RFC3986);
}

// ─── Sesión ─────────────────────────────────────────────────────────────────

/**
 * Inicia la sesión tras un login correcto: regenera el ID, crea un token CSRF nuevo, revoca las
 * sesiones anteriores del usuario y crea la fila en `admin_sessions`.
 *
 * @param array{discord_id: string, username: string, avatar: ?string} $user
 */
function adminSessionStart(PDO $db, array $user, string $role): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_regenerate_id(true);
    }
    unset($_SESSION[ADMIN_SESSION_OBSOLETE_KEY], $_SESSION['oauth_state']);
    rotateCsrfToken();

    $token = bin2hex(random_bytes(32));
    $ip = getClientIp();
    $family = ipFamily($ip);

    $db->prepare('UPDATE admin_sessions SET revoked_at = NOW() WHERE discord_id = ? AND revoked_at IS NULL')
        ->execute([$user['discord_id']]);
    $db->prepare(
        'INSERT INTO admin_sessions
            (discord_id, discord_username, discord_avatar, session_token_hash, ipv4_address, ipv6_address, created_at, last_activity_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW() + INTERVAL ? SECOND)'
    )->execute([
        $user['discord_id'],
        mb_substr($user['username'], 0, 100),
        $user['avatar'] === null ? null : mb_substr($user['avatar'], 0, 255),
        hash('sha256', $token),
        $family === 'ipv4' ? $ip : null,
        $family === 'ipv6' ? $ip : null,
        ADMIN_SESSION_ABSOLUTE_TTL,
    ]);

    $_SESSION[ADMIN_SESSION_KEY] = [
        'session_id' => (int) $db->lastInsertId(),
        'token' => $token,
        'discord_id' => $user['discord_id'],
        'role' => $role,
        'regenerated_at' => time(),
    ];
}

/**
 * Valida la sesión del panel en cada petición.
 *
 * - `user` null + `error` null: no hay sesión (mostrar login).
 * - `error` 'session_expired' | 'access_revoked': había sesión y ya no vale (se limpia).
 *
 * @return array{user: array{discord_id: string, username: ?string, avatar: ?string, role: string, session_id: int}|null, error: ?string}
 */
function adminSessionValidate(PDO $db): array
{
    $session = $_SESSION[ADMIN_SESSION_KEY] ?? null;
    if (!is_array($session) || !is_int($session['session_id'] ?? null) || !is_string($session['token'] ?? null)
        || !is_string($session['discord_id'] ?? null)) {
        return ['user' => null, 'error' => null];
    }

    // ID antiguo tras una regeneración: vale unos segundos para peticiones que ya estaban en vuelo.
    $obsoleteAt = $_SESSION[ADMIN_SESSION_OBSOLETE_KEY] ?? null;
    if (is_int($obsoleteAt) && time() - $obsoleteAt > ADMIN_SESSION_OBSOLETE_GRACE) {
        adminSessionClearLocal();
        return ['user' => null, 'error' => 'session_expired'];
    }

    $stmt = $db->prepare(
        'SELECT discord_id, discord_username, discord_avatar, session_token_hash, ipv4_address, ipv6_address, revoked_at,
                (expires_at > NOW() AND last_activity_at > NOW() - INTERVAL ? SECOND) AS alive,
                (last_activity_at < NOW() - INTERVAL ? SECOND) AS touch_due
         FROM admin_sessions WHERE id = ?'
    );
    $stmt->execute([ADMIN_SESSION_IDLE_TTL, ADMIN_SESSION_TOUCH_EVERY, $session['session_id']]);
    $row = $stmt->fetch();
    $sessionId = $session['session_id'];

    if (!is_array($row) || $row['discord_id'] !== $session['discord_id']
        || !hash_equals((string) $row['session_token_hash'], hash('sha256', $session['token']))) {
        adminSessionClearLocal();
        return ['user' => null, 'error' => 'session_expired'];
    }
    if ($row['revoked_at'] !== null) {
        $role = getUserRole($db, $session['discord_id']);
        adminSessionClearLocal();
        $changed = $role === null || $role !== ($session['role'] ?? null);
        return ['user' => null, 'error' => $changed ? 'access_revoked' : 'session_expired'];
    }
    if ((int) $row['alive'] !== 1) {
        adminSessionRevokeById($db, $sessionId);
        adminSessionClearLocal();
        return ['user' => null, 'error' => 'session_expired'];
    }

    $role = getUserRole($db, $session['discord_id']);
    if ($role === null) {
        adminSessionRevokeById($db, $sessionId);
        adminSessionClearLocal();
        return ['user' => null, 'error' => 'access_revoked'];
    }

    $ip = getClientIp();
    $family = ipFamily($ip);
    if ($family !== null) {
        $column = $family === 'ipv4' ? 'ipv4_address' : 'ipv6_address';
        $learned = $row[$column];
        if ($learned === null) {
            $db->prepare("UPDATE admin_sessions SET {$column} = ? WHERE id = ? AND {$column} IS NULL")->execute([$ip, $sessionId]);
        } elseif (!sameIpScope((string) $learned, $ip)) {
            adminSessionRevokeById($db, $sessionId);
            adminSessionClearLocal();
            return ['user' => null, 'error' => 'session_expired'];
        }
    }

    if ((int) $row['touch_due'] === 1) {
        $db->prepare('UPDATE admin_sessions SET last_activity_at = NOW() WHERE id = ?')->execute([$sessionId]);
    }

    $_SESSION[ADMIN_SESSION_KEY]['role'] = $role;
    $regeneratedAt = is_int($session['regenerated_at'] ?? null) ? $session['regenerated_at'] : 0;
    if (!is_int($obsoleteAt) && session_status() === PHP_SESSION_ACTIVE && time() - $regeneratedAt >= ADMIN_SESSION_REGENERATE_EVERY) {
        // session_regenerate_id(false) escribe los datos actuales (con la marca) en el ID antiguo.
        $_SESSION[ADMIN_SESSION_OBSOLETE_KEY] = time();
        session_regenerate_id(false);
        unset($_SESSION[ADMIN_SESSION_OBSOLETE_KEY]);
        $_SESSION[ADMIN_SESSION_KEY]['regenerated_at'] = time();
    }

    return [
        'user' => [
            'discord_id' => $session['discord_id'],
            'username' => $row['discord_username'],
            'avatar' => $row['discord_avatar'],
            'role' => $role,
            'session_id' => $sessionId,
        ],
        'error' => null,
    ];
}

/**
 * Revoca todas las sesiones activas de un usuario (al quitarlo o cambiar su rol). Devuelve cuántas.
 */
function adminSessionRevokeForDiscordId(PDO $db, string $discordId): int
{
    $stmt = $db->prepare('UPDATE admin_sessions SET revoked_at = NOW() WHERE discord_id = ? AND revoked_at IS NULL');
    $stmt->execute([$discordId]);
    return $stmt->rowCount();
}

/**
 * Cierra la sesión actual: revoca la fila y destruye la sesión PHP.
 */
function adminSessionLogout(PDO $db): void
{
    $session = $_SESSION[ADMIN_SESSION_KEY] ?? null;
    if (is_array($session) && is_int($session['session_id'] ?? null)) {
        adminSessionRevokeById($db, $session['session_id']);
    }
    $_SESSION = [];
    if (session_status() === PHP_SESSION_ACTIVE) {
        $params = session_get_cookie_params();
        if (!headers_sent()) {
            setcookie((string) session_name(), '', [
                'expires' => time() - 3600,
                'path' => $params['path'],
                'secure' => $params['secure'],
                'httponly' => $params['httponly'],
                'samesite' => $params['samesite'],
            ]);
        }
        session_destroy();
    }
}

function adminSessionRevokeById(PDO $db, int $sessionId): void
{
    $db->prepare('UPDATE admin_sessions SET revoked_at = NOW() WHERE id = ? AND revoked_at IS NULL')->execute([$sessionId]);
}

/**
 * Quita los datos de administrador y renueva el ID, dejando una sesión vacía utilizable
 * (para el `state` de OAuth y el token CSRF de la pantalla de login).
 */
function adminSessionClearLocal(): void
{
    unset($_SESSION[ADMIN_SESSION_KEY], $_SESSION[ADMIN_SESSION_OBSOLETE_KEY]);
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_regenerate_id(true);
    }
    rotateCsrfToken();
}
