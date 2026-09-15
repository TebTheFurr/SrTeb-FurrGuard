<?php

declare(strict_types=1);

/**
 * FurrGuard - panel: sesión, mensajes, registro, ajustes, API key, exportación y usuarios.
 */

if (!defined('FURRGUARD_ROOT')) {
    http_response_code(404);
    exit;
}

const ADMIN_MESSAGE_MAX_LENGTH = 4000;
const ADMIN_ASSIGNABLE_ROLES = ['owner', 'manager', 'sradmin', 'admin'];

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 */
function adminLogout(PDO $db, array $in, array $user): null
{
    logActivity($db, 'auth', 'logout', adminActor($user) . " ({$user['discord_id']}) cerró sesión");
    adminSessionLogout($db);
    return null;
}

// ─── Mensajes ───────────────────────────────────────────────────────────────

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{messages: object}
 */
function adminGetMessages(PDO $db, array $in, array $user): array
{
    return ['messages' => messagesMap($db)];
}

/**
 * Guarda solo las claves existentes que cambian; una clave desconocida es 422.
 *
 * @param array<string, mixed> $in
 * @param AdminUser $user
 */
function adminSaveMessages(PDO $db, array $in, array $user): null
{
    $messages = [];
    foreach (inputArray($in, 'messages', 500) as $key => $value) {
        $key = (string) $key;
        if (!is_string($value) || !mb_check_encoding($value, 'UTF-8') || mb_strlen($value) > ADMIN_MESSAGE_MAX_LENGTH) {
            throw new ValidationError("El mensaje {$key} debe ser texto de hasta " . ADMIN_MESSAGE_MAX_LENGTH . ' caracteres.', 'messages');
        }
        $messages[$key] = $value;
    }
    if ($messages === []) {
        return null;
    }
    withTransaction($db, static function (PDO $db) use ($user, $messages): void {
        $stmt = $db->prepare('SELECT `key`, value FROM messages WHERE `key` IN (' . sqlPlaceholders(count($messages)) . ') FOR UPDATE');
        $stmt->execute(array_keys($messages));
        $current = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
        $unknown = array_diff(array_keys($messages), array_keys($current));
        if ($unknown !== []) {
            throw new ValidationError('Mensajes desconocidos: ' . implode(', ', $unknown) . '.', 'messages');
        }
        $changed = array_filter($messages, static fn (string $value, string $key): bool => $current[$key] !== $value, ARRAY_FILTER_USE_BOTH);
        if ($changed === []) {
            return;
        }
        $update = $db->prepare('UPDATE messages SET value = ? WHERE `key` = ?');
        foreach ($changed as $key => $value) {
            $update->execute([$value, $key]);
        }
        adminRecord($db, $user, 'messages', 'messages_updated', count($changed) . ' mensajes: ' . implode(', ', array_keys($changed)));
    });
    return null;
}

// ─── Registro ───────────────────────────────────────────────────────────────

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{items: list<mixed>, pagination: array{page: int, per_page: int, total: int, total_pages: int}}
 */
function adminGetLogs(PDO $db, array $in, array $user): array
{
    $type = inputOptionalEnum($in, 'type', ACTIVITY_LOG_TYPES);
    [$where, $params] = adminWhere([$type === null ? null : ['type = ?', [$type]], adminSearchCondition($in, ['action', 'details'])]);
    return adminPaginate($db, $in, 'id, type, action, details, ip_address, created_at', "FROM activity_logs{$where}", $params, 'id DESC', 50);
}

// ─── Ajustes y API key ──────────────────────────────────────────────────────

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array<string, mixed>
 */
function adminGetSettings(PDO $db, array $in, array $user): array
{
    return ['settings' => settingsForPanel($db), 'api_key' => apiKeyInfo($db)];
}

/**
 * Los bool/int/float pueden llegar como números: validateSettingsInput los normaliza. Guarda solo
 * lo que cambia, deja traza e incrementa cache_version (saveChangedSettings).
 *
 * @param array<string, mixed> $in
 * @param AdminUser $user
 */
function adminSaveSettings(PDO $db, array $in, array $user): null
{
    saveChangedSettings($db, validateSettingsInput(inputArray($in, 'settings', 100)), adminActor($user));
    return null;
}

/**
 * La clave en claro solo sale en esta respuesta.
 *
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{api_key: string, prefix: string, created_at: ?string}
 */
function adminRegenerateApiKey(PDO $db, array $in, array $user): array
{
    $key = apiKeyRegenerate($db, adminActor($user));
    return $key + ['created_at' => apiKeyInfo($db)['created_at']];
}

/**
 * Configuración y listas, sin API key, hashes ni otros secretos.
 *
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array<string, mixed>
 */
function adminExportData(PDO $db, array $in, array $user): array
{
    $rows = static fn (string $sql): array => $db->query($sql)->fetchAll();
    $data = [
        'exported_at' => gmdate('Y-m-d H:i:s'),
        'version' => FURRGUARD_VERSION,
        'settings' => settingsForPanel($db),
        'messages' => messagesMap($db),
        'whitelist' => $rows('SELECT type, value, reason, added_by, created_at FROM whitelist ORDER BY id'),
        'blacklist' => $rows('SELECT id, ban_id, type, value, reason, added_by, active, expires_at, parent_id, created_at FROM blacklist ORDER BY id'),
        'providers' => $rows('SELECT name, pattern, type, active FROM blocked_providers ORDER BY id'),
        'countries' => $rows('SELECT country_code, country_name, kick_message, active FROM blocked_countries ORDER BY id'),
        'continents' => $rows('SELECT continent_code, continent_name, kick_message, active FROM blocked_continents ORDER BY id'),
    ];
    adminRecord($db, $user, 'settings', 'export_data', 'Exportación de configuración y listas', false);
    return $data;
}

// ─── Usuarios ───────────────────────────────────────────────────────────────

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{items: list<mixed>, pagination: array{page: int, per_page: int, total: int, total_pages: int}}
 */
function adminGetAdminUsers(PDO $db, array $in, array $user): array
{
    return adminPaginate(
        $db,
        $in,
        'au.id, au.discord_id, au.role, au.created_by, au.created_at,
         (SELECT s.discord_username FROM admin_sessions s WHERE s.discord_id = au.discord_id AND s.discord_username IS NOT NULL ORDER BY s.id DESC LIMIT 1) AS discord_username',
        'FROM admin_users au',
        [],
        "FIELD(au.role, 'founder', 'owner', 'manager', 'sradmin', 'admin'), au.created_at, au.id"
    );
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{id: int}
 */
function adminAddAdminUser(PDO $db, array $in, array $user): array
{
    $discordId = inputString($in, 'discord_id', 20);
    if (preg_match('/^\d{17,20}\z/', $discordId) !== 1) {
        throw new ValidationError('El Discord ID son 17 a 20 dígitos.', 'discord_id');
    }
    if (FOUNDER_DISCORD_ID !== '' && hash_equals(FOUNDER_DISCORD_ID, $discordId)) {
        throw new ValidationError('El founder ya tiene acceso siempre.', 'discord_id');
    }
    $role = inputEnum($in, 'role', ADMIN_ASSIGNABLE_ROLES);
    return withTransaction($db, static function (PDO $db) use ($user, $discordId, $role): array {
        try {
            $db->prepare('INSERT INTO admin_users (discord_id, role, created_by, created_at) VALUES (?, ?, ?, NOW())')->execute([$discordId, $role, $user['discord_id']]);
        } catch (PDOException $e) {
            throw isDuplicateKeyError($e) ? new HttpError(409, 'duplicate', 'Ese usuario ya tiene acceso al panel.') : $e;
        }
        $id = (int) $db->lastInsertId();
        adminRecord($db, $user, 'users', 'add_user', "Discord {$discordId} con rol {$role}", false);
        return ['id' => $id];
    });
}

/**
 * Quita el acceso y revoca todas sus sesiones del panel.
 *
 * @param array<string, mixed> $in
 * @param AdminUser $user
 */
function adminRemoveAdminUser(PDO $db, array $in, array $user): null
{
    $id = inputInt($in, 'id', 1);
    withTransaction($db, static function (PDO $db) use ($user, $id): void {
        $target = adminFindRow($db, 'admin_users', $id, 'discord_id, role') ?? adminNotFound('Usuario no encontrado.');
        $discordId = (string) $target['discord_id'];
        if ($target['role'] === 'founder' || (FOUNDER_DISCORD_ID !== '' && hash_equals(FOUNDER_DISCORD_ID, $discordId))) {
            throw new HttpError(403, 'forbidden', 'No se puede quitar el acceso al founder.');
        }
        $db->prepare('DELETE FROM admin_users WHERE id = ?')->execute([$id]);
        $revoked = adminSessionRevokeForDiscordId($db, $discordId);
        adminRecord($db, $user, 'users', 'remove_user', "Discord {$discordId} ({$target['role']}); {$revoked} sesiones cerradas", false);
    });
    return null;
}
