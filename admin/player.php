<?php
/**
 * FurrGuard Admin Panel - Player Viewer
 *
 * @author GrinchHorizon
 * @copyright SrTeb Limited
 * @website https://srteb.eu
 * @version 1.5.0
 */

require_once __DIR__ . '/../config.php';

// Check database connection
$db = db();
if ($db === null) {
    http_response_code(503);
    die('Error de conexion a la base de datos');
}

// Check authentication
if (!isset($_SESSION['furrguard_admin']) || empty($_SESSION['furrguard_admin']['discord_id'])) {
    header('Location: index.php');
    exit;
}

// Validate session
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

// Get role if not set
if (empty($_SESSION['furrguard_admin']['role'])) {
    $role = getUserRole($_SESSION['furrguard_admin']['discord_id']);
    if ($role) {
        $_SESSION['furrguard_admin']['role'] = $role;
    } else {
        unset($_SESSION['furrguard_admin']);
        header('Location: index.php');
        exit;
    }
}

// Get UUID from URL
$uuid = $_GET['uuid'] ?? '';
$openConnection = $_GET['connection'] ?? null;

if (!$uuid || !validateUuid($uuid)) {
    header('Location: index.php');
    exit;
}

$user = $_SESSION['furrguard_admin'];
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FurrGuard - Visor de Jugador</title>
    <link rel="icon" type="image/png" href="../icono-furguard.png">
    <link rel="apple-touch-icon" href="../icono-furguard.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/admin.css?v=<?php echo filemtime(__DIR__ . '/assets/css/admin.css'); ?>">
    <link rel="stylesheet" href="assets/css/animations.css?v=<?php echo filemtime(__DIR__ . '/assets/css/animations.css'); ?>">
    <script src="https://unpkg.com/skinview3d/bundles/skinview3d.bundle.js"></script>
    <style>
        .player-page {
            min-height: 100vh;
            padding: 24px;
            padding-bottom: 0;
            position: relative;
            z-index: 1;
            display: flex;
            flex-direction: column;
        }
        .player-page-header {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 32px;
        }
        .back-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 16px;
            background: var(--bg-elevated);
            border: 1px solid var(--border-default);
            border-radius: var(--radius-md);
            color: var(--text-secondary);
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: all var(--transition-fast);
        }
        .back-btn:hover {
            background: var(--bg-hover);
            color: var(--text-primary);
            border-color: var(--purple-500);
        }
        .back-btn svg { width: 18px; height: 18px; }
        .player-page-title {
            font-size: 1.5rem;
            font-weight: 600;
            color: var(--text-primary);
        }
        .player-page-container {
            display: grid;
            grid-template-columns: 520px 1fr;
            gap: 24px;
            max-width: 1600px;
            margin: 0 auto;
            flex: 1;
            width: 100%;
        }
        @media (max-width: 1100px) {
            .player-page-container { grid-template-columns: 1fr; }
        }
        .skin-viewer-card {
            background: var(--bg-card);
            border: 1px solid var(--border-default);
            border-radius: var(--radius-xl);
            padding: 24px;
            backdrop-filter: blur(20px);
            position: sticky;
            top: 24px;
            min-width: 320px;
        }
        .skin-viewer-title {
            font-size: 0.875rem;
            font-weight: 600;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .skin-viewer-title svg { width: 16px; height: 16px; color: var(--purple-400); }
        #playerSkinViewer {
            width: 100%;
            height: 480px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: radial-gradient(ellipse at center, rgba(139, 92, 246, 0.1) 0%, transparent 70%);
            border-radius: var(--radius-lg);
            margin-bottom: 20px;
        }
        #playerSkinViewer canvas { border-radius: var(--radius-md); }
        .skin-viewer-name {
            text-align: center;
            font-size: 1.5rem;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 8px;
        }
        .skin-viewer-uuid {
            text-align: center;
            font-family: var(--font-mono);
            font-size: 0.75rem;
            color: var(--text-muted);
            word-break: break-all;
        }
        .player-data-card {
            background: var(--bg-card);
            border: 1px solid var(--border-default);
            border-radius: var(--radius-xl);
            padding: 24px;
            backdrop-filter: blur(20px);
        }
        .player-data-section { margin-bottom: 24px; }
        .player-data-section:last-child { margin-bottom: 0; }
        .player-data-section-title {
            font-size: 0.875rem;
            font-weight: 600;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--border-subtle);
        }
        .player-data-section-title svg { width: 16px; height: 16px; color: var(--purple-400); }
        .premium-status-box {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 16px;
            border-radius: var(--radius-md);
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.08);
            margin-bottom: 16px;
        }
        .premium-status-box.premium {
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%);
            border-color: rgba(16, 185, 129, 0.25);
        }
        .premium-status-box.not-premium {
            background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%);
            border-color: rgba(239, 68, 68, 0.25);
        }
        .premium-avatar img { width: 56px; height: 56px; border-radius: var(--radius-sm); }
        .premium-avatar-placeholder {
            width: 56px;
            height: 56px;
            border-radius: var(--radius-sm);
            background: linear-gradient(135deg, var(--purple-500) 0%, var(--magenta-500) 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 1.5rem;
            color: white;
        }
        .premium-info { flex: 1; }
        .premium-name { font-size: 1.125rem; font-weight: 600; color: var(--text-primary); }
        .premium-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            margin-top: 4px;
        }
        .premium-status-box.premium .premium-badge { background: rgba(16, 185, 129, 0.15); color: #10b981; }
        .premium-status-box.not-premium .premium-badge { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
        .premium-uuid { font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-muted); margin-top: 4px; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
        .info-item {
            background: rgba(255,255,255,0.02);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-sm);
            padding: 12px;
        }
        .info-label { font-size: 0.7rem; font-weight: 500; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
        .info-value { font-size: 0.9rem; font-weight: 500; color: var(--text-primary); }
        .info-value.status-online { color: var(--success); }
        .info-value.status-offline { color: var(--text-muted); }
        .info-value.whitelisted { color: var(--success); }
        .info-value.blacklisted { color: var(--error); }
        .action-buttons { display: flex; gap: 12px; margin-top: 20px; flex-wrap: wrap; }
        .action-buttons .btn { flex: 1; min-width: 140px; }
        .history-list { max-height: 200px; overflow-y: auto; }
        .history-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 12px;
            background: rgba(255,255,255,0.02);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-sm);
            margin-bottom: 8px;
            cursor: pointer;
            transition: all var(--transition-fast);
        }
        .history-item:hover { background: var(--bg-hover); border-color: var(--purple-500); }
        .history-item-avatar { width: 28px; height: 28px; border-radius: 4px; }
        .history-item-content { flex: 1; min-width: 0; }
        .history-item-value { font-size: 0.875rem; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .history-item-meta { display: flex; gap: 12px; font-size: 0.75rem; color: var(--text-muted); }
        .history-item-date { font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; }
        .connections-table { width: 100%; border-collapse: collapse; }
        .connections-table th { text-align: left; padding: 12px; font-size: 0.7rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--border-subtle); }
        .connections-table td { padding: 12px; font-size: 0.875rem; color: var(--text-primary); border-bottom: 1px solid var(--border-subtle); }
        .connections-table tr:hover td { background: var(--bg-hover); }
        .connections-table .status-allowed { color: var(--success); }
        .connections-table .status-blocked { color: var(--error); }
        .view-connection-btn {
            padding: 6px 12px;
            background: var(--bg-elevated);
            border: 1px solid var(--border-default);
            border-radius: var(--radius-xs);
            color: var(--text-secondary);
            font-size: 0.75rem;
            cursor: pointer;
            transition: all var(--transition-fast);
        }
        .view-connection-btn:hover { background: var(--purple-500); border-color: var(--purple-500); color: white; }
        .loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px; color: var(--text-muted); }
        .loading-spinner { width: 40px; height: 40px; border: 3px solid var(--border-default); border-top-color: var(--purple-500); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 16px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .empty-state { text-align: center; padding: 40px; color: var(--text-muted); }
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px 16px;
            border-radius: var(--radius-sm);
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: all var(--transition-fast);
            border: none;
            text-decoration: none;
        }
        .btn svg { width: 16px; height: 16px; }
        .btn-primary { background: var(--gradient-primary); color: white; }
        .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-success { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; }
        .btn-success:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-danger { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; }
        .btn-danger:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-ghost { background: transparent; border: 1px solid var(--border-default); color: var(--text-secondary); }
        .btn-ghost:hover { background: var(--bg-hover); color: var(--text-primary); }

        /* Modals */
        .modal {
            position: fixed;
            inset: 0;
            z-index: 1000;
            display: none;
            align-items: center;
            justify-content: center;
        }
        .modal.active { display: flex; }
        .modal .modal-overlay {
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(4px);
        }
        .modal .modal-content {
            position: relative;
            width: 90%;
            max-width: 500px;
            max-height: 90vh;
            background: var(--bg-secondary);
            border: 1px solid var(--border-default);
            border-radius: var(--radius-xl);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            animation: modalSlideIn 0.3s ease;
        }
        @keyframes modalSlideIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .modal .modal-header {
            padding: 20px 24px;
            border-bottom: 1px solid var(--border-subtle);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .modal .modal-header h2 {
            font-size: 1.125rem;
            font-weight: 600;
            color: var(--text-primary);
            margin: 0;
        }
        .modal .modal-close {
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: transparent;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            border-radius: var(--radius-xs);
            font-size: 1.5rem;
            transition: all var(--transition-fast);
        }
        .modal .modal-close:hover { background: var(--bg-hover); color: var(--text-primary); }
        .modal .modal-body { padding: 24px; overflow-y: auto; flex: 1; }
        .modal .modal-footer {
            padding: 16px 24px;
            border-top: 1px solid var(--border-subtle);
            display: flex;
            gap: 12px;
            justify-content: flex-end;
        }
        .form-group { margin-bottom: 16px; }
        .form-group label {
            display: block;
            font-size: 0.875rem;
            font-weight: 500;
            color: var(--text-primary);
            margin-bottom: 8px;
        }
        .form-input {
            width: 100%;
            padding: 10px 14px;
            background: var(--bg-elevated);
            border: 1px solid var(--border-default);
            border-radius: var(--radius-sm);
            color: var(--text-primary);
            font-size: 0.875rem;
            transition: all var(--transition-fast);
            box-sizing: border-box;
        }
        .form-input:focus { outline: none; border-color: var(--purple-500); box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1); }
        .form-textarea {
            width: 100%;
            padding: 10px 14px;
            background: var(--bg-elevated);
            border: 1px solid var(--border-default);
            border-radius: var(--radius-sm);
            color: var(--text-primary);
            font-size: 0.875rem;
            min-height: 80px;
            resize: vertical;
            font-family: inherit;
            box-sizing: border-box;
        }
        .form-textarea:focus { outline: none; border-color: var(--purple-500); }
        .form-help {
            display: block;
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-top: 6px;
        }
        .toggle {
            position: relative;
            display: inline-block;
            width: 44px;
            height: 24px;
        }
        .toggle input { opacity: 0; width: 0; height: 0; }
        .toggle-slider {
            position: absolute;
            cursor: pointer;
            inset: 0;
            background: var(--bg-elevated);
            border: 1px solid var(--border-default);
            border-radius: 24px;
            transition: all var(--transition-fast);
        }
        .toggle-slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 2px;
            bottom: 2px;
            background: var(--text-muted);
            border-radius: 50%;
            transition: all var(--transition-fast);
        }
        .toggle input:checked + .toggle-slider { background: var(--purple-500); border-color: var(--purple-500); }
        .toggle input:checked + .toggle-slider:before { transform: translateX(20px); background: white; }

        /* Connection Detail Modal */
        #connectionModal {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(4px);
            z-index: 1000;
            opacity: 0;
            visibility: hidden;
            transition: all var(--transition-normal);
        }
        #connectionModal.active { opacity: 1; visibility: visible; }
        #connectionModalContainer {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.95);
            width: 90%;
            max-width: 500px;
            max-height: 90vh;
            background: var(--bg-secondary);
            border: 1px solid var(--border-default);
            border-radius: var(--radius-xl);
            z-index: 1001;
            opacity: 0;
            visibility: hidden;
            transition: all var(--transition-normal);
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        #connectionModalContainer.active { opacity: 1; visibility: visible; transform: translate(-50%, -50%) scale(1); }
        .modal-body-content { padding: 24px; overflow-y: auto; flex: 1; }
        .connection-detail-grid { display: grid; gap: 12px; }
        .connection-detail-item { display: flex; justify-content: space-between; padding: 12px; background: rgba(255,255,255,0.02); border-radius: var(--radius-sm); }
        .connection-detail-label { font-size: 0.8rem; color: var(--text-muted); }
        .connection-detail-value { font-size: 0.875rem; font-weight: 500; color: var(--text-primary); }

        .toast-container { position: fixed; bottom: 24px; right: 24px; z-index: 2000; display: flex; flex-direction: column; gap: 8px; }
        .toast {
            padding: 12px 20px;
            background: var(--bg-elevated);
            border: 1px solid var(--border-default);
            border-radius: var(--radius-md);
            color: var(--text-primary);
            font-size: 0.875rem;
            animation: slideInRight 0.3s var(--ease-default);
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .toast.success { border-color: var(--success); }
        .toast.error { border-color: var(--error); }
        .toast.warning { border-color: var(--warning); }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
        .country-flag { display: inline-flex; align-items: center; gap: 6px; }
        .country-flag img { width: 18px; height: 12px; border-radius: 2px; object-fit: cover; }

        /* Blacklist Modal Tabs */
        .modal-tabs { display: flex; gap: 5px; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; }
        .modal-tab { flex: 1; padding: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: rgba(255,255,255,0.6); cursor: pointer; transition: all 0.2s; }
        .modal-tab.active { background: rgba(99,102,241,0.2); border: 1px solid rgba(99,102,241,0.3); color: #fff; }
        .bl-tab-content { display: none; }
        .bl-tab-content.active { display: block; }
        .btn-secondary { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: var(--text-primary); padding: 10px 15px; border-radius: var(--radius-sm); cursor: pointer; }
        .btn-secondary:hover { background: rgba(255,255,255,0.15); }
        .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
        .setting-label { font-weight: 500; color: var(--text-primary); }
        .setting-desc { display: block; font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; }

        /* Footer */
        .player-footer {
            padding: 16px 28px;
            border-top: 1px solid var(--border-subtle);
            background: rgba(8, 8, 12, 0.5);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            flex-wrap: wrap;
            margin-top: auto;
        }
        .player-footer .footer-left {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .player-footer .footer-brand {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .player-footer .footer-brand-logo {
            width: 24px;
            height: 24px;
            background: var(--gradient-primary);
            border-radius: var(--radius-xs);
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .player-footer .footer-brand-logo img {
            width: 14px;
            height: 14px;
            object-fit: contain;
        }
        .player-footer .footer-brand-name {
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--text-primary);
        }
        .player-footer .footer-copyright {
            font-size: 0.75rem;
            color: var(--text-muted);
        }
        .player-footer .footer-right {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .player-footer .footer-links {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .player-footer .footer-link {
            font-size: 0.75rem;
            color: var(--text-muted);
            text-decoration: none;
            transition: var(--transition-normal);
        }
        .player-footer .footer-link:hover {
            color: var(--purple-400);
        }
        .player-footer .footer-status {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            background: var(--success-dim);
            border-radius: 100px;
            font-size: 0.7rem;
            font-weight: 600;
            color: var(--success);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .player-footer .footer-status::before {
            content: '';
            width: 6px;
            height: 6px;
            background: currentColor;
            border-radius: 50%;
            animation: statusPulse 2s infinite;
        }
        @keyframes statusPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        @media (max-width: 600px) {
            .player-footer {
                flex-direction: column;
                text-align: center;
                padding: 14px 16px;
            }
            .player-footer .footer-left,
            .player-footer .footer-right {
                flex-direction: column;
                gap: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="bg-effects"><div class="noise"></div></div>

    <div class="player-page">
        <div class="player-page-header">
            <a href="index.php" class="back-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                Volver al Panel
            </a>
            <h1 class="player-page-title">Visor de Jugador</h1>
        </div>

        <div class="player-page-container">
            <div class="skin-viewer-card">
                <div class="skin-viewer-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="8" r="4"/>
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    </svg>
                    Skin del Jugador
                </div>
                <div id="playerSkinViewer"><div class="loading-spinner"></div></div>
                <div class="skin-viewer-name" id="playerName">Cargando...</div>
                <div class="skin-viewer-uuid" id="playerUuid"></div>
                <div class="action-buttons" id="playerActions"></div>
            </div>

            <div class="player-data-card">
                <div id="playerDataContent">
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <span>Cargando datos del jugador...</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Connection Modal -->
    <div id="connectionModal"></div>
    <div id="connectionModalContainer">
        <div class="modal-header">
            <h3 class="modal-title" style="font-size:1.125rem;font-weight:600;color:var(--text-primary);">Detalle de Conexion</h3>
            <button class="modal-close" onclick="closeConnectionModal()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>
        </div>
        <div class="modal-body-content" id="connectionModalBody"></div>
        <div class="modal-footer" id="connectionModalFooter"></div>
    </div>

    <!-- Whitelist Modal -->
    <div id="whitelistModal" class="modal">
        <div class="modal-overlay" onclick="closeModal('whitelistModal')"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Anadir a Whitelist</h2>
                <button class="modal-close" onclick="closeModal('whitelistModal')">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Tipo</label>
                    <select class="form-input" id="wlType">
                        <option value="uuid">UUID</option>
                        <option value="nick">Nick</option>
                        <option value="ip">IP</option>
                        <option value="ip_range">Rango IP (CIDR)</option>
                        <option value="as">Numero AS</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Valor</label>
                    <input type="text" class="form-input" id="wlValue" placeholder="Introduce el valor...">
                    <span class="form-help">UUID, nick, IP, rango CIDR (ej: 192.168.1.0/24) o numero AS (ej: AS12345)</span>
                </div>
                <div class="form-group">
                    <label>Razon (opcional)</label>
                    <textarea class="form-textarea" id="wlReason" placeholder="Razon para anadir a whitelist..."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-ghost" onclick="closeModal('whitelistModal')">Cancelar</button>
                <button class="btn btn-success" onclick="confirmWhitelist()">Anadir</button>
            </div>
        </div>
    </div>

    <!-- Blacklist Modal -->
    <div id="blacklistModal" class="modal">
        <div class="modal-overlay" onclick="closeModal('blacklistModal')"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Anadir a Blacklist</h2>
                <button class="modal-close" onclick="closeModal('blacklistModal')">&times;</button>
            </div>
            <div class="modal-body">
                <div class="modal-tabs">
                    <button type="button" class="modal-tab active" data-tab="player">Jugador</button>
                    <button type="button" class="modal-tab" data-tab="other">IP / AS / CIDR</button>
                </div>

                <!-- Tab: Jugador -->
                <div id="blTabPlayer" class="bl-tab-content active">
                    <div class="form-group">
                        <label>Nombre del Jugador</label>
                        <div style="display:flex;gap:10px;">
                            <input type="text" class="form-input" id="blPlayerName" placeholder="Introduce el nick del jugador..." style="flex:1;">
                            <button type="button" class="btn-secondary" id="blLookupBtn">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" style="vertical-align:middle;margin-right:5px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                Verificar
                            </button>
                        </div>
                        <span class="form-help">El sistema detectara automaticamente si es premium o no-premium</span>
                    </div>

                    <div id="blLookupResult" style="display:none;margin-bottom:20px;padding:15px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);">
                        <div style="display:flex;align-items:center;gap:15px;">
                            <div id="blPlayerAvatar" style="width:48px;height:48px;border-radius:8px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:bold;color:#fff;">?</div>
                            <div style="flex:1;">
                                <div style="display:flex;align-items:center;gap:10px;margin-bottom:5px;">
                                    <span id="blPlayerNameDisplay" style="font-weight:600;font-size:16px;">-</span>
                                    <span id="blPremiumBadge" style="display:none;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase;">Premium</span>
                                </div>
                                <div id="blPlayerUuid" style="font-family:monospace;font-size:12px;color:rgba(255,255,255,0.5);">-</div>
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Razon</label>
                        <textarea class="form-textarea" id="blReason" placeholder="Razon para bloquear..."></textarea>
                    </div>
                    <div class="form-group">
                        <label>Duracion</label>
                        <select class="form-input" id="blDuration">
                            <option value="0">Permanente</option>
                            <option value="60">1 hora</option>
                            <option value="360">6 horas</option>
                            <option value="720">12 horas</option>
                            <option value="1440">24 horas</option>
                            <option value="10080">7 dias</option>
                            <option value="43200">30 dias</option>
                            <option value="custom">Personalizado</option>
                        </select>
                    </div>
                    <div class="form-group" id="blCustomDurationGroup" style="display:none;">
                        <label>Duracion personalizada (minutos)</label>
                        <input type="number" class="form-input" id="blCustomDuration" placeholder="Minutos" min="1">
                    </div>
                    <div class="form-group" style="display:flex;align-items:center;gap:10px;margin-top:10px;">
                        <label class="toggle" style="margin:0;">
                            <input type="checkbox" id="blStainIp" checked>
                            <span class="toggle-slider"></span>
                        </label>
                        <div style="flex:1;">
                            <span class="setting-label">Manchar IP automaticamente</span>
                            <span class="setting-desc">Tambien anadira las IPs usadas por este jugador a la blacklist</span>
                        </div>
                    </div>
                </div>

                <!-- Tab: Otros tipos -->
                <div id="blTabOther" class="bl-tab-content">
                    <div class="form-group">
                        <label>Tipo</label>
                        <select class="form-input" id="blType">
                            <option value="ip">IP</option>
                            <option value="ip_range">Rango IP (CIDR)</option>
                            <option value="as">Numero AS</option>
                        </select>
                        <span class="form-help" id="blTypeHelp">Direccion IP especifica</span>
                    </div>
                    <div class="form-group">
                        <label>Valor</label>
                        <input type="text" class="form-input" id="blValue" placeholder="Introduce el valor...">
                        <span class="form-help" id="blValueHelp">Direccion IPv4 o IPv6 (ej: 192.168.1.1)</span>
                    </div>
                    <div class="form-group">
                        <label>Razon</label>
                        <textarea class="form-textarea" id="blReasonOther" placeholder="Razon para bloquear..."></textarea>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-ghost" onclick="closeModal('blacklistModal')">Cancelar</button>
                <button class="btn btn-danger" onclick="confirmBlacklist()">Bloquear</button>
            </div>
        </div>
    </div>

    <div class="toast-container" id="toastContainer"></div>

    <!-- Footer -->
    <footer class="player-footer">
        <div class="footer-left">
            <div class="footer-brand">
                <div class="footer-brand-logo">
                    <img src="../icono-furguard.png" alt="FurrGuard">
                </div>
                <span class="footer-brand-name">FurrGuard</span>
            </div>
            <span class="footer-copyright">&copy; <?php echo date('Y'); ?> SrTeb Limited</span>
        </div>
        <div class="footer-right">
            <div class="footer-links">
                <a href="https://srteb.eu" target="_blank" class="footer-link">SrTeb</a>
            </div>
            <div class="footer-status">
                Online
            </div>
        </div>
    </footer>

    <script>
        const API_URL = 'api.php';
        let skinViewer = null;
        let currentPlayerUuid = <?php echo json_encode($uuid); ?>;
        let openConnectionId = <?php echo $openConnection ? (int)$openConnection : 'null'; ?>;
        let playerData = null;
        let premiumInfo = null;
        let lookedUpPlayer = null;
        let nameHistoryData = null;

        document.addEventListener('DOMContentLoaded', () => {
            loadPlayerData();
            initBlacklistModalTabs();
        });

        async function apiRequest(action, data = {}) {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...data })
            });
            if (response.status === 401) {
                localStorage.removeItem('furrguard_session');
                showToast('Sesion expirada. Redirigiendo...', 'warning');
                setTimeout(() => window.location.href = 'index.php', 1500);
                throw new Error('Unauthorized');
            }
            return response.json();
        }

        function escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function formatDate(dateStr) {
            if (!dateStr) return 'N/A';
            const date = new Date(dateStr);
            return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        }

        function showToast(message, type = 'info') {
            const container = document.getElementById('toastContainer');
            const toast = document.createElement('div');
            toast.className = 'toast ' + type;
            toast.textContent = message;
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 4000);
        }

        function closeModal(modalId) {
            document.getElementById(modalId).classList.remove('active');
        }

        async function loadPlayerData() {
            try {
                const playerResponse = await apiRequest('get_player_detail', { uuid: currentPlayerUuid });
                if (!playerResponse.success) {
                    document.getElementById('playerDataContent').innerHTML = '<div class="empty-state"><p>Jugador no encontrado</p><a href="index.php" class="btn btn-primary" style="margin-top:16px">Volver al Panel</a></div>';
                    return;
                }
                playerData = playerResponse.data;
                const player = playerData.player;

                try {
                    const lookup = await apiRequest('lookup_player', { player_name: player.last_nick });
                    if (lookup.success) premiumInfo = lookup.data;
                } catch (e) { console.log('Could not verify premium status'); }

                if (!premiumInfo) premiumInfo = { is_premium: false, uuid: player.uuid, name: player.last_nick };

                document.getElementById('playerName').textContent = player.last_nick;
                document.getElementById('playerUuid').textContent = player.uuid;
                initSkinViewer(player.last_nick);
                renderPlayerData();

                if (openConnectionId) setTimeout(() => showConnectionDetail(openConnectionId), 500);
            } catch (error) {
                console.error('Error loading player:', error);
                document.getElementById('playerDataContent').innerHTML = '<div class="empty-state"><p>Error al cargar datos del jugador</p></div>';
            }
        }

        function initSkinViewer(nick) {
            const container = document.getElementById('playerSkinViewer');
            if (!container || typeof skinview3d === 'undefined') {
                container.innerHTML = '<img src="https://mineskin.eu/avatar/' + encodeURIComponent(nick) + '/200.png" style="border-radius:8px">';
                return;
            }
            if (skinViewer) skinViewer.dispose();
            skinViewer = new skinview3d.SkinViewer({
                canvas: document.createElement('canvas'),
                width: 350,
                height: 450,
                skin: 'https://mineskin.eu/skin/' + nick
            });
            container.innerHTML = '';
            container.appendChild(skinViewer.canvas);
            skinViewer.camera.position.set(0, 0, 55);
            skinViewer.autoRotate = true;
            skinViewer.autoRotateSpeed = 1;
            skinViewer.animation = new skinview3d.WalkingAnimation();
            skinViewer.animation.speed = 0.5;
            skinViewer.controls.enableRotate = true;
            skinViewer.controls.enableZoom = true;
        }

        function renderPlayerData() {
            const player = playerData.player;
            const ips = playerData.ips || [];

            let premiumBoxHtml = '';
            if (premiumInfo.is_premium) {
                premiumBoxHtml = '<div class="premium-status-box premium"><div class="premium-avatar"><img src="https://mineskin.eu/avatar/' + encodeURIComponent(premiumInfo.name) + '/56.png" alt=""></div><div class="premium-info"><div class="premium-name">' + escapeHtml(premiumInfo.name) + '</div><div class="premium-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;margin-right:4px;color:#10b981;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Premium Verificado</div><div class="premium-uuid">UUID: ' + (premiumInfo.uuid || player.uuid) + '</div></div></div>';
            } else {
                premiumBoxHtml = '<div class="premium-status-box not-premium"><div class="premium-avatar"><div class="premium-avatar-placeholder">' + player.last_nick.charAt(0).toUpperCase() + '</div></div><div class="premium-info"><div class="premium-name">' + escapeHtml(player.last_nick) + '</div><div class="premium-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;margin-right:4px;color:#ef4444;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>No Premium (Offline)</div><div class="premium-uuid">Bloquear por Nick, no por UUID</div></div></div>';
            }

            const statusClass = player.is_online ? 'status-online' : 'status-offline';
            const statusText = player.is_online ? 'Online' : 'Offline';
            let wlClass = '', wlText = 'No';
            if (player.is_whitelisted) { wlClass = 'whitelisted'; wlText = 'Si'; }
            let blClass = '', blText = 'No';
            if (player.is_blacklisted) { blClass = 'blacklisted'; blText = 'Si'; }

            let ipsHtml = ips.length > 0 ? ips.map(ip => '<div class="history-item"><div class="history-item-content"><div class="history-item-value">' + escapeHtml(ip.ip) + '</div><div class="history-item-meta">' + (ip.country ? '<span class="country-flag"><img src="https://flagcdn.com/16x12/' + (ip.country_code?.toLowerCase() || 'xx') + '.png" alt="">' + ip.country + '</span>' : '') + '</div></div><div class="history-item-date">' + formatDate(ip.first_used) + '</div></div>').join('') : '<div class="empty-state" style="padding:20px">Sin historial de IPs</div>';

            document.getElementById('playerDataContent').innerHTML =
                '<div class="player-data-section"><div class="player-data-section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Estado de Cuenta</div>' + premiumBoxHtml + '</div>' +
                '<div class="player-data-section"><div class="player-data-section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>Informacion General</div><div class="info-grid"><div class="info-item"><div class="info-label">Estado</div><div class="info-value ' + statusClass + '">' + statusText + '</div></div><div class="info-item"><div class="info-label">Whitelisted</div><div class="info-value ' + wlClass + '">' + wlText + '</div></div><div class="info-item"><div class="info-label">Blacklisted</div><div class="info-value ' + blClass + '">' + blText + '</div></div><div class="info-item"><div class="info-label">Conexiones</div><div class="info-value">' + (player.total_connections || 0) + '</div></div><div class="info-item"><div class="info-label">Primera vez</div><div class="info-value">' + formatDate(player.first_seen) + '</div></div><div class="info-item"><div class="info-label">Ultima vez</div><div class="info-value">' + formatDate(player.last_seen) + '</div></div><div class="info-item"><div class="info-label">Ultima IP</div><div class="info-value">' + (player.last_ip || 'N/A') + '</div></div><div class="info-item"><div class="info-label">Ultimo Pais</div><div class="info-value">' + (player.last_country || 'Desconocido') + '</div></div></div></div>' +
                '<div class="player-data-section"><div class="player-data-section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/><path d="M3 3l18 18"/></svg>Historial de Nombres</div><div id="nameHistoryContent"><div class="loading-spinner" style="margin:20px auto"></div></div></div>' +
                '<div class="player-data-section"><div class="player-data-section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>Historial de IPs (' + ips.length + ')</div><div class="history-list">' + ipsHtml + '</div></div>' +
                '<div class="player-data-section"><div class="player-data-section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Ultimas Conexiones</div><div id="connectionsContent"><div class="loading-spinner" style="margin:20px auto"></div></div></div>';

            loadPlayerConnections();
            loadNameHistory();
            updateActionButtons();
        }

        async function loadNameHistory() {
            const playerName = playerData.player.last_nick;
            const container = document.getElementById('nameHistoryContent');
            if (!container) return;

            container.innerHTML = '<div class="loading-spinner" style="margin:20px auto"></div>';

            try {
                const response = await apiRequest('get_name_history', { player_name: playerName });
                if (response.success && response.data && response.data.history) {
                    nameHistoryData = response.data;
                    renderNameHistory(response.data);
                } else {
                    container.innerHTML = '<div class="empty-state" style="padding:20px;color:var(--text-muted)">No hay historial disponible</div>';
                }
            } catch (error) {
                console.error('Error loading name history:', error);
                container.innerHTML = '<div class="empty-state" style="padding:20px;color:var(--text-muted)">Error al cargar historial</div>';
            }
        }

        function renderNameHistory(data) {
            const container = document.getElementById('nameHistoryContent');
            if (!container || !data || !data.history) return;

            const history = data.history;
            const currentName = playerData.player.last_nick;

            if (history.length === 0) {
                container.innerHTML = '<div class="empty-state" style="padding:20px;color:var(--text-muted)">Sin historial de cambios</div>';
                return;
            }

            // Sort by changed_at descending (newest first), with current name at top
            const sortedHistory = [...history].sort((a, b) => {
                // Current name first
                if (a.name === currentName && b.name !== currentName) return -1;
                if (b.name === currentName && a.name !== currentName) return 1;
                // Then sort by changed_at descending (most recent first)
                const dateA = a.changed_at ? new Date(a.changed_at).getTime() : 0;
                const dateB = b.changed_at ? new Date(b.changed_at).getTime() : 0;
                return dateB - dateA;
            });

            container.innerHTML = '<div class="history-list"></div>';
            const listContainer = container.querySelector('.history-list');

            sortedHistory.forEach((entry) => {
                const isCurrent = entry.name === currentName;
                const changeDate = entry.changed_at ? formatDate(entry.changed_at) : 'Original';

                const item = document.createElement('div');
                item.className = 'history-item';
                if (isCurrent) {
                    item.style.borderColor = 'var(--purple-500)';
                    item.style.background = 'rgba(139,92,246,0.05)';
                }

                const avatar = document.createElement('img');
                avatar.src = 'https://mineskin.eu/avatar/' + encodeURIComponent(entry.name) + '/28.png';
                avatar.className = 'history-item-avatar';
                avatar.alt = '';
                avatar.onerror = function() {
                    this.style.display = 'none';
                    const placeholder = document.createElement('div');
                    placeholder.className = 'history-item-avatar';
                    placeholder.style.cssText = 'background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:#fff;';
                    placeholder.textContent = entry.name.charAt(0).toUpperCase();
                    this.parentNode.insertBefore(placeholder, this);
                };

                const content = document.createElement('div');
                content.className = 'history-item-content';

                const value = document.createElement('div');
                value.className = 'history-item-value';
                value.textContent = entry.name;

                if (isCurrent) {
                    const badge = document.createElement('span');
                    badge.style.cssText = 'color:var(--success);margin-left:8px;font-size:0.7rem';
                    badge.textContent = '(Actual)';
                    value.appendChild(badge);
                }

                if (entry.censored) {
                    const censoredBadge = document.createElement('span');
                    censoredBadge.style.cssText = 'color:var(--warning);margin-left:8px;font-size:0.7rem';
                    censoredBadge.textContent = '(Censurado)';
                    value.appendChild(censoredBadge);
                }

                const date = document.createElement('div');
                date.className = 'history-item-date';
                date.textContent = changeDate;

                content.appendChild(value);
                content.appendChild(date);

                item.appendChild(avatar);
                item.appendChild(content);
                listContainer.appendChild(item);
            });
        }

        async function loadPlayerConnections(page) {
            page = page || 1;
            try {
                const response = await apiRequest('get_connections', { page: page, search: playerData.player.last_nick, filter: 'all' });
                if (response.success) renderConnections(response.data.connections, response.data.pagination);
            } catch (error) {
                console.error('Error loading connections:', error);
                document.getElementById('connectionsContent').innerHTML = '<div class="empty-state">Error al cargar conexiones</div>';
            }
        }

        function renderConnections(connections, pagination) {
            const playerConns = connections.filter(c => c.uuid === currentPlayerUuid || c.nick === playerData.player.last_nick);
            if (playerConns.length === 0) {
                document.getElementById('connectionsContent').innerHTML = '<div class="empty-state">Sin conexiones recientes</div>';
                return;
            }
            let tbodyHtml = playerConns.map(c => '<tr><td>' + formatDate(c.created_at) + '</td><td>' + escapeHtml(c.ip) + '</td><td>' + (c.country ? '<span class="country-flag"><img src="https://flagcdn.com/16x12/' + (c.country_code?.toLowerCase() || 'xx') + '.png" alt="">' + c.country + '</span>' : 'N/A') + '</td><td><span class="' + (c.blocked ? 'status-blocked' : 'status-allowed') + '">' + (c.blocked ? 'Bloqueado' : 'Permitido') + '</span></td><td><button class="view-connection-btn" onclick="showConnectionDetail(' + c.id + ')">Ver</button></td></tr>').join('');
            document.getElementById('connectionsContent').innerHTML = '<table class="connections-table"><thead><tr><th>Fecha</th><th>IP</th><th>Pais</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>' + tbodyHtml + '</tbody></table>';
        }

        async function showConnectionDetail(connectionId) {
            const modal = document.getElementById('connectionModal');
            const container = document.getElementById('connectionModalContainer');
            const body = document.getElementById('connectionModalBody');
            const footer = document.getElementById('connectionModalFooter');
            modal.classList.add('active');
            container.classList.add('active');
            body.innerHTML = '<div class="loading-spinner" style="margin:40px auto"></div>';
            footer.innerHTML = '';
            try {
                const response = await apiRequest('get_connection_detail', { id: connectionId });
                if (response.success) {
                    const c = response.data.connection;
                    body.innerHTML = '<div class="connection-detail-grid"><div class="connection-detail-item"><span class="connection-detail-label">Nick</span><span class="connection-detail-value">' + escapeHtml(c.nick) + '</span></div><div class="connection-detail-item"><span class="connection-detail-label">UUID</span><span class="connection-detail-value" style="font-family:var(--font-mono);font-size:0.75rem">' + (c.uuid || 'N/A') + '</span></div><div class="connection-detail-item"><span class="connection-detail-label">IP</span><span class="connection-detail-value">' + escapeHtml(c.ip) + '</span></div><div class="connection-detail-item"><span class="connection-detail-label">Pais</span><span class="connection-detail-value">' + (c.country ? '<span class="country-flag"><img src="https://flagcdn.com/16x12/' + (c.country_code?.toLowerCase() || 'xx') + '.png" alt="">' + c.country + '</span>' : 'N/A') + '</span></div><div class="connection-detail-item"><span class="connection-detail-label">ISP</span><span class="connection-detail-value">' + (c.isp || 'N/A') + '</span></div><div class="connection-detail-item"><span class="connection-detail-label">ASN</span><span class="connection-detail-value">' + (c.asn || 'N/A') + '</span></div><div class="connection-detail-item"><span class="connection-detail-label">Proxy</span><span class="connection-detail-value ' + (c.is_proxy ? 'status-blocked' : 'status-allowed') + '">' + (c.is_proxy ? 'Si' : 'No') + '</span></div><div class="connection-detail-item"><span class="connection-detail-label">VPN</span><span class="connection-detail-value ' + (c.is_vpn ? 'status-blocked' : 'status-allowed') + '">' + (c.is_vpn ? 'Si' : 'No') + '</span></div><div class="connection-detail-item"><span class="connection-detail-label">Hosting</span><span class="connection-detail-value ' + (c.is_hosting ? 'status-blocked' : 'status-allowed') + '">' + (c.is_hosting ? 'Si' : 'No') + '</span></div><div class="connection-detail-item"><span class="connection-detail-label">Estado</span><span class="connection-detail-value ' + (c.blocked ? 'status-blocked' : 'status-allowed') + '">' + (c.blocked ? 'Bloqueado' : 'Permitido') + '</span></div><div class="connection-detail-item"><span class="connection-detail-label">Fecha</span><span class="connection-detail-value">' + formatDate(c.created_at) + '</span></div></div>';
                    footer.innerHTML = '<button class="btn btn-ghost" onclick="closeConnectionModal()">Cerrar</button>';
                }
            } catch (error) {
                console.error('Error loading connection:', error);
                body.innerHTML = '<div class="empty-state">Error al cargar datos de la conexion</div>';
            }
        }

        function closeConnectionModal() {
            document.getElementById('connectionModal').classList.remove('active');
            document.getElementById('connectionModalContainer').classList.remove('active');
        }

        function updateActionButtons() {
            const player = playerData.player;
            const banInfo = getBanTypeForPlayer();
            const type = banInfo.type;
            const value = banInfo.value;
            let buttonsHtml = '';
            if (!player.is_whitelisted) {
                buttonsHtml += '<button class="btn btn-success" onclick="openWhitelist(\'' + escapeHtml(type) + '\', \'' + escapeHtml(value) + '\')">Anadir a Whitelist</button>';
            } else {
                buttonsHtml += '<button class="btn btn-ghost" onclick="removeFromWhitelist(\'' + escapeHtml(type) + '\', \'' + escapeHtml(value) + '\')">Quitar de Whitelist</button>';
            }
            if (!player.is_blacklisted) {
                buttonsHtml += '<button class="btn btn-danger" onclick="openBlacklist(\'' + escapeHtml(player.last_nick) + '\')">Anadir a Blacklist</button>';
            } else {
                buttonsHtml += '<button class="btn btn-ghost" onclick="removeFromBlacklist(\'' + escapeHtml(type) + '\', \'' + escapeHtml(value) + '\')">Quitar de Blacklist</button>';
            }
            document.getElementById('playerActions').innerHTML = buttonsHtml;
        }

        function getBanTypeForPlayer() {
            if (premiumInfo && premiumInfo.is_premium) return { type: 'uuid', value: premiumInfo.uuid || playerData.player.uuid };
            return { type: 'nick', value: playerData.player.last_nick };
        }

        function openWhitelist(type, value) {
            document.getElementById('wlType').value = type;
            document.getElementById('wlValue').value = value;
            document.getElementById('wlReason').value = '';
            document.getElementById('wlType').disabled = true;
            document.getElementById('wlValue').readOnly = true;
            document.getElementById('whitelistModal').classList.add('active');
        }

        function openBlacklist(playerName) {
            resetBlacklistModal();
            document.getElementById('blacklistModal').classList.add('active');
            document.getElementById('blPlayerName').value = playerName;
            // Auto-trigger lookup
            setTimeout(() => lookupPlayer(), 100);
        }

        function resetBlacklistModal() {
            lookedUpPlayer = null;
            document.getElementById('blPlayerName').value = '';
            document.getElementById('blLookupResult').style.display = 'none';
            document.getElementById('blPlayerAvatar').textContent = '?';
            document.getElementById('blPlayerAvatar').style.background = 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)';
            document.getElementById('blPlayerAvatar').style.display = 'flex';
            document.getElementById('blPremiumBadge').style.display = 'none';
            document.getElementById('blPlayerUuid').textContent = '-';
            document.getElementById('blPlayerNameDisplay').textContent = '-';
            document.getElementById('blReason').value = '';
            document.getElementById('blDuration').value = '0';
            document.getElementById('blCustomDurationGroup').style.display = 'none';
            document.getElementById('blCustomDuration').value = '';
            document.getElementById('blStainIp').checked = true;
            document.getElementById('blType').value = 'ip';
            document.getElementById('blValue').value = '';
            document.getElementById('blReasonOther').value = '';

            // Reset tabs to player
            document.querySelectorAll('.modal-tab').forEach(tab => {
                tab.classList.remove('active');
                tab.style.background = 'rgba(255,255,255,0.05)';
                tab.style.border = '1px solid rgba(255,255,255,0.1)';
                tab.style.color = 'rgba(255,255,255,0.6)';
                if (tab.dataset.tab === 'player') {
                    tab.classList.add('active');
                    tab.style.background = 'rgba(99,102,241,0.2)';
                    tab.style.border = '1px solid rgba(99,102,241,0.3)';
                    tab.style.color = '#fff';
                }
            });
            document.getElementById('blTabPlayer').style.display = 'block';
            document.getElementById('blTabOther').style.display = 'none';
        }

        function initBlacklistModalTabs() {
            const tabs = document.querySelectorAll('.modal-tab');
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    tabs.forEach(t => {
                        t.classList.remove('active');
                        t.style.background = 'rgba(255,255,255,0.05)';
                        t.style.border = '1px solid rgba(255,255,255,0.1)';
                        t.style.color = 'rgba(255,255,255,0.6)';
                    });
                    tab.classList.add('active');
                    tab.style.background = 'rgba(99,102,241,0.2)';
                    tab.style.border = '1px solid rgba(99,102,241,0.3)';
                    tab.style.color = '#fff';

                    const tabName = tab.dataset.tab;
                    document.getElementById('blTabPlayer').style.display = tabName === 'player' ? 'block' : 'none';
                    document.getElementById('blTabOther').style.display = tabName === 'other' ? 'block' : 'none';
                });
            });

            // Lookup button
            document.getElementById('blLookupBtn').addEventListener('click', lookupPlayer);

            // Enter key on player name input
            document.getElementById('blPlayerName').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    lookupPlayer();
                }
            });

            // Duration change
            document.getElementById('blDuration').addEventListener('change', () => {
                const custom = document.getElementById('blDuration').value === 'custom';
                document.getElementById('blCustomDurationGroup').style.display = custom ? 'block' : 'none';
                if (!custom) document.getElementById('blCustomDuration').value = '';
            });

            // Type change for other tab
            document.getElementById('blType').addEventListener('change', (e) => {
                const type = e.target.value;
                const helps = {
                    ip: { type: 'Direccion IP especifica', value: 'Direccion IPv4 o IPv6 (ej: 192.168.1.1)' },
                    ip_range: { type: 'Rango de IPs usando notacion CIDR', value: 'Rango CIDR (ej: 192.168.1.0/24)' },
                    as: { type: 'Numero de Sistema Autonomo', value: 'Numero AS (ej: AS12345 o 12345)' }
                };
                if (helps[type]) {
                    document.getElementById('blTypeHelp').textContent = helps[type].type;
                    document.getElementById('blValueHelp').textContent = helps[type].value;
                }
            });
        }

        async function lookupPlayer() {
            const playerName = document.getElementById('blPlayerName').value.trim();
            if (!playerName) {
                showToast('Introduce un nombre de jugador', 'error');
                return;
            }

            const lookupBtn = document.getElementById('blLookupBtn');
            const lookupResult = document.getElementById('blLookupResult');

            lookupBtn.disabled = true;
            lookupBtn.innerHTML = 'Buscando...';

            try {
                const response = await apiRequest('lookup_player', { player_name: playerName });
                lookupResult.style.display = 'block';

                if (response.success && response.data) {
                    const data = response.data;
                    lookedUpPlayer = data;

                    const avatarEl = document.getElementById('blPlayerAvatar');
                    if (data.is_premium && data.name) {
                        avatarEl.textContent = '';
                        avatarEl.style.background = 'transparent';
                        const img = document.createElement('img');
                        img.src = 'https://mineskin.eu/avatar/' + encodeURIComponent(data.name) + '/48.png';
                        img.style.cssText = 'width:48px;height:48px;border-radius:8px;display:block;';
                        img.alt = 'Avatar';
                        img.onerror = function() {
                            avatarEl.textContent = data.name.charAt(0).toUpperCase();
                            avatarEl.style.background = 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)';
                            avatarEl.style.display = 'flex';
                            avatarEl.style.alignItems = 'center';
                            avatarEl.style.justifyContent = 'center';
                        };
                        avatarEl.appendChild(img);
                    } else {
                        avatarEl.textContent = playerName.charAt(0).toUpperCase();
                        avatarEl.style.background = 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)';
                        avatarEl.style.display = 'flex';
                        avatarEl.style.alignItems = 'center';
                        avatarEl.style.justifyContent = 'center';
                    }

                    document.getElementById('blPlayerNameDisplay').textContent = data.name || playerName;

                    const badgeEl = document.getElementById('blPremiumBadge');
                    badgeEl.style.display = 'inline-block';
                    if (data.is_premium) {
                        badgeEl.textContent = 'Premium';
                        badgeEl.style.cssText = 'background:linear-gradient(135deg,#fbbf24 0%,#f59e0b 100%);color:#1a1a2e;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase;';
                    } else {
                        badgeEl.textContent = 'No Premium';
                        badgeEl.style.cssText = 'background:rgba(107,114,128,0.2);border:1px solid rgba(107,114,128,0.3);color:#9ca3af;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase;';
                    }

                    const uuidEl = document.getElementById('blPlayerUuid');
                    if (data.is_premium && data.uuid) {
                        uuidEl.textContent = data.uuid;
                        uuidEl.style.color = 'rgba(255,255,255,0.7)';
                    } else {
                        uuidEl.textContent = 'Jugador offline (sin UUID verificable)';
                        uuidEl.style.color = 'rgba(255,255,255,0.4)';
                    }

                    showToast((data.is_premium ? 'Premium' : 'No Premium') + ' detectado', 'success');
                } else {
                    lookedUpPlayer = null;
                    document.getElementById('blPlayerAvatar').textContent = '?';
                    document.getElementById('blPlayerNameDisplay').textContent = playerName;
                    document.getElementById('blPremiumBadge').style.display = 'none';
                    document.getElementById('blPlayerUuid').textContent = 'Jugador no encontrado';
                    document.getElementById('blPlayerUuid').style.color = 'rgba(255,100,100,0.7)';
                    showToast(response.error || 'Jugador no encontrado', 'error');
                }
            } catch (error) {
                lookedUpPlayer = null;
                showToast('Error al buscar jugador', 'error');
                lookupResult.style.display = 'none';
            } finally {
                lookupBtn.disabled = false;
                lookupBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" style="vertical-align:middle;margin-right:5px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>Verificar';
            }
        }

        async function confirmWhitelist() {
            const type = document.getElementById('wlType').value;
            const value = document.getElementById('wlValue').value.trim();
            const reason = document.getElementById('wlReason').value.trim();

            if (!value) {
                showToast('Introduce un valor', 'error');
                return;
            }

            try {
                const response = await apiRequest('add_whitelist', { type, value, reason });
                if (response.success) {
                    showToast('Anadido a whitelist', 'success');
                    closeModal('whitelistModal');
                    loadPlayerData();
                } else {
                    showToast(response.error || 'Error', 'error');
                }
            } catch (error) {
                showToast('Error al anadir a whitelist', 'error');
            }
        }

        async function confirmBlacklist() {
            const tabPlayer = document.getElementById('blTabPlayer');
            const isPlayerTab = tabPlayer && tabPlayer.style.display !== 'none';

            if (isPlayerTab) {
                if (!lookedUpPlayer) {
                    showToast('Primero verifica el jugador', 'error');
                    return;
                }

                const reason = document.getElementById('blReason').value.trim();
                const stainIp = document.getElementById('blStainIp').checked ? 1 : 0;

                let duration = parseInt(document.getElementById('blDuration').value) || 0;
                if (document.getElementById('blDuration').value === 'custom') {
                    duration = parseInt(document.getElementById('blCustomDuration').value) || 0;
                    if (duration <= 0) {
                        showToast('Introduce una duracion valida', 'error');
                        return;
                    }
                }

                try {
                    const response = await apiRequest('add_blacklist_unified', {
                        player_name: lookedUpPlayer.name,
                        is_premium: lookedUpPlayer.is_premium,
                        uuid: lookedUpPlayer.uuid,
                        reason: reason,
                        duration: duration,
                        stain_ip: stainIp
                    });

                    if (response.success) {
                        showToast('Jugador anadido a blacklist', 'success');
                        closeModal('blacklistModal');
                        loadPlayerData();
                        lookedUpPlayer = null;
                    } else {
                        showToast(response.error || 'Error al anadir', 'error');
                    }
                } catch (error) {
                    showToast('Error al anadir a blacklist', 'error');
                }
            } else {
                const type = document.getElementById('blType').value;
                const value = document.getElementById('blValue').value.trim();
                const reason = document.getElementById('blReasonOther').value.trim();

                if (!value) {
                    showToast('Introduce un valor', 'error');
                    return;
                }

                try {
                    const response = await apiRequest('add_blacklist', { type, value, reason, duration: 0, stain_ip: 0 });
                    if (response.success) {
                        showToast('Anadido a blacklist', 'success');
                        closeModal('blacklistModal');
                    } else {
                        showToast(response.error || 'Error', 'error');
                    }
                } catch (error) {
                    showToast('Error al anadir a blacklist', 'error');
                }
            }
        }

        async function removeFromWhitelist(type, value) {
            if (!confirm('¿Quitar este jugador de la whitelist?')) return;
            try {
                const response = await apiRequest('remove_whitelist_by_value', { type: type, value: value });
                if (response.success) { showToast('Eliminado de whitelist', 'success'); loadPlayerData(); }
                else showToast(response.error || 'Error', 'error');
            } catch (error) { showToast('Error al eliminar', 'error'); }
        }

        async function removeFromBlacklist(type, value) {
            if (!confirm('¿Quitar este jugador de la blacklist?\n\nLas IPs vinculadas también serán eliminadas automáticamente.')) return;
            try {
                const response = await apiRequest('remove_blacklist_by_value', { type: type, value: value });
                if (response.success) {
                    const msg = response.deleted_ips > 0
                        ? `Eliminado de blacklist (+${response.deleted_ips} IPs vinculadas)`
                        : 'Eliminado de blacklist';
                    showToast(msg, 'success');
                    loadPlayerData();
                }
                else showToast(response.error || 'Error', 'error');
            } catch (error) { showToast('Error al eliminar', 'error'); }
        }

        document.getElementById('connectionModal').addEventListener('click', closeConnectionModal);
        document.addEventListener('keydown', function(e) { if (e.key === 'Escape') { closeConnectionModal(); closeModal('whitelistModal'); closeModal('blacklistModal'); } });
    </script>
</body>
</html>
