<?php

declare(strict_types=1);

/**
 * FurrGuard - motor de migraciones y utilidades de esquema (MySQL 5.7+ / MariaDB 10.3+).
 *
 * Cada migración es `database/migrations/NNNN_nombre.php` y devuelve
 * `static function (PDO $db): void`. Deben ser idempotentes: el DDL de MySQL confirma
 * implícitamente, así que una migración interrumpida se vuelve a ejecutar entera.
 */

const MIGRATIONS_DIR = __DIR__ . '/migrations';
const TABLE_OPTIONS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

// ─── Registro de salida ─────────────────────────────────────────────────────

/**
 * Destino de los mensajes de las migraciones (por defecto, nada). bin/migrate.php lo apunta a STDOUT.
 */
function migrationLogger(?callable $logger = null, bool $set = false): ?callable
{
    static $current = null;
    if ($set) {
        $current = $logger;
    }
    return $current;
}

function migrationLog(string $message): void
{
    $logger = migrationLogger();
    if ($logger !== null) {
        $logger($message);
    }
}

// ─── Motor ──────────────────────────────────────────────────────────────────

function ensureMigrationsTable(PDO $db): void
{
    $db->exec('CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(191) NOT NULL,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (version)
    ) ' . TABLE_OPTIONS);
}

/**
 * @return array<string, string> versión => ruta, en orden
 */
function migrationFiles(string $dir = MIGRATIONS_DIR): array
{
    $files = glob($dir . '/*.php') ?: [];
    sort($files, SORT_STRING);
    $result = [];
    foreach ($files as $file) {
        $result[basename($file, '.php')] = $file;
    }
    return $result;
}

/**
 * @return array<string, ?string> versión => fecha de aplicación (null = pendiente)
 */
function migrationStatus(PDO $db, string $dir = MIGRATIONS_DIR): array
{
    ensureMigrationsTable($db);
    $applied = $db->query('SELECT version, applied_at FROM schema_migrations')->fetchAll(PDO::FETCH_KEY_PAIR);
    $status = [];
    foreach (array_keys(migrationFiles($dir)) as $version) {
        $status[$version] = isset($applied[$version]) ? (string) $applied[$version] : null;
    }
    return $status;
}

/**
 * Aplica las migraciones pendientes en orden. Devuelve las versiones aplicadas.
 *
 * @return list<string>
 */
function runMigrations(PDO $db, string $dir = MIGRATIONS_DIR): array
{
    $lock = (int) $db->query("SELECT GET_LOCK('furrguard_migrations', 30)")->fetchColumn();
    if ($lock !== 1) {
        throw new RuntimeException('Otra ejecución de migraciones está en curso.');
    }
    try {
        $applied = [];
        foreach (migrationStatus($db, $dir) as $version => $appliedAt) {
            if ($appliedAt !== null) {
                continue;
            }
            $migration = require migrationFiles($dir)[$version];
            if (!$migration instanceof Closure) {
                throw new RuntimeException("La migración {$version} no devuelve una función.");
            }
            migrationLog("→ {$version}");
            $migration($db);
            $db->prepare('INSERT INTO schema_migrations (version) VALUES (?)')->execute([$version]);
            $applied[] = $version;
        }
        return $applied;
    } finally {
        $db->query("SELECT RELEASE_LOCK('furrguard_migrations')");
    }
}

// ─── Inspección del esquema ─────────────────────────────────────────────────

function dbTableExists(PDO $db, string $table): bool
{
    $stmt = $db->prepare('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?');
    $stmt->execute([$table]);
    return (int) $stmt->fetchColumn() > 0;
}

/**
 * @return array{type: string, column_type: string, nullable: bool, default: ?string, extra: string, collation: ?string}|null
 */
function dbColumnInfo(PDO $db, string $table, string $column): ?array
{
    $stmt = $db->prepare(
        'SELECT DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLLATION_NAME
         FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
    );
    $stmt->execute([$table, $column]);
    $row = $stmt->fetch();
    if (!is_array($row)) {
        return null;
    }
    return [
        'type' => strtolower((string) $row['DATA_TYPE']),
        'column_type' => strtolower((string) $row['COLUMN_TYPE']),
        'nullable' => $row['IS_NULLABLE'] === 'YES',
        'default' => normalizeColumnDefault($row['COLUMN_DEFAULT']),
        'extra' => strtolower((string) $row['EXTRA']),
        'collation' => $row['COLLATION_NAME'] === null ? null : (string) $row['COLLATION_NAME'],
    ];
}

/**
 * MariaDB y MySQL escriben distinto los defectos (`current_timestamp()` / `CURRENT_TIMESTAMP`,
 * `'texto'` / `texto`, `NULL` / null).
 */
function normalizeColumnDefault(mixed $default): ?string
{
    if ($default === null) {
        return null;
    }
    $value = (string) $default;
    if (strtoupper($value) === 'NULL') {
        return null;
    }
    if (preg_match('/^current_timestamp(\(\))?\z/i', $value)) {
        return 'CURRENT_TIMESTAMP';
    }
    if (strlen($value) >= 2 && $value[0] === "'" && $value[strlen($value) - 1] === "'") {
        return str_replace("''", "'", substr($value, 1, -1));
    }
    return $value;
}

function dbColumnExists(PDO $db, string $table, string $column): bool
{
    return dbColumnInfo($db, $table, $column) !== null;
}

function dbIndexExists(PDO $db, string $table, string $index): bool
{
    $stmt = $db->prepare('SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?');
    $stmt->execute([$table, $index]);
    return (int) $stmt->fetchColumn() > 0;
}

function dbTableCollation(PDO $db, string $table): ?string
{
    $stmt = $db->prepare('SELECT TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?');
    $stmt->execute([$table]);
    $collation = $stmt->fetchColumn();
    return is_string($collation) ? $collation : null;
}

// ─── Cambios idempotentes ───────────────────────────────────────────────────

/**
 * Ejecuta un ALTER TABLE con las cláusulas no vacías (una sola reconstrucción de la tabla).
 *
 * @param list<?string> $clauses
 */
function dbAlter(PDO $db, string $table, array $clauses): void
{
    $clauses = array_values(array_filter($clauses, static fn (?string $c): bool => $c !== null && $c !== ''));
    if ($clauses !== []) {
        $db->exec("ALTER TABLE `{$table}` " . implode(', ', $clauses));
        migrationLog("  {$table}: " . count($clauses) . ' cambio(s)');
    }
}

function addColumnClause(PDO $db, string $table, string $column, string $definition): ?string
{
    return dbColumnExists($db, $table, $column) ? null : "ADD COLUMN `{$column}` {$definition}";
}

function dropColumnClause(PDO $db, string $table, string $column): ?string
{
    return dbColumnExists($db, $table, $column) ? "DROP COLUMN `{$column}`" : null;
}

function addIndexClause(PDO $db, string $table, string $index, string $columns, bool $unique = false): ?string
{
    return dbIndexExists($db, $table, $index) ? null : ($unique ? 'ADD UNIQUE KEY' : 'ADD KEY') . " `{$index}` ({$columns})";
}

function dropIndexClause(PDO $db, string $table, string $index): ?string
{
    return dbIndexExists($db, $table, $index) ? "DROP INDEX `{$index}`" : null;
}

/**
 * MODIFY de una columna DATETIME si su tipo, nulabilidad, defecto u ON UPDATE no coinciden.
 * Convierte TIMESTAMP → DATETIME (con la sesión en UTC los valores no se desplazan).
 */
function datetimeColumnClause(PDO $db, string $table, string $column, bool $nullable, ?string $default, bool $onUpdate): ?string
{
    $info = dbColumnInfo($db, $table, $column);
    if ($info === null) {
        return null;
    }
    $matches = $info['type'] === 'datetime'
        && $info['nullable'] === $nullable
        && $info['default'] === $default
        && str_contains($info['extra'], 'on update') === $onUpdate;
    if ($matches) {
        return null;
    }
    $definition = 'DATETIME ' . ($nullable ? 'NULL' : 'NOT NULL');
    $definition .= $default === null ? ($nullable ? ' DEFAULT NULL' : '') : " DEFAULT {$default}";
    $definition .= $onUpdate ? ' ON UPDATE CURRENT_TIMESTAMP' : '';
    return "MODIFY COLUMN `{$column}` {$definition}";
}

// ─── Semillas ───────────────────────────────────────────────────────────────

/**
 * Inserta filas `clave => valor` en `settings` solo si la clave no existe. Devuelve cuántas insertó.
 *
 * @param array<string, string> $values
 */
function seedSettingsIfMissing(PDO $db, array $values): int
{
    $stmt = $db->prepare('INSERT IGNORE INTO settings (`key`, value) VALUES (?, ?)');
    $inserted = 0;
    foreach ($values as $key => $value) {
        $stmt->execute([$key, $value]);
        $inserted += $stmt->rowCount();
    }
    return $inserted;
}

/**
 * Inserta mensajes `[clave, valor, descripción]` solo si la clave no existe. Devuelve cuántos insertó.
 *
 * @param list<array{0: string, 1: string, 2: string}> $messages
 */
function seedMessagesIfMissing(PDO $db, array $messages): int
{
    $stmt = $db->prepare('INSERT IGNORE INTO messages (`key`, value, description) VALUES (?, ?, ?)');
    $inserted = 0;
    foreach ($messages as [$key, $value, $description]) {
        $stmt->execute([$key, $value, $description]);
        $inserted += $stmt->rowCount();
    }
    return $inserted;
}

/**
 * Carga `database/data/providers.tsv` (cabecera name, pattern, type).
 *
 * @return list<array{0: string, 1: string, 2: string}>
 */
function loadProvidersTsv(string $path = __DIR__ . '/data/providers.tsv'): array
{
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        throw new RuntimeException("No se puede leer {$path}");
    }
    array_shift($lines);
    $rows = [];
    foreach ($lines as $number => $line) {
        $fields = explode("\t", rtrim($line, "\r"));
        if (count($fields) !== 3 || !in_array($fields[2], ['hosting', 'vpn', 'proxy'], true)) {
            throw new RuntimeException("Línea inválida en providers.tsv: " . ($number + 2));
        }
        $rows[] = [$fields[0], $fields[1], $fields[2]];
    }
    return $rows;
}
