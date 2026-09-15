<?php

declare(strict_types=1);

/**
 * FurrGuard - limitador de peticiones en archivos (`storage/ratelimit/`).
 *
 * Ventana deslizante aproximada (contador de la ventana actual + la anterior ponderada), de tamaño
 * constante por cubo. Lectura-modificación-escritura atómica con `flock(LOCK_EX)`.
 * Si el almacenamiento falla, deja pasar la petición y lo registra (fail open).
 */

const RATE_LIMIT_FILE_MAX_AGE = 86400;

/**
 * Comprueba un cubo y, si `$consume` y está permitido, suma una petición.
 *
 * @return array{allowed: bool, retry_after: int}
 */
function rateLimitCheck(string $bucket, int $limit, int $windowSeconds, bool $consume = true, ?int $now = null): array
{
    $now ??= time();
    $windowSeconds = max(1, $windowSeconds);
    $dir = storagePath('ratelimit');
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        error_log("FurrGuard rate limit: no se puede crear {$dir}; se permite la petición");
        return ['allowed' => true, 'retry_after' => 0];
    }

    $handle = @fopen($dir . '/' . hash('sha256', $bucket) . '.json', 'c+');
    if ($handle === false) {
        error_log("FurrGuard rate limit: no se puede abrir el cubo en {$dir}; se permite la petición");
        return ['allowed' => true, 'retry_after' => 0];
    }
    try {
        if (!flock($handle, LOCK_EX)) {
            error_log('FurrGuard rate limit: flock falló; se permite la petición');
            return ['allowed' => true, 'retry_after' => 0];
        }
        $state = json_decode((string) stream_get_contents($handle), true);
        $result = rateLimitEvaluate(is_array($state) ? $state : [], $limit, $windowSeconds, $now, $consume);
        if ($consume && $result['allowed']) {
            ftruncate($handle, 0);
            rewind($handle);
            fwrite($handle, (string) json_encode($result['state']));
            fflush($handle);
        }
        flock($handle, LOCK_UN);
    } finally {
        fclose($handle);
    }

    if (random_int(1, 1000) === 1) {
        rateLimitCleanup();
    }
    return ['allowed' => $result['allowed'], 'retry_after' => $result['retry_after']];
}

/**
 * Lógica pura de la ventana deslizante.
 *
 * @param array<array-key, mixed> $state {start, current, previous}
 * @return array{allowed: bool, retry_after: int, state: array{start: int, current: int, previous: int}}
 */
function rateLimitEvaluate(array $state, int $limit, int $windowSeconds, int $now, bool $consume): array
{
    $windowStart = intdiv($now, $windowSeconds) * $windowSeconds;
    $storedStart = is_int($state['start'] ?? null) ? $state['start'] : 0;
    $current = is_int($state['current'] ?? null) ? $state['current'] : 0;
    $previous = is_int($state['previous'] ?? null) ? $state['previous'] : 0;

    if ($storedStart !== $windowStart) {
        $previous = $storedStart === $windowStart - $windowSeconds ? $current : 0;
        $current = 0;
    }

    $elapsed = $now - $windowStart;
    $remainingFraction = ($windowSeconds - $elapsed) / $windowSeconds;
    $estimate = $previous * $remainingFraction + $current;
    $allowed = $estimate + 1 <= $limit;

    $retryAfter = 0;
    if (!$allowed) {
        if ($current + 1 > $limit || $previous === 0) {
            $retryAfter = $windowSeconds - $elapsed;
        } else {
            // Momento de esta ventana en que previous*(w-t)/w + current + 1 <= limit.
            $needed = $windowSeconds - ($limit - $current - 1) * $windowSeconds / $previous;
            $retryAfter = (int) ceil($needed - $elapsed);
        }
        $retryAfter = max(1, $retryAfter);
    } elseif ($consume) {
        $current++;
    }

    return [
        'allowed' => $allowed,
        'retry_after' => $retryAfter,
        'state' => ['start' => $windowStart, 'current' => $current, 'previous' => $previous],
    ];
}

/**
 * Aplica un límite y, si se supera, responde 429 y termina. `$format`: 'panel' | 'plugin'.
 */
function rateLimitEnforce(string $bucket, int $limit, int $windowSeconds, string $format): void
{
    $result = rateLimitCheck($bucket, $limit, $windowSeconds);
    if (!$result['allowed']) {
        respondTooManyRequests($result['retry_after'], $format);
    }
}

/**
 * Borra cubos sin actividad. Devuelve cuántos archivos eliminó.
 */
function rateLimitCleanup(int $maxAgeSeconds = RATE_LIMIT_FILE_MAX_AGE): int
{
    $files = glob(storagePath('ratelimit') . '/*.json');
    $deleted = 0;
    $threshold = time() - $maxAgeSeconds;
    foreach ($files === false ? [] : $files as $file) {
        $mtime = @filemtime($file);
        if ($mtime !== false && $mtime < $threshold && @unlink($file)) {
            $deleted++;
        }
    }
    return $deleted;
}
