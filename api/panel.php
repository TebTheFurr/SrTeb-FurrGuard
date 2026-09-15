<?php

declare(strict_types=1);

/**
 * FurrGuard - puente con el panel de Pterodactyl (docs/API.md §9).
 *
 * POST /api/panel.php con cuerpo JSON `{"action": …}`, firmado con X-FurrGuard-Signature. Sin
 * cookies ni CSRF: no lo llama un navegador, lo llama el panel desde su servidor.
 *
 * @author GrinchHorizon
 * @copyright Tebby Services S.L.
 */

require_once dirname(__DIR__) . '/includes/bootstrap.php';
require_once FURRGUARD_ROOT . '/includes/panel_bridge.php';

panelBridgeRun();
