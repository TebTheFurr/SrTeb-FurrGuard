<?php

declare(strict_types=1);

/**
 * FurrGuard - API del plugin Velocity y de FurrPerms (docs/API.md §1).
 *
 * POST /api/plugin.php?action=<acción> con X-API-Key. Sin cookies, sesión ni CORS.
 *
 * @author GrinchHorizon
 * @copyright Tebby Services S.L.
 */

require_once dirname(__DIR__) . '/includes/bootstrap.php';
require_once FURRGUARD_ROOT . '/includes/plugin_api.php';

pluginApiRun([
    'check_player' => static fn (PDO $db, array $in): array => checkPlayer($db, [
        'uuid' => inputOptionalUuid($in),
        'nick' => inputNick($in),
        'ip' => inputIp($in),
        'game_version' => inputOptionalString($in, 'game_version', 64),
    ]),
    'recheck_players' => static fn (PDO $db, array $in): array => recheckPlayers($db, inputPlayerList($in)),
    'lookup_player' => static fn (PDO $db, array $in): array => lookupPlayer($db, inputNick($in)),
    'player_join' => static function (PDO $db, array $in): array {
        updatePlayerInfo($db, inputUuid($in), inputNick($in), inputIp($in), [], online: true);
        return ['success' => true];
    },
    'player_quit' => static function (PDO $db, array $in): array {
        playerQuit($db, inputUuid($in));
        return ['success' => true];
    },
    'get_messages' => static fn (PDO $db): object => messagesMap($db),
    'get_settings' => static fn (PDO $db): array => getSettings($db, PLUGIN_SETTINGS),
    'poll_changes' => static fn (PDO $db, array $in): array => pollChanges(
        $db,
        inputInt($in, 'last_version', -1, PHP_INT_MAX, -1),
        inputInt($in, 'wait', 0, POLL_MAX_WAIT, POLL_MAX_WAIT)
    ),
    'add_whitelist' => pluginAddWhitelist(...),
    'remove_whitelist' => pluginRemoveWhitelist(...),
    'add_blacklist' => pluginAddBlacklist(...),
    'remove_blacklist' => pluginRemoveBlacklist(...),
    'check_furr_perms_whitelist' => static fn (PDO $db, array $in): array => furrPermsCheck($db, inputNick($in), inputUuid($in), inputIp($in)),
    'log_furr_perms_command' => static function (PDO $db, array $in): array {
        furrPermsLogCommand($db, [
            'player_uuid' => inputOptionalUuid($in, 'player_uuid'),
            'player_nick' => inputNick($in, 'player_nick'),
            'command' => inputString($in, 'command', 4096),
            'server_name' => inputOptionalString($in, 'server_name', 100),
            'allowed' => inputBool($in, 'allowed'),
            'reason' => inputOptionalString($in, 'reason', 255),
            'ip_address' => inputOptionalIp($in, 'ip_address'),
        ]);
        return ['success' => true];
    },
]);
