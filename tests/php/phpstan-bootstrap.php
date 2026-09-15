<?php

declare(strict_types=1);

// Constantes que includes/bootstrap.php define en tiempo de ejecución, para el análisis estático.

define('FURRGUARD_ROOT', dirname(__DIR__, 2));
define('FURRGUARD_VERSION', '2.0.0');
define('FURRGUARD_SKIP_DOTENV', false);
define('FURRGUARD_STORAGE', FURRGUARD_ROOT . '/storage');
define('APP_ENV', 'production');
define('APP_URL', '');
define('DISCORD_CLIENT_ID', '');
define('DISCORD_CLIENT_SECRET', '');
define('DISCORD_REDIRECT_URI', '');
define('FOUNDER_DISCORD_ID', '');
define('PTERODACTYL_URL', '');
define('PTERODACTYL_PANEL_KEY', '');
define('PTERODACTYL_PANEL_IPS', []);
