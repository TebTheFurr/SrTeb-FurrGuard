<?php

declare(strict_types=1);

/**
 * Geolocalización: caché en BD, espejo MaxMind local y un balanceador de proveedores remotos de
 * igual prioridad (ip-api.com, proxycheck.io, ipapi.is y freeipapi.com).
 *
 * Cada consulta remota empieza por un proveedor elegido al azar (reparto uniforme sin estado
 * compartido) y, si ese está caído, en pausa por límite o sin presupuesto, pasa al siguiente hasta
 * agotar la cadena o el plazo total. Cada proveedor tiene su presupuesto (por minuto o por día,
 * contado en `ip_api_logs`) y su pausa (archivo en `storage/ratelimit`) cuando responde 429 o
 * avisa de que se agotó la cuota.
 *
 * Todas las respuestas se normalizan al formato de ip-api (`country`, `countryCode`, `continent`,
 * `continentCode`, `regionName`, `city`, `isp`, `org`, `as`, `asname`, `proxy`, `vpn`, `hosting`,
 * `mobile`, `lat`, `lon`, `timezone`, `source`). Una bandera que el proveedor no aporta vale null
 * (desconocida), nunca false; los resultados de proveedores sin hosting/móvil ("parciales") se
 * cachean 1 h en vez de 24 h para que la siguiente conexión los complete con otro proveedor.
 */

const GEO_REMOTE_CONNECT_TIMEOUT = 3;
const GEO_REMOTE_TIMEOUT = 5;
const GEO_REMOTE_TOTAL_BUDGET = 6.5;   // segundos para toda la cadena: el plugin espera 8 s en total
const GEO_CACHE_SUCCESS_TTL = 86400;
const GEO_CACHE_PARTIAL_TTL = 3600;
const GEO_CACHE_FAIL_TTL = 300;
const GEO_MAXMIND_FILL_FIELDS = ['country', 'countryCode', 'continent', 'continentCode', 'as', 'org'];
const GEO_DEFAULT_PROVIDERS = 'ip-api,proxycheck,ipapi-is,freeipapi';
const IP_API_BUDGET_PER_MIN = 40;
const IP_API_CONNECT_TIMEOUT = GEO_REMOTE_CONNECT_TIMEOUT;
const IP_API_TIMEOUT = GEO_REMOTE_TIMEOUT;
const IP_API_FIELDS = 'status,message,continent,continentCode,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,as,asname,mobile,proxy,hosting,query';

/**
 * Dobles para tests: transporte remoto (recibe `$ip, $proveedor, $url` y devuelve `{status, headers, body}`)
 * y consulta MaxMind.
 *
 * @return array{ip_api: ?callable, maxmind: ?callable, start: ?int}
 */
function &geoTestDoubles(): array
{
    static $doubles = ['ip_api' => null, 'maxmind' => null, 'start' => null];
    return $doubles;
}

function geoUseTestDoubles(?callable $ipApiTransport, ?callable $maxmindLookup, ?int $firstProvider = null): void
{
    $doubles = &geoTestDoubles();
    $doubles = ['ip_api' => $ipApiTransport, 'maxmind' => $maxmindLookup, 'start' => $firstProvider];
}

/**
 * Datos de una IP: caché → MaxMind → proveedores remotos → mezcla. `degraded` es true cuando solo
 * respondió MaxMind. Una IP privada o reservada nunca tiene datos.
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
    // Un fallo reciente en caché (5 min) evita volver a esperar por esa IP.
    if ($cached === null && $allowRemote) {
        $remote = geoRemoteLookup($db, $ip);
        if ($remote['data'] !== null) {
            $merged = geoMerge($remote['data'], $maxmind);
            geoCacheWrite($db, $ip, 'success', $merged, $remote['partial'] ? GEO_CACHE_PARTIAL_TTL : GEO_CACHE_SUCCESS_TTL);
            return ['data' => $merged, 'source' => $maxmind === null ? (string) $remote['source'] : 'merged', 'degraded' => false];
        }
        if ($remote['attempted']) {
            geoCacheWrite($db, $ip, 'fail', [], GEO_CACHE_FAIL_TTL);
        }
    }

    return $maxmind === null ? $none : ['data' => $maxmind, 'source' => 'maxmind', 'degraded' => true];
}

/**
 * El proveedor remoto manda; MaxMind solo rellena país, continente, ASN y organización vacíos.
 *
 * @param array<string, mixed> $remote
 * @param array<string, mixed>|null $maxmind
 * @return array<string, mixed>
 */
function geoMerge(array $remote, ?array $maxmind): array
{
    foreach (GEO_MAXMIND_FILL_FIELDS as $field) {
        $current = $remote[$field] ?? null;
        if (($current === null || $current === '') && isset($maxmind[$field]) && $maxmind[$field] !== '') {
            $remote[$field] = $maxmind[$field];
        }
    }
    return $remote;
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

// ─── Proveedores remotos (balanceador) ──────────────────────────────────────

/**
 * Proveedores activos según `GEO_PROVIDERS` (lista separada por comas; por defecto los cuatro).
 * `ipapi-is` se omite sin `IPAPI_IS_API_KEY` (sin clave no devuelve banderas). `window` es
 * 'minute' o 'day'; `partial` marca a los que no aportan hosting/móvil.
 *
 * @return array<string, array{window: string, budget: int, partial: bool}>
 */
function geoProviders(): array
{
    $all = [
        'ip-api' => ['window' => 'minute', 'budget' => IP_API_BUDGET_PER_MIN, 'partial' => false],
        'proxycheck' => ['window' => 'day', 'budget' => env('PROXYCHECK_API_KEY') === '' ? 90 : 950, 'partial' => false],
        'ipapi-is' => ['window' => 'day', 'budget' => 950, 'partial' => false],
        'freeipapi' => ['window' => 'minute', 'budget' => 50, 'partial' => true],
    ];
    $configured = env('GEO_PROVIDERS') !== '' ? env('GEO_PROVIDERS') : GEO_DEFAULT_PROVIDERS;
    $active = [];
    foreach (array_filter(array_map('trim', explode(',', $configured))) as $name) {
        if (isset($all[$name]) && ($name !== 'ipapi-is' || env('IPAPI_IS_API_KEY') !== '')) {
            $active[$name] = $all[$name];
        }
    }
    return $active;
}

function geoProviderUrl(string $provider, string $ip): string
{
    return match ($provider) {
        'ip-api' => 'http://ip-api.com/json/' . $ip . '?fields=' . IP_API_FIELDS,
        'proxycheck' => 'https://proxycheck.io/v2/' . $ip . '?vpn=1&asn=1'
            . (env('PROXYCHECK_API_KEY') !== '' ? '&key=' . rawurlencode(env('PROXYCHECK_API_KEY')) : ''),
        'ipapi-is' => 'https://api.ipapi.is/?q=' . $ip . '&key=' . rawurlencode(env('IPAPI_IS_API_KEY')),
        'freeipapi' => 'https://free.freeipapi.com/api/v1/json/' . $ip,
        default => throw new InvalidArgumentException("Proveedor de geolocalización desconocido: {$provider}"),
    };
}

/**
 * Consulta remota con reparto de carga: empieza por un proveedor al azar y recorre los demás si
 * falla. Respeta el plazo total para que el login del plugin no expire.
 *
 * @return array{data: ?array<string, mixed>, partial: bool, source: ?string, attempted: bool}
 */
function geoRemoteLookup(PDO $db, string $ip): array
{
    $providers = geoProviders();
    $names = array_keys($providers);
    $count = count($names);
    $attempted = false;
    $deadline = microtime(true) + GEO_REMOTE_TOTAL_BUDGET;
    $start = $count > 0 ? (geoTestDoubles()['start'] ?? random_int(0, $count - 1)) % $count : 0;
    for ($i = 0; $i < $count; $i++) {
        $name = $names[($start + $i) % $count];
        $remaining = $deadline - microtime(true);
        if ($remaining < 1.5 || !geoBudgetAvailable($db, $name)) {
            continue;
        }
        $attempted = true;
        $data = geoProviderFetch($db, $name, $ip, (int) min(GEO_REMOTE_TIMEOUT, ceil($remaining)));
        if ($data !== null) {
            return ['data' => $data, 'partial' => $providers[$name]['partial'], 'source' => $name, 'attempted' => true];
        }
    }
    return ['data' => null, 'partial' => false, 'source' => null, 'attempted' => $attempted];
}

/**
 * Una petición a un proveedor. Reserva el hueco en `ip_api_logs` antes de llamar (así las
 * peticiones concurrentes lo cuentan), marca `success` solo si la respuesta trajo datos válidos y
 * activa la pausa del proveedor si avisa de límite.
 *
 * @return array<string, mixed>|null datos normalizados o null
 */
function geoProviderFetch(PDO $db, string $provider, string $ip, int $timeout): ?array
{
    $db->prepare('INSERT INTO ip_api_logs (provider, ip, success, created_at) VALUES (?, ?, 0, NOW())')->execute([$provider, $ip]);
    $logId = (int) $db->lastInsertId();

    $url = geoProviderUrl($provider, $ip);
    $doubles = geoTestDoubles();
    $response = $doubles['ip_api'] !== null
        ? ($doubles['ip_api'])($ip, $provider, $url)
        : httpGet($url, GEO_REMOTE_CONNECT_TIMEOUT, max(2, $timeout));
    $body = $response['status'] === 200 && is_string($response['body']) ? json_decode($response['body'], true) : null;
    $parsed = geoProviderParse($provider, $ip, (int) $response['status'], $response['headers'], is_array($body) ? $body : null);
    if ($parsed['pause'] > 0) {
        geoPauseUntil($provider, time() + $parsed['pause']);
    }
    if ($parsed['data'] === null) {
        return null;
    }
    $db->prepare('UPDATE ip_api_logs SET success = 1 WHERE id = ?')->execute([$logId]);
    return $parsed['data'] + ['source' => $provider];
}

/**
 * Normaliza la respuesta de un proveedor al formato de ip-api y decide la pausa (segundos, 0 = ninguna).
 *
 * @param array<string, string> $headers cabeceras en minúsculas
 * @param array<string, mixed>|null $body
 * @return array{data: ?array<string, mixed>, pause: int}
 */
function geoProviderParse(string $provider, string $ip, int $status, array $headers, ?array $body): array
{
    $str = static fn (mixed $value): ?string => is_string($value) && trim($value) !== '' ? trim($value) : (is_int($value) ? (string) $value : null);
    $bool = static fn (mixed $value): ?bool => is_bool($value) ? $value : null;
    $daily = in_array($provider, ['proxycheck', 'ipapi-is'], true);
    $pause = 0;
    if ($status === 429) {
        $retry = isset($headers['retry-after']) && ctype_digit($headers['retry-after']) ? (int) $headers['retry-after'] : ($daily ? 3600 : 60);
        $pause = max(1, min($retry, 3600));
    }
    if ($provider === 'ip-api') {
        $pause = max($pause, ipApiPauseFromResponse($status, $headers));
        if ($body === null || ($body['status'] ?? null) !== 'success') {
            return ['data' => null, 'pause' => $pause];
        }
        return ['data' => $body + ['vpn' => null], 'pause' => $pause];
    }
    if ($body === null) {
        return ['data' => null, 'pause' => $pause];
    }
    if ($provider === 'proxycheck') {
        $record = $body[$ip] ?? null;
        if (!is_array($record) || !in_array($body['status'] ?? '', ['ok', 'warning'], true)) {
            $message = strtolower((string) ($body['message'] ?? ''));
            $exhausted = ($body['status'] ?? '') === 'denied' || str_contains($message, 'limit') || str_contains($message, 'exceeded');
            return ['data' => null, 'pause' => max($pause, $exhausted ? 3600 : 0)];
        }
        $type = (string) ($record['type'] ?? '');
        $asn = $str($record['asn'] ?? null);
        $isp = $str($record['provider'] ?? null);
        return ['pause' => $pause, 'data' => [
            'country' => $str($record['country'] ?? null), 'countryCode' => $str($record['isocode'] ?? null),
            'continent' => $str($record['continent'] ?? null), 'continentCode' => $str($record['continentcode'] ?? null),
            'regionName' => $str($record['region'] ?? null), 'city' => $str($record['city'] ?? null),
            'isp' => $isp, 'org' => $str($record['organisation'] ?? null) ?? $isp,
            'as' => $asn === null ? null : trim($asn . ' ' . ($isp ?? '')), 'asname' => $isp,
            'proxy' => ($record['proxy'] ?? 'no') === 'yes',
            'vpn' => strcasecmp($type, 'VPN') === 0 || strcasecmp($type, 'OpenVPN') === 0,
            'hosting' => strcasecmp($type, 'Hosting') === 0,
            'mobile' => strcasecmp($type, 'Wireless') === 0,
            'lat' => $record['latitude'] ?? null, 'lon' => $record['longitude'] ?? null, 'timezone' => $str($record['timezone'] ?? null),
        ]];
    }
    if ($provider === 'ipapi-is') {
        $location = is_array($body['location'] ?? null) ? $body['location'] : null;
        if ($location === null || isset($body['error'])) {
            return ['data' => null, 'pause' => $pause];
        }
        $asn = is_array($body['asn'] ?? null) ? $body['asn'] : [];
        $company = is_array($body['company'] ?? null) ? $body['company'] : [];
        $asNumber = isset($asn['asn']) && is_int($asn['asn']) ? 'AS' . $asn['asn'] : null;
        $asOrg = $str($asn['org'] ?? null);
        return ['pause' => $pause, 'data' => [
            'country' => $str($location['country'] ?? null), 'countryCode' => $str($location['country_code'] ?? null),
            'continent' => null, 'continentCode' => $str($location['continent'] ?? null),
            'regionName' => $str($location['state'] ?? null), 'city' => $str($location['city'] ?? null),
            'isp' => $asOrg ?? $str($company['name'] ?? null), 'org' => $str($company['name'] ?? null) ?? $asOrg,
            'as' => $asNumber === null ? null : trim($asNumber . ' ' . ($asOrg ?? '')), 'asname' => $asOrg,
            'proxy' => ($bool($body['is_proxy'] ?? null) ?? false) || ($bool($body['is_tor'] ?? null) ?? false),
            'vpn' => $bool($body['is_vpn'] ?? null), 'hosting' => $bool($body['is_datacenter'] ?? null), 'mobile' => $bool($body['is_mobile'] ?? null),
            'lat' => $location['latitude'] ?? null, 'lon' => $location['longitude'] ?? null, 'timezone' => $str($location['timezone'] ?? null),
        ]];
    }
    // freeipapi: país, continente, ASN y proxy; sin VPN, hosting ni móvil (resultado parcial).
    $countryCode = $str($body['countryCode'] ?? null);
    if ($countryCode === null) {
        return ['data' => null, 'pause' => $pause];
    }
    $asn = $str($body['asn'] ?? null);
    $asOrg = $str($body['asnOrganization'] ?? null);
    $timezones = is_array($body['timeZones'] ?? null) ? $body['timeZones'] : [];
    return ['pause' => $pause, 'data' => [
        'country' => $str($body['countryName'] ?? null), 'countryCode' => $countryCode,
        'continent' => $str($body['continent'] ?? null), 'continentCode' => $str($body['continentCode'] ?? null),
        'regionName' => $str($body['regionName'] ?? null), 'city' => $str($body['cityName'] ?? null),
        'isp' => $asOrg, 'org' => $asOrg,
        'as' => $asn === null ? null : trim('AS' . ltrim($asn, 'AS') . ' ' . ($asOrg ?? '')), 'asname' => $asOrg,
        'proxy' => $bool($body['isProxy'] ?? null), 'vpn' => null, 'hosting' => null, 'mobile' => null,
        'lat' => $body['latitude'] ?? null, 'lon' => $body['longitude'] ?? null, 'timezone' => $str($timezones[0] ?? null),
    ]];
}

/**
 * Segundos de espera que pide ip-api según `X-Rl` (peticiones restantes) y `X-Ttl` (segundos hasta
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

// ─── Presupuesto y pausas por proveedor ─────────────────────────────────────

function geoPauseFile(string $provider): string
{
    return storagePath('ratelimit/' . $provider . '-pause');
}

function geoPauseUntil(string $provider, int $timestamp): void
{
    $file = geoPauseFile($provider);
    $dir = dirname($file);
    if ((is_dir($dir) || @mkdir($dir, 0700, true)) && @file_put_contents($file, (string) $timestamp, LOCK_EX) !== false) {
        return;
    }
    error_log("FurrGuard geo: no se pudo guardar la pausa de {$provider} por límite de peticiones");
}

function geoPausedUntil(string $provider): int
{
    $value = @file_get_contents(geoPauseFile($provider));
    return is_string($value) && ctype_digit(trim($value)) ? (int) trim($value) : 0;
}

/** Peticiones reales del proveedor en su ventana (60 s o 24 h). */
function geoRequestsInWindow(PDO $db, string $provider): int
{
    $window = (geoProviders()[$provider]['window'] ?? 'minute') === 'day' ? 'INTERVAL 24 HOUR' : 'INTERVAL 60 SECOND';
    $stmt = $db->prepare("SELECT COUNT(*) FROM ip_api_logs WHERE provider = ? AND created_at > NOW() - {$window}");
    $stmt->execute([$provider]);
    return (int) $stmt->fetchColumn();
}

function geoBudgetAvailable(PDO $db, string $provider): bool
{
    $definition = geoProviders()[$provider] ?? null;
    return $definition !== null && geoPausedUntil($provider) <= time() && geoRequestsInWindow($db, $provider) < $definition['budget'];
}

// Nombres antiguos de las funciones de ip-api, ahora sobre el proveedor "ip-api".
function ipApiPauseFile(): string
{
    return geoPauseFile('ip-api');
}

function ipApiPauseUntil(int $timestamp): void
{
    geoPauseUntil('ip-api', $timestamp);
}

function ipApiPausedUntil(): int
{
    return geoPausedUntil('ip-api');
}

function ipApiBudgetAvailable(PDO $db): bool
{
    return geoBudgetAvailable($db, 'ip-api');
}

function ipApiRequestsLastMinute(PDO $db): int
{
    return geoRequestsInWindow($db, 'ip-api');
}

/**
 * @return array{data: ?array<string, mixed>, attempted: bool}
 */
function ipApiFetch(PDO $db, string $ip): array
{
    if (!geoBudgetAvailable($db, 'ip-api')) {
        return ['data' => null, 'attempted' => false];
    }
    return ['data' => geoProviderFetch($db, 'ip-api', $ip, GEO_REMOTE_TIMEOUT), 'attempted' => true];
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
 * Salud para el panel y `--status`: `ip_api` resume todos los proveedores remotos (ok si alguno
 * responde, limited si todos están en pausa o sin presupuesto, down si todos fallan) y `providers`
 * detalla cada uno.
 *
 * @return array{geo_mirror: string, ip_api: string, providers: array<string, string>}
 */
function geoHealth(PDO $db): array
{
    $providers = geoRemoteStatus($db);
    return ['geo_mirror' => geoMirrorStatus(), 'ip_api' => geoRemoteSummary($providers), 'providers' => $providers];
}

/**
 * @param array<string, string> $providers
 */
function geoRemoteSummary(array $providers): string
{
    if ($providers === []) {
        return 'down';
    }
    if (in_array('ok', $providers, true)) {
        return 'ok';
    }
    return in_array('limited', $providers, true) ? 'limited' : 'down';
}

/**
 * Estado por proveedor activo: `limited` (pausa o presupuesto agotado), `down` (las últimas tres
 * peticiones fallaron en los últimos 15 min) u `ok`.
 *
 * @return array<string, string>
 */
function geoRemoteStatus(PDO $db): array
{
    $statuses = [];
    foreach (array_keys(geoProviders()) as $provider) {
        $statuses[$provider] = geoProviderStatus($db, $provider);
    }
    return $statuses;
}

function geoProviderStatus(PDO $db, string $provider): string
{
    if (!geoBudgetAvailable($db, $provider)) {
        return 'limited';
    }
    $stmt = $db->prepare(
        'SELECT success FROM ip_api_logs
         WHERE provider = ? AND created_at < NOW() - INTERVAL 10 SECOND AND created_at > NOW() - INTERVAL 15 MINUTE
         ORDER BY id DESC LIMIT 3'
    );
    $stmt->execute([$provider]);
    $recent = $stmt->fetchAll(PDO::FETCH_COLUMN);
    if (count($recent) === 3 && !in_array(1, array_map('intval', $recent), true)) {
        return 'down';
    }
    return 'ok';
}

/** Resumen de todos los proveedores remotos (nombre antiguo). */
function ipApiStatus(PDO $db): string
{
    return geoRemoteSummary(geoRemoteStatus($db));
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

