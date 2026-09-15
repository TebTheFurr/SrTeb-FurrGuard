<?php

declare(strict_types=1);

/**
 * FurrSecurity (docs/API.md §2): staff, enlaces de verificación, sesiones atadas a la IP, intentos
 * fallidos con ventana y auto-baneo.
 *
 * - La sesión verificada vale solo desde el ámbito de IP que pidió el enlace (IPv4 exacta, IPv6 /64).
 * - Todas las fechas se calculan en SQL (UTC).
 */

require_once __DIR__ . '/bans.php';

const FURRSECURITY_TOKEN_PATTERN = '/^[0-9a-f]{64}\z/';
const FURRSECURITY_AUTHOR = 'FurrSecurity';
const FURRSECURITY_LOG_GROUPS = [
    'verification' => ['token_generated', 'verification_success'],
    'failed' => ['verification_failed', 'wrong_discord_attempt'],
    'blacklist' => ['auto_blacklisted', 'auto_blacklisted_wrong_discord'],
    'session' => ['session_extended', 'session_reset', 'session_revoked', 'revoke_session', 'player_disconnect', 'ip_changed', 'token_expired'],
];
const FURRSECURITY_VERIFICATION_COLUMNS = "id, uuid, minecraft_nick, discord_id, status, ip_address, created_at, token_expires_at, verified_at, expires_at,
    (token_expires_at IS NOT NULL AND token_expires_at > NOW()) AS token_alive,
    GREATEST(TIMESTAMPDIFF(SECOND, NOW(), token_expires_at), 0) AS token_remaining,
    (expires_at > NOW()) AS session_alive,
    GREATEST(TIMESTAMPDIFF(SECOND, NOW(), expires_at), 0) AS session_remaining";

// ─── Utilidades ─────────────────────────────────────────────────────────────

/**
 * @param array<array-key, mixed> $in
 */
function inputVerificationToken(array $in, string $key = 'token', bool $required = true): ?string
{
    $token = inputOptionalString($in, $key, 64);
    if ($token === null && !$required) {
        return null;
    }
    if ($token === null || preg_match(FURRSECURITY_TOKEN_PATTERN, $token) !== 1) {
        throw new ValidationError("El campo {$key} no es un token válido.", $key);
    }
    return $token;
}

/**
 * Todos los ajustes `furrsecurity_*` (§7).
 *
 * @return array<string, ?string>
 */
function furrSecuritySettings(PDO $db): array
{
    $keys = array_values(array_filter(array_keys(settingDefinitions()), static fn (string $key): bool => str_starts_with($key, 'furrsecurity_')));
    return getSettings($db, $keys);
}

/**
 * Ajuste entero acotado a su rango de §7 (un valor corrupto nunca deja la sesión sin límite).
 */
function furrSecurityIntSetting(PDO $db, string $key): int
{
    $definition = settingDefinitions()[$key];
    return max((int) ($definition['min'] ?? 0), min((int) ($definition['max'] ?? PHP_INT_MAX), (int) getSetting($db, $key)));
}

function furrSecurityLog(PDO $db, ?string $uuid, ?string $nick, ?string $discordId, string $action, ?string $details, ?string $ip): void
{
    $db->prepare(
        'INSERT INTO furrsecurity_logs (uuid, minecraft_nick, discord_id, action, details, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())'
    )->execute([$uuid, $nick === null ? null : mb_substr($nick, 0, 16), $discordId, $action, $details, $ip === null ? null : normalizeIp($ip)]);
}

/**
 * @return array{discord_id: string, minecraft_nick: string}|null
 */
function furrSecurityStaff(PDO $db, string $nick): ?array
{
    $stmt = $db->prepare('SELECT discord_id, minecraft_nick FROM furrsecurity_staff WHERE minecraft_nick = ?');
    $stmt->execute([$nick]);
    $row = $stmt->fetch();
    return is_array($row) ? ['discord_id' => (string) $row['discord_id'], 'minecraft_nick' => (string) $row['minecraft_nick']] : null;
}

/**
 * @return array{staff: list<array{nick: string}>}
 */
function furrSecurityStaffList(PDO $db): array
{
    $nicks = $db->query('SELECT minecraft_nick FROM furrsecurity_staff ORDER BY minecraft_nick')->fetchAll(PDO::FETCH_COLUMN);
    return ['staff' => array_map(static fn (mixed $nick): array => ['nick' => (string) $nick], $nicks)];
}

/**
 * @return array<string, mixed>|null
 */
function furrSecurityVerificationByToken(PDO $db, string $token): ?array
{
    $stmt = $db->prepare('SELECT ' . FURRSECURITY_VERIFICATION_COLUMNS . ' FROM furrsecurity_verifications WHERE verification_token = ?');
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    return is_array($row) ? $row : null;
}

// ─── Sesiones ───────────────────────────────────────────────────────────────

/**
 * Sesiones verificadas y sin caducar de un UUID (opcionalmente de un token), la más duradera primero.
 *
 * @return list<array<string, mixed>>
 */
function furrSecurityActiveSessions(PDO $db, string $uuid, ?string $token = null): array
{
    $stmt = $db->prepare(
        'SELECT ' . FURRSECURITY_VERIFICATION_COLUMNS . " FROM furrsecurity_verifications
         WHERE uuid = ? AND status = 'verified' AND expires_at > NOW()" . ($token === null ? '' : ' AND verification_token = ?') . '
         ORDER BY expires_at DESC, id DESC'
    );
    $stmt->execute($token === null ? [$uuid] : [$uuid, $token]);
    return $stmt->fetchAll();
}

/**
 * Sesión en vigor del UUID desde el mismo ámbito de IP, o null.
 *
 * @param list<array<string, mixed>>|null $sessions
 * @return array<string, mixed>|null
 */
function furrSecuritySessionFor(PDO $db, string $uuid, string $ip, ?array $sessions = null): ?array
{
    foreach ($sessions ?? furrSecurityActiveSessions($db, $uuid) as $session) {
        if (sameIpScope(is_string($session['ip_address']) ? $session['ip_address'] : null, $ip)) {
            return $session;
        }
    }
    return null;
}

/**
 * @return array<string, mixed>
 */
function furrSecurityCheckStatus(PDO $db, string $uuid, string $nick, string $ip): array
{
    if (getSetting($db, 'furrsecurity_enabled') !== '1') {
        return ['needs_verification' => false, 'reason' => 'module_disabled'];
    }
    $staff = furrSecurityStaff($db, $nick);
    if ($staff === null) {
        return ['needs_verification' => false, 'reason' => 'not_staff'];
    }
    $sessions = furrSecurityActiveSessions($db, $uuid);
    $session = furrSecuritySessionFor($db, $uuid, $ip, $sessions);
    if ($session !== null) {
        return [
            'needs_verification' => false,
            'reason' => 'already_verified',
            'session' => ['expires_at' => $session['expires_at'], 'time_remaining_seconds' => (int) $session['session_remaining']],
        ];
    }
    if ($sessions !== []) {
        furrSecurityLog($db, $uuid, $nick, $staff['discord_id'], 'ip_changed', 'Sesión verificada desde otra IP: hay que verificar de nuevo', $ip);
    }
    return ['needs_verification' => true, 'reason' => $sessions === [] ? 'no_valid_session' : 'ip_changed', 'discord_id' => $staff['discord_id']];
}

/**
 * @return array<string, mixed>
 */
function furrSecurityGetSession(PDO $db, string $uuid, string $ip): array
{
    $session = furrSecuritySessionFor($db, $uuid, $ip);
    if ($session === null) {
        return ['has_session' => false];
    }
    return [
        'has_session' => true,
        'session' => [
            'id' => (int) $session['id'],
            'nick' => $session['minecraft_nick'],
            'discord_id' => $session['discord_id'],
            'verified_at' => $session['verified_at'],
            'expires_at' => $session['expires_at'],
            'time_remaining_seconds' => (int) $session['session_remaining'],
        ],
    ];
}

/**
 * Renueva una sesión verificada, sin caducar y del mismo ámbito de IP (con token: esa sesión).
 *
 * @return array<string, mixed>
 */
function furrSecurityExtendSession(PDO $db, string $uuid, string $ip, ?string $token): array
{
    $sessions = furrSecurityActiveSessions($db, $uuid, $token);
    if ($sessions === []) {
        return ['success' => false, 'error' => $token === null ? 'no_active_session' : 'invalid_token'];
    }
    $session = furrSecuritySessionFor($db, $uuid, $ip, $sessions);
    if ($session === null) {
        return ['success' => false, 'error' => 'ip_changed'];
    }
    $db->prepare("UPDATE furrsecurity_verifications SET expires_at = NOW() + INTERVAL ? SECOND WHERE id = ? AND status = 'verified' AND expires_at > NOW()")
        ->execute([furrSecurityIntSetting($db, 'furrsecurity_session_duration'), $session['id']]);
    $stmt = $db->prepare('SELECT expires_at, GREATEST(TIMESTAMPDIFF(SECOND, NOW(), expires_at), 0) AS remaining FROM furrsecurity_verifications WHERE id = ?');
    $stmt->execute([$session['id']]);
    $renewed = $stmt->fetch();
    furrSecurityLog($db, $uuid, (string) $session['minecraft_nick'], is_string($session['discord_id']) ? $session['discord_id'] : null, 'session_extended', 'Sesión renovada', $ip);
    return ['success' => true, 'expires_at' => $renewed['expires_at'] ?? null, 'time_remaining_seconds' => (int) ($renewed['remaining'] ?? 0)];
}

/**
 * @return array{success: true, sessions_expired: int}
 */
function furrSecurityResetSession(PDO $db, string $uuid, string $nick): array
{
    $stmt = $db->prepare("UPDATE furrsecurity_verifications SET status = 'expired', expires_at = NOW() WHERE uuid = ? AND status = 'verified' AND expires_at > NOW()");
    $stmt->execute([$uuid]);
    $expired = $stmt->rowCount();
    furrSecurityLog($db, $uuid, $nick, null, 'session_reset', "Sesión reiniciada ({$expired} sesiones expiradas)", null);
    return ['success' => true, 'sessions_expired' => $expired];
}

// ─── Enlaces ────────────────────────────────────────────────────────────────

/**
 * Enlace de verificación. Reutiliza uno pendiente solo si es de la misma IP y no ha caducado; si
 * no, expira los pendientes y crea uno nuevo que dura `furrsecurity_token_expiration`.
 *
 * @return array<string, mixed>
 */
function furrSecurityGenerateToken(PDO $db, string $uuid, string $nick, string $ip): array
{
    $staff = furrSecurityStaff($db, $nick);
    if ($staff === null) {
        return ['success' => false, 'error' => 'not_in_whitelist'];
    }
    return withTransaction($db, static function (PDO $db) use ($uuid, $nick, $ip, $staff): array {
        $stmt = $db->prepare(
            "SELECT verification_token, ip_address, GREATEST(TIMESTAMPDIFF(SECOND, NOW(), token_expires_at), 0) AS remaining
             FROM furrsecurity_verifications WHERE uuid = ? AND status = 'pending' AND token_expires_at > NOW() ORDER BY id DESC FOR UPDATE"
        );
        $stmt->execute([$uuid]);
        foreach ($stmt->fetchAll() as $pending) {
            if (sameIpScope(is_string($pending['ip_address']) ? $pending['ip_address'] : null, $ip)) {
                return furrSecurityTokenGrant($db, (string) $pending['verification_token'], true, (int) $pending['remaining']);
            }
        }
        $db->prepare(
            "UPDATE furrsecurity_verifications SET status = IF(token_expires_at > NOW(), 'expired', 'token_expired') WHERE uuid = ? AND status = 'pending'"
        )->execute([$uuid]);
        $seconds = furrSecurityIntSetting($db, 'furrsecurity_token_expiration');
        $token = bin2hex(random_bytes(32));
        $db->prepare(
            "INSERT INTO furrsecurity_verifications (uuid, discord_id, minecraft_nick, verification_token, token_expires_at, status, expires_at, ip_address, created_at)
             VALUES (?, ?, ?, ?, NOW() + INTERVAL ? SECOND, 'pending', NOW() + INTERVAL ? SECOND, ?, NOW())"
        )->execute([$uuid, $staff['discord_id'], $nick, $token, $seconds, $seconds, $ip]);
        furrSecurityLog($db, $uuid, $nick, $staff['discord_id'], 'token_generated', 'Enlace de verificación generado', $ip);
        return furrSecurityTokenGrant($db, $token, false, $seconds);
    });
}

/**
 * @return array{success: true, token: string, verify_url: string, existing: bool, token_expires_in_seconds: int}
 */
function furrSecurityTokenGrant(PDO $db, string $token, bool $existing, int $seconds): array
{
    $base = (string) getSetting($db, 'furrsecurity_verify_url');
    if ($base === '') {
        $base = APP_URL . '/verify.php';
    }
    return [
        'success' => true,
        'token' => $token,
        'verify_url' => $base . (str_contains($base, '?') ? '&' : '?') . 'token=' . $token,
        'existing' => $existing,
        'token_expires_in_seconds' => $seconds,
    ];
}

/**
 * Estado de un enlace para el sondeo del módulo: pending | verified | token_expired | expired | not_found.
 *
 * @return array<string, mixed>
 */
function furrSecurityTokenStatus(PDO $db, string $token): array
{
    $row = furrSecurityVerificationByToken($db, $token);
    if ($row === null) {
        return ['status' => 'not_found', 'verified' => false];
    }
    if ($row['status'] === 'pending') {
        if ((int) $row['token_alive'] === 1) {
            return ['status' => 'pending', 'verified' => false, 'token_expires_in_seconds' => (int) $row['token_remaining']];
        }
        $db->prepare("UPDATE furrsecurity_verifications SET status = 'token_expired' WHERE id = ? AND status = 'pending'")->execute([$row['id']]);
        return ['status' => 'token_expired', 'verified' => false];
    }
    if ($row['status'] === 'verified') {
        if ((int) $row['session_alive'] === 1) {
            return ['status' => 'verified', 'verified' => true, 'expires_at' => $row['expires_at'], 'time_remaining_seconds' => (int) $row['session_remaining']];
        }
        $db->prepare("UPDATE furrsecurity_verifications SET status = 'expired' WHERE id = ? AND status = 'verified'")->execute([$row['id']]);
        return ['status' => 'expired', 'verified' => false];
    }
    return ['status' => $row['status'] === 'token_expired' ? 'token_expired' : 'expired', 'verified' => false];
}

/**
 * Vuelta de Discord en verify.php: el token debe seguir pendiente y sin caducar. Mismo Discord →
 * sesión verificada (la IP de la sesión sigue siendo la que pidió el enlace); otro → intento fallido.
 *
 * @return array{result: string, attempts: int, max_attempts: int} result: verified | mismatch | blacklisted | expired
 */
function furrSecurityCompleteVerification(PDO $db, string $token, string $discordId, string $clientIp): array
{
    return withTransaction($db, static function (PDO $db) use ($token, $discordId, $clientIp): array {
        $stmt = $db->prepare(
            "SELECT id, uuid, minecraft_nick, discord_id, ip_address FROM furrsecurity_verifications
             WHERE verification_token = ? AND status = 'pending' AND token_expires_at > NOW() FOR UPDATE"
        );
        $stmt->execute([$token]);
        $row = $stmt->fetch();
        if (!is_array($row)) {
            return ['result' => 'expired', 'attempts' => 0, 'max_attempts' => 0];
        }
        $uuid = (string) $row['uuid'];
        $nick = (string) $row['minecraft_nick'];
        if (is_string($row['discord_id']) && $row['discord_id'] !== '' && hash_equals($row['discord_id'], $discordId)) {
            // Re-verificación anticipada: las sesiones en vigor del mismo ámbito de IP se renuevan con esta.
            $ids = [(int) $row['id']];
            foreach (furrSecurityActiveSessions($db, $uuid) as $session) {
                if (sameIpScope(is_string($session['ip_address']) ? $session['ip_address'] : null, is_string($row['ip_address']) ? $row['ip_address'] : null)) {
                    $ids[] = (int) $session['id'];
                }
            }
            $db->prepare(
                "UPDATE furrsecurity_verifications SET status = 'verified', verified_at = IF(id = ?, NOW(), verified_at), expires_at = NOW() + INTERVAL ? SECOND
                 WHERE id IN (" . sqlPlaceholders(count($ids)) . ')'
            )->execute([$row['id'], furrSecurityIntSetting($db, 'furrsecurity_session_duration'), ...$ids]);
            furrSecurityLog($db, $uuid, $nick, $discordId, 'verification_success', 'Verificación completada con Discord', $clientIp);
            return ['result' => 'verified', 'attempts' => 0, 'max_attempts' => 0];
        }
        furrSecurityLog($db, $uuid, $nick, $discordId, 'wrong_discord_attempt', 'Intento con una cuenta de Discord distinta a la del staff', $clientIp);
        $failed = furrSecurityRecordFailedAttempt($db, $uuid, $nick, $clientIp, $discordId);
        return ['result' => $failed['blacklisted'] ? 'blacklisted' : 'mismatch', 'attempts' => $failed['attempts'], 'max_attempts' => $failed['max_attempts']];
    });
}

// ─── Intentos fallidos ──────────────────────────────────────────────────────

/**
 * Cuenta un intento dentro de `furrsecurity_failed_attempts_window`. Al llegar a
 * `furrsecurity_max_failed_attempts` → upsertBan(auto) del UUID, con el nick y la IP (IPv6 /64) como
 * hijas. `$discordId` indica que el intento vino de la web con otra cuenta de Discord.
 *
 * `$expirePendingTokens` (acción record_failed_attempt del módulo, tras expulsar por enlace caducado):
 * el enlace pendiente pasa a `token_expired` para que el player_disconnect(locked=1) que llega
 * después no cuente el mismo intento dos veces.
 *
 * @return array{attempts: int, max_attempts: int, blacklisted: bool}
 */
function furrSecurityRecordFailedAttempt(PDO $db, string $uuid, string $nick, ?string $ip, ?string $discordId = null, bool $expirePendingTokens = false): array
{
    $window = furrSecurityIntSetting($db, 'furrsecurity_failed_attempts_window');
    $max = furrSecurityIntSetting($db, 'furrsecurity_max_failed_attempts');
    return withTransaction($db, static function (PDO $db) use ($uuid, $nick, $ip, $discordId, $window, $max, $expirePendingTokens): array {
        if ($expirePendingTokens) {
            $db->prepare("UPDATE furrsecurity_verifications SET status = 'token_expired' WHERE uuid = ? AND status = 'pending'")->execute([$uuid]);
        }
        $db->prepare(
            'INSERT INTO furrsecurity_failed_attempts (uuid, minecraft_nick, failed_attempts, window_started_at, last_attempt, last_ip)
             VALUES (?, ?, 1, NOW(), NOW(), ?)
             ON DUPLICATE KEY UPDATE
                 failed_attempts = IF(window_started_at <= NOW() - INTERVAL ? SECOND, 1, COALESCE(failed_attempts, 0) + 1),
                 window_started_at = IF(window_started_at <= NOW() - INTERVAL ? SECOND, NOW(), window_started_at),
                 minecraft_nick = VALUES(minecraft_nick), last_attempt = NOW(), last_ip = COALESCE(VALUES(last_ip), last_ip)'
        )->execute([$uuid, mb_substr($nick, 0, 16), $ip, $window, $window]);
        $stmt = $db->prepare('SELECT failed_attempts FROM furrsecurity_failed_attempts WHERE uuid = ?');
        $stmt->execute([$uuid]);
        $attempts = (int) $stmt->fetchColumn();
        furrSecurityLog($db, $uuid, $nick, $discordId, 'verification_failed', "Intento fallido {$attempts}/{$max}", $ip);
        if ($attempts < $max) {
            return ['attempts' => $attempts, 'max_attempts' => $max, 'blacklisted' => false];
        }

        $base = ['reason' => 'FurrSecurity: demasiados intentos de verificación fallidos', 'added_by' => FURRSECURITY_AUTHOR];
        $root = upsertBan($db, ['type' => 'uuid', 'value' => $uuid] + $base, 'auto');
        upsertBan($db, ['type' => 'nick', 'value' => $nick, 'parent_id' => $root['id']] + $base, 'auto');
        $target = $ip === null ? null : autoBanIpTarget($ip);
        if ($target !== null) {
            upsertBan($db, $target + $base + ['parent_id' => $root['id']], 'auto');
        }
        $db->prepare('DELETE FROM furrsecurity_failed_attempts WHERE uuid = ?')->execute([$uuid]);
        $db->prepare("UPDATE furrsecurity_verifications SET status = 'expired' WHERE uuid = ? AND status = 'pending'")->execute([$uuid]);
        furrSecurityLog(
            $db,
            $uuid,
            $nick,
            $discordId,
            $discordId === null ? 'auto_blacklisted' : 'auto_blacklisted_wrong_discord',
            "Auto-baneo {$root['ban_id']} tras {$attempts} intentos fallidos",
            $ip
        );
        incrementCacheVersion($db);
        return ['attempts' => $attempts, 'max_attempts' => $max, 'blacklisted' => true];
    });
}

/**
 * Desconexión: solo deja traza si es staff o estaba bloqueado. Bloqueado con un enlace pendiente
 * cuenta como intento fallido (con la IP que pidió el enlace).
 */
function furrSecurityPlayerDisconnect(PDO $db, string $uuid, string $nick, bool $locked): void
{
    $staff = furrSecurityStaff($db, $nick);
    if ($staff === null && !$locked) {
        return;
    }
    furrSecurityLog($db, $uuid, $nick, $staff['discord_id'] ?? null, 'player_disconnect', $locked ? 'Desconectado sin verificar' : 'Desconectado', null);
    if (!$locked) {
        return;
    }
    $stmt = $db->prepare("SELECT ip_address FROM furrsecurity_verifications WHERE uuid = ? AND status = 'pending' AND token_expires_at > NOW() ORDER BY id DESC LIMIT 1");
    $stmt->execute([$uuid]);
    $ip = $stmt->fetchColumn();
    if ($ip !== false) {
        furrSecurityRecordFailedAttempt($db, $uuid, $nick, is_string($ip) ? $ip : null);
    }
}
