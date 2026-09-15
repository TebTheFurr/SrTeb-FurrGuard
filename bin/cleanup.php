<?php

declare(strict_types=1);

/**
 * Limpieza periódica (cron cada hora): cachés caducadas, sesiones, tokens, intentos fallidos,
 * archivos de rate limit y retención configurada (`retention_*_days`, 0 = conservar siempre).
 *
 *   php bin/cleanup.php
 */

const CLEANUP_BATCH = 5000;

/**
 * Borra por lotes para no bloquear tablas grandes. Devuelve el total borrado.
 *
 * @param list<int|string> $params
 */
function cleanupDelete(PDO $db, string $table, string $where, array $params = []): int
{
    $stmt = $db->prepare("DELETE FROM {$table} WHERE {$where} LIMIT " . CLEANUP_BATCH);
    $total = 0;
    do {
        $stmt->execute($params);
        $deleted = $stmt->rowCount();
        $total += $deleted;
    } while ($deleted === CLEANUP_BATCH);
    return $total;
}

/**
 * @return array<string, int> tarea => filas o archivos borrados
 */
function runCleanup(PDO $db): array
{
    $settings = getSettings($db, ['furrsecurity_failed_attempts_window', 'retention_connections_days', 'retention_logs_days']);
    $window = max(300, (int) $settings['furrsecurity_failed_attempts_window']);

    $result = [
        'ip_cache' => cleanupDelete($db, 'ip_cache', 'expires_at < NOW()'),
        'ip_api_logs' => cleanupDelete($db, 'ip_api_logs', 'created_at < NOW() - INTERVAL 1 HOUR'),
        'minecraft_profiles' => cleanupDelete($db, 'minecraft_profiles', 'expires_at < NOW()'),
        'minecraft_names_cache' => cleanupDelete($db, 'minecraft_names_cache', 'expires_at < NOW()'),
        'admin_sessions' => cleanupDelete($db, 'admin_sessions', 'expires_at < NOW() - INTERVAL 1 DAY OR revoked_at < NOW() - INTERVAL 1 DAY'),
        'furrsecurity_verifications' => cleanupDelete($db, 'furrsecurity_verifications', "status IN ('expired', 'token_expired') AND created_at < NOW() - INTERVAL 30 DAY"),
        'furrsecurity_failed_attempts' => cleanupDelete($db, 'furrsecurity_failed_attempts', 'window_started_at < NOW() - INTERVAL ? SECOND', [$window]),
        'ratelimit_files' => rateLimitCleanup(),
    ];

    $connectionsDays = (int) $settings['retention_connections_days'];
    if ($connectionsDays > 0) {
        $result['player_connections'] = cleanupDelete($db, 'player_connections', 'created_at < NOW() - INTERVAL ? DAY', [$connectionsDays]);
    }
    $logsDays = (int) $settings['retention_logs_days'];
    if ($logsDays > 0) {
        foreach (['activity_logs', 'fur_perms_command_logs', 'furrsecurity_logs'] as $table) {
            $result[$table] = cleanupDelete($db, $table, 'created_at < NOW() - INTERVAL ? DAY', [$logsDays]);
        }
    }
    return $result;
}

if (PHP_SAPI !== 'cli' || realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) !== __FILE__) {
    return;
}

require_once dirname(__DIR__) . '/includes/bootstrap.php';

try {
    $db = dbConnect(dbConfigFromEnv());
    if ((int) $db->query("SELECT GET_LOCK('furrguard_cleanup', 0)")->fetchColumn() !== 1) {
        fwrite(STDOUT, "Otra limpieza está en curso.\n");
        exit(0);
    }
    foreach (runCleanup($db) as $task => $count) {
        fwrite(STDOUT, sprintf("%-30s %d\n", $task, $count));
    }
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, 'Error en la limpieza: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}
