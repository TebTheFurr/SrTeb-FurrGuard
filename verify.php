<?php
/**
 * FurrSecurity - Public Verification Page
 *
 * @author GrinchHorizon
 * @copyright SrTeb Limited
 * @website https://srteb.eu
 * @version 1.5.0
 */

session_start();

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/config/database.php';
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

function showVerificationPage(array $verification): void {
    global $discordClientId, $baseUrl;

    $redirectUri = $baseUrl . strtok($_SERVER['REQUEST_URI'], '?');

    $oauthUrl = 'https://discord.com/oauth2/authorize?' . http_build_query([
        'client_id' => $discordClientId,
        'redirect_uri' => $redirectUri,
        'response_type' => 'code',
        'scope' => 'identify',
    ]);

    ?>
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>FurrSecurity - Verificacion de Staff</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .container {
                max-width: 440px;
                width: 100%;
            }
            .card {
                background: rgba(18, 18, 26, 0.8);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(139, 92, 246, 0.15);
                border-radius: 20px;
                padding: 40px;
                text-align: center;
                box-shadow: 0 25px 50px rgba(0, 0, 0, 0.4);
            }
            .logo {
                width: 64px;
                height: 64px;
                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                border-radius: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 24px;
                box-shadow: 0 8px 24px rgba(239, 68, 68, 0.3);
            }
            .logo svg {
                width: 32px;
                height: 32px;
                color: white;
            }
            h1 {
                color: #f4f4f5;
                font-size: 1.5rem;
                font-weight: 700;
                margin-bottom: 8px;
            }
            .subtitle {
                color: #71717a;
                font-size: 0.9rem;
                margin-bottom: 32px;
            }
            .player-info {
                background: rgba(139, 92, 246, 0.08);
                border: 1px solid rgba(139, 92, 246, 0.15);
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 24px;
            }
            .player-info .nick {
                color: #f4f4f5;
                font-weight: 600;
                font-size: 1.1rem;
            }
            .player-info .label {
                color: #71717a;
                font-size: 0.75rem;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-top: 4px;
            }
            .btn-discord {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                width: 100%;
                padding: 14px 24px;
                background: #5865F2;
                border: none;
                border-radius: 12px;
                color: white;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                text-decoration: none;
            }
            .btn-discord:hover {
                background: #4752C4;
                transform: translateY(-2px);
                box-shadow: 0 8px 20px rgba(88, 101, 242, 0.4);
            }
            .btn-discord svg {
                width: 24px;
                height: 24px;
            }
            .help-text {
                margin-top: 24px;
                padding-top: 24px;
                border-top: 1px solid rgba(139, 92, 246, 0.1);
                color: #71717a;
                font-size: 0.85rem;
                line-height: 1.5;
            }
            .help-text strong {
                color: #a1a1aa;
            }
            .expires {
                margin-top: 16px;
                padding: 12px;
                background: rgba(251, 191, 36, 0.1);
                border: 1px solid rgba(251, 191, 36, 0.2);
                border-radius: 8px;
                color: #fbbf24;
                font-size: 0.8rem;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <div class="logo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        <path d="M9 12l2 2 4-4"/>
                    </svg>
                </div>
                <h1>Verificacion de Staff</h1>
                <p class="subtitle">Confirma tu identidad para continuar</p>

                <div class="player-info">
                    <div class="nick"><?= htmlspecialchars($verification['minecraft_nick']) ?></div>
                    <div class="label">Jugador pendiente de verificacion</div>
                </div>

                <a href="<?= htmlspecialchars($oauthUrl) ?>" class="btn-discord">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                    Iniciar sesion con Discord
                </a>

                <div class="expires">
                    Este token expira: <?= date('d/m/Y H:i:s', strtotime($verification['expires_at'])) ?>
                </div>

                <div class="help-text">
                    <strong>Primera vez?</strong><br>
                    Si es la primera vez que verificas tu cuenta, asegurate de que tu Discord ID este registrado en el sistema. Contacta a <strong>SrTeb</strong> en Discord si tienes problemas.
                </div>
            </div>
        </div>
    </body>
    </html>
    <?php
}

function showError(string $title, string $message = ''): void {
    ?>
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>FurrSecurity - Error</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .container { max-width: 400px; width: 100%; }
            .card {
                background: rgba(18, 18, 26, 0.8);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(239, 68, 68, 0.2);
                border-radius: 20px;
                padding: 40px;
                text-align: center;
                border-top: 3px solid #ef4444;
            }
            .icon {
                width: 64px;
                height: 64px;
                background: rgba(239, 68, 68, 0.15);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 24px;
            }
            .icon svg { width: 32px; height: 32px; color: #ef4444; }
            h1 { color: #f4f4f5; font-size: 1.25rem; margin-bottom: 8px; }
            p { color: #71717a; font-size: 0.9rem; line-height: 1.5; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <div class="icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                </div>
                <h1><?= htmlspecialchars($title) ?></h1>
                <?php if ($message): ?>
                    <p><?= htmlspecialchars($message) ?></p>
                <?php endif; ?>
            </div>
        </div>
    </body>
    </html>
    <?php
}

function showSuccess(string $title, string $message = ''): void {
    ?>
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>FurrSecurity - Verificado</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .container { max-width: 400px; width: 100%; }
            .card {
                background: rgba(18, 18, 26, 0.8);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(34, 197, 94, 0.2);
                border-radius: 20px;
                padding: 40px;
                text-align: center;
                border-top: 3px solid #22c55e;
            }
            .icon {
                width: 64px;
                height: 64px;
                background: rgba(34, 197, 94, 0.15);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 24px;
            }
            .icon svg { width: 32px; height: 32px; color: #22c55e; }
            h1 { color: #f4f4f5; font-size: 1.25rem; margin-bottom: 8px; }
            p { color: #71717a; font-size: 0.9rem; line-height: 1.5; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <div class="icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                </div>
                <h1><?= htmlspecialchars($title) ?></h1>
                <?php if ($message): ?>
                    <p><?= htmlspecialchars($message) ?></p>
                <?php endif; ?>
            </div>
        </div>
    </body>
    </html>
    <?php
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
