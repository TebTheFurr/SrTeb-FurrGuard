<?php

declare(strict_types=1);

/**
 * FurrGuard - arranque de las páginas web (panel, landing, verificación).
 *
 * Carga el arranque común (entorno, UTC, BD, seguridad, roles y sesión de administrador: ver
 * includes/bootstrap.php), inicia la sesión segura y envía las cabeceras de seguridad.
 * `ROLE_PERMISSIONS`, `getUserRole()`, `hasPermission()` y `getDiscordLoginUrl()` quedan disponibles
 * (definidos en includes/admin_session.php). Las APIs de plugin cargan solo includes/bootstrap.php.
 *
 * @author GrinchHorizon
 * @copyright Tebby Services S.L.
 * @website https://tebby.lgbt
 */

require_once __DIR__ . '/includes/bootstrap.php';

startWebSession();
applySecurityHeaders();
