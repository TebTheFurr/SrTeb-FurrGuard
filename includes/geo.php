<?php

declare(strict_types=1);

/**
 * FurrGuard - geolocalización (docs/API.md §6).
 *
 * Orden: `ip_cache` vigente → espejo local MaxMind (GeoLite2-Country + GeoLite2-ASN) → ip-api
 * (plan gratuito, presupuesto 40/min contando solo peticiones reales) → combinación.
 * ip-api manda en ISP/proxy/hosting/mobile; MaxMind rellena país, continente y ASN.
 */

const IP_API_BUDGET_PER_MIN = 40;
const IP_API_CONNECT_TIMEOUT = 3;
const IP_API_TIMEOUT = 5;
const IP_API_FIELDS = 'status,message,continent,continentCode,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,as,asname,mobile,proxy,hosting,query';
const GEO_CACHE_SUCCESS_TTL = 86400;
const GEO_CACHE_FAIL_TTL = 300;
const GEO_MAXMIND_FILL_FIELDS = ['country', 'countryCode', 'continent', 'continentCode', 'as', 'org'];

/**
 * Sustitutos para tests. `ip_api`: fn(string $ip): array{status:int, headers:array<string,string>, body:?string}.
 * `maxmind`: fn(string $ip): ?array (claves estilo ip-api).
 *
 * @return array{ip_api: ?callable, maxmind: ?callable}
 */
function &geoTestDoubles(): array
{
    static $doubles = ['ip_api' => null, 'maxmind' => null];
    return $doubles;
}

function geoUseTestDoubles(?callable $ipApiTransport, ?callable $maxmindLookup): void
{
    $doubles = &geoTestDoubles();
    $doubles = ['ip_api' => $ipApiTransport, 'maxmind' => $maxmindLookup];
}

/**
 * Datos de geolocalización de una IP.
 *
 * - `source`: 'cache' | 'ip-api' | 'maxmind' | 'merged' | 'none'.
 * - `degraded`: true si no hay datos de ip-api (proxy/hosting/mobile sin evaluar) pero sí de MaxMind.
 * - Con `$allowRemote = false` (recheck_players) nunca llama a ip-api.
 *
 * @return array{data: array<string, mixed>, source: string, degraded: bool}
 */
function geoLookup(PDO $db, string $ip, bool $allowRemote = true): array
{
    $none = ['data' => [], 'source' => 'none', 'degraded' => false];
    $ip = normalizeIp($ip);
    if ($ip === null || filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
        return $none;
    }

    $cached = geoCacheRead($db, $ip);
    if ($cached !== null && $cached['status'] === 'success') {
        return ['data' => $cached['data'], 'source' => 'cache', 'degraded' => false];
    }

    $maxmind = geoMaxmindLookup($ip);
    // Un fallo reciente en caché (5 min) evita reintentar ip-api para esa IP.
    if ($cached === null && $allowRemote) {
        $remote = ipApiFetch($db, $ip);
        if ($remote['data'] !== null) {
            $merged = geoMerge($remote['data'], $maxmind);
            geoCacheWrite($db, $ip, 'success', $merged, GEO_CACHE_SUCCESS_TTL);
            return ['data' => $merged, 'source' => $maxmind === null ? 'ip-api' : 'merged', 'degraded' => false];
        }
        if ($remote['attempted']) {
            geoCacheWrite($db, $ip, 'fail', [], GEO_CACHE_FAIL_TTL);
        }
    }

    return $maxmind === null ? $none : ['data' => $maxmind, 'source' => 'maxmind', 'degraded' => true];
}

/**
 * ip-api manda; MaxMind solo rellena país, continente, ASN y organización vacíos.
 *
 * @param array<string, mixed> $ipApi
 * @param array<string, mixed>|null $maxmind
 * @return array<string, mixed>
 */
function geoMerge(array $ipApi, ?array $maxmind): array
{
    foreach (GEO_MAXMIND_FILL_FIELDS as $field) {
        $current = $ipApi[$field] ?? null;
        if (($current === null || $current === '') && isset($maxmind[$field]) && $maxmind[$field] !== '') {
            $ipApi[$field] = $maxmind[$field];
        }
    }
    return $ipApi;
}

/**
 * @return array{status: string, data: array<string, mixed>}|null Fila vigente o null.
 */
function geoCacheRead(PDO $db, string $ip): ?array
{
    $stmt = $db->prepare('SELECT status, data FROM ip_cache WHERE ip = ? AND expires_at > NOW()');
    $stmt->execute([$ip]);
    $row = $stmt->fetch();
    if (!is_array($row) || !in_array($row['status'], ['success', 'fail'], true)) {
        return null;
    }
    $data = json_decode((string) $row['data'], true);
    if (!is_array($data)) {
        return null;
    }
    /** @var array<string, mixed> $data */
    return ['status' => $row['status'], 'data' => $data];
}

/**
 * @param array<string, mixed> $data
 */
function geoCacheWrite(PDO $db, string $ip, string $status, array $data, int $ttlSeconds): void
{
    $db->prepare(
        'INSERT INTO ip_cache (ip, data, status, expires_at) VALUES (?, ?, ?, NOW() + INTERVAL ? SECOND)
         ON DUPLICATE KEY UPDATE data = VALUES(data), status = VALUES(status), expires_at = VALUES(expires_at)'
    )->execute([$ip, json_encode((object) $data, JSON_FLAGS), $status, $ttlSeconds]);
}

// ─── ip-api ─────────────────────────────────────────────────────────────────

/**
 * Llama a ip-api si hay presupuesto. `attempted` indica si se hizo una petición real.
 *
 * @return array{data: array<string, mixed>|null, attempted: bool}
 */
function ipApiFetch(PDO $db, string $ip): array
{
    if (!ipApiBudgetAvailable($db)) {
        return ['data' => null, 'attempted' => false];
    }
    // Se reserva el hueco antes de llamar para que las peticiones concurrentes lo cuenten.
    $db->prepare('INSERT INTO ip_api_logs (ip, success, created_at) VALUES (?, 0, NOW())')->execute([$ip]);
    $logId = (int) $db->lastInsertId();

    $doubles = geoTestDoubles();
    $response = $doubles['ip_api'] !== null
        ? ($doubles['ip_api'])($ip)
        : httpGet('http://ip-api.com/json/' . $ip . '?fields=' . IP_API_FIELDS, IP_API_CONNECT_TIMEOUT, IP_API_TIMEOUT);

    $pauseSeconds = ipApiPauseFromResponse($response['status'], $response['headers']);
    if ($pauseSeconds > 0) {
        ipApiPauseUntil(time() + $pauseSeconds);
    }

    $decoded = $response['status'] === 200 && $response['body'] !== null ? json_decode($response['body'], true) : null;
    if (is_array($decoded)) {
        $db->prepare('UPDATE ip_api_logs SET success = 1 WHERE id = ?')->execute([$logId]);
    }
    if (!is_array($decoded) || ($decoded['status'] ?? null) !== 'success') {
        return ['data' => null, 'attempted' => true];
    }
    /** @var array<string, mixed> $decoded */
    return ['data' => $decoded, 'attempted' => true];
}

/**
 * Segundos que hay que esperar según `X-Rl` (peticiones restantes) y `X-Ttl` (segundos hasta
 * reiniciar la ventana). 0 si se puede seguir llamando.
 *
 * @param array<string, string> $headers cabeceras en minúsculas
 */
function ipApiPauseFromResponse(int $status, array $headers): int
{
    $remaining = $headers['x-rl'] ?? null;
    $ttl = isset($headers['x-ttl']) && ctype_digit($headers['x-ttl']) ? (int) $headers['x-ttl'] : 60;
    if ($status === 429 || $remaining === '0') {
        return max(1, min($ttl, 3600));
    }
    return 0;
}

function ipApiPauseFile(): string
{
    return storagePath('ratelimit/ip-api-pause');
}

function ipApiPauseUntil(int $timestamp): void
{
    $file = ipApiPauseFile();
    $dir = dirname($file);
    if ((is_dir($dir) || @mkdir($dir, 0700, true)) && @file_put_contents($file, (string) $timestamp, LOCK_EX) !== false) {
        return;
    }
    error_log('FurrGuard ip-api: no se pudo guardar la pausa por límite de peticiones');
}

function ipApiPausedUntil(): int
{
    $value = @file_get_contents(ipApiPauseFile());
    return is_string($value) && ctype_digit(trim($value)) ? (int) trim($value) : 0;
}

function ipApiBudgetAvailable(PDO $db): bool
{
    return ipApiPausedUntil() <= time() && ipApiRequestsLastMinute($db) < IP_API_BUDGET_PER_MIN;
}

function ipApiRequestsLastMinute(PDO $db): int
{
    return (int) $db->query('SELECT COUNT(*) FROM ip_api_logs WHERE created_at > NOW() - INTERVAL 60 SECOND')->fetchColumn();
}

// ─── MaxMind ────────────────────────────────────────────────────────────────

/**
 * Ruta de una base GeoLite2 (`country` | `asn`). Rutas relativas respecto a la raíz del proyecto.
 */
function geoDatabasePath(string $edition): string
{
    $configured = env($edition === 'country' ? 'GEOIP_COUNTRY_DB' : 'GEOIP_ASN_DB');
    if ($configured === '') {
        return storagePath($edition === 'country' ? 'geoip/GeoLite2-Country.mmdb' : 'geoip/GeoLite2-ASN.mmdb');
    }
    $absolute = str_starts_with($configured, '/') || str_starts_with($configured, '\\') || preg_match('/^[A-Za-z]:[\\\\\/]/', $configured) === 1;
    return $absolute ? $configured : FURRGUARD_ROOT . '/' . $configured;
}

function geoMaxmindReader(string $edition): ?\MaxMind\Db\Reader
{
    static $readers = [];
    if (array_key_exists($edition, $readers)) {
        return $readers[$edition];
    }
    $readers[$edition] = null;
    $path = geoDatabasePath($edition);
    if (!class_exists(\MaxMind\Db\Reader::class) || !is_file($path) || !is_readable($path)) {
        return null;
    }
    try {
        $readers[$edition] = new \MaxMind\Db\Reader($path);
    } catch (Throwable $e) {
        error_log("FurrGuard GeoIP: no se pudo abrir {$path}: " . $e->getMessage());
    }
    return $readers[$edition];
}

/**
 * País, continente, ASN y organización desde las bases locales, o null si no hay datos.
 *
 * @return array<string, mixed>|null
 */
function geoMaxmindLookup(string $ip): ?array
{
    $doubles = geoTestDoubles();
    if ($doubles['maxmind'] !== null) {
        $result = ($doubles['maxmind'])($ip);
        return is_array($result) && $result !== [] ? $result : null;
    }

    $data = [];
    try {
        $country = geoMaxmindReader('country')?->get($ip);
        if (is_array($country)) {
            $place = $country['country'] ?? $country['registered_country'] ?? null;
            if (is_array($place)) {
                if (is_string($place['iso_code'] ?? null)) {
                    $data['countryCode'] = $place['iso_code'];
                }
                if (is_string($place['names']['en'] ?? null)) {
                    $data['country'] = $place['names']['en'];
                }
            }
            if (is_string($country['continent']['code'] ?? null)) {
                $data['continentCode'] = $country['continent']['code'];
            }
            if (is_string($country['continent']['names']['en'] ?? null)) {
                $data['continent'] = $country['continent']['names']['en'];
            }
        }
        $asn = geoMaxmindReader('asn')?->get($ip);
        if (is_array($asn) && is_int($asn['autonomous_system_number'] ?? null)) {
            $organization = is_string($asn['autonomous_system_organization'] ?? null) ? $asn['autonomous_system_organization'] : '';
            $data['as'] = trim('AS' . $asn['autonomous_system_number'] . ' ' . $organization);
            if ($organization !== '') {
                $data['org'] = $organization;
            }
        }
    } catch (Throwable $e) {
        error_log('FurrGuard GeoIP: error de lectura: ' . $e->getMessage());
    }
    return $data === [] ? null : $data;
}

// ─── Estado ─────────────────────────────────────────────────────────────────

/**
 * @return array{geo_mirror: string, ip_api: string} geo_mirror: ok|missing|disabled; ip_api: ok|limited|down
 */
function geoHealth(PDO $db): array
{
    return ['geo_mirror' => geoMirrorStatus(), 'ip_api' => ipApiStatus($db)];
}

/**
 * 'disabled' si falta la librería (composer install), 'missing' si faltan las bases, 'ok' si están.
 */
function geoMirrorStatus(): string
{
    if (geoTestDoubles()['maxmind'] !== null) {
        return 'ok';
    }
    if (!class_exists(\MaxMind\Db\Reader::class)) {
        return 'disabled';
    }
    foreach (['country', 'asn'] as $edition) {
        $path = geoDatabasePath($edition);
        if (!is_file($path) || !is_readable($path)) {
            return 'missing';
        }
    }
    return 'ok';
}

/**
 * 'limited' si está en pausa o sin presupuesto; 'down' si las últimas peticiones completadas fallaron.
 */
function ipApiStatus(PDO $db): string
{
    if (!ipApiBudgetAvailable($db)) {
        return 'limited';
    }
    $recent = $db->query(
        'SELECT success FROM ip_api_logs
         WHERE created_at < NOW() - INTERVAL 10 SECOND AND created_at > NOW() - INTERVAL 15 MINUTE
         ORDER BY id DESC LIMIT 3'
    )->fetchAll(PDO::FETCH_COLUMN);
    if ($recent !== [] && !in_array(1, array_map('intval', $recent), true)) {
        return 'down';
    }
    return 'ok';
}
