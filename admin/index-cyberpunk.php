<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FurrGuard // Security Command Center</title>
    <link rel="icon" type="image/png" href="../icono-furguard.png">

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Rajdhani:wght@400;500;600;700&family=Orbitron:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">

    <!-- Cyberpunk Styles -->
    <link rel="stylesheet" href="assets/css/cyberpunk.css?v=2.0">
    <link rel="stylesheet" href="assets/css/animations.css?v=2.0">
</head>
<body>
    <!-- Background Effects -->
    <div class="cyber-grid"></div>
    <div class="scan-line"></div>
    <div class="hex-pattern"></div>

    <!-- App Container -->
    <div class="app-container page-load-sequence">

        <!-- Sidebar -->
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <div class="brand">
                    <div class="brand-logo">FG</div>
                    <div class="brand-info">
                        <div class="brand-name">FurrGuard</div>
                        <div class="brand-version">v2.0.77</div>
                    </div>
                </div>
            </div>

            <nav class="sidebar-nav">
                <div class="nav-section">
                    <div class="nav-section-title">Command Center</div>
                    <a href="#" class="nav-item active" data-section="overview">
                        <svg class="nav-icon" viewBox="0 0 24 24">
                            <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>
                        </svg>
                        <span class="nav-label">Dashboard</span>
                    </a>
                    <a href="#" class="nav-item" data-section="monitor">
                        <svg class="nav-icon" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                        <span class="nav-label">Live Monitor</span>
                        <span class="nav-badge">23</span>
                    </a>
                </div>

                <div class="nav-section">
                    <div class="nav-section-title">Network</div>
                    <a href="#" class="nav-item" data-section="players">
                        <svg class="nav-icon" viewBox="0 0 24 24">
                            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                        </svg>
                        <span class="nav-label">Players</span>
                        <span class="nav-badge">1.2K</span>
                    </a>
                    <a href="#" class="nav-item" data-section="connections">
                        <svg class="nav-icon" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                        </svg>
                        <span class="nav-label">Connections</span>
                    </a>
                    <a href="#" class="nav-item" data-section="ips">
                        <svg class="nav-icon" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                        </svg>
                        <span class="nav-label">IP Database</span>
                    </a>
                </div>

                <div class="nav-section">
                    <div class="nav-section-title">Security</div>
                    <a href="#" class="nav-item" data-section="whitelist">
                        <svg class="nav-icon" viewBox="0 0 24 24">
                            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                        </svg>
                        <span class="nav-label">Whitelist</span>
                        <span class="nav-badge">89</span>
                    </a>
                    <a href="#" class="nav-item" data-section="blacklist">
                        <svg class="nav-icon" viewBox="0 0 24 24">
                            <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
                        </svg>
                        <span class="nav-label">Blacklist</span>
                        <span class="nav-badge text-red">156</span>
                    </a>
                    <a href="#" class="nav-item" data-section="threats">
                        <svg class="nav-icon" viewBox="0 0 24 24">
                            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                        </svg>
                        <span class="nav-label">Threats</span>
                        <span class="nav-badge text-red">23</span>
                    </a>
                </div>

                <div class="nav-section">
                    <div class="nav-section-title">System</div>
                    <a href="#" class="nav-item" data-section="logs">
                        <svg class="nav-icon" viewBox="0 0 24 24">
                            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                        </svg>
                        <span class="nav-label">System Logs</span>
                    </a>
                    <a href="#" class="nav-item" data-section="settings">
                        <svg class="nav-icon" viewBox="0 0 24 24">
                            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                        </svg>
                        <span class="nav-label">Settings</span>
                    </a>
                </div>
            </nav>
        </aside>

        <!-- Main Content -->
        <main class="main-content">
            <!-- Top Bar -->
            <header class="top-bar">
                <h1 class="page-title" id="pageTitle">Dashboard</h1>
                <div class="top-bar-actions">
                    <div class="search-box">
                        <input type="text" placeholder="SEARCH_DATABASE..." id="globalSearch">
                    </div>
                    <button class="action-btn" id="refreshBtn" title="Refresh">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M23 4v6h-6M1 20v-6h6"/>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                        </svg>
                    </button>
                    <div class="user-profile">
                        <div class="user-avatar">
                            <img src="https://cdn.discordapp.com/avatars/USER/AVATAR.png" alt="User" id="userAvatar">
                        </div>
                        <div class="user-info">
                            <div class="user-name" id="userName">Admin</div>
                            <div class="user-role">COMMANDER</div>
                        </div>
                    </div>
                </div>
            </header>

            <!-- Content Area -->
            <div class="content-area" id="contentArea">

                <!-- Dashboard Overview -->
                <section class="section active" id="section-overview">
                    <!-- Stats Grid -->
                    <div class="stats-grid stagger-children">
                        <div class="stat-card cyan">
                            <div class="stat-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                </svg>
                            </div>
                            <div class="stat-value" data-counter="127">0</div>
                            <div class="stat-label">Players Online</div>
                        </div>

                        <div class="stat-card magenta">
                            <div class="stat-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                                </svg>
                            </div>
                            <div class="stat-value" data-counter="89">0</div>
                            <div class="stat-label">Threats Blocked</div>
                        </div>

                        <div class="stat-card red">
                            <div class="stat-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                                </svg>
                            </div>
                            <div class="stat-value" data-counter="12">0</div>
                            <div class="stat-label">Active Alerts</div>
                        </div>

                        <div class="stat-card green">
                            <div class="stat-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                                </svg>
                            </div>
                            <div class="stat-value" data-counter="4521">0</div>
                            <div class="stat-label">Total Scans</div>
                        </div>
                    </div>

                    <!-- Live Connections Panel -->
                    <div class="data-panel corner-decoration">
                        <div class="panel-header">
                            <h2 class="panel-title">LIVE_CONNECTIONS</h2>
                            <div class="panel-actions">
                                <button class="btn btn-primary">View All</button>
                            </div>
                        </div>
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Timestamp</th>
                                        <th>Player</th>
                                        <th>IP Address</th>
                                        <th>Location</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody id="liveConnections">
                                    <tr class="data-flow">
                                        <td class="font-mono">14:32:07</td>
                                        <td>
                                            <div class="flex items-center gap-4">
                                                <div class="player-avatar-mini">
                                                    <img src="https://mineskin.eu/avatar/Notch/24.png" alt="Notch">
                                                </div>
                                                <span>Notch</span>
                                            </div>
                                        </td>
                                        <td class="font-mono">192.168.1.1</td>
                                        <td>🇸🇪 Sweden</td>
                                        <td><span class="status-indicator online"><span class="status-dot"></span>Allowed</span></td>
                                        <td><button class="action-btn">View</button></td>
                                    </tr>
                                    <tr class="data-flow">
                                        <td class="font-mono">14:31:55</td>
                                        <td>
                                            <div class="flex items-center gap-4">
                                                <div class="player-avatar-mini">
                                                    <img src="https://mineskin.eu/avatar/jeb_/24.png" alt="jeb_">
                                                </div>
                                                <span>jeb_</span>
                                            </div>
                                        </td>
                                        <td class="font-mono">45.33.22.11</td>
                                        <td>🇫🇷 France</td>
                                        <td><span class="status-indicator blocked"><span class="status-dot"></span>Blocked</span></td>
                                        <td><button class="action-btn">View</button></td>
                                    </tr>
                                    <tr class="data-flow">
                                        <td class="font-mono">14:31:42</td>
                                        <td>
                                            <div class="flex items-center gap-4">
                                                <div class="player-avatar-mini">
                                                    <img src="https://mineskin.eu/avatar/Dinnerbone/24.png" alt="Dinnerbone">
                                                </div>
                                                <span>Dinnerbone</span>
                                            </div>
                                        </td>
                                        <td class="font-mono">78.45.12.9</td>
                                        <td>🇬🇧 UK</td>
                                        <td><span class="status-indicator online"><span class="status-dot"></span>Allowed</span></td>
                                        <td><button class="action-btn">View</button></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Quick Actions -->
                    <div class="data-panel mt-4">
                        <div class="panel-header">
                            <h2 class="panel-title">QUICK_ACTIONS</h2>
                        </div>
                        <div class="panel-body" style="padding: var(--space-lg);">
                            <div class="flex gap-4">
                                <button class="btn btn-primary">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M12 5v14M5 12h14"/>
                                    </svg>
                                    Add Whitelist
                                </button>
                                <button class="btn btn-secondary">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                                    </svg>
                                    Add Blacklist
                                </button>
                                <button class="btn btn-danger">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                                    </svg>
                                    Emergency Lockdown
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

            </div>
        </main>
    </div>

    <!-- Toast Container -->
    <div class="toast-container" id="toastContainer"></div>

    <!-- Scripts -->
    <script src="assets/js/cyberpunk.js?v=2.0"></script>
</body>
</html>
