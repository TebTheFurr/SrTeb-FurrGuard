<?php

declare(strict_types=1);

/**
 * FurrPerms: whitelist de comandos sensibles y registro de comandos (docs/API.md §1.2).
 */

require_once __DIR__ . '/furrsecurity.php';

/**
 * ¿Puede el jugador usar comandos protegidos?
 *
 * - `uuid_mismatch` si la entrada fija un UUID y no es el que llega (evita suplantar el nick en offline).
 * - Si el nick es staff de FurrSecurity (y el módulo está activo) exige una sesión verificada vigente
 *   desde esa IP: si no, `needs_furrsecurity`.
 *
 * @return array{allowed: bool, reason: string}
 */
function furrPermsCheck(PDO $db, string $nick, string $uuid, string $ip): array
{
    $settings = getSettings($db, ['fur_perms_enabled', 'furrsecurity_enabled']);
    if ($settings['fur_perms_enabled'] !== '1') {
        return ['allowed' => true, 'reason' => 'module_disabled'];
    }
    $stmt = $db->prepare('SELECT uuid FROM fur_perms_whitelist WHERE nick = ? AND active = 1');
    $stmt->execute([$nick]);
    $entry = $stmt->fetch();
    if (!is_array($entry)) {
        return ['allowed' => false, 'reason' => 'not_whitelisted'];
    }
    if (is_string($entry['uuid']) && trim($entry['uuid']) !== '' && normalizeUuid($entry['uuid']) !== $uuid) {
        return ['allowed' => false, 'reason' => 'uuid_mismatch'];
    }
    if ($settings['furrsecurity_enabled'] === '1' && furrSecurityStaff($db, $nick) !== null && furrSecuritySessionFor($db, $uuid, $ip) === null) {
        return ['allowed' => false, 'reason' => 'needs_furrsecurity'];
    }
    return ['allowed' => true, 'reason' => 'ok'];
}

/**
 * Registra un comando si `fur_perms_log_allowed` / `fur_perms_log_blocked` lo piden.
 *
 * @param array{player_uuid: ?string, player_nick: string, command: string, server_name: ?string, allowed: bool, reason: ?string, ip_address: ?string} $log
 */
function furrPermsLogCommand(PDO $db, array $log): void
{
    if (getSetting($db, $log['allowed'] ? 'fur_perms_log_allowed' : 'fur_perms_log_blocked') !== '1') {
        return;
    }
    $db->prepare(
        'INSERT INTO fur_perms_command_logs (player_uuid, player_nick, command, server_name, allowed, reason, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())'
    )->execute([
        $log['player_uuid'],
        $log['player_nick'],
        mb_substr($log['command'], 0, 255),
        $log['server_name'],
        $log['allowed'] ? 1 : 0,
        $log['reason'],
        $log['ip_address'],
    ]);
}
