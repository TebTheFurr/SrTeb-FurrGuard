<?php
/**
 * FurrSecurity - Public Verification Page
 *
 * @author GrinchHorizon
 * @copyright SrTeb Limited
 * @website https://srteb.eu
 * @version 2.0.0
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/includes/functions.php';

// Get Discord credentials from constants
$discordClientId = DISCORD_CLIENT_ID;
$discordClientSecret = DISCORD_CLIENT_SECRET;

// Determine the base URL for redirect URIs (always use HTTPS in production)
$baseUrl = 'https://' . $_SERVER['HTTP_HOST'];

// Get token from URL or session
$token = trim($_GET['token'] ?? $_SESSION['furrsecurity_token'] ?? '');

if (!$token) {
    showError('Token no proporcionado');
    exit;
}

// Store token in session for OAuth callback
$_SESSION['furrsecurity_token'] = $token;

// Validate token format (64 hex characters)
if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
    showError('Token inválido');
    exit;
}

$db = db();
if ($db === null) {
    showError('Error de conexión a la base de datos');
    exit;
}

// Get verification record
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
    showError('Token no encontrado');
    exit;
}

// Check if already verified
if ($verification['status'] === 'verified') {
    showSuccess('Ya verificado', 'Tu sesión ha sido verificada correctamente. Puedes volver al juego.');
    exit;
}

// Check if token expired
if ($verification['status'] === 'expired' || strtotime($verification['expires_at']) < time()) {
    showError('Token expirado', 'Este token ha expirado. Por favor, reconecta al servidor para generar uno nuevo.');
    exit;
}

// Handle Discord OAuth callback
if (isset($_GET['code'])) {
    // Validate OAuth state parameter (CSRF protection)
    if (empty($_GET['state']) || empty($_SESSION['furrsecurity_oauth_state']) || !hash_equals($_SESSION['furrsecurity_oauth_state'], $_GET['state'])) {
        showError('Error de seguridad', 'Token de verificación inválido. Por favor, inténtalo de nuevo.');
        exit;
    }
    unset($_SESSION['furrsecurity_oauth_state']);
    handleOAuthCallback($db, $verification);
    exit;
}

// Handle OAuth error
if (isset($_GET['error'])) {
    showError('Acceso denegado', 'Has cancelado la autenticación con Discord.');
    exit;
}

// Show verification page
showVerificationPage($verification);

// ============================================
// Functions
// ============================================

function handleOAuthCallback(PDO $db, array $verification): void {
    global $token;

    $code = $_GET['code'];

    // Exchange code for access token
    $tokenData = exchangeDiscordCode($code);

    if (!$tokenData || !isset($tokenData['access_token'])) {
        showError('Error de Discord', 'No se pudo obtener el token de acceso.');
        return;
    }

    // Get Discord user info
    $discordUser = getDiscordUserInfo($tokenData['access_token']);

    if (!$discordUser || !isset($discordUser['id'])) {
        showError('Error de Discord', 'No se pudo obtener la información del usuario.');
        return;
    }

    $discordId = $discordUser['id'];

    // Check if Discord ID matches the one in verification record
    if ($discordId !== $verification['discord_id']) {
        // Log failed attempt
        logFurrSecurityAction($db, $verification['uuid'], $verification['minecraft_nick'], $discordId, 'verification_failed', 'Discord ID no coincide - Intento con cuenta incorrecta', $_SERVER['REMOTE_ADDR']);

        // Record failed attempt and check for auto-blacklist
        $blacklistResult = recordWrongDiscordAttempt($db, $verification['uuid'], $verification['minecraft_nick'], $_SERVER['REMOTE_ADDR'], $discordId);

        if ($blacklistResult['blacklisted']) {
            showError('Auto-Blacklist', 'Has sido añadido a la blacklist por intentar verificar con una cuenta de Discord incorrecta. Contacta a un administrador.');
        } else {
            showError('Verificación fallida', 'El Discord ID no coincide con el registrado. Intento ' . $blacklistResult['attempts'] . '/' . $blacklistResult['max_attempts'] . '. Si crees que es un error, contacta a un administrador.');
        }
        return;
    }

    // Mark as verified
    $sessionDuration = (int)getSetting($db, 'furrsecurity_session_duration', '28800');
    $newExpiresAt = date('Y-m-d H:i:s', time() + $sessionDuration);

    $stmt = $db->prepare("
        UPDATE furrsecurity_verifications
        SET status = 'verified',
            verified_at = NOW(),
            expires_at = :expires_at
        WHERE verification_token = :token
    ");
    $stmt->execute(['expires_at' => $newExpiresAt, 'token' => $token]);

    // Log successful verification
    logFurrSecurityAction($db, $verification['uuid'], $verification['minecraft_nick'], $discordId, 'verification_success', 'Verificación completada via Discord OAuth', $_SERVER['REMOTE_ADDR']);

    // Clear token from session
    unset($_SESSION['furrsecurity_token']);

    showSuccess('Verificación completada', 'Tu identidad ha sido verificada correctamente. Ya puedes volver al juego.');
}

function exchangeDiscordCode(string $code): ?array {
    global $discordClientId, $discordClientSecret, $baseUrl;

    $redirectUri = $baseUrl . strtok($_SERVER['REQUEST_URI'], '?');

    $ch = curl_init('https://discord.com/api/oauth2/token');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query([
            'client_id' => $discordClientId,
            'client_secret' => $discordClientSecret,
            'grant_type' => 'authorization_code',
            'code' => $code,
            'redirect_uri' => $redirectUri,
        ]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    return $response ? json_decode($response, true) : null;
}

function getDiscordUserInfo(string $accessToken): ?array {
    $ch = curl_init('https://discord.com/api/users/@me');
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => ["Authorization: Bearer $accessToken"],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    return $response ? json_decode($response, true) : null;
}

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
            'ip' => $ipAddress,
        ]);
    } catch (Exception $e) {
        error_log("Failed to log FurrSecurity action: " . $e->getMessage());
    }
}

/**
 * Serve the Vue app with injected verification data.
 * Replaces the old inline HTML rendering functions.
 */
function serveVueApp(array $verifyData): void {
    $nonce = getCspNonce();
    $distHtml = @file_get_contents(__DIR__ . '/public/dist/index.html');
    if ($distHtml === false) {
        http_response_code(503);
        echo '<!DOCTYPE html><html><body style="background:#0f0f1a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:Inter,sans-serif"><div><h1>Error</h1><p>Servicio no disponible.</p></div></body></html>';
        exit;
    }

    $fontLinks = <<<'HTML'
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="icon" type="image/png" href="/icono-furguard.png">
HTML;

    $dataScript = '<script nonce="' . $nonce . '">' . "\n"
        . 'window.__VERIFY_DATA__ = ' . json_encode($verifyData) . ";\n"
        . '</script>';

    $distHtml = str_replace('</head>', $fontLinks . "\n" . $dataScript . "\n</head>", $distHtml);
    $distHtml = preg_replace('/<script(?![^>]*nonce=)/', '<script nonce="' . $nonce . '"', $distHtml);
    echo $distHtml;
}

function showVerificationPage(array $verification): void {
    global $discordClientId, $baseUrl;

    $redirectUri = $baseUrl . strtok($_SERVER['REQUEST_URI'], '?');

    if (empty($_SESSION['furrsecurity_oauth_state'])) {
        $_SESSION['furrsecurity_oauth_state'] = bin2hex(random_bytes(32));
    }

    $oauthUrl = 'https://discord.com/oauth2/authorize?' . http_build_query([
        'client_id' => $discordClientId,
        'redirect_uri' => $redirectUri,
        'response_type' => 'code',
        'scope' => 'identify',
        'state' => $_SESSION['furrsecurity_oauth_state'],
    ]);

    serveVueApp([
        'state' => 'form',
        'minecraft_nick' => $verification['minecraft_nick'],
        'discord_login_url' => $oauthUrl,
        'expires_at' => date('d/m/Y H:i:s', strtotime($verification['expires_at'])),
    ]);
}

function showError(string $title, string $message = ''): void {
    serveVueApp([
        'state' => 'error',
        'title' => $title,
        'message' => $message,
    ]);
}

function showSuccess(string $title, string $message = ''): void {
    serveVueApp([
        'state' => 'success',
        'title' => $title,
        'message' => $message,
    ]);
}

/**
 * Record a wrong Discord attempt and auto-blacklist if threshold reached
 */
function recordWrongDiscordAttempt(PDO $db, string $uuid, string $nick, string $ip, string $wrongDiscordId): array {
    // Get max failed attempts from settings
    $maxFailedAttempts = (int)getSetting($db, 'furrsecurity_max_failed_attempts', '3');

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

    // Check if should be blacklisted
    $blacklisted = false;
    if ($newAttempts >= $maxFailedAttempts) {
        // Generate ban_id using FurrGuard's function if available
        $banId = function_exists('generateBanId') ? generateBanId() : 'FS-' . bin2hex(random_bytes(8));

        // Add to blacklist by UUID
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
        $nickBanId = function_exists('generateBanId') ? generateBanId() : 'FS-' . bin2hex(random_bytes(8));
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

        // Also blacklist the IP
        $ipBanId = function_exists('generateBanId') ? generateBanId() : 'FS-' . bin2hex(random_bytes(8));
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

        // Reset failed attempts counter after blacklisting
        $stmt = $db->prepare("DELETE FROM furrsecurity_failed_attempts WHERE uuid = :uuid");
        $stmt->execute(['uuid' => $uuid]);

        $blacklisted = true;

        // Log auto-blacklist
        logFurrSecurityAction($db, $uuid, $nick, $wrongDiscordId, 'auto_blacklisted_wrong_discord', 'Auto-blacklist por verificar con Discord incorrecto ' . $newAttempts . ' veces', $ip);
    } else {
        // Log failed attempt
        logFurrSecurityAction($db, $uuid, $nick, $wrongDiscordId, 'wrong_discord_attempt', "Intento con Discord incorrecto ($newAttempts/$maxFailedAttempts)", $ip);
    }

    return [
        'attempts' => $newAttempts,
        'max_attempts' => $maxFailedAttempts,
        'blacklisted' => $blacklisted
    ];
}
