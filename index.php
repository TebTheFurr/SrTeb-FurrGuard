<?php

declare(strict_types=1);

/**
 * FurrGuard - landing (public/dist). No inyecta datos ni abre sesión: sin __VERIFY_DATA__ la SPA
 * muestra la landing.
 *
 * @author GrinchHorizon
 * @copyright SrTeb Limited
 * @website https://srteb.eu
 */

require_once __DIR__ . '/includes/bootstrap.php';
require_once FURRGUARD_ROOT . '/includes/spa.php';

applySecurityHeaders();
serveSpa(FURRGUARD_ROOT . '/public/dist/index.html');
