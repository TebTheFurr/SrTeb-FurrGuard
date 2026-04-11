<?php
/**
 * FurrGuard Admin Panel - Vue 3 Entry Point
 *
 * @author GrinchHorizon
 * @copyright SrTeb Limited
 * @website https://srteb.eu
 * @version 2.0.0
 */

require_once __DIR__ . '/../config.php';

// Logout handler
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: ../index.php');
    exit;
}

// DB check — use db() helper from config/database.php (loaded by config.php)
try {
    $db = db();
} catch (Exception $e) {
    echo '<!DOCTYPE html><html><body style="background:#0a0a0f;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:Inter,sans-serif"><div><h1>Error de Base de Datos</h1><p>No se puede conectar a la base de datos.</p></div></body></html>';
    exit;
}

// Auth validation — config.php already started session via configureSecureSession() + session_start()
$isAuthenticated = false;
$user = null;
$rolePermissions = [];

if (isset($_SESSION['furrguard_admin'])) {
    validateSessionIntegrity();
    $admin = $_SESSION['furrguard_admin'];
    if (!empty($admin['discord_id']) && !empty($admin['expires_at'])) {
        if (strtotime($admin['expires_at']) > time()) {
            $isAuthenticated = true;
            $user = $admin;
            $rolePermissions = defined('ROLE_PERMISSIONS') ? ROLE_PERMISSIONS : [];
        }
    }
}

$nonce = base64_encode(random_bytes(16));
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FurrGuard Admin</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
</head>
<body class="bg-dark-900 text-white font-body antialiased">
    <div id="app"></div>
    <script type="module" src="/admin/src/main.ts"></script>
    <?php if ($isAuthenticated && $user): ?>
    <script nonce="<?php echo $nonce; ?>">
        window.__FURRGUARD_USER__ = <?php echo json_encode($user); ?>;
        window.__ROLE_PERMISSIONS__ = <?php echo json_encode($rolePermissions); ?>;
    </script>
    <?php endif; ?>
</body>
</html>
