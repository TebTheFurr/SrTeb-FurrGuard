<?php

declare(strict_types=1);

/**
 * FurrGuard - API del módulo FurrSecurity (docs/API.md §2). Mismas reglas de autenticación que §1.1.
 *
 * Los clientes fallan en cerrado: cualquier error aquí significa "bloquear y reintentar".
 *
 * @author GrinchHorizon
 * @copyright SrTeb Limited
 */

require_once dirname(__DIR__) . '/includes/bootstrap.php';
require_once FURRGUARD_ROOT . '/includes/plugin_api.php';

pluginApiRun([
    'check_status' => static fn (PDO $db, array $in): array => furrSecurityCheckStatus($db, inputUuid($in), inputNick($in), inputIp($in)),
    'get_staff' => static fn (PDO $db): array => furrSecurityStaffList($db),
    'generate_token' => static fn (PDO $db, array $in): array => furrSecurityGenerateToken($db, inputUuid($in), inputNick($in), inputIp($in)),
    'verify_token_status' => static fn (PDO $db, array $in): array => furrSecurityTokenStatus($db, (string) inputVerificationToken($in)),
    'get_session' => static fn (PDO $db, array $in): array => furrSecurityGetSession($db, inputUuid($in), inputIp($in)),
    'extend_session' => static fn (PDO $db, array $in): array => furrSecurityExtendSession(
        $db,
        inputUuid($in),
        inputIp($in),
        inputVerificationToken($in, 'token', false)
    ),
    'player_disconnect' => static function (PDO $db, array $in): array {
        furrSecurityPlayerDisconnect($db, inputUuid($in), inputNick($in), inputBool($in, 'locked', false));
        return ['success' => true];
    },
    'reset_session' => static fn (PDO $db, array $in): array => furrSecurityResetSession($db, inputUuid($in), inputNick($in)),
    'record_failed_attempt' => static function (PDO $db, array $in): array {
        $result = furrSecurityRecordFailedAttempt($db, inputUuid($in), inputNick($in), inputIp($in), expirePendingTokens: true);
        return ['success' => true, 'failed_attempts' => $result['attempts'], 'blacklisted' => $result['blacklisted']];
    },
    'get_settings' => static fn (PDO $db): array => furrSecuritySettings($db),
    'get_messages' => static fn (PDO $db): object => messagesMap($db, 'furr_security_'),
]);
