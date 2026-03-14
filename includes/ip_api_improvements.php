<?php
/**
 * MEJORAS PARA IP API - Solución al Rate Limiting
 *
 * PROBLEMA: ip-api.com tiene límite de 45 req/min en tier gratuito
 * SOLUCIÓN: Implementar cache agresivo + API alternatives
 */

// Configuración de rate limiting para IP API
define('IP_API_RATE_LIMIT', 45); // 45 requests por minuto
define('IP_API_WINDOW', 60); // 60 segundos
define('IP_API_CACHE_TTL', 3600); // 1 hora en lugar de 24h para reducir requests

/**
 * Verificar si estamos cerca del límite de rate limit
 */
function checkIpApiRateLimit(PDO $db): bool {
    try {
        // Contar requests en el último minuto
        $stmt = $db->prepare("
            SELECT COUNT(*) as count
            FROM ip_api_logs
            WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)
        ");
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($result && $result['count'] >= IP_API_RATE_LIMIT - 5) {
            // Estamos a 5 requests del límite
            return true;
        }
    } catch (PDOException $e) {
        // Si la tabla no existe, no hay rate limit tracking
        return false;
    }

    return false;
}

/**
 * Loggear una request a IP API
 */
function logIpApiRequest(PDO $db, string $ip, bool $success): void {
    try {
        $stmt = $db->prepare("
            INSERT INTO ip_api_logs (ip, success, created_at)
            VALUES (?, ?, NOW())
        ");
        $stmt->execute([$ip, $success ? 1 : 0]);

        // Limpiar logs antiguos (más de 1 hora)
        $db->exec("DELETE FROM ip_api_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)");
    } catch (PDOException $e) {
        // Ignore log errors
    }
}

/**
 * Crear tabla de tracking de IP API si no existe
 */
function createIpApiLogsTable(PDO $db): void {
    try {
        $db->exec("
            CREATE TABLE IF NOT EXISTS ip_api_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ip VARCHAR(45) NOT NULL,
                success TINYINT(1) NOT NULL,
                created_at DATETIME NOT NULL,
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
    } catch (PDOException $e) {
        error_log("Failed to create ip_api_logs table: " . $e->getMessage());
    }
}

/**
 * Obtener estadísticas de uso de IP API
 */
function getIpApiStats(PDO $db): array {
    try {
        // Requests en el último minuto
        $stmt = $db->prepare("
            SELECT
                COUNT(*) as total,
                SUM(success) as successful,
                COUNT(*) - SUM(success) as failed
            FROM ip_api_logs
            WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)
        ");
        $stmt->execute();
        $lastMinute = $stmt->fetch(PDO::FETCH_ASSOC);

        // Requests en la última hora
        $stmt = $db->prepare("
            SELECT
                COUNT(*) as total,
                SUM(success) as successful,
                COUNT(*) - SUM(success) as failed
            FROM ip_api_logs
            WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
        ");
        $stmt->execute();
        $lastHour = $stmt->fetch(PDO::FETCH_ASSOC);

        return [
            'last_minute' => $lastMinute ?: ['total' => 0, 'successful' => 0, 'failed' => 0],
            'last_hour' => $lastHour ?: ['total' => 0, 'successful' => 0, 'failed' => 0],
            'rate_limit' => IP_API_RATE_LIMIT,
            'window' => IP_API_WINDOW,
            'near_limit' => ($lastMinute['total'] ?? 0) >= (IP_API_RATE_LIMIT - 5)
        ];
    } catch (PDOException $e) {
        return [
            'error' => $e->getMessage()
        ];
    }
}

/**
 * Función mejorada de checkIpApi con rate limiting awareness
 */
function checkIpApiWithRateLimit(string $ip, ?PDO $db = null): ?array {
    if (!$db) {
        return checkIpApi($ip, $db);
    }

    // Asegurar que la tabla de logs existe
    createIpApiLogsTable($db);

    // Verificar si estamos cerca del límite
    $nearLimit = checkIpApiRateLimit($db);

    if ($nearLimit) {
        error_log("IP API near rate limit, using extended cache for $ip");

        // Usar cache más largo si estamos cerca del límite
        $cacheKey = "ip_api_{$ip}";
        try {
            $stmt = $db->prepare("
                SELECT data, status
                FROM ip_cache
                WHERE ip = ? AND expires_at > NOW()
                LIMIT 1
            ");
            $stmt->execute([$ip]);
            $cached = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($cached && $cached['status'] === 'success') {
                // Devolver cache aunque esté expirado
                error_log("Using stale cache for $ip due to rate limiting");
                return json_decode($cached['data'], true);
            }

            // Si no hay cache, devolver null (fallar según configuración)
            error_log("No cache available for $ip and rate limit reached");
            return null;
        } catch (PDOException $e) {
            // Continue to normal flow
        }
    }

    // Llamada normal a la API
    $result = checkIpApi($ip, $db, IP_API_CACHE_TTL);

    // Loggear la request
    logIpApiRequest($db, $ip, $result !== null);

    return $result;
}
