<?php

declare(strict_types=1);

/**
 * FurrGuard - conexión a MariaDB/MySQL.
 *
 * Toda conexión trabaja en UTC (`time_zone = '+00:00'`), modo estricto, utf8mb4 y sentencias
 * preparadas reales (`ATTR_EMULATE_PREPARES = false`).
 *
 * @author GrinchHorizon
 * @copyright SrTeb Limited
 */

const DB_SQL_MODE = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

/**
 * @return array{host: string, port: int, name: string, user: string, pass: string}
 */
function dbConfigFromEnv(): array
{
    return [
        'host' => env('DB_HOST', '127.0.0.1'),
        'port' => (int) env('DB_PORT', '3306'),
        'name' => env('DB_NAME'),
        'user' => env('DB_USERNAME'),
        'pass' => env('DB_PASSWORD'),
    ];
}

/**
 * Abre una conexión configurada. Lanza PDOException si falla.
 *
 * @param array{host: string, port: int, name: string, user: string, pass: string} $config
 */
function dbConnect(array $config): PDO
{
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $config['host'],
        $config['port'] > 0 ? $config['port'] : 3306,
        $config['name']
    );
    return new PDO($dsn, $config['user'], $config['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_STRINGIFY_FETCHES => false,
        PDO::ATTR_TIMEOUT => 3,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci, time_zone = '+00:00', sql_mode = '" . DB_SQL_MODE . "'",
    ]);
}

/**
 * Conexión compartida de la petición web. Devuelve null (y deja log) si la BD no está disponible;
 * el endpoint decide la respuesta (503).
 */
function db(): ?PDO
{
    static $connection = null;
    static $failed = false;

    if ($connection instanceof PDO || $failed) {
        return $connection;
    }
    for ($attempt = 1; $attempt <= 2; $attempt++) {
        try {
            $connection = dbConnect(dbConfigFromEnv());
            return $connection;
        } catch (PDOException $e) {
            error_log('FurrGuard DB: conexión fallida (intento ' . $attempt . '): ' . $e->getMessage());
            if ($attempt === 1) {
                usleep(300000);
            }
        }
    }
    $failed = true;
    return null;
}
