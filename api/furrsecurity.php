<?php
/**
 * FurrSecurity API - Plugin endpoints
 *
 * @author GrinchHorizon
 * @copyright SrTeb Limited
 * @website https://srteb.eu
 * @version 1.5.0
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . (getenv('CORS_ALLOWED_ORIGIN') ?: 'https://furrguard.srteb.eu'));
header('Access-Control-Allow-Methods: POST, GET');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/security.php';

// Check database connection early
$db = db();
if ($db === null) {
    http_response_code(503);
    echo json_encode([
        'error' => 'database_unavailable',
        'message' => 'Database temporarily unavailable',
        'fallback' => 'deny',
        'retry_after' => 60
    ]);
    exit;
}

// Rate limit: 120 requests per minute per IP for plugin API
$clientIp = getClientIp();
enforceRateLimit($clientIp, 120, 60, 'furrsecurity_api');

// Require API key for all actions
requireApiKey();

// Validate action is a known action
$validActions = [
    'check_status',
    'generate_token',
    'verify_token_status',
    'get_session',
    'extend_session',
    'player_disconnect',
    'reset_session',
    'get_settings',
    'get_messages',
    'record_failed_attempt'
];

$action = $_GET['action'] ?? $_POST['action'] ?? '';
if (!in_array($action, $validActions, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid action']);
    exit;
}

try {
    switch ($action) {
        case 'check_status':
            handleCheckStatus($db);
            break;

        case 'generate_token':
            handleGenerateToken($db);
            break;

        case 'verify_token_status':
            handleVerifyTokenStatus($db);
            break;

        case 'get_session':
            handleGetSession($db);
            break;

        case 'extend_session':
            handleExtendSession($db);
            break;

        case 'player_disconnect':
            handlePlayerDisconnect($db);
            break;

        case 'reset_session':
            handleResetSession($db);
            break;

        case 'get_settings':
            handleGetSettings($db);
            break;

        case 'get_messages':
            handleGetMessages($db);
            break;

        case 'record_failed_attempt':
            handleRecordFailedAttempt($db);
            break;

        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
    }
} catch (PDOException $e) {
    error_log("FurrSecurity API PDO Error: " . $e->getMessage());
    http_response_code(503);
    header('Retry-After: 60');
    echo json_encode([
        'error' => 'database_unavailable',
        'message' => 'Database temporarily unavailable',
        'fallback' => 'deny',
        'retry_after' => 60
    ]);
} catch (Exception $e) {
    error_log("FurrSecurity API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'internal_error',
        'message' => 'Internal server error',
        'fallback' => 'deny'
    ]);
}

/**
 * Check if a player needs verification
 */
function handleCheckStatus(PDO $db): void {
    $uuid = trim($_POST['uuid'] ?? '');
    $nick = trim($_POST['nick'] ?? '');
    $ip = trim($_POST['ip'] ?? '');

    if (!$uuid || !$nick) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields: uuid, nick']);
        return;
    }

    // Validate UUID format
    if (!preg_match('/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i', $uuid)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid UUID']);
        return;
    }

    // Normalize UUID
    $uuid = normalizeUuid($uuid);

    // Check if FurrSecurity is enabled
    $enabled = getSetting($db, 'furrsecurity_enabled', '1') === '1';
    if (!$enabled) {
        echo json_encode([
            'needs_verification' => false,
            'reason' => 'module_disabled'
        ]);
        return;
    }

    // Check if player is in staff whitelist
    $stmt = $db->prepare("SELECT discord_id FROM furrsecurity_staff WHERE minecraft_nick = :nick");
    $stmt->execute(['nick' => $nick]);
    $staffEntry = $stmt->fetch();

    if (!$staffEntry) {
        // Player is not in staff whitelist, no verification needed
        echo json_encode([
            'needs_verification' => false,
            'reason' => 'not_staff'
        ]);
        return;
    }

    // Check if player has an active verified session
    $stmt = $db->prepare("
        SELECT id, expires_at, verified_at
        FROM furrsecurity_verifications
        WHERE uuid = :uuid
        AND status = 'verified'
        AND expires_at > NOW()
        ORDER BY expires_at DESC
        LIMIT 1
    ");
    $stmt->execute(['uuid' => $uuid]);
    $session = $stmt->fetch();

    if ($session) {
        $expiresAt = strtotime($session['expires_at']);
        $timeRemaining = $expiresAt - time();

        echo json_encode([
            'needs_verification' => false,
            'reason' => 'already_verified',
            'session' => [
                'expires_at' => $session['expires_at'],
                'time_remaining_seconds' => $timeRemaining
            ]
        ]);
        return;
    }

    // Player needs verification
    echo json_encode([
        'needs_verification' => true,
        'reason' => 'no_valid_session',
        'discord_id' => $staffEntry['discord_id']
    ]);
}

/**
 * Generate a new verification token
 */
function handleGenerateToken(PDO $db): void {
    $uuid = trim($_POST['uuid'] ?? '');
    $nick = trim($_POST['nick'] ?? '');
    $ip = trim($_POST['ip'] ?? '');

    if (!$uuid || !$nick) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields: uuid, nick']);
        return;
    }

    // Normalize UUID
    $uuid = normalizeUuid($uuid);

    // Check if player is in staff whitelist
    $stmt = $db->prepare("SELECT discord_id FROM furrsecurity_staff WHERE minecraft_nick = :nick");
    $stmt->execute(['nick' => $nick]);
    $staffEntry = $stmt->fetch();

    if (!$staffEntry) {
        echo json_encode([
            'success' => false,
            'error' => 'not_in_whitelist'
        ]);
        return;
    }

    // Token expiration time (configurable, default 3 minutes)
    $tokenExpirationSeconds = (int)getSetting($db, 'furrsecurity_token_expiration', '180');
    $tokenExpiresAt = date('Y-m-d H:i:s', time() + $tokenExpirationSeconds);

    // Check if player already has a non-expired pending token
    // Only check if token_expires_at column exists
    try {
        $stmt = $db->prepare("
            SELECT verification_token, token_expires_at
            FROM furrsecurity_verifications
            WHERE uuid = :uuid
            AND status = 'pending'
            AND token_expires_at > NOW()
            LIMIT 1
        ");
        $stmt->execute(['uuid' => $uuid]);
        $existingToken = $stmt->fetch();

        if ($existingToken && $existingToken['token_expires_at']) {
            // Return existing token (same link for player)
            $tokenExpiresTimestamp = strtotime($existingToken['token_expires_at']);
            $timeRemaining = max(0, $tokenExpiresTimestamp - time());

            $verifyUrl = getSetting($db, 'furrsecurity_verify_url', 'https://furrguard.srteb.eu/verify.php');
            $fullVerifyUrl = $verifyUrl . '?token=' . $existingToken['verification_token'];

            echo json_encode([
                'success' => true,
                'token' => $existingToken['verification_token'],
                'verify_url' => $fullVerifyUrl,
                'existing' => true,
                'token_expires_in_seconds' => $timeRemaining
            ]);
            return;
        }
    } catch (PDOException $e) {
        // Column doesn't exist yet, continue to create new token
    }

    // Get session duration from settings (default 8 hours)
    $sessionDuration = (int)getSetting($db, 'furrsecurity_session_duration', '28800');
    $sessionExpiresAt = date('Y-m-d H:i:s', time() + $sessionDuration);

    // Generate secure token
    $token = bin2hex(random_bytes(32));

    // Invalidate any existing pending tokens for this UUID (expired ones)
    $stmt = $db->prepare("UPDATE furrsecurity_verifications SET status = 'expired' WHERE uuid = :uuid AND status = 'pending'");
    $stmt->execute(['uuid' => $uuid]);

    // Insert new verification token
    // Try with token_expires_at first, fallback if column doesn't exist
    try {
        $stmt = $db->prepare("
            INSERT INTO furrsecurity_verifications (uuid, discord_id, minecraft_nick, verification_token, token_expires_at, expires_at, ip_address)
            VALUES (:uuid, :discord_id, :nick, :token, :token_expires_at, :expires_at, :ip)
        ");
        $stmt->execute([
            'uuid' => $uuid,
            'discord_id' => $staffEntry['discord_id'],
            'nick' => $nick,
            'token' => $token,
            'token_expires_at' => $tokenExpiresAt,
            'expires_at' => $sessionExpiresAt,
            'ip' => $ip ?: null
        ]);
    } catch (PDOException $e) {
        // Column doesn't exist, insert without token_expires_at
        $stmt = $db->prepare("
            INSERT INTO furrsecurity_verifications (uuid, discord_id, minecraft_nick, verification_token, expires_at, ip_address)
            VALUES (:uuid, :discord_id, :nick, :token, :expires_at, :ip)
        ");
        $stmt->execute([
            'uuid' => $uuid,
            'discord_id' => $staffEntry['discord_id'],
            'nick' => $nick,
            'token' => $token,
            'expires_at' => $sessionExpiresAt,
            'ip' => $ip ?: null
        ]);
    }

    // Get verify URL from settings
    $verifyUrl = getSetting($db, 'furrsecurity_verify_url', 'https://furrguard.srteb.eu/verify.php');
    $fullVerifyUrl = $verifyUrl . '?token=' . $token;

    // Log token generation
    logFurrSecurityAction($db, $uuid, $nick, $staffEntry['discord_id'], 'token_generated', 'Token de verificación generado', $ip);

    echo json_encode([
        'success' => true,
        'token' => $token,
        'verify_url' => $fullVerifyUrl,
        'existing' => false,
        'token_expires_in_seconds' => $tokenExpirationSeconds,
        'expires_at' => $sessionExpiresAt
    ]);
}

/**
 * Check if a verification token has been verified (polling)
 */
function handleVerifyTokenStatus(PDO $db): void {
    $token = trim($_POST['token'] ?? '');

    if (!$token) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing token']);
        return;
    }

    $stmt = $db->prepare("
        SELECT v.*, s.minecraft_nick as staff_nick
        FROM furrsecurity_verifications v
        LEFT JOIN furrsecurity_staff s ON s.discord_id = v.discord_id
        WHERE v.verification_token = :token
        LIMIT 1
    ");
    $stmt->execute(['token' => $token]);
    $verification = $stmt->fetch();

    if (!$verification) {
        echo json_encode([
            'status' => 'not_found',
            'verified' => false
        ]);
        return;
    }

    // Check if token link has expired (3 minute limit)
    // Use isset() to handle cases where column doesn't exist yet or value is NULL
    $tokenExpiresAt = isset($verification['token_expires_at']) ? $verification['token_expires_at'] : null;

    if ($verification['status'] === 'pending' && $tokenExpiresAt !== null) {
        $tokenExpiresTimestamp = strtotime($tokenExpiresAt);
        if ($tokenExpiresTimestamp < time()) {
            // Token link expired without verification
            $stmt = $db->prepare("UPDATE furrsecurity_verifications SET status = 'token_expired' WHERE id = :id");
            $stmt->execute(['id' => $verification['id']]);

            echo json_encode([
                'status' => 'token_expired',
                'verified' => false
            ]);
            return;
        }

        // Token still valid, return time remaining
        $tokenTimeRemaining = max(0, $tokenExpiresTimestamp - time());
        echo json_encode([
            'status' => 'pending',
            'verified' => false,
            'token_expires_in_seconds' => $tokenTimeRemaining
        ]);
        return;
    }

    // Handle pending tokens without token_expires_at (old tokens or column doesn't exist)
    if ($verification['status'] === 'pending') {
        echo json_encode([
            'status' => 'pending',
            'verified' => false
        ]);
        return;
    }

    // Check if session has expired (for verified tokens)
    if ($verification['status'] === 'verified' && strtotime($verification['expires_at']) < time()) {
        $stmt = $db->prepare("UPDATE furrsecurity_verifications SET status = 'expired' WHERE id = :id");
        $stmt->execute(['id' => $verification['id']]);

        echo json_encode([
            'status' => 'expired',
            'verified' => false
        ]);
        return;
    }

    if ($verification['status'] === 'verified') {
        // Return existing session info WITHOUT resetting the expiry time
        // The session time should decrement continuously, not reset on each poll
        $expiresAt = strtotime($verification['expires_at']);
        $timeRemaining = max(0, $expiresAt - time());

        echo json_encode([
            'status' => 'verified',
            'verified' => true,
            'uuid' => $verification['uuid'],
            'nick' => $verification['minecraft_nick'],
            'discord_id' => $verification['discord_id'],
            'expires_at' => $verification['expires_at'],
            'time_remaining_seconds' => $timeRemaining
        ]);
        return;
    }

    echo json_encode([
        'status' => $verification['status'],
        'verified' => false
    ]);
}

/**
 * Get active session info for a player
 */
function handleGetSession(PDO $db): void {
    $uuid = trim($_POST['uuid'] ?? '');

    if (!$uuid) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing uuid']);
        return;
    }

    $uuid = normalizeUuid($uuid);

    $stmt = $db->prepare("
        SELECT id, minecraft_nick, discord_id, verified_at, expires_at, status
        FROM furrsecurity_verifications
        WHERE uuid = :uuid
        AND status = 'verified'
        AND expires_at > NOW()
        ORDER BY expires_at DESC
        LIMIT 1
    ");
    $stmt->execute(['uuid' => $uuid]);
    $session = $stmt->fetch();

    if (!$session) {
        echo json_encode([
            'has_session' => false
        ]);
        return;
    }

    $expiresAt = strtotime($session['expires_at']);
    $timeRemaining = $expiresAt - time();

    echo json_encode([
        'has_session' => true,
        'session' => [
            'id' => (int)$session['id'],
            'nick' => $session['minecraft_nick'],
            'discord_id' => $session['discord_id'],
            'verified_at' => $session['verified_at'],
            'expires_at' => $session['expires_at'],
            'time_remaining_seconds' => $timeRemaining
        ]
    ]);
}

/**
 * Extend a session (re-verification)
 */
function handleExtendSession(PDO $db): void {
    $uuid = trim($_POST['uuid'] ?? '');
    $token = trim($_POST['token'] ?? '');

    if (!$uuid) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing uuid']);
        return;
    }

    $uuid = normalizeUuid($uuid);

    // Get session duration
    $sessionDuration = (int)getSetting($db, 'furrsecurity_session_duration', '28800');
    $newExpiresAt = date('Y-m-d H:i:s', time() + $sessionDuration);

    // If token provided, verify and extend
    if ($token) {
        $stmt = $db->prepare("
            SELECT v.*, s.minecraft_nick
            FROM furrsecurity_verifications v
            LEFT JOIN furrsecurity_staff s ON s.discord_id = v.discord_id
            WHERE v.verification_token = :token
            AND v.uuid = :uuid
            LIMIT 1
        ");
        $stmt->execute(['token' => $token, 'uuid' => $uuid]);
        $verification = $stmt->fetch();

        if (!$verification) {
            echo json_encode([
                'success' => false,
                'error' => 'invalid_token'
            ]);
            return;
        }

        if ($verification['status'] !== 'verified') {
            echo json_encode([
                'success' => false,
                'error' => 'not_verified'
            ]);
            return;
        }

        // Extend session
        $stmt = $db->prepare("UPDATE furrsecurity_verifications SET expires_at = :expires_at WHERE id = :id");
        $stmt->execute(['expires_at' => $newExpiresAt, 'id' => $verification['id']]);

        logFurrSecurityAction($db, $uuid, $verification['minecraft_nick'], $verification['discord_id'], 'session_extended', 'Sesión extendida por re-verificación', null);

        echo json_encode([
            'success' => true,
            'expires_at' => $newExpiresAt,
            'time_remaining_seconds' => $sessionDuration
        ]);
        return;
    }

    // Extend existing session without token (early renewal)
    $stmt = $db->prepare("
        UPDATE furrsecurity_verifications
        SET expires_at = :expires_at
        WHERE uuid = :uuid
        AND status = 'verified'
        ORDER BY expires_at DESC
        LIMIT 1
    ");
    $stmt->execute(['expires_at' => $newExpiresAt, 'uuid' => $uuid]);

    if ($stmt->rowCount() > 0) {
        echo json_encode([
            'success' => true,
            'expires_at' => $newExpiresAt,
            'time_remaining_seconds' => $sessionDuration
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'error' => 'no_active_session'
        ]);
    }
}

/**
 * Handle player disconnect
 */
function handlePlayerDisconnect(PDO $db): void {
    $uuid = trim($_POST['uuid'] ?? '');
    $nick = trim($_POST['nick'] ?? '');

    if (!$uuid) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing uuid']);
        return;
    }

    $uuid = normalizeUuid($uuid);

    // Log disconnect
    logFurrSecurityAction($db, $uuid, $nick, null, 'player_disconnect', 'Jugador desconectado', null);

    echo json_encode(['success' => true]);
}

/**
 * Reset a player's session (force re-verification)
 */
function handleResetSession(PDO $db): void {
    $uuid = trim($_POST['uuid'] ?? '');
    $nick = trim($_POST['nick'] ?? '');

    if (!$uuid) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing uuid']);
        return;
    }

    $uuid = normalizeUuid($uuid);

    // Expire all active sessions for this UUID
    $stmt = $db->prepare("
        UPDATE furrsecurity_verifications
        SET status = 'expired', expires_at = NOW()
        WHERE uuid = :uuid
        AND status = 'verified'
        AND expires_at > NOW()
    ");
    $stmt->execute(['uuid' => $uuid]);

    $affectedRows = $stmt->rowCount();

    // Log the reset action
    logFurrSecurityAction($db, $uuid, $nick, null, 'session_reset', "Sesion reseteada via comando ($affectedRows sesiones expiradas)", null);

    echo json_encode([
        'success' => true,
        'sessions_expired' => $affectedRows,
        'message' => $affectedRows > 0 ? "Se expiraron $affectedRows sesiones" : 'No habia sesiones activas'
    ]);
}

/**
 * Get FurrSecurity settings
 */
function handleGetSettings(PDO $db): void {
    $settings = [
        'furrsecurity_enabled' => getSetting($db, 'furrsecurity_enabled', '1'),
        'furrsecurity_session_duration' => getSetting($db, 'furrsecurity_session_duration', '28800'),
        'furrsecurity_token_expiration' => getSetting($db, 'furrsecurity_token_expiration', '180'),
        'furrsecurity_max_failed_attempts' => getSetting($db, 'furrsecurity_max_failed_attempts', '3'),
        'furrsecurity_verify_url' => getSetting($db, 'furrsecurity_verify_url', 'https://furrguard.srteb.eu/verify.php'),
        'furrsecurity_alert_times' => getSetting($db, 'furrsecurity_alert_times', '3600,1800,300,240,180,120,60,30'),
        'furrsecurity_early_verify_time' => getSetting($db, 'furrsecurity_early_verify_time', '300'),
        'furrsecurity_lock_movement' => getSetting($db, 'furrsecurity_lock_movement', '1'),
        'furrsecurity_lock_commands' => getSetting($db, 'furrsecurity_lock_commands', '1'),
        'furrsecurity_lock_inventory' => getSetting($db, 'furrsecurity_lock_inventory', '1'),
        'furrsecurity_lock_server_switch' => getSetting($db, 'furrsecurity_lock_server_switch', '1'),
        'furrsecurity_notify_admins' => getSetting($db, 'furrsecurity_notify_admins', '1'),
        'furrsecurity_admin_permission' => getSetting($db, 'furrsecurity_admin_permission', 'furrguard.furrsecurity.notify'),
    ];

    echo json_encode($settings);
}

/**
 * Get FurrSecurity messages
 */
function handleGetMessages(PDO $db): void {
    $stmt = $db->prepare("
        SELECT `key`, value FROM messages
        WHERE `key` LIKE 'furrsecurity_%'
    ");
    $stmt->execute();
    $messages = [];
    while ($row = $stmt->fetch()) {
        $messages[$row['key']] = $row['value'];
    }
    echo json_encode($messages);
}

/**
 * Record a failed verification attempt
 * After 3 failed attempts, player is auto-blacklisted
 */
function handleRecordFailedAttempt(PDO $db): void {
    $uuid = trim($_POST['uuid'] ?? '');
    $nick = trim($_POST['nick'] ?? '');
    $ip = trim($_POST['ip'] ?? '');

    if (!$uuid || !$nick) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields: uuid, nick']);
        return;
    }

    $uuid = normalizeUuid($uuid);

    // Get or create failed attempts record
    $stmt = $db->prepare("
        SELECT failed_attempts FROM furrsecurity_failed_attempts
        WHERE uuid = :uuid
    ");
    $stmt->execute(['uuid' => $uuid]);
    $record = $stmt->fetch();

    $currentAttempts = $record ? (int)$record['failed_attempts'] : 0;
    $newAttempts = $currentAttempts + 1;

    // Update or insert failed attempts
    if ($record) {
        $stmt = $db->prepare("
            UPDATE furrsecurity_failed_attempts
            SET failed_attempts = :attempts, last_attempt = NOW(), last_ip = :ip
            WHERE uuid = :uuid
        ");
        $stmt->execute(['attempts' => $newAttempts, 'ip' => $ip, 'uuid' => $uuid]);
    } else {
        $stmt = $db->prepare("
            INSERT INTO furrsecurity_failed_attempts (uuid, minecraft_nick, failed_attempts, last_ip)
            VALUES (:uuid, :nick, :attempts, :ip)
        ");
        $stmt->execute(['uuid' => $uuid, 'nick' => $nick, 'attempts' => $newAttempts, 'ip' => $ip]);
    }

    // Log the failed attempt
    logFurrSecurityAction($db, $uuid, $nick, null, 'verification_failed', "Intento de verificacion fallido ($newAttempts)", $ip);

    // Get max failed attempts from settings
    $maxFailedAttempts = (int)getSetting($db, 'furrsecurity_max_failed_attempts', '3');

    // Check if should be blacklisted
    $blacklisted = false;
    if ($newAttempts >= $maxFailedAttempts) {
        // Generate ban_id using FurrGuard's function
        $banId = generateBanId();

        // Add to blacklist by UUID (official FurrGuard blacklist)
        $stmt = $db->prepare("
            INSERT INTO blacklist (ban_id, type, value, reason, added_by, expires_at, active)
            VALUES (:ban_id, 'uuid', :uuid, :reason, 'FurrSecurity', NULL, 1)
            ON DUPLICATE KEY UPDATE reason = VALUES(reason), active = 1, updated_at = NOW()
        ");
        $stmt->execute([
            'ban_id' => $banId,
            'uuid' => $uuid,
            'reason' => 'seguridad'
        ]);

        // Get the parent ID for linking
        $parentId = (int)$db->lastInsertId();

        // Also blacklist by nick
        $nickBanId = generateBanId();
        $stmt = $db->prepare("
            INSERT INTO blacklist (ban_id, type, value, reason, added_by, expires_at, active, parent_id)
            VALUES (:ban_id, 'nick', :nick, :reason, 'FurrSecurity', NULL, 1, :parent_id)
            ON DUPLICATE KEY UPDATE reason = VALUES(reason), active = 1, updated_at = NOW()
        ");
        $stmt->execute([
            'ban_id' => $nickBanId,
            'nick' => $nick,
            'reason' => 'seguridad',
            'parent_id' => $parentId ?: null
        ]);

        // Also blacklist the IP if available
        if ($ip) {
            $ipBanId = generateBanId();
            $stmt = $db->prepare("
                INSERT INTO blacklist (ban_id, type, value, reason, added_by, expires_at, active, parent_id)
                VALUES (:ban_id, 'ip', :ip, :reason, 'FurrSecurity', NULL, 1, :parent_id)
                ON DUPLICATE KEY UPDATE reason = VALUES(reason), active = 1, updated_at = NOW()
            ");
            $stmt->execute([
                'ban_id' => $ipBanId,
                'ip' => $ip,
                'reason' => 'seguridad',
                'parent_id' => $parentId ?: null
            ]);
        }

        // Reset failed attempts counter after blacklisting
        $stmt = $db->prepare("DELETE FROM furrsecurity_failed_attempts WHERE uuid = :uuid");
        $stmt->execute(['uuid' => $uuid]);

        $blacklisted = true;

        // Log auto-blacklist
        logFurrSecurityAction($db, $uuid, $nick, null, 'auto_blacklisted', 'Jugador automaticamente añadido a blacklist por ' . $maxFailedAttempts . ' intentos fallidos', $ip);
    }

    echo json_encode([
        'success' => true,
        'failed_attempts' => $newAttempts,
        'blacklisted' => $blacklisted
    ]);
}

/**
 * Log FurrSecurity action
 */
function logFurrSecurityAction(PDO $db, ?string $uuid, ?string $nick, ?string $discordId, string $action, ?string $details, ?string $ipAddress): void {
    try {
        $stmt = $db->prepare("
            INSERT INTO furrsecurity_logs (uuid, minecraft_nick, discord_id, action, details, ip_address)
            VALUES (:uuid, :nick, :discord_id, :action, :details, :ip)
        ");
        $stmt->execute([
            'uuid' => $uuid,
            'nick' => $nick,
            'discord_id' => $discordId,
            'action' => $action,
            'details' => $details,
            'ip' => $ipAddress
        ]);
    } catch (Exception $e) {
        error_log("Failed to log FurrSecurity action: " . $e->getMessage());
    }
}
