<?php

declare(strict_types=1);

/**
 * Migraciones de la base de datos (instalación nueva y actualización usan el mismo comando).
 *
 *   php bin/migrate.php            aplica las pendientes
 *   php bin/migrate.php --status   lista aplicadas y pendientes
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit(1);
}

require_once dirname(__DIR__) . '/includes/bootstrap.php';
require_once dirname(__DIR__) . '/database/lib.php';

try {
    $db = dbConnect(dbConfigFromEnv());
    if (in_array('--status', $argv, true)) {
        foreach (migrationStatus($db) as $version => $appliedAt) {
            printf("%-40s %s\n", $version, $appliedAt === null ? 'pendiente' : "aplicada {$appliedAt} UTC");
        }
        exit(0);
    }
    migrationLogger(static function (string $message): void {
        fwrite(STDOUT, $message . PHP_EOL);
    }, true);
    $applied = runMigrations($db);
    fwrite(STDOUT, $applied === [] ? "Sin migraciones pendientes.\n" : 'Aplicadas: ' . implode(', ', $applied) . "\n");
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, 'Error en las migraciones: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}
