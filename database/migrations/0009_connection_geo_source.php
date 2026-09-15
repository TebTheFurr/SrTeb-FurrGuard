<?php

declare(strict_types=1);

/**
 * `player_connections.geo_source`: método y proveedores usados para geolocalizar esa conexión
 * (p. ej. `proxycheck+maxmind`, `cache:ip-api`, `maxmind`, `none`).
 */
return static function (PDO $db): void {
    if (!dbColumnExists($db, 'player_connections', 'geo_source')) {
        dbAlter($db, 'player_connections', ['ADD COLUMN geo_source VARCHAR(64) NULL AFTER raw_data']);
        migrationLog('  player_connections.geo_source añadida');
    }
};
