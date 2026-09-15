<?php

declare(strict_types=1);

/**
 * Balanceador de proveedores de geolocalización: `ip_api_logs` pasa a contar las peticiones de
 * cada proveedor (ip-api, proxycheck, ipapi-is, freeipapi) para aplicar su presupuesto.
 */
return static function (PDO $db): void {
    if (!dbColumnExists($db, 'ip_api_logs', 'provider')) {
        dbAlter($db, 'ip_api_logs', ["ADD COLUMN provider VARCHAR(20) NOT NULL DEFAULT 'ip-api' AFTER id"]);
        migrationLog('  ip_api_logs.provider añadida');
    }
    if (!dbIndexExists($db, 'ip_api_logs', 'idx_provider_created')) {
        dbAlter($db, 'ip_api_logs', ['ADD INDEX idx_provider_created (provider, created_at)']);
        migrationLog('  ip_api_logs: índice idx_provider_created');
    }
};
