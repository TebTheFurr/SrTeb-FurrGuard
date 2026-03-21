<?php
/**
 * FurrGuard Discord OAuth Callback
 *
 * @author GrinchHorizon
 * @copyright SrTeb Limited
 * @website https://srteb.eu
 * @version 1.5.0
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/functions.php';

// Check database connection early
$db = db();
if ($db === null) {
    http_response_code(503);
    ?>
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>FurrGuard - Error</title>
        <style nonce="<?php echo getCspNonce(); ?>">
            body { font-family: sans-serif; text-align: center; padding: 50px; background: #1a1a2e; color: #fff; }
            a { color: #667eea; }
        </style>
    </head>
    <body>
        <h1>Error de Conexión</h1>
        <p>No se pudo conectar a la base de datos.</p>
        <a href="index.php">Volver al inicio</a>
    </body>
    </html>
    <?php
    exit;
}

// Rate limit OAuth callbacks: 10 attempts per 5 minutes per IP
$clientIp = getClientIp();
if (!checkRateLimit($clientIp, 10, 300, 'oauth_callback')) {
    http_response_code(429);
    die('Demasiados intentos de inicio de sesión. Intenta de nuevo en unos minutos.');
}

if (!isset($_GET['code']) || !is_string($_GET['code']) || strlen($_GET['code']) > 100) {
    header('Location: index.php?error=invalid_code');
    exit;
}

$code = $_GET['code'];

$tokenData = exchangeCodeForToken($code);

if (!$tokenData || !isset($tokenData['access_token'])) {
    header('Location: index.php?error=discord_error');
    exit;
}

$userData = getDiscordUser($tokenData['access_token']);

if (!$userData || !isset($userData['id'])) {
    header('Location: index.php?error=discord_error');
    exit;
}

$userRole = getUserRole($userData['id']);
if ($userRole === null) {
    header('Location: index.php?error=no_access');
    exit;
}

$sessionToken = bin2hex(random_bytes(32));
$expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));

try {
    $db = db();

    // Delete all previous sessions for this user (DB sessions)
    $stmt = $db->prepare("DELETE FROM admin_sessions WHERE discord_id = ?");
    $stmt->execute([$userData['id']]);

    $stmt = $db->prepare("
        INSERT INTO admin_sessions (discord_id, discord_username, discord_avatar, session_token, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $userData['id'],
        $userData['username'],
        $userData['avatar'] ?? null,
        $sessionToken,
        getClientIp(),
        $expiresAt
    ]);

    logActivity($db, 'login', 'Admin login', "User {$userData['username']} ({$userData['id']}) logged in", getClientIp());

} catch (PDOException $e) {
    error_log('FurrGuard DB Error: ' . $e->getMessage());
}

// Completely destroy old session before creating new one (prevents session fixation)
$oldSessionData = $_SESSION;
$_SESSION = [];

// Delete the session cookie
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}

// Destroy the session file
session_destroy();

// Start a fresh session with new ID
configureSecureSession();
session_start();

// Regenerate ID again for extra security
session_regenerate_id(true);

$_SESSION['furrguard_admin'] = [
    'discord_id' => $userData['id'],
    'username' => $userData['username'],
    'avatar' => $userData['avatar'] ?? null,
    'role' => $userRole,
    'session_token' => $sessionToken,
    'expires_at' => $expiresAt
];

// Bind session to IP
$_SESSION['_session_ip'] = getClientIp();

header('Location: index.php');
exit;

function exchangeCodeForToken($code) {
    $url = 'https://discord.com/api/oauth2/token';

    $data = [
        'client_id' => DISCORD_CLIENT_ID,
        'client_secret' => DISCORD_CLIENT_SECRET,
        'grant_type' => 'authorization_code',
        'code' => $code,
        'redirect_uri' => DISCORD_REDIRECT_URI
    ];

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($data),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/x-www-form-urlencoded'
        ]
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        error_log('Discord token exchange failed: ' . $response);
        return null;
    }

    return json_decode($response, true);
}

function getDiscordUser($accessToken) {
    $url = 'https://discord.com/api/users/@me';

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $accessToken
        ]
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        error_log('Discord user fetch failed: ' . $response);
        return null;
    }

    return json_decode($response, true);
}
?>