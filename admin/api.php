<?php

declare(strict_types=1);

/**
 * FurrGuard - API del panel (docs/API.md §4.2–§4.4). Control de acceso y acciones en admin/api/.
 *
 * @author GrinchHorizon
 * @copyright Tebby Services S.L.
 * @website https://tebby.lgbt
 */

require_once dirname(__DIR__) . '/config.php';
require_once __DIR__ . '/api/router.php';

adminApiRun();
