<?php
/**
 * FurrGuard - Landing Page
 *
 * @author GrinchHorizon
 * @copyright SrTeb Limited
 * @website https://srteb.eu
 * @version 4.0.0
 */

require_once __DIR__ . '/config.php';
$page_title = 'FurrGuard - Anti-Proxy/VPN Protection for Minecraft';
?>

<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo $page_title; ?></title>
    <meta name="description" content="Sistema de protección anti-proxy/VPN para servidores Minecraft. Detecta y bloquea conexiones sospechosas automáticamente.">
    <meta name="keywords" content="minecraft, anti-proxy, anti-vpn, protection, security, velocity, paper">
    <meta name="author" content="GrinchHorizon - SrTeb Limited">
    <meta name="robots" content="index, follow">
    <meta property="og:title" content="<?php echo $page_title; ?>">
    <meta property="og:description" content="Sistema de protección anti-proxy/VPN para servidores Minecraft.">
    <meta property="og:type" content="website">
    <link rel="icon" type="image/png" href="icono-furguard.png">
    <link rel="apple-touch-icon" href="icono-furguard.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/style.css?v=<?php echo time(); ?>">
</head>
<body>
    <header class="header" role="banner">
        <div class="container header-inner">
            <a href="/" class="logo" aria-label="FurrGuard - Inicio">
                <div class="logo-icon">
                    <img src="icono-furguard.png" alt="FurrGuard" style="width:20px;height:20px;object-fit:contain;">
                </div>
                Furr<span class="logo-accent">Guard</span>
                <span class="logo-version">v<?php echo FURRGUARD_VERSION; ?></span>
            </a>
            <button class="menu-btn" aria-label="Toggle menu" aria-expanded="false" aria-controls="primary-navigation">
                <span></span>
                <span></span>
                <span></span>
            </button>
            <nav class="nav" id="primary-navigation" role="navigation" aria-label="Primary navigation">
                <a href="#features" class="nav-link">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    <span>Características</span>
                </a>
                <a href="#architecture" class="nav-link">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                        <polyline points="2 17 12 22 22 17"/>
                        <polyline points="2 12 12 17 22 12"/>
                    </svg>
                    <span>Arquitectura</span>
                </a>
                <a href="#protection" class="nav-link">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <span>Protección</span>
                </a>
                <a href="https://discord.com/users/srteb" target="_blank" class="btn btn-primary nav-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                    </svg>
                    Contactar
                </a>
            </nav>
        </div>
    </header>

    <main role="main" id="main-content">
        <section class="hero">
            <div class="hero-bg">
                <div class="floating-shapes">
                    <div class="shape shape-1"></div>
                    <div class="shape shape-2"></div>
                    <div class="shape shape-3"></div>
                </div>
            </div>

            <div class="container">
                <div class="hero-content">
                    <div class="hero-text">
                        <div class="hero-badge">
                            <span class="badge-dot"></span>
                            <span>Protección Avanzada para Minecraft</span>
                        </div>
                        <h1 class="hero-title">
                            <span class="text-gradient">FurrGuard</span><br>
                            <span style="color: var(--text-primary);">Anti-Proxy / VPN / Hosting<span class="cursor"></span></span>
                        </h1>
                        <p class="hero-subtitle">
                            Sistema de protección profesional para servidores Minecraft. Detecta y bloquea automáticamente proxies, VPNs y conexiones desde datacenters con geolocalización en tiempo real.
                        </p>
                        <div class="hero-actions">
                            <a href="#features" class="btn btn-primary">Ver Características</a>
                            <a href="https://discord.com/users/srteb" target="_blank" class="btn btn-secondary">Solicitar Demo</a>
                        </div>
                        <div class="hero-stats">
                            <div class="stat-item">
                                <span class="stat-number-large">100%</span>
                                <span class="stat-label-large">Detección</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-number-large">&lt;50ms</span>
                                <span class="stat-label-large">Latencia</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-number-large">24/7</span>
                                <span class="stat-label-large">Protección</span>
                            </div>
                        </div>
                    </div>

                    <div class="hero-terminal" aria-hidden="true">
                        <div class="terminal-header">
                            <span class="terminal-dot red"></span>
                            <span class="terminal-dot yellow"></span>
                            <span class="terminal-dot green"></span>
                        </div>
                        <div class="terminal-body">
                            <div class="terminal-line">
                                <span class="prompt">$</span> <span class="command">./furrguard --check</span>
                            </div>
                            <div class="terminal-line">
                                <span class="output">> Analizando conexión...</span>
                            </div>
                            <div class="terminal-line">
                                <span class="output">> IP: 192.168.1.1</span>
                            </div>
                            <div class="terminal-line">
                                <span class="output">> País: ES | ISP: Movistar</span>
                            </div>
                            <div class="terminal-line">
                                <span class="comment">// Proxy detectado: NO</span>
                            </div>
                            <div class="terminal-line">
                                <span class="prompt">$</span> <span class="command">status --all</span>
                            </div>
                            <div class="terminal-line">
                                <span class="output">> Conexión: </span><span class="string">PERMITIDA</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section class="section section-alt" id="features">
            <div class="container">
                <div class="section-header">
                    <span class="section-tag">// Características</span>
                    <h2 class="section-title">Protección Completa</h2>
                    <p class="section-subtitle">Herramientas avanzadas de seguridad para tu servidor Minecraft</p>
                </div>
                <div class="services-grid stagger-in">
                    <div class="service-card card-3d">
                        <div class="service-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                        </div>
                        <h3>Detección de Proxy</h3>
                        <p>Identifica y bloquea conexiones que utilizan proxies para ocultar su IP real mediante análisis de ASN y proveedores.</p>
                        <a href="#features" class="service-link">Saber más</a>
                    </div>
                    <div class="service-card card-3d">
                        <div class="service-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                        </div>
                        <h3>Bloqueo de VPN</h3>
                        <p>Detecta servicios VPN populares: NordVPN, ExpressVPN, Surfshark y más de 50 proveedores automáticamente.</p>
                        <a href="#features" class="service-link">Saber más</a>
                    </div>
                    <div class="service-card card-3d">
                        <div class="service-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                                <line x1="6" y1="6" x2="6.01" y2="6"/>
                                <line x1="6" y1="18" x2="6.01" y2="18"/>
                            </svg>
                        </div>
                        <h3>Filtro de Hosting</h3>
                        <p>Bloquea conexiones desde datacenters: AWS, Azure, DigitalOcean, Google Cloud y más proveedores cloud.</p>
                        <a href="#features" class="service-link">Saber más</a>
                    </div>
                    <div class="service-card card-3d">
                        <div class="service-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                                <circle cx="9" cy="7" r="4"/>
                                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                            </svg>
                        </div>
                        <h3>Whitelist / Blacklist</h3>
                        <p>Gestiona listas de permitidos y bloqueados por UUID, nickname, IP, CIDR o número AS.</p>
                        <a href="#features" class="service-link">Saber más</a>
                    </div>
                    <div class="service-card card-3d">
                        <div class="service-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                <line x1="12" y1="9" x2="12" y2="13"/>
                                <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                        </div>
                        <h3>Alertas en Tiempo Real</h3>
                        <p>Recibe notificaciones instantáneas en Discord cuando se detecta o bloquea una conexión sospechosa.</p>
                        <a href="#features" class="service-link">Saber más</a>
                    </div>
                    <div class="service-card card-3d">
                        <div class="service-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="2" y1="12" x2="22" y2="12"/>
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                            </svg>
                        </div>
                        <h3>Geolocalización</h3>
                        <p>Información detallada del país, ciudad, ISP, ASN y tipo de conexión de cada jugador.</p>
                        <a href="#features" class="service-link">Saber más</a>
                    </div>
                </div>
            </div>
        </section>

        <section class="section" id="architecture">
            <div class="container">
                <div class="section-header">
                    <span class="section-tag">// Arquitectura</span>
                    <h2 class="section-title">Sistema Distribuido</h2>
                    <p class="section-subtitle">Arquitectura optimizada para mínimo impacto en el rendimiento</p>
                </div>
                <div class="services-grid stagger-in" style="grid-template-columns: repeat(2, 1fr);">
                    <div class="service-card card-3d">
                        <div class="service-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
                                <rect x="9" y="9" width="6" height="6"/>
                                <line x1="9" y1="1" x2="9" y2="4"/>
                                <line x1="15" y1="1" x2="15" y2="4"/>
                                <line x1="9" y1="20" x2="9" y2="23"/>
                                <line x1="15" y1="20" x2="15" y2="23"/>
                                <line x1="20" y1="9" x2="23" y2="9"/>
                                <line x1="20" y1="14" x2="23" y2="14"/>
                                <line x1="1" y1="9" x2="4" y2="9"/>
                                <line x1="1" y1="14" x2="4" y2="14"/>
                            </svg>
                        </div>
                        <h3>Plugin Velocity</h3>
                        <p>Plugin nativo para Velocity 3.0+ con intercepción en fase PreLogin. Cache inteligente con TTL configurable para consultas repetidas.</p>
                        <a href="#architecture" class="service-link">Saber más</a>
                    </div>
                    <div class="service-card card-3d">
                        <div class="service-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                            </svg>
                        </div>
                        <h3>Backend PHP</h3>
                        <p>API REST en PHP con MySQL para persistencia. Integración con ip-api.com para geolocalización y detección de proxies.</p>
                        <a href="#architecture" class="service-link">Saber más</a>
                    </div>
                    <div class="service-card card-3d">
                        <div class="service-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                            </svg>
                        </div>
                        <h3>Panel de Administración</h3>
                        <p>Dashboard web con estadísticas en tiempo real, gestión de listas y visualización de logs de conexión.</p>
                        <a href="#architecture" class="service-link">Saber más</a>
                    </div>
                    <div class="service-card card-3d">
                        <div class="service-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                            </svg>
                        </div>
                        <h3>Webhooks Discord</h3>
                        <p>Notificaciones automáticas a Discord para alertas de seguridad, bloqueos y eventos importantes del sistema.</p>
                        <a href="#architecture" class="service-link">Saber más</a>
                    </div>
                </div>
            </div>
        </section>

        <section class="section section-alt" id="protection">
            <div class="container">
                <div class="section-header">
                    <span class="section-tag">// Tipos de Bloqueo</span>
                    <h2 class="section-title">Múltiples Niveles de Protección</h2>
                    <p class="section-subtitle">Bloquea amenazas de diferentes formas según tus necesidades</p>
                </div>
                <div class="services-grid stagger-in" style="grid-template-columns: repeat(3, 1fr);">
                    <div class="service-card card-3d">
                        <div class="service-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                <circle cx="12" cy="7" r="4"/>
                            </svg>
                        </div>
                        <h3>Por UUID</h3>
                        <p>Bloquea jugadores específicos por su UUID de Minecraft, permanente e inmutable.</p>
                        <a href="#protection" class="service-link">Saber más</a>
                    </div>
                    <div class="service-card card-3d">
                        <div class="service-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <circle cx="12" cy="12" r="3"/>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                            </svg>
                        </div>
                        <h3>Por Nickname</h3>
                        <p>Bloquea por nombre de jugador, útil para evitar trolls con cuentas alternas.</p>
                        <a href="#protection" class="service-link">Saber más</a>
                    </div>
                    <div class="service-card card-3d">
                        <div class="service-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                                <line x1="6" y1="6" x2="6.01" y2="6"/>
                                <line x1="6" y1="18" x2="6.01" y2="18"/>
                            </svg>
                        </div>
                        <h3>Por IP / CIDR</h3>
                        <p>Bloquea IPs individuales o rangos completos usando notación CIDR para mayor cobertura.</p>
                        <a href="#protection" class="service-link">Saber más</a>
                    </div>
                    <div class="service-card card-3d">
                        <div class="service-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="2" y1="12" x2="22" y2="12"/>
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                            </svg>
                        </div>
                        <h3>Por ASN</h3>
                        <p>Bloquea proveedores completos por su número de Sistema Autónomo (AS).</p>
                        <a href="#protection" class="service-link">Saber más</a>
                    </div>
                    <div class="service-card card-3d">
                        <div class="service-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                <line x1="12" y1="8" x2="12" y2="12"/>
                                <line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                        </div>
                        <h3>Proveedores Bloqueados</h3>
                        <p>Lista predefinida de proveedores VPN/Proxy/Hosting bloqueados automáticamente.</p>
                        <a href="#protection" class="service-link">Saber más</a>
                    </div>
                    <div class="service-card card-3d">
                        <div class="service-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="17 8 12 3 7 8"/>
                                <line x1="12" y1="3" x2="12" y2="15"/>
                            </svg>
                        </div>
                        <h3>Whitelist Global</h3>
                        <p>Permite que jugadores o IPs de confianza bypassen todas las verificaciones.</p>
                        <a href="#protection" class="service-link">Saber más</a>
                    </div>
                </div>
            </div>
        </section>

        <section class="section">
            <div class="container">
                <div class="cta-wrapper">
                    <div class="cta">
                        <h2 class="cta-title">Protege tu servidor hoy</h2>
                        <p class="cta-text">Implementa FurrGuard en tu servidor Velocity y mantén a los jugadores indeseados fuera. Contacta para obtener acceso.</p>
                        <a href="https://discord.com/users/srteb" target="_blank" class="btn btn-primary">Contactar Ahora</a>
                    </div>
                </div>
            </div>
        </section>
    </main>

    <footer class="footer" role="contentinfo">
        <div class="container footer-container">
            <div class="footer-content">
                <div class="footer-brand">
                    <a href="/" class="footer-logo" aria-label="FurrGuard - Inicio">
                        <div class="logo-icon">
                            <img src="icono-furguard.png" alt="FurrGuard" style="width:16px;height:16px;object-fit:contain;">
                        </div>
                        Furr<span class="logo-accent">Guard</span>
                    </a>
                    <p class="footer-tagline">Sistema de protección anti-proxy/VPN para servidores Minecraft. Detección automática de conexiones sospechosas con geolocalización en tiempo real.</p>
                    <div class="footer-social">
                        <a href="https://discord.com/users/srteb" target="_blank" rel="noopener noreferrer" aria-label="Contactar por Discord">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                            </svg>
                        </a>
                        <a href="https://github.com/grinchhorizon" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                            </svg>
                        </a>
                    </div>
                </div>

                <div class="footer-section">
                    <h4>// PROTECCIÓN</h4>
                    <nav aria-label="Footer navigation - Protección">
                        <ul>
                            <li><a href="#features">Detección de Proxy</a></li>
                            <li><a href="#features">Bloqueo de VPN</a></li>
                            <li><a href="#features">Filtro de Hosting</a></li>
                            <li><a href="#protection">Tipos de Bloqueo</a></li>
                        </ul>
                    </nav>
                </div>

                <div class="footer-section">
                    <h4>// SISTEMA</h4>
                    <nav aria-label="Footer navigation - Sistema">
                        <ul>
                            <li><a href="#architecture">Plugin Velocity</a></li>
                            <li><a href="#architecture">Backend PHP</a></li>
                            <li><a href="#architecture">Panel Admin</a></li>
                            <li><a href="#architecture">Webhooks Discord</a></li>
                        </ul>
                    </nav>
                </div>

                <div class="footer-section">
                    <h4>// LEGAL</h4>
                    <nav aria-label="Footer navigation - Legal">
                        <ul>
                            <li><a href="#">Aviso Legal</a></li>
                            <li><a href="#">Política de Privacidad</a></li>
                            <li><a href="#">Términos de Servicio</a></li>
                        </ul>
                    </nav>
                </div>
            </div>

            <div class="footer-bottom">
                <p>&copy; <?php echo date('Y'); ?> SrTeb Limited & Teb Solutions S.L. // Todos los derechos reservados.</p>
            </div>
        </div>
    </footer>

    <script src="assets/js/script.js" defer></script>
</body>
</html>
