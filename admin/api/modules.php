<?php

declare(strict_types=1);

/**
 * FurrGuard - panel: módulos FurrPerms y FurrSecurity.
 */

if (!defined('FURRGUARD_ROOT')) {
    http_response_code(404);
    exit;
}

// ─── FurrPerms ──────────────────────────────────────────────────────────────

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{items: list<mixed>, pagination: array{page: int, per_page: int, total: int, total_pages: int}}
 */
function adminGetFurrPermsWhitelist(PDO $db, array $in, array $user): array
{
    [$where, $params] = adminWhere([adminSearchCondition($in, ['nick', 'uuid', 'reason'])]);
    return adminPaginate($db, $in, 'id, nick, uuid, reason, added_by, active, created_at', "FROM fur_perms_whitelist{$where}", $params, 'created_at DESC, id DESC');
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{id: int}
 */
function adminAddFurrPermsWhitelist(PDO $db, array $in, array $user): array
{
    $nick = inputNick($in);
    $uuid = inputOptionalUuid($in);
    $reason = inputOptionalString($in, 'reason', BAN_REASON_MAX);
    return withTransaction($db, static function (PDO $db) use ($user, $nick, $uuid, $reason): array {
        try {
            $db->prepare('INSERT INTO fur_perms_whitelist (nick, uuid, reason, added_by, active, created_at) VALUES (?, ?, ?, ?, 1, NOW())')
                ->execute([$nick, $uuid, $reason, mb_substr(adminActor($user), 0, 100)]);
        } catch (PDOException $e) {
            throw isDuplicateKeyError($e) ? new HttpError(409, 'duplicate', 'Ese jugador ya está en la whitelist de FurrPerms.') : $e;
        }
        $id = (int) $db->lastInsertId();
        adminRecord($db, $user, 'furrperms', 'add', $uuid === null ? $nick : "{$nick} ({$uuid})");
        return ['id' => $id];
    });
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 */
function adminRemoveFurrPermsWhitelist(PDO $db, array $in, array $user): null
{
    $id = inputInt($in, 'id', 1);
    withTransaction($db, static function (PDO $db) use ($user, $id): void {
        $entry = adminFindRow($db, 'fur_perms_whitelist', $id, 'nick') ?? adminNotFound('Entrada de FurrPerms no encontrada.');
        $db->prepare('DELETE FROM fur_perms_whitelist WHERE id = ?')->execute([$id]);
        adminRecord($db, $user, 'furrperms', 'remove', (string) $entry['nick']);
    });
    return null;
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array<string, mixed>
 */
function adminGetFurrPermsLogs(PDO $db, array $in, array $user): array
{
    $filter = inputEnum($in, 'filter', ['all', 'allowed', 'blocked'], 'all');
    [$where, $params] = adminWhere([
        match ($filter) {
            'allowed' => ['allowed = 1', []],
            'blocked' => ['allowed = 0', []],
            default => null,
        },
        adminSearchCondition($in, ['player_nick', 'command', 'server_name']),
    ]);
    $list = adminPaginate($db, $in, 'id, player_uuid, player_nick, command, server_name, allowed, reason, ip_address, created_at', "FROM fur_perms_command_logs{$where}", $params, 'id DESC', 50);
    $stats = adminIntRow($db, 'SELECT COUNT(*) AS total, COALESCE(SUM(allowed = 1), 0) AS allowed, COALESCE(SUM(allowed = 0), 0) AS blocked FROM fur_perms_command_logs');
    return $list + ['stats' => $stats];
}

/**
 * Borra los registros de comandos de más de 30 días.
 *
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{deleted_count: int}
 */
function adminClearFurrPermsLogs(PDO $db, array $in, array $user): array
{
    $stmt = $db->prepare('DELETE FROM fur_perms_command_logs WHERE created_at < NOW() - INTERVAL 30 DAY');
    $stmt->execute();
    adminRecord($db, $user, 'furrperms', 'clear_logs', "{$stmt->rowCount()} registros de más de 30 días borrados", false);
    return ['deleted_count' => $stmt->rowCount()];
}

// ─── FurrSecurity ───────────────────────────────────────────────────────────

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{items: list<mixed>, pagination: array{page: int, per_page: int, total: int, total_pages: int}}
 */
function adminFurrSecurityGetStaff(PDO $db, array $in, array $user): array
{
    [$where, $params] = adminWhere([adminSearchCondition($in, ['minecraft_nick', 'discord_id'])]);
    return adminPaginate($db, $in, 'id, discord_id, minecraft_nick, added_by, added_at', "FROM furrsecurity_staff{$where}", $params, 'added_at DESC, id DESC');
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{id: int}
 */
function adminFurrSecurityAddStaff(PDO $db, array $in, array $user): array
{
    $discordId = inputString($in, 'discord_id', 20);
    if (preg_match('/^\d{17,20}\z/', $discordId) !== 1) {
        throw new ValidationError('El Discord ID son 17 a 20 dígitos.', 'discord_id');
    }
    $nick = inputNick($in, 'minecraft_nick');
    return withTransaction($db, static function (PDO $db) use ($user, $discordId, $nick): array {
        try {
            $db->prepare('INSERT INTO furrsecurity_staff (discord_id, minecraft_nick, added_by, added_at) VALUES (?, ?, ?, NOW())')
                ->execute([$discordId, $nick, mb_substr(adminActor($user), 0, 32)]);
        } catch (PDOException $e) {
            throw isDuplicateKeyError($e) ? new HttpError(409, 'duplicate', 'Ya hay staff con ese Discord ID o ese nick.') : $e;
        }
        $id = (int) $db->lastInsertId();
        adminRecord($db, $user, 'furrsecurity', 'add_staff', "{$nick} (Discord {$discordId})", false);
        return ['id' => $id];
    });
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 */
function adminFurrSecurityRemoveStaff(PDO $db, array $in, array $user): null
{
    $id = inputInt($in, 'id', 1);
    withTransaction($db, static function (PDO $db) use ($user, $id): void {
        $staff = adminFindRow($db, 'furrsecurity_staff', $id, 'minecraft_nick, discord_id') ?? adminNotFound('Staff no encontrado.');
        $db->prepare('DELETE FROM furrsecurity_staff WHERE id = ?')->execute([$id]);
        adminRecord($db, $user, 'furrsecurity', 'remove_staff', "{$staff['minecraft_nick']} (Discord {$staff['discord_id']})", false);
    });
    return null;
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{items: list<mixed>, pagination: array{page: int, per_page: int, total: int, total_pages: int}}
 */
function adminFurrSecurityGetSessions(PDO $db, array $in, array $user): array
{
    $status = inputEnum($in, 'status', ['active', 'pending', 'all'], 'active');
    [$where, $params] = adminWhere([
        match ($status) {
            'active' => ["status = 'verified' AND expires_at > NOW()", []],
            'pending' => ["status = 'pending' AND token_expires_at > NOW()", []],
            default => null,
        },
        adminSearchCondition($in, ['minecraft_nick', 'uuid', 'discord_id']),
    ]);
    return adminPaginate(
        $db,
        $in,
        'id, uuid, discord_id, minecraft_nick, status, verified_at, expires_at, token_expires_at, ip_address, created_at',
        "FROM furrsecurity_verifications{$where}",
        $params,
        'created_at DESC, id DESC'
    );
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{items: list<mixed>, pagination: array{page: int, per_page: int, total: int, total_pages: int}}
 */
function adminFurrSecurityGetLogs(PDO $db, array $in, array $user): array
{
    $group = inputEnum($in, 'group', ['all', ...array_keys(FURRSECURITY_LOG_GROUPS)], 'all');
    $actions = FURRSECURITY_LOG_GROUPS[$group] ?? null;
    [$where, $params] = adminWhere([
        $actions === null ? null : ['action IN (' . sqlPlaceholders(count($actions)) . ')', $actions],
        adminSearchCondition($in, ['minecraft_nick', 'uuid', 'discord_id', 'details']),
    ]);
    return adminPaginate($db, $in, 'id, uuid, minecraft_nick, discord_id, action, details, ip_address, created_at', "FROM furrsecurity_logs{$where}", $params, 'id DESC', 50);
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 */
function adminFurrSecurityRevokeSession(PDO $db, array $in, array $user): null
{
    $id = inputInt($in, 'id', 1);
    withTransaction($db, static function (PDO $db) use ($user, $id): void {
        $session = adminFindRow($db, 'furrsecurity_verifications', $id, 'uuid, minecraft_nick, discord_id') ?? adminNotFound('Sesión no encontrada.');
        $db->prepare("UPDATE furrsecurity_verifications SET status = 'expired', expires_at = NOW() WHERE id = ? AND status IN ('verified', 'pending')")->execute([$id]);
        furrSecurityLog($db, (string) $session['uuid'], (string) $session['minecraft_nick'], is_string($session['discord_id']) ? $session['discord_id'] : null, 'session_revoked', 'Sesión revocada desde el panel por ' . adminActor($user), null);
        adminRecord($db, $user, 'furrsecurity', 'revoke_session', "{$session['minecraft_nick']} ({$session['uuid']})", false);
    });
    return null;
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array<string, int>
 */
function adminFurrSecurityGetStats(PDO $db, array $in, array $user): array
{
    return adminIntRow($db, "SELECT
        (SELECT COUNT(*) FROM furrsecurity_staff) AS total_staff,
        (SELECT COUNT(*) FROM furrsecurity_verifications WHERE status = 'verified' AND expires_at > NOW()) AS active_sessions,
        (SELECT COUNT(*) FROM furrsecurity_verifications WHERE status = 'pending' AND token_expires_at > NOW()) AS pending_verifications,
        (SELECT COUNT(*) FROM furrsecurity_verifications WHERE verified_at >= CURDATE()) AS verified_today");
}
