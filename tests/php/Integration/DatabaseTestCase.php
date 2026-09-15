<?php

declare(strict_types=1);

namespace FurrGuard\Tests\Integration;

use PDO;
use PDOException;
use PHPUnit\Framework\TestCase;

/**
 * Base de los tests de integración. Usa FG_TEST_DB_* (por defecto 127.0.0.1:3307/furrguard_test,
 * root/root). Si no hay servidor, los tests se omiten. La BD se recrea desde cero: su nombre debe
 * contener "test" para no borrar nunca una base real.
 */
abstract class DatabaseTestCase extends TestCase
{
    private static ?PDO $migrated = null;

    /**
     * @return array{host: string, port: int, name: string, user: string, pass: string}
     */
    protected static function testDbConfig(): array
    {
        $get = static fn (string $key, string $default): string => is_string(getenv($key)) && getenv($key) !== '' ? (string) getenv($key) : $default;
        return [
            'host' => $get('FG_TEST_DB_HOST', '127.0.0.1'),
            'port' => (int) $get('FG_TEST_DB_PORT', '3307'),
            'name' => $get('FG_TEST_DB_NAME', 'furrguard_test'),
            'user' => $get('FG_TEST_DB_USER', 'root'),
            'pass' => $get('FG_TEST_DB_PASS', 'root'),
        ];
    }

    /**
     * Borra y recrea la base de datos de pruebas y devuelve una conexión (sin migrar).
     */
    protected static function freshDatabase(): PDO
    {
        $config = self::testDbConfig();
        if (!str_contains($config['name'], 'test')) {
            self::fail('FG_TEST_DB_NAME debe contener "test".');
        }
        try {
            $server = dbConnect(['name' => ''] + $config);
        } catch (PDOException $e) {
            self::markTestSkipped('Sin base de datos de pruebas: ' . $e->getMessage());
        }
        $name = str_replace('`', '', $config['name']);
        $server->exec("DROP DATABASE IF EXISTS `{$name}`");
        $server->exec("CREATE DATABASE `{$name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        self::$migrated = null;
        return dbConnect($config);
    }

    /**
     * Para tests en proceso aparte: reutiliza la BD existente (sin borrarla) y aplica lo pendiente.
     */
    protected static function reusableMigratedDatabase(): PDO
    {
        try {
            $db = dbConnect(self::testDbConfig());
        } catch (PDOException) {
            $db = self::freshDatabase();
        }
        runMigrations($db);
        return $db;
    }

    /**
     * Conexión a una BD migrada (se migra una vez por proceso y se reutiliza).
     */
    protected static function migratedDatabase(): PDO
    {
        if (self::$migrated === null) {
            $db = self::freshDatabase();
            runMigrations($db);
            self::$migrated = $db;
        }
        return self::$migrated;
    }
}
