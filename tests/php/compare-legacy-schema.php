<?php

declare(strict_types=1);

/**
 * Compara el esquema de una instalación limpia con el de una actualización desde producción.
 * Nunca imprime filas: solo esquema y recuentos.
 *
 *   php tests/php/compare-legacy-schema.php [--migrate] [--clean=furrguard_test] [--legacy=furrguard_legacy]
 *
 * Conexión: FG_TEST_DB_HOST/PORT/USER/PASS (por defecto 127.0.0.1:3307 root/root).
 * Con --migrate: recrea la BD limpia y migra ambas dos veces (la segunda vacía schema_migrations
 * para volver a ejecutar cada migración y demostrar que son idempotentes). La BD legacy debe estar
 * restaurada de antemano desde la copia de producción.
 * Sale con 0 si los esquemas son idénticos.
 */

if (PHP_SAPI !== 'cli') {
    exit(1);
}

define('FURRGUARD_SKIP_DOTENV', true);
require_once dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once dirname(__DIR__, 2) . '/database/lib.php';

$options = getopt('', ['migrate', 'clean::', 'legacy::']);
$cleanName = is_string($options['clean'] ?? null) ? $options['clean'] : 'furrguard_test';
$legacyName = is_string($options['legacy'] ?? null) ? $options['legacy'] : 'furrguard_legacy';
$envOr = static fn (string $key, string $default): string => is_string(getenv($key)) && getenv($key) !== '' ? (string) getenv($key) : $default;
$base = [
    'host' => $envOr('FG_TEST_DB_HOST', '127.0.0.1'),
    'port' => (int) $envOr('FG_TEST_DB_PORT', '3307'),
    'user' => $envOr('FG_TEST_DB_USER', 'root'),
    'pass' => $envOr('FG_TEST_DB_PASS', 'root'),
];
$connect = static fn (string $name): PDO => dbConnect(['name' => $name] + $base);

/**
 * @return list<string>
 */
function schemaSnapshot(PDO $db): array
{
    $lines = [];
    $q = static function (string $sql) use ($db): array {
        return $db->query($sql)->fetchAll(PDO::FETCH_ASSOC);
    };
    foreach ($q("SELECT TABLE_NAME, ENGINE, TABLE_COLLATION, TABLE_COMMENT FROM information_schema.TABLES
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME") as $t) {
        $lines[] = "table {$t['TABLE_NAME']} engine={$t['ENGINE']} collation={$t['TABLE_COLLATION']} comment=" . json_encode($t['TABLE_COMMENT'], JSON_UNESCAPED_UNICODE);
    }
    foreach ($q('SELECT TABLE_NAME, ORDINAL_POSITION, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLLATION_NAME
                 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION') as $c) {
        $default = normalizeColumnDefault($c['COLUMN_DEFAULT']);
        $lines[] = "column {$c['TABLE_NAME']}.{$c['COLUMN_NAME']} #{$c['ORDINAL_POSITION']} {$c['COLUMN_TYPE']} null={$c['IS_NULLABLE']}"
            . ' default=' . json_encode($default) . " extra={$c['EXTRA']} collation={$c['COLLATION_NAME']}";
    }
    foreach ($q('SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, SUB_PART FROM information_schema.STATISTICS
                 WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX') as $i) {
        $lines[] = "index {$i['TABLE_NAME']}.{$i['INDEX_NAME']} unique=" . ((int) $i['NON_UNIQUE'] === 0 ? 'yes' : 'no')
            . " #{$i['SEQ_IN_INDEX']} {$i['COLUMN_NAME']}" . ($i['SUB_PART'] !== null ? "({$i['SUB_PART']})" : '');
    }
    foreach ($q('SELECT rc.TABLE_NAME, rc.CONSTRAINT_NAME, rc.REFERENCED_TABLE_NAME, rc.UPDATE_RULE, rc.DELETE_RULE, k.COLUMN_NAME, k.REFERENCED_COLUMN_NAME
                 FROM information_schema.REFERENTIAL_CONSTRAINTS rc
                 JOIN information_schema.KEY_COLUMN_USAGE k ON k.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA AND k.CONSTRAINT_NAME = rc.CONSTRAINT_NAME AND k.TABLE_NAME = rc.TABLE_NAME
                 WHERE rc.CONSTRAINT_SCHEMA = DATABASE() ORDER BY rc.TABLE_NAME, rc.CONSTRAINT_NAME') as $f) {
        $lines[] = "fk {$f['TABLE_NAME']}.{$f['CONSTRAINT_NAME']} ({$f['COLUMN_NAME']}) -> {$f['REFERENCED_TABLE_NAME']}({$f['REFERENCED_COLUMN_NAME']}) on_update={$f['UPDATE_RULE']} on_delete={$f['DELETE_RULE']}";
    }
    try {
        foreach ($q('SELECT TABLE_NAME, CONSTRAINT_NAME, CHECK_CLAUSE FROM information_schema.CHECK_CONSTRAINTS
                     WHERE CONSTRAINT_SCHEMA = DATABASE() ORDER BY TABLE_NAME, CONSTRAINT_NAME') as $check) {
            $lines[] = "check {$check['TABLE_NAME']}.{$check['CONSTRAINT_NAME']} {$check['CHECK_CLAUSE']}";
        }
    } catch (PDOException) {
        // MySQL 5.7 no tiene CHECK_CONSTRAINTS.
    }
    return $lines;
}

/**
 * @return array<string, int>
 */
function rowCounts(PDO $db): array
{
    $counts = [];
    foreach ($db->query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME")->fetchAll(PDO::FETCH_COLUMN) as $table) {
        $counts[(string) $table] = (int) $db->query("SELECT COUNT(*) FROM `{$table}`")->fetchColumn();
    }
    return $counts;
}

function migrateTwice(PDO $db, string $label): bool
{
    migrationLogger(static fn (string $m) => fwrite(STDOUT, "[{$label}] {$m}\n"), true);
    runMigrations($db);
    $first = schemaSnapshot($db);
    migrationLogger(static fn (string $m) => fwrite(STDOUT, "[{$label} 2ª] {$m}\n"), true);
    $db->exec('DELETE FROM schema_migrations');
    runMigrations($db);
    $second = schemaSnapshot($db);
    $same = $first === $second;
    fwrite(STDOUT, "[{$label}] segunda ejecución " . ($same ? 'sin cambios de esquema (idempotente)' : 'CAMBIÓ el esquema') . "\n");
    return $same;
}

$ok = true;
if (isset($options['migrate'])) {
    if (!str_contains($cleanName, 'test')) {
        fwrite(STDERR, "--clean debe contener 'test'\n");
        exit(1);
    }
    $server = dbConnect(['name' => ''] + $base);
    $server->exec("DROP DATABASE IF EXISTS `{$cleanName}`");
    $server->exec("CREATE DATABASE `{$cleanName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

    $cleanIdempotent = migrateTwice($connect($cleanName), 'limpia');

    $legacy = $connect($legacyName);
    $before = rowCounts($legacy);
    $ok = migrateTwice($legacy, 'legacy') && $cleanIdempotent;
    $after = rowCounts($legacy);
    fwrite(STDOUT, "\nRecuento de filas en legacy (antes → después):\n");
    foreach (array_unique(array_merge(array_keys($before), array_keys($after))) as $table) {
        $from = $before[$table] ?? '-';
        $to = $after[$table] ?? '-';
        fwrite(STDOUT, sprintf("  %-34s %6s → %-6s%s\n", $table, $from, $to, $from === $to ? '' : '  *'));
    }
}

$clean = schemaSnapshot($connect($cleanName));
$legacySchema = schemaSnapshot($connect($legacyName));
$onlyClean = array_values(array_diff($clean, $legacySchema));
$onlyLegacy = array_values(array_diff($legacySchema, $clean));

fwrite(STDOUT, sprintf("\nEsquema: %d líneas en limpia, %d en legacy.\n", count($clean), count($legacySchema)));
if ($onlyClean === [] && $onlyLegacy === []) {
    fwrite(STDOUT, "IDÉNTICOS\n");
    exit($ok ? 0 : 1);
}
foreach ($onlyClean as $line) {
    fwrite(STDOUT, "- solo limpia: {$line}\n");
}
foreach ($onlyLegacy as $line) {
    fwrite(STDOUT, "+ solo legacy: {$line}\n");
}
exit(1);
