<?php

declare(strict_types=1);

/**
 * FurrGuard - utilidades SQL compartidas por los módulos de dominio y los endpoints.
 */

/**
 * Ejecuta `$work($db)` en una transacción (o dentro de la que ya esté abierta) y la deshace si falla.
 *
 * @template T
 * @param callable(PDO): T $work
 * @return T
 */
function withTransaction(PDO $db, callable $work): mixed
{
    if ($db->inTransaction()) {
        return $work($db);
    }
    $db->beginTransaction();
    try {
        $result = $work($db);
        $db->commit();
        return $result;
    } catch (Throwable $e) {
        try {
            $db->rollBack();
        } catch (PDOException $rollbackError) {
            // Sin transacción activa (p. ej. conexión perdida): el error que importa es el original.
            error_log('FurrGuard: no se pudo deshacer la transacción: ' . $rollbackError->getMessage());
        }
        throw $e;
    }
}

function isDuplicateKeyError(PDOException $e): bool
{
    return ($e->errorInfo[1] ?? null) === 1062;
}

/**
 * Errores de conexión, bloqueo o interbloqueo: el cliente puede reintentar (503).
 */
function isDatabaseUnavailableError(PDOException $e): bool
{
    $driverCode = $e->errorInfo[1] ?? null;
    return in_array($driverCode, [1040, 1205, 1213, 2002, 2003, 2006, 2013], true)
        || str_starts_with((string) ($e->errorInfo[0] ?? $e->getCode()), '08');
}

/**
 * `?, ?, ?` para una lista IN (...). Nunca vacía: con 0 elementos devuelve `NULL` (no coincide nada).
 */
function sqlPlaceholders(int $count): string
{
    return $count > 0 ? implode(', ', array_fill(0, $count, '?')) : 'NULL';
}

/**
 * Patrón LIKE "empieza por" con `%`, `_` y `\` escapados.
 */
function likePrefix(string $prefix): string
{
    return addcslashes($prefix, '\\%_') . '%';
}
