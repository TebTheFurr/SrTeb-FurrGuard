<?php
/**
 * FurrGuard Admin Panel
 *
 * @author GrinchHorizon
 * @copyright SrTeb Limited
 * @website https://srteb.eu
 * @version 1.0.0
 */

require_once __DIR__ . '/../config.php';

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
        <title>FurrGuard - Error de Conexión</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #fff;
            }
            .error-container {
                text-align: center;
                padding: 40px;
                background: rgba(255,255,255,0.05);
                border-radius: 20px;
                border: 1px solid rgba(255,255,255,0.1);
                backdrop-filter: blur(10px);
                max-width: 500px;
            }
            .error-icon { font-size: 64px; margin-bottom: 20px; }
            h1 { color: #ff6b6b; margin-bottom: 15px; }
            p { color: rgba(255,255,255,0.7); margin-bottom: 25px; line-height: 1.6; }
            .retry-btn {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 12px 30px;
                border-radius: 10px;
                cursor: pointer;
                font-size: 16px;
                text-decoration: none;
                display: inline-block;
            }
            .retry-btn:hover { opacity: 0.9; transform: translateY(-2px); transition: all 0.2s; }
        </style>
    </head>
    <body>
        <div class="error-container">
            <div class="error-icon">⚠️</div>
            <h1>Error de Conexión</h1>
            <p>No se pudo conectar a la base de datos. Por favor, inténtalo de nuevo en unos momentos.</p>
            <a href="index.php" class="retry-btn">Reintentar</a>
        </div>
    </body>
    </html>
    <?php
    exit;
}

// Handle logout BEFORE any output
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: ../index.php');
    exit;
}

$isAuthenticated = isset($_SESSION['furrguard_admin']) && !empty($_SESSION['furrguard_admin']['discord_id']);

// Validate session integrity and expiration
if ($isAuthenticated) {
    if (!validateSessionIntegrity()) {
        session_destroy();
        header('Location: index.php?error=session_expired');
        exit;
    }
    if (isset($_SESSION['furrguard_admin']['expires_at'])) {
        $expiresAt = strtotime($_SESSION['furrguard_admin']['expires_at']);
        if ($expiresAt && time() > $expiresAt) {
            session_destroy();
            header('Location: index.php?error=session_expired');
            exit;
        }
    }
}

if ($isAuthenticated && empty($_SESSION['furrguard_admin']['role'])) {
    $role = getUserRole($_SESSION['furrguard_admin']['discord_id']);
    if ($role) {
        $_SESSION['furrguard_admin']['role'] = $role;
    } else {
        unset($_SESSION['furrguard_admin']);
        $isAuthenticated = false;
    }
}
$user = $isAuthenticated ? $_SESSION['furrguard_admin'] : null;
?>
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>FurrGuard - Panel de Administración</title>
        <link rel="icon" type="image/png" href="../icono-furguard.png">
        <link rel="apple-touch-icon" href="../icono-furguard.png">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="assets/css/admin.css?v=<?php echo filemtime(__DIR__ . '/assets/css/admin.css'); ?>">
        <link rel="stylesheet" href="assets/css/animations.css?v=<?php echo filemtime(__DIR__ . '/assets/css/animations.css'); ?>">
        <link rel="stylesheet" href="assets/css/furrperms.css?v=<?php echo filemtime(__DIR__ . '/assets/css/furrperms.css'); ?>">
        <script src="https://unpkg.com/skinview3d/bundles/skinview3d.bundle.js"></script>
    </head>
    <body>
    <div class="bg-effects">
        <div class="noise"></div>
        <div class="floating-shapes">
            <div class="shape shape-1"></div>
            <div class="shape shape-2"></div>
            <div class="shape shape-3"></div>
        </div>
    </div>

    <!-- Login Screen -->
    <div id="loginContainer" class="login-container <?php echo $isAuthenticated ? 'hidden' : ''; ?>">
        <div class="login-card">
            <div class="login-glow"></div>
            <div class="login-content">
                <div class="login-icon">
                    <img src="../icono-furguard.png" alt="FurrGuard" style="width:40px;height:40px;object-fit:contain;">
                </div>
                <h1>FurrGuard</h1>
                <p>Panel de Administración</p>
                <a href="<?php echo getDiscordLoginUrl(); ?>" class="btn-discord" id="discordLoginBtn">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                    Iniciar sesión con Discord
                </a>
                <?php if (isset($_GET['error'])): ?>
                    <div class="login-error">
                        <?php
                        $errors = [
                                'invalid_code' => 'Código de autorización inválido',
                                'no_access' => 'No tienes permiso para acceder',
                                'discord_error' => 'Error al conectar con Discord',
                                'session_expired' => 'Sesión expirada, inicia sesión de nuevo'
                        ];
                        echo $errors[$_GET['error']] ?? 'Error desconocido';
                        ?>
                    </div>
                <?php endif; ?>
                <div class="login-footer">
                    <p>Solo usuarios autorizados</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Dashboard -->
    <div id="dashboard" class="dashboard <?php echo $isAuthenticated ? 'active' : ''; ?>">
        <!-- Sidebar -->
        <aside class="sidebar">
            <div class="sidebar-brand">
                <div class="brand-logo"><img src="../icono-furguard.png" alt="FurrGuard" style="width:26px;height:26px;object-fit:contain;"></div>
                <div class="brand-info">
                    <span class="brand-name">FurrGuard</span>
                    <span class="brand-version">v<?php echo FURRGUARD_VERSION; ?></span>
                </div>
            </div>

            <nav class="sidebar-nav">
                <!-- Dashboard - Principal -->
                <a href="#" class="nav-dashboard active" data-section="overview">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="7" height="7" rx="1"/>
                        <rect x="14" y="3" width="7" height="7" rx="1"/>
                        <rect x="3" y="14" width="7" height="7" rx="1"/>
                        <rect x="14" y="14" width="7" height="7" rx="1"/>
                    </svg>
                    Dashboard
                </a>

                <!-- Categoría: Gestión -->
                <div class="nav-category">
                    <div class="nav-category-header">
                        <svg class="nav-category-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"/>
                        </svg>
                        <span>Gestión</span>
                    </div>
                    <div class="nav-category-items">
                        <a href="#" class="nav-item" data-section="players">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                <circle cx="9" cy="7" r="4"/>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                            </svg>
                            Jugadores
                            <span class="nav-badge" id="playersBadge">0</span>
                        </a>
                        <a href="#" class="nav-item" data-section="connections">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                            </svg>
                            Conexiones
                        </a>
                        <a href="#" class="nav-item" data-section="ips">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                                <line x1="6" y1="6" x2="6.01" y2="6"/>
                                <line x1="6" y1="18" x2="6.01" y2="18"/>
                            </svg>
                            Direcciones IP
                        </a>
                    </div>
                </div>

                <!-- Categoría: Seguridad -->
                <div class="nav-category collapsed">
                    <div class="nav-category-header">
                        <svg class="nav-category-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"/>
                        </svg>
                        <span>Seguridad</span>
                    </div>
                    <div class="nav-category-items">
                        <a href="#" class="nav-item" data-section="whitelist">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                <polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                            Whitelist
                            <span class="nav-badge success" id="whitelistBadge">0</span>
                        </a>
                        <a href="#" class="nav-item" data-section="blacklist">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                            </svg>
                            Blacklist
                            <span class="nav-badge danger" id="blacklistBadge">0</span>
                        </a>
                        <a href="#" class="nav-item" data-section="sanctions">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                <path d="M12 8v4"/>
                                <path d="M12 16h.01"/>
                            </svg>
                            Sanciones
                        </a>
                        <a href="#" class="nav-item" data-section="providers">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                            </svg>
                            Proveedores VPN
                            <span class="nav-badge warning" id="providersBadge">0</span>
                        </a>
                    </div>
                </div>

                <!-- Categoría: Geolocalización -->
                <div class="nav-category collapsed">
                    <div class="nav-category-header">
                        <svg class="nav-category-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"/>
                        </svg>
                        <span>Geolocalización</span>
                    </div>
                    <div class="nav-category-items">
                        <a href="#" class="nav-item" data-section="countries">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="2" y1="12" x2="22" y2="12"/>
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                            </svg>
                            Países
                            <span class="nav-badge warning" id="countriesBadge">0</span>
                        </a>
                        <a href="#" class="nav-item" data-section="continents">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M2 12h20"/>
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                            </svg>
                            Continentes
                            <span class="nav-badge warning" id="continentsBadge">0</span>
                        </a>
                    </div>
                </div>

                <!-- Categoría: Módulos -->
                <div class="nav-category collapsed">
                    <div class="nav-category-header">
                        <svg class="nav-category-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"/>
                        </svg>
                        <span>Módulos</span>
                    </div>
                    <div class="nav-category-items">
                        <a href="#" class="nav-item" data-section="furrperms">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                <path d="M9 12l2 2 4-4"/>
                            </svg>
                            FurrPerms
                        </a>
                    </div>
                </div>

                <!-- Categoría: Sistema -->
                <div class="nav-category collapsed">
                    <div class="nav-category-header">
                        <svg class="nav-category-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"/>
                        </svg>
                        <span>Sistema</span>
                    </div>
                    <div class="nav-category-items">
                        <a href="#" class="nav-item" data-section="messages">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                            Mensajes
                        </a>
                        <a href="#" class="nav-item" data-section="logs">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                            </svg>
                            Logs
                        </a>
                        <a href="#" class="nav-item" data-section="settings">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="3"/>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                            </svg>
                            Configuración
                        </a>
                        <a href="#" class="nav-item" data-section="users">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                                <circle cx="9" cy="7" r="4"/>
                                <line x1="19" y1="8" x2="19" y2="14"/>
                                <line x1="22" y1="11" x2="16" y2="11"/>
                            </svg>
                            Usuarios Panel
                        </a>
                    </div>
                </div>
            </nav>

            <div class="sidebar-footer">
                <div class="user-card">
                    <div class="user-avatar" id="userAvatar">
                        <?php if ($user && $user['avatar']): ?>
                            <img src="https://cdn.discordapp.com/avatars/<?php echo $user['discord_id']; ?>/<?php echo $user['avatar']; ?>.png" alt="Avatar">
                        <?php else: ?>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                <circle cx="12" cy="7" r="4"/>
                            </svg>
                        <?php endif; ?>
                    </div>
                    <div class="user-details">
                        <span class="user-name" id="userDisplay"><?php echo $user ? htmlspecialchars($user['username']) : 'Admin'; ?></span>
                        <span class="user-role" id="userRoleDisplay"><?php echo $user ? ucfirst($user['role'] ?? 'admin') : 'Admin'; ?></span>
                    </div>
                </div>
                <a href="?logout=1" class="btn-logout" id="logoutBtn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Cerrar sesión
                </a>
            </div>
        </aside>

        <!-- Main Content -->
        <main class="main-content">
            <header class="main-header">
                <div class="header-left">
                    <button class="sidebar-toggle" id="sidebarToggle">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="3" y1="12" x2="21" y2="12"/>
                            <line x1="3" y1="6" x2="21" y2="6"/>
                            <line x1="3" y1="18" x2="21" y2="18"/>
                        </svg>
                    </button>
                    <div class="header-title">
                        <h1 id="sectionTitle">Dashboard</h1>
                        <div class="header-breadcrumb">
                            <span>Panel</span>
                            <span>→</span>
                            <span id="breadcrumbSection">Resumen</span>
                        </div>
                    </div>
                </div>
                <div class="header-actions">
                    <div class="search-global">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <input type="text" id="globalSearch" placeholder="Buscar jugador, IP, UUID...">
                    </div>
                    <button class="btn-icon" id="refreshBtn" title="Actualizar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                        </svg>
                    </button>
                </div>
            </header>

            <div class="content-wrapper">
                <!-- Overview Section -->
                <section id="section-overview" class="section active">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon green">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                                </svg>
                            </div>
                            <div class="stat-content">
                                <span class="stat-value" id="statOnline">0</span>
                                <span class="stat-label">Jugadores Online</span>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon blue">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                                    <circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                                </svg>
                            </div>
                            <div class="stat-content">
                                <span class="stat-value" id="statTotalPlayers">0</span>
                                <span class="stat-label">Total Jugadores</span>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon purple">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/>
                                    <path d="M2 12l10 5 10-5"/>
                                </svg>
                            </div>
                            <div class="stat-content">
                                <span class="stat-value" id="statConnections24h">0</span>
                                <span class="stat-label">Conexiones 24h</span>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon red">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>
                                </svg>
                            </div>
                            <div class="stat-content">
                                <span class="stat-value" id="statBlocked24h">0</span>
                                <span class="stat-label">Bloqueados 24h</span>
                            </div>
                        </div>
                    </div>

                    <div class="cards-grid">
                        <div class="card">
                            <div class="card-header">
                                <h3>Conexiones Recientes</h3>
                                <a href="#" class="card-link" data-goto="connections">Ver todas</a>
                            </div>
                            <div class="card-body">
                                <div class="connections-mini-list" id="recentConnectionsList">
                                    <div class="loading-spinner"></div>
                                </div>
                            </div>
                        </div>
                        <div class="card">
                            <div class="card-header">
                                <h3>Bloqueos Recientes</h3>
                                <a href="#" class="card-link" data-goto="blacklist">Ver todos</a>
                            </div>
                            <div class="card-body">
                                <div class="blocks-mini-list" id="recentBlocksList">
                                    <div class="loading-spinner"></div>
                                </div>
                            </div>
                        </div>
                        <div class="card full-width">
                            <div class="card-header">
                                <h3>Acciones Rápidas</h3>
                            </div>
                            <div class="card-body">
                                <div class="quick-actions">
                                    <button class="quick-action" id="quickAddWhitelist">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                            <polyline points="22 4 12 14.01 9 11.01"/>
                                        </svg>
                                        Añadir a Whitelist
                                    </button>
                                    <button class="quick-action" id="quickAddBlacklist">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>
                                        </svg>
                                        Añadir a Blacklist
                                    </button>
                                    <button class="quick-action" id="quickSearchPlayer">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" stroke-linecap="round" stroke-linejoin="round"/>
                                        </svg>
                                        Buscar Jugador
                                    </button>
                                    <?php if (($user['role'] ?? '') === 'founder'): ?>
                                    <button class="quick-action" id="quickExport">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                            <polyline points="7 10 12 15 17 10"/>
                                            <line x1="12" y1="15" x2="12" y2="3"/>
                                        </svg>
                                        Exportar Datos
                                    </button>
                                    <?php endif; ?>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Players Section -->
                <section id="section-players" class="section">
                    <div class="section-header">
                        <span class="section-tag">Players</span>
                        <h2>Gestión de Jugadores</h2>
                        <div class="search-box">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <input type="text" id="playersSearch" placeholder="Buscar por nick, UUID o IP...">
                        </div>
                        <div class="filter-group">
                            <button class="filter-btn active" data-player-filter="all">Todos</button>
                            <button class="filter-btn" data-player-filter="online">Online</button>
                            <button class="filter-btn" data-player-filter="whitelisted">Whitelist</button>
                            <button class="filter-btn" data-player-filter="blacklisted">Blacklist</button>
                        </div>
                    </div>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                            <tr>
                                <th>Jugador</th>
                                <th>UUID</th>
                                <th>Última IP</th>
                                <th>País</th>
                                <th>Conexiones</th>
                                <th>Última vez</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                            </thead>
                            <tbody id="playersTableBody">
                            <tr><td colspan="8"><div class="loading-spinner"></div></td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="pagination" id="playersPagination"></div>
                </section>

                <!-- Connections Section -->
                <section id="section-connections" class="section">
                    <div class="section-tag">Connections</div>
                    <div class="section-header">
                        <h2>Historial de Conexiones</h2>
                        <div class="search-box">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <input type="text" id="connectionsSearch" placeholder="Buscar...">
                        </div>
                        <div class="filter-group">
                            <button class="filter-btn active" data-conn-filter="all">Todos</button>
                            <button class="filter-btn" data-conn-filter="allowed">Permitidos</button>
                            <button class="filter-btn" data-conn-filter="blocked">Bloqueados</button>
                            <button class="filter-btn" data-conn-filter="proxy">Proxy</button>
                            <button class="filter-btn" data-conn-filter="vpn">VPN</button>
                            <button class="filter-btn" data-conn-filter="hosting">Hosting</button>
                        </div>
                    </div>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                            <tr>
                                <th>Jugador</th>
                                <th>IP</th>
                                <th>País</th>
                                <th>ISP</th>
                                <th>Versión</th>
                                <th>Fecha</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                            </thead>
                            <tbody id="connectionsTableBody">
                            <tr><td colspan="8"><div class="loading-spinner"></div></td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="pagination" id="connectionsPagination"></div>
                </section>

                <!-- IPs Section -->
                <section id="section-ips" class="section">
                    <div class="section-tag">IPs</div>
                    <div class="section-header">
                        <h2>Direcciones IP</h2>
                        <div class="search-box">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <input type="text" id="ipsSearch" placeholder="Buscar IP...">
                        </div>
                    </div>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                            <tr>
                                <th>IP</th>
                                <th>País</th>
                                <th>ISP / ASN</th>
                                <th>Jugadores</th>
                                <th>Conexiones</th>
                                <th>Primera vez</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                            </thead>
                            <tbody id="ipsTableBody">
                            <tr><td colspan="8"><div class="loading-spinner"></div></td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="pagination" id="ipsPagination"></div>
                </section>

                <!-- Whitelist Section -->
                <section id="section-whitelist" class="section">
                    <div class="section-tag">Security</div>
                    <div class="section-header">
                        <h2>Whitelist</h2>
                        <div class="search-box">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <input type="text" id="whitelistSearch" placeholder="Buscar...">
                        </div>
                        <div class="filter-group">
                            <button class="filter-btn active" data-wl-filter="all">Todos</button>
                            <button class="filter-btn" data-wl-filter="uuid">UUID</button>
                            <button class="filter-btn" data-wl-filter="nick">Nick</button>
                            <button class="filter-btn" data-wl-filter="ip">IP</button>
                            <button class="filter-btn" data-wl-filter="as">AS</button>
                        </div>
                        <button class="btn-primary" id="addWhitelistBtn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="12" y1="6" x2="12" y2="18"/>
                                <line x1="6" y1="12" x2="18" y2="12"/>
                            </svg>
                            Añadir
                        </button>
                    </div>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                            <tr>
                                <th>Tipo</th>
                                <th>Valor</th>
                                <th>Razón</th>
                                <th>Añadido por</th>
                                <th>Fecha</th>
                                <th>Acciones</th>
                            </tr>
                            </thead>
                            <tbody id="whitelistTableBody">
                            <tr><td colspan="6"><div class="loading-spinner"></div></td></tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <!-- Blacklist Section -->
                <section id="section-blacklist" class="section">
                    <div class="section-tag">Blacklist</div>
                    <div class="section-header">
                        <h2>Blacklist</h2>
                        <div class="search-box">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <input type="text" id="blacklistSearch" placeholder="Buscar...">
                        </div>
                        <div class="filter-group">
                            <button class="filter-btn active" data-bl-filter="all">Todos</button>
                            <button class="filter-btn" data-bl-filter="uuid">UUID</button>
                            <button class="filter-btn" data-bl-filter="nick">Nick</button>
                            <button class="filter-btn" data-bl-filter="ip">IP</button>
                            <button class="filter-btn" data-bl-filter="as">AS</button>
                        </div>
                        <button class="btn-primary" id="addBlacklistBtn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="12" y1="6" x2="12" y2="18"/>
                                <line x1="6" y1="12" x2="18" y2="12"/>
                            </svg>
                            Añadir
                        </button>
                    </div>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                            <tr>
                                <th>ID</th>
                                <th>Tipo</th>
                                <th>Valor</th>
                                <th>Razón</th>
                                <th>Añadido por</th>
                                <th>Fecha</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                            </thead>
                            <tbody id="blacklistTableBody">
                            <tr><td colspan="8"><div class="loading-spinner"></div></td></tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <!-- Sanctions Section -->
                <section id="section-sanctions" class="section">
                    <div class="section-tag">Security</div>
                    <div class="section-header">
                        <h2>Registro de Sanciones</h2>
                        <div class="search-box">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <input type="text" id="sanctionsSearch" placeholder="Buscar por ID, valor, razón...">
                        </div>
                        <div class="filter-group">
                            <button class="filter-btn active" data-sanction-filter="all">Todos</button>
                            <button class="filter-btn" data-sanction-filter="active">Activos</button>
                            <button class="filter-btn" data-sanction-filter="permanent">Permanentes</button>
                            <button class="filter-btn" data-sanction-filter="temporary">Temporales</button>
                            <button class="filter-btn" data-sanction-filter="expired">Expirados</button>
                            <button class="filter-btn" data-sanction-filter="inactive">Inactivos</button>
                        </div>
                    </div>
                    <div class="providers-stats">
                        <div class="mini-stat">
                            <span class="mini-stat-value" id="sanctionStatTotal">0</span>
                            <span class="mini-stat-label">Total</span>
                        </div>
                        <div class="mini-stat">
                            <span class="mini-stat-value" id="sanctionStatActive">0</span>
                            <span class="mini-stat-label">Activos</span>
                        </div>
                        <div class="mini-stat">
                            <span class="mini-stat-value" id="sanctionStatPermanent">0</span>
                            <span class="mini-stat-label">Permanentes</span>
                        </div>
                        <div class="mini-stat">
                            <span class="mini-stat-value" id="sanctionStatTemporary">0</span>
                            <span class="mini-stat-label">Temporales</span>
                        </div>
                        <div class="mini-stat">
                            <span class="mini-stat-value" id="sanctionStatExpired">0</span>
                            <span class="mini-stat-label">Expirados</span>
                        </div>
                    </div>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                            <tr>
                                <th>ID Sanción</th>
                                <th>Tipo</th>
                                <th>Valor</th>
                                <th>Razón</th>
                                <th>Ejecutor</th>
                                <th>Duración</th>
                                <th>Fecha</th>
                                <th>Estado</th>
                            </tr>
                            </thead>
                            <tbody id="sanctionsTableBody">
                            <tr><td colspan="8"><div class="loading-spinner"></div></td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div id="sanctionsPagination" class="pagination"></div>
                </section>

                <!-- Providers Section -->
                <section id="section-providers" class="section">
                    <div class="section-tag">VPN</div>
                    <div class="section-header">
                        <h2>Proveedores Bloqueados</h2>
                        <div class="search-box">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <input type="text" id="providersSearch" placeholder="Buscar proveedor...">
                        </div>
                        <div class="filter-group">
                            <button class="filter-btn active" data-prov-filter="all">Todos</button>
                            <button class="filter-btn" data-prov-filter="hosting">Hosting</button>
                            <button class="filter-btn" data-prov-filter="vpn">VPN</button>
                            <button class="filter-btn" data-prov-filter="proxy">Proxy</button>
                        </div>
                        <button class="btn-primary" id="addProviderBtn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="12" y1="6" x2="12" y2="18"/>
                                <line x1="6" y1="12" x2="18" y2="12"/>
                            </svg>
                            Añadir
                        </button>
                    </div>
                    <div class="providers-stats">
                        <div class="mini-stat">
                            <span class="mini-stat-value" id="provStatHosting">0</span>
                            <span class="mini-stat-label">Hosting</span>
                        </div>
                        <div class="mini-stat">
                            <span class="mini-stat-value" id="provStatVPN">0</span>
                            <span class="mini-stat-label">VPN</span>
                        </div>
                        <div class="mini-stat">
                            <span class="mini-stat-value" id="provStatProxy">0</span>
                            <span class="mini-stat-label">Proxy</span>
                        </div>
                    </div>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Patrón</th>
                                <th>Tipo</th>
                                <th>Bloqueos</th>
                                <th>Estado</th>
                                <th>Fecha</th>
                                <th>Acciones</th>
                            </tr>
                            </thead>
                            <tbody id="providersTableBody">
                            <tr><td colspan="7"><div class="loading-spinner"></div></td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="pagination" id="providersPagination"></div>
                </section>

                <!-- Countries Section -->
                <section id="section-countries" class="section">
                    <div class="section-tag">Geolocation</div>
                    <div class="section-header">
                        <h2>Países Bloqueados</h2>
                        <div class="search-box">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <input type="text" id="countriesSearch" placeholder="Buscar país...">
                        </div>
                        <button class="btn-primary" id="addCountryBtn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="12" y1="6" x2="12" y2="18"/>
                                <line x1="6" y1="12" x2="18" y2="12"/>
                            </svg>
                            Añadir
                        </button>
                    </div>
                    <div class="providers-stats">
                        <div class="mini-stat">
                            <span class="mini-stat-value" id="countryStatTotal">0</span>
                            <span class="mini-stat-label">Total</span>
                        </div>
                        <div class="mini-stat">
                            <span class="mini-stat-value" id="countryStatActive">0</span>
                            <span class="mini-stat-label">Activos</span>
                        </div>
                        <div class="mini-stat">
                            <span class="mini-stat-value" id="countryStatBlocks">0</span>
                            <span class="mini-stat-label">Bloqueos</span>
                        </div>
                    </div>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                            <tr>
                                <th>País</th>
                                <th>Código</th>
                                <th>Mensaje de Kick</th>
                                <th>Bloqueos</th>
                                <th>Estado</th>
                                <th>Fecha</th>
                                <th>Acciones</th>
                            </tr>
                            </thead>
                            <tbody id="countriesTableBody">
                            <tr><td colspan="7"><div class="loading-spinner"></div></td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="pagination" id="countriesPagination"></div>
                </section>

                <!-- Continents Section -->
                <section id="section-continents" class="section">
                    <div class="section-tag">Geo</div>
                    <div class="section-header">
                        <h2>Continentes Bloqueados</h2>
                        <button class="btn-primary" id="addContinentBtn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="12" y1="6" x2="12" y2="18"/>
                                <line x1="6" y1="12" x2="18" y2="12"/>
                            </svg>
                            Añadir
                        </button>
                    </div>
                    <div class="providers-stats">
                        <div class="mini-stat">
                            <span class="mini-stat-value" id="continentStatTotal">0</span>
                            <span class="mini-stat-label">Total</span>
                        </div>
                        <div class="mini-stat">
                            <span class="mini-stat-value" id="continentStatActive">0</span>
                            <span class="mini-stat-label">Activos</span>
                        </div>
                        <div class="mini-stat">
                            <span class="mini-stat-value" id="continentStatBlocks">0</span>
                            <span class="mini-stat-label">Bloqueos</span>
                        </div>
                    </div>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                            <tr>
                                <th>Continente</th>
                                <th>Código</th>
                                <th>Mensaje de Kick</th>
                                <th>Bloqueos</th>
                                <th>Estado</th>
                                <th>Fecha</th>
                                <th>Acciones</th>
                            </tr>
                            </thead>
                            <tbody id="continentsTableBody">
                            <tr><td colspan="7"><div class="loading-spinner"></div></td></tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <!-- Messages Section -->
                <section id="section-messages" class="section">
                    <div class="section-tag">Config</div>
                    <div class="section-header">
                        <h2>Mensajes del Plugin</h2>
                    </div>
                    <p style="color: var(--text-tertiary); margin-bottom: 24px;">
                        Personaliza los mensajes que muestra el plugin. Usa códigos de color de Minecraft (&a, &c, etc.) y variables como {player}, {reason}, {ip}, {country}.
                    </p>
                    <div class="messages-editor" id="messagesEditor">
                        <div class="loading-spinner"></div>
                    </div>
                    <div class="settings-actions" style="margin-top: 24px;">
                        <button class="btn-primary" id="saveMessages">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                            </svg>
                            Guardar Mensajes
                        </button>
                    </div>
                </section>

                <!-- Logs Section -->
                <section id="section-logs" class="section">
                    <div class="section-tag">System</div>
                    <div class="section-header">
                        <h2>Logs de Actividad</h2>
                        <div class="filter-group">
                            <button class="filter-btn active" data-log-filter="all">Todos</button>
                            <button class="filter-btn" data-log-filter="connection">Conexiones</button>
                            <button class="filter-btn" data-log-filter="whitelist">Whitelist</button>
                            <button class="filter-btn" data-log-filter="blacklist">Blacklist</button>
                            <button class="filter-btn" data-log-filter="settings">Configuración</button>
                        </div>
                    </div>
                    <div class="logs-container" id="logsContainer">
                        <div class="loading-spinner"></div>
                    </div>
                </section>

                <!-- Settings Section -->
                <section id="section-settings" class="section">
                    <div class="section-tag">Configuration</div>
                    <div class="section-header">
                        <h2>Configuración</h2>
                    </div>
                    <div class="settings-grid">
                        <div class="settings-card">
                            <h3>General</h3>
                            <div class="setting-item full-width">
                                <div class="setting-info">
                                    <span class="setting-label">Nombre del Servidor</span>
                                    <span class="setting-desc">Se muestra en los mensajes de expulsión ({server_name})</span>
                                </div>
                                <input type="text" class="setting-input" id="settingServerName" placeholder="MI SERVIDOR">
                            </div>
                            <div class="setting-item full-width">
                                <div class="setting-info">
                                    <span class="setting-label">Discord URL</span>
                                    <span class="setting-desc">Enlace de Discord mostrado en mensajes de expulsión ({discord})</span>
                                </div>
                                <input type="text" class="setting-input" id="settingDiscordUrl" placeholder="discord.gg/tuservidor">
                            </div>
                        </div>
                        <div class="settings-card">
                            <h3>Bloqueo Automático</h3>
                            <div class="setting-item">
                                <div class="setting-info">
                                    <span class="setting-label">Bloquear Proxies</span>
                                    <span class="setting-desc">Bloquea conexiones detectadas como proxy</span>
                                </div>
                                <label class="toggle">
                                    <input type="checkbox" id="settingBlockProxy">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <div class="setting-item">
                                <div class="setting-info">
                                    <span class="setting-label">Bloquear VPNs</span>
                                    <span class="setting-desc">Bloquea conexiones desde servicios VPN conocidos</span>
                                </div>
                                <label class="toggle">
                                    <input type="checkbox" id="settingBlockVPN">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <div class="setting-item">
                                <div class="setting-info">
                                    <span class="setting-label">Bloquear Hosting</span>
                                    <span class="setting-desc">Bloquea conexiones desde datacenters y servidores</span>
                                </div>
                                <label class="toggle">
                                    <input type="checkbox" id="settingBlockHosting">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="settings-card">
                            <h3>Notificaciones</h3>
                            <div class="setting-item full-width">
                                <div class="setting-info">
                                    <span class="setting-label">Webhook de Discord</span>
                                    <span class="setting-desc">URL del webhook para enviar notificaciones</span>
                                </div>
                                <input type="url" class="setting-input" id="settingWebhookUrl" placeholder="https://discord.com/api/webhooks/...">
                            </div>
                            <div class="setting-item">
                                <div class="setting-info">
                                    <span class="setting-label">Notificar Conexiones</span>
                                    <span class="setting-desc">Envía notificación in-game por cada conexión</span>
                                </div>
                                <label class="toggle">
                                    <input type="checkbox" id="settingNotifyConnections">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <div class="setting-item">
                                <div class="setting-info">
                                    <span class="setting-label">Notificar Conexiones Extranjeras</span>
                                    <span class="setting-desc">Notifica solo conexiones desde países NO hispanohablantes (fuera de ES, MX, AR, CO, etc.)</span>
                                </div>
                                <label class="toggle">
                                    <input type="checkbox" id="settingNotifyHispanic">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <div class="setting-item">
                                <div class="setting-info">
                                    <span class="setting-label">Notificar Bloqueos</span>
                                    <span class="setting-desc">Envía notificación cuando se bloquea una conexión</span>
                                </div>
                                <label class="toggle">
                                    <input type="checkbox" id="settingNotifyBlocks">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="settings-card full-width">
                            <h3>API</h3>
                            <div class="setting-item full-width">
                                <div class="setting-info">
                                    <span class="setting-label">API Key</span>
                                    <span class="setting-desc">Clave de autenticación para el plugin. Cópiala en la configuración del plugin.</span>
                                </div>
                                <div class="api-key-container">
                                    <input type="password" class="setting-input" id="settingApiKey" readonly>
                                    <button class="btn-icon" id="toggleApiKey" title="Mostrar/Ocultar">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                            <circle cx="12" cy="12" r="3"/>
                                        </svg>
                                    </button>
                                    <button class="btn-danger" id="regenerateApiKey">Regenerar</button>
                                </div>
                            </div>
                        </div>
                        <div class="settings-card full-width" id="migrationCard" style="display:none;">
                            <h3>Migración de Sistema</h3>
                            <div class="setting-item full-width">
                                <div class="setting-info">
                                    <span class="setting-label">Migrar Blacklist al Nuevo Sistema</span>
                                    <span class="setting-desc">Verifica todas las entradas de blacklist de jugadores y las actualiza según su estado premium/no-premium actual. Esta acción puede tardar varios minutos.</span>
                                </div>
                                <button class="btn-warning" id="migrateBlacklistBtn">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;vertical-align:middle;margin-right:5px;">
                                        <path d="M21 12a9 9 0 11-6.219-8.56"/>
                                        <polyline points="21 3 21 9 15 9"/>
                                    </svg>
                                    Migrar Blacklist
                                </button>
                            </div>
                            <div id="migrationStatus" style="display:none;margin-top:15px;padding:15px;border-radius:10px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);">
                                <div style="display:flex;align-items:center;gap:10px;">
                                    <div class="loading-spinner" style="width:20px;height:20px;border-width:2px;"></div>
                                    <span id="migrationStatusText">Migrando...</span>
                                </div>
                            </div>
                            <div class="setting-item full-width" style="margin-top:20px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.1);">
                                <div class="setting-info">
                                    <span class="setting-label">Migrar Jugadores Registrados</span>
                                    <span class="setting-desc">Verifica todos los jugadores registrados en la base de datos y actualiza sus UUIDs según su estado premium/no-premium. Esta acción puede tardar varios minutos.</span>
                                </div>
                                <button class="btn-warning" id="migratePlayersBtn">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;vertical-align:middle;margin-right:5px;">
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                        <circle cx="9" cy="7" r="4"/>
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                                    </svg>
                                    Migrar Jugadores
                                </button>
                            </div>
                            <div id="playerMigrationStatus" style="display:none;margin-top:15px;padding:15px;border-radius:10px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);">
                                <div style="display:flex;align-items:center;gap:10px;">
                                    <div class="loading-spinner" style="width:20px;height:20px;border-width:2px;"></div>
                                    <span id="playerMigrationStatusText">Migrando jugadores...</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="settings-actions">
                        <button class="btn-primary" id="saveSettings">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                            </svg>
                            Guardar Configuración
                        </button>
                    </div>
                </section>

                <!-- Users Management Section -->
                <section id="section-users" class="section">
                    <div class="section-tag">Admin</div>
                    <div class="section-header">
                        <h2>Gestión de Usuarios</h2>
                        <button class="btn-primary" id="addAdminUserBtn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="12" y1="6" x2="12" y2="18"/>
                                <line x1="6" y1="12" x2="18" y2="12"/>
                            </svg>
                            Añadir Usuario
                        </button>
                    </div>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                            <tr>
                                <th>Discord ID</th>
                                <th>Rol</th>
                                <th>Creado por</th>
                                <th>Fecha</th>
                                <th>Acciones</th>
                            </tr>
                            </thead>
                            <tbody id="usersTableBody">
                            <tr><td colspan="5"><div class="loading-spinner"></div></td></tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <!-- FurrPerms Section -->
                <section id="section-furrperms" class="section">
                    <div class="section-tag">Module</div>
                    <div class="section-header">
                        <h2>FurrPerms - Protección de Comandos</h2>
                    </div>

                    <!-- Status Bar -->
                    <div class="furrperms-status-bar">
                        <div class="furrperms-status-indicator active">
                            <span class="status-dot"></span>
                            <span class="status-text">Módulo Activo</span>
                        </div>
                        <div class="furrperms-info">
                            <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="16" x2="12" y2="12"/>
                                <line x1="12" y1="8" x2="12.01" y2="8"/>
                            </svg>
                            <span>Protección de comandos sensibles (OP, LuckPerms, etc.)</span>
                        </div>
                    </div>

                    <!-- FurrPerms Content -->
                    <div class="furrperms-content">
                        <div class="furrperms-header-actions">
                            <button class="btn-primary" id="addFurrPermsWhitelistBtn">
                                <svg class="btn-icon-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="12" y1="6" x2="12" y2="18"/>
                                    <line x1="6" y1="12" x2="18" y2="12"/>
                                </svg>
                                Añadir Jugador
                            </button>
                            <button class="btn-secondary" id="refreshFurrPermsBtn" title="Actualizar datos">
                                <svg class="btn-icon-refresh" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M23 4v6h-3"/>
                                    <path d="M1 20v-6h3"/>
                                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                                </svg>
                            </button>
                        </div>

                        <!-- Stats Cards -->
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-icon purple">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M12 22s8-4 8-10V3l-8-3-8 3v9c0 6 8 10 8 10z"/>
                                        <path d="M9 12l2 2 4-4"/>
                                    </svg>
                                </div>
                                <div class="stat-content">
                                    <span class="stat-value" id="furrPermsTotalWhitelist">0</span>
                                    <span class="stat-label">Whitelist</span>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon green">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                        <polyline points="22 4 12 14.01 9 11.01"/>
                                    </svg>
                                </div>
                                <div class="stat-content">
                                    <span class="stat-value" id="furrPermsAllowedCommands">0</span>
                                    <span class="stat-label">Comandos Permitidos</span>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon red">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <circle cx="12" cy="12" r="10"/>
                                        <line x1="15" y1="9" x2="9" y2="15"/>
                                        <line x1="9" y1="9" x2="15" y2="15"/>
                                    </svg>
                                </div>
                                <div class="stat-content">
                                    <span class="stat-value" id="furrPermsBlockedCommands">0</span>
                                    <span class="stat-label">Comandos Bloqueados</span>
                                </div>
                            </div>
                        </div>

                        <!-- Inner Tabs -->
                        <div class="furrperms-tabs">
                            <button class="furrperms-tab active" data-tab="furrperms-whitelist">Whitelist</button>
                            <button class="furrperms-tab" data-tab="furrperms-logs">Logs</button>
                        </div>

                        <!-- Whitelist Tab Content -->
                        <div class="furrperms-tab-content active" id="tab-furrperms-whitelist">
                            <div class="table-controls">
                                <input type="text" class="form-input" id="searchFurrPermsWhitelist" placeholder="🔍 Buscar jugador...">
                                <button class="btn-danger btn-sm" id="clearFurrPermsLogsBtn">
                                    <svg class="btn-icon-trash" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="3 6 5 6 21 6"/>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                        <line x1="10" y1="11" x2="10" y2="17"/>
                                        <line x1="14" y1="11" x2="14" y2="17"/>
                                    </svg>
                                    Limpiar Logs
                                </button>
                            </div>
                            <div class="table-container">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Jugador</th>
                                            <th>UUID</th>
                                            <th>Razón</th>
                                            <th>Añadido por</th>
                                            <th>Fecha</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody id="furrPermsWhitelistTableBody">
                                        <tr><td colspan="6" class="empty-state">Cargando...</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Logs Tab Content -->
                        <div class="furrperms-tab-content" id="tab-furrperms-logs">
                            <div class="table-controls">
                                <select class="form-input styled-select" id="furrPermsLogsFilter">
                                    <option value="all">📋 Todos</option>
                                    <option value="allowed">✅ Permitidos</option>
                                    <option value="blocked">🚫 Bloqueados</option>
                                </select>
                                <input type="text" class="form-input" id="searchFurrPermsLogs" placeholder="🔍 Buscar en logs...">
                            </div>
                            <div class="table-container">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Jugador</th>
                                            <th>Comando</th>
                                            <th>Servidor</th>
                                            <th>Resultado</th>
                                            <th>Fecha</th>
                                        </tr>
                                    </thead>
                                    <tbody id="furrPermsLogsTableBody">
                                        <tr><td colspan="5" class="empty-state">Cargando...</td></tr>
                                    </tbody>
                                </table>
                            </div>
                            <div class="pagination-container" id="furrPermsLogsPagination"></div>
                        </div>
                    </div>
                </section>
            </div>
        </main>

        <!-- Footer -->
        <footer class="main-footer">
            <div class="footer-left">
                <div class="footer-brand">
                    <div class="footer-brand-logo">
                        <img src="../icono-furguard.png" alt="FurrGuard">
                    </div>
                    <span class="footer-brand-name">FurrGuard</span>
                </div>
                <span class="footer-copyright">© <?php echo date('Y'); ?> SrTeb Limited</span>
            </div>
            <div class="footer-right">
                <div class="footer-links">
                    <a href="https://srteb.eu" class="footer-link" target="_blank">SrTeb</a>
                    <a href="../index.php" class="footer-link">Inicio</a>
                    <a href="https://discord.gg/srteb" class="footer-link" target="_blank">Soporte</a>
                </div>
                <div class="footer-status">
                    Sistema Activo
                </div>
            </div>
        </footer>
    </div>

    <!-- Admin User Modal -->
    <div id="adminUserModal" class="modal modal-terminal">
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-terminal-dots">
                <span class="dot red"></span>
                <span class="dot yellow"></span>
                <span class="dot green"></span>
            </div>
            <div class="modal-header">
                <h2>Añadir Usuario Admin</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Discord ID</label>
                    <input type="text" class="form-input input-premium" id="adminUserDiscordId" placeholder="Ej: 123456789012345678">
                    <span class="form-help">ID numérico de Discord del usuario (17-20 dígitos)</span>
                </div>
                <div class="form-group">
                    <label>Rol</label>
                    <select class="form-input styled-select" id="adminUserRole">
                        <option value="admin">Admin</option>
                        <option value="sradmin">SrAdmin</option>
                        <option value="manager">Manager</option>
                        <option value="owner">Owner</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost modal-cancel">Cancelar</button>
                <button class="btn-primary" id="confirmAddAdminUser">Añadir</button>
            </div>
        </div>
    </div>

    <!-- Add FurrPerms Whitelist Modal -->
    <div id="addFurrPermsModal" class="modal">
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Añadir Jugador a Whitelist - FurrPerms</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Nick del Jugador *</label>
                    <input type="text" class="form-input" id="furrPermsNick" placeholder="Ej: Steve">
                    <span class="form-help">Nick exacto del jugador (1-16 caracteres)</span>
                </div>
                <div class="form-group">
                    <label>UUID (opcional)</label>
                    <input type="text" class="form-input" id="furrPermsUuid" placeholder="Ej: 123e4567-e89b-12d3-a456-426614174000">
                    <span class="form-help">UUID del jugador para verificación adicional</span>
                </div>
                <div class="form-group">
                    <label>Razón</label>
                    <input type="text" class="form-input" id="furrPermsReason" placeholder="Ej: Administrador de red">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost modal-cancel">Cancelar</button>
                <button class="btn-primary" id="confirmAddFurrPermsWhitelist">Añadir</button>
            </div>
        </div>
    </div>

    <!-- Modals -->
    <!-- Player Detail Modal -->
    <div id="playerModal" class="modal modal-lg">
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Detalles del Jugador</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body" id="playerModalContent">
                <div class="loading-spinner"></div>
            </div>
            <div class="modal-footer" id="playerModalFooter"></div>
        </div>
    </div>

    <!-- IP Detail Modal -->
    <div id="ipModal" class="modal">
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Detalles de IP</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body" id="ipModalContent">
                <div class="loading-spinner"></div>
            </div>
            <div class="modal-footer" id="ipModalFooter"></div>
        </div>
    </div>

    <!-- Connection Detail Modal -->
    <div id="connectionModal" class="modal">
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Detalles de Conexión</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body" id="connectionModalContent">
                <div class="loading-spinner"></div>
            </div>
            <div class="modal-footer" id="connectionModalFooter"></div>
        </div>
    </div>

    <!-- Whitelist Modal -->
    <div id="whitelistModal" class="modal">
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Añadir a Whitelist</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Tipo</label>
                    <select class="form-input styled-select" id="wlType">
                        <option value="uuid">UUID</option>
                        <option value="nick">Nick</option>
                        <option value="ip">IP</option>
                        <option value="ip_range">Rango IP (CIDR)</option>
                        <option value="as">Número AS</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Valor</label>
                    <input type="text" class="form-input" id="wlValue" placeholder="Introduce el valor...">
                    <span class="form-help">UUID, nick, IP, rango CIDR (ej: 192.168.1.0/24) o número AS (ej: AS12345)</span>
                </div>
                <div class="form-group">
                    <label>Razón (opcional)</label>
                    <textarea class="form-textarea" id="wlReason" placeholder="Razón para añadir a whitelist..."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost modal-cancel">Cancelar</button>
                <button class="btn-success" id="confirmWhitelist">Añadir</button>
            </div>
        </div>
    </div>

    <!-- Blacklist Modal -->
    <div id="blacklistModal" class="modal">
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Añadir a Blacklist</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <!-- Tabs para seleccionar tipo -->
                <div class="modal-tabs" style="display:flex;gap:5px;margin-bottom:20px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:10px;">
                    <button type="button" class="modal-tab active" data-tab="player" style="flex:1;padding:10px;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.3);border-radius:8px;color:#fff;cursor:pointer;">Jugador</button>
                    <button type="button" class="modal-tab" data-tab="other" style="flex:1;padding:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:rgba(255,255,255,0.6);cursor:pointer;">IP / AS / CIDR</button>
                </div>

                <!-- Tab: Jugador (Unificado) -->
                <div id="blTabPlayer" class="bl-tab-content">
                    <div class="form-group">
                        <label>Nombre del Jugador</label>
                        <div style="display:flex;gap:10px;">
                            <input type="text" class="form-input" id="blPlayerName" placeholder="Introduce el nick del jugador..." style="flex:1;">
                            <button type="button" class="btn-secondary" id="blLookupBtn" style="white-space:nowrap;padding:10px 15px;">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" style="vertical-align:middle;margin-right:5px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                Verificar
                            </button>
                        </div>
                        <span class="form-help">El sistema detectará automáticamente si es premium o no-premium</span>
                    </div>

                    <!-- Resultado del lookup -->
                    <div id="blLookupResult" style="display:none;margin-bottom:20px;padding:15px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);">
                        <div style="display:flex;align-items:center;gap:15px;">
                            <div id="blPlayerAvatar" style="width:48px;height:48px;border-radius:8px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:bold;color:#fff;">
                                ?
                            </div>
                            <div style="flex:1;">
                                <div style="display:flex;align-items:center;gap:10px;margin-bottom:5px;">
                                    <span id="blPlayerNameDisplay" style="font-weight:600;font-size:16px;">-</span>
                                    <span id="blPremiumBadge" class="premium-badge" style="display:none;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase;">Premium</span>
                                </div>
                                <div id="blPlayerUuid" style="font-family:monospace;font-size:12px;color:rgba(255,255,255,0.5);">-</div>
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Razón</label>
                        <textarea class="form-textarea" id="blReason" placeholder="Razón para bloquear..."></textarea>
                    </div>
                    <div class="form-group">
                        <label>Duración</label>
                        <select class="form-input styled-select" id="blDuration">
                            <option value="0">Permanente</option>
                            <option value="60">1 hora</option>
                            <option value="360">6 horas</option>
                            <option value="720">12 horas</option>
                            <option value="1440">24 horas</option>
                            <option value="10080">7 días</option>
                            <option value="43200">30 días</option>
                            <option value="custom">Personalizado</option>
                        </select>
                    </div>
                    <div class="form-group" id="blCustomDurationGroup" style="display:none;">
                        <label>Duración personalizada (minutos)</label>
                        <input type="number" class="form-input" id="blCustomDuration" placeholder="Minutos" min="1">
                    </div>
                    <div class="form-group" style="display:flex;align-items:center;gap:10px;margin-top:10px;">
                        <label class="toggle" style="margin:0;">
                            <input type="checkbox" id="blStainIp" checked>
                            <span class="toggle-slider"></span>
                        </label>
                        <div style="flex:1;">
                            <span class="setting-label">Manchar IP automáticamente</span>
                            <span class="setting-desc">También añadirá las IPs usadas por este jugador a la blacklist</span>
                        </div>
                    </div>
                </div>

                <!-- Tab: Otros tipos (IP, CIDR, AS) -->
                <div id="blTabOther" class="bl-tab-content" style="display:none;">
                    <div class="form-group">
                        <label>Tipo</label>
                        <select class="form-input styled-select" id="blType">
                            <option value="ip">IP</option>
                            <option value="ip_range">Rango IP (CIDR)</option>
                            <option value="as">Número AS</option>
                        </select>
                        <span class="form-help" id="blTypeHelp">Dirección IP específica</span>
                    </div>
                    <div class="form-group">
                        <label>Valor</label>
                        <input type="text" class="form-input" id="blValue" placeholder="Introduce el valor...">
                        <span class="form-help" id="blValueHelp">Dirección IPv4 o IPv6 (ej: 192.168.1.1)</span>
                    </div>
                    <div class="form-group">
                        <label>Razón</label>
                        <textarea class="form-textarea" id="blReasonOther" placeholder="Razón para bloquear..."></textarea>
                    </div>
                    <div class="form-group">
                        <label>Duración</label>
                        <select class="form-input styled-select" id="blDurationOther">
                            <option value="0">Permanente</option>
                            <option value="60">1 hora</option>
                            <option value="360">6 horas</option>
                            <option value="720">12 horas</option>
                            <option value="1440">24 horas</option>
                            <option value="10080">7 días</option>
                            <option value="43200">30 días</option>
                            <option value="custom">Personalizado</option>
                        </select>
                    </div>
                    <div class="form-group" id="blCustomDurationGroupOther" style="display:none;">
                        <label>Duración personalizada (minutos)</label>
                        <input type="number" class="form-input" id="blCustomDurationOther" placeholder="Minutos" min="1">
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost modal-cancel">Cancelar</button>
                <button class="btn-danger" id="confirmBlacklist">Bloquear</button>
            </div>
        </div>
    </div>

    <!-- Provider Modal -->
    <div id="providerModal" class="modal">
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Añadir Proveedor</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Nombre</label>
                    <input type="text" class="form-input" id="provName" placeholder="Nombre del proveedor">
                </div>
                <div class="form-group">
                    <label>Patrón</label>
                    <input type="text" class="form-input" id="provPattern" placeholder="Patrón de búsqueda (ej: digitalocean)">
                    <span class="form-help">El patrón se buscará en el ISP, organización y nombre AS</span>
                </div>
                <div class="form-group">
                    <label>Tipo</label>
                    <select class="form-input styled-select" id="provType">
                        <option value="hosting">Hosting</option>
                        <option value="vpn">VPN</option>
                        <option value="proxy">Proxy</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost modal-cancel">Cancelar</button>
                <button class="btn-primary" id="confirmProvider">Añadir</button>
            </div>
        </div>
    </div>

    <!-- Country Modal -->
    <div id="countryModal" class="modal">
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Añadir País Bloqueado</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>País</label>
                    <select class="form-input styled-select" id="countrySelect">
                        <option value="">Seleccionar país...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Mensaje de Kick (opcional)</label>
                    <textarea class="form-input" id="countryKickMessage" rows="4" placeholder="Dejar vacío para usar el mensaje por defecto de kick_blocked_country"></textarea>
                    <span class="form-help">Variables: {country}, {country_code}, {server_name}, {discord}, {id}</span>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost modal-cancel">Cancelar</button>
                <button class="btn-primary" id="confirmCountry">Añadir</button>
            </div>
        </div>
    </div>

    <!-- Edit Country Modal -->
    <div id="editCountryModal" class="modal">
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Editar País Bloqueado</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="editCountryId">
                <div class="form-group">
                    <label>Nombre del País</label>
                    <input type="text" class="form-input" id="editCountryName">
                </div>
                <div class="form-group">
                    <label>Mensaje de Kick (opcional)</label>
                    <textarea class="form-input" id="editCountryKickMessage" rows="4" placeholder="Dejar vacío para usar el mensaje por defecto"></textarea>
                    <span class="form-help">Variables: {country}, {country_code}, {server_name}, {discord}, {id}</span>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost modal-cancel">Cancelar</button>
                <button class="btn-primary" id="confirmEditCountry">Guardar</button>
            </div>
        </div>
    </div>

    <!-- Continent Modal -->
    <div id="continentModal" class="modal">
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Añadir Continente Bloqueado</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Continente</label>
                    <select class="form-input styled-select" id="continentSelect">
                        <option value="">Seleccionar continente...</option>
                        <option value="AF">África</option>
                        <option value="AN">Antártida</option>
                        <option value="AS">Asia</option>
                        <option value="EU">Europa</option>
                        <option value="NA">Norteamérica</option>
                        <option value="OC">Oceanía</option>
                        <option value="SA">Sudamérica</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Mensaje de Kick (opcional)</label>
                    <textarea class="form-input" id="continentKickMessage" rows="4" placeholder="Dejar vacío para usar el mensaje por defecto de kick_blocked_continent"></textarea>
                    <span class="form-help">Variables: {continent}, {continent_code}, {server_name}, {discord}, {id}</span>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost modal-cancel">Cancelar</button>
                <button class="btn-primary" id="confirmContinent">Añadir</button>
            </div>
        </div>
    </div>

    <!-- Edit Continent Modal -->
    <div id="editContinentModal" class="modal">
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Editar Continente Bloqueado</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="editContinentId">
                <div class="form-group">
                    <label>Nombre del Continente</label>
                    <input type="text" class="form-input" id="editContinentName">
                </div>
                <div class="form-group">
                    <label>Mensaje de Kick (opcional)</label>
                    <textarea class="form-input" id="editContinentKickMessage" rows="4" placeholder="Dejar vacío para usar el mensaje por defecto"></textarea>
                    <span class="form-help">Variables: {continent}, {continent_code}, {server_name}, {discord}, {id}</span>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost modal-cancel">Cancelar</button>
                <button class="btn-primary" id="confirmEditContinent">Guardar</button>
            </div>
        </div>
    </div>

    <!-- Edit Whitelist Modal -->
    <div id="editWhitelistModal" class="modal">
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Editar Whitelist</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="editWlId">
                <div class="form-group">
                    <label>Tipo</label>
                    <select class="form-input styled-select" id="editWlType">
                        <option value="uuid">UUID</option>
                        <option value="nick">Nick</option>
                        <option value="ip">IP</option>
                        <option value="ip_range">Rango IP (CIDR)</option>
                        <option value="as">Número AS</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Valor</label>
                    <input type="text" class="form-input" id="editWlValue">
                </div>
                <div class="form-group">
                    <label>Razón</label>
                    <textarea class="form-textarea" id="editWlReason"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost modal-cancel">Cancelar</button>
                <button class="btn-primary" id="confirmEditWhitelist">Guardar</button>
            </div>
        </div>
    </div>

    <!-- Edit Blacklist Modal -->
    <div id="editBlacklistModal" class="modal">
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Editar Blacklist</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="editBlId">
                <div class="form-group">
                    <label>Tipo</label>
                    <select class="form-input styled-select" id="editBlType">
                        <option value="uuid">UUID</option>
                        <option value="nick">Nick</option>
                        <option value="ip">IP</option>
                        <option value="ip_range">Rango IP (CIDR)</option>
                        <option value="as">Número AS</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Valor</label>
                    <input type="text" class="form-input" id="editBlValue">
                </div>
                <div class="form-group">
                    <label>Razón</label>
                    <textarea class="form-textarea" id="editBlReason"></textarea>
                </div>
                <div class="form-group">
                    <label>Duración</label>
                    <select class="form-input styled-select" id="editBlDuration">
                        <option value="-1">No cambiar</option>
                        <option value="0">Permanente</option>
                        <option value="60">1 hora</option>
                        <option value="360">6 horas</option>
                        <option value="720">12 horas</option>
                        <option value="1440">24 horas</option>
                        <option value="10080">7 días</option>
                        <option value="43200">30 días</option>
                        <option value="custom">Personalizado</option>
                    </select>
                </div>
                <div class="form-group" id="editBlCustomDurationGroup" style="display:none;">
                    <label>Duración personalizada (minutos)</label>
                    <input type="number" class="form-input" id="editBlCustomDuration" placeholder="Minutos" min="1">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost modal-cancel">Cancelar</button>
                <button class="btn-primary" id="confirmEditBlacklist">Guardar</button>
            </div>
        </div>
    </div>

    <!-- Toast Container -->
    <div id="toastContainer" class="toast-container"></div>

    <!-- Custom Confirm Modal -->
    <div id="confirmModal" class="modal modal-terminal">
        <div class="modal-overlay"></div>
        <div class="modal-content confirm-modal">
            <div class="modal-terminal-dots">
                <span class="dot red"></span>
                <span class="dot yellow"></span>
                <span class="dot green"></span>
            </div>
            <div class="modal-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
            </div>
            <div class="modal-body">
                <h3 id="confirmTitle">Confirmar acción</h3>
                <p id="confirmMessage">¿Estás seguro de realizar esta acción?</p>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost" id="confirmCancel">Cancelar</button>
                <button class="btn-danger" id="confirmOk">Confirmar</button>
            </div>
        </div>
    </div>

    <!-- Custom Prompt Modal -->
    <div id="promptModal" class="modal modal-terminal">
        <div class="modal-overlay"></div>
        <div class="modal-content prompt-modal">
            <div class="modal-terminal-dots">
                <div class="dot red"></div>
                <div class="dot yellow"></div>
                <div class="dot green"></div>
            </div>
            <div class="modal-header">
                <h2 id="promptTitle">Entrada requerida</h2>
            </div>
            <div class="modal-body">
                <div class="modal-cmd-line">
                    <span class="prompt">$</span>
                    <span class="path">~/furrguard</span>
                    <span class="cursor"></span>
                </div>
                <p id="promptMessage" class="prompt-message">Introduce el valor:</p>
                <input type="text" class="form-input" id="promptInput" placeholder="Introduce el valor...">
            </div>
            <div class="modal-footer">
                <button class="btn-ghost" id="promptCancel">Cancelar</button>
                <button class="btn-primary" id="promptOk">Aceptar</button>
            </div>
        </div>
    </div>

    <!-- Custom Alert Modal -->
    <div id="alertModal" class="modal">
        <div class="modal-overlay"></div>
        <div class="modal-content alert-modal">
            <div class="modal-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
            </div>
            <div class="modal-body">
                <h3 id="alertTitle">Información</h3>
                <p id="alertMessage">Mensaje</p>
            </div>
            <div class="modal-footer">
                <button class="btn-primary" id="alertOk">Aceptar</button>
            </div>
        </div>
    </div>

    <script src="assets/js/admin.js?v=<?php echo FURRGUARD_VERSION . '.' . time(); ?>"></script>
    <?php if ($isAuthenticated): ?>
        <script>
            localStorage.setItem('furrguard_session', JSON.stringify(<?php echo json_encode($user); ?>));
            window.ROLE_PERMISSIONS = <?php echo json_encode(ROLE_PERMISSIONS); ?>;
        </script>
    <?php endif; ?>
    </body>
    </html>