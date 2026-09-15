<?php

declare(strict_types=1);

/**
 * Descarga GeoLite2-Country y GeoLite2-ASN de MaxMind (cron dos veces por semana).
 *
 *   php bin/geoip-update.php                 descarga/actualiza las bases
 *   php bin/geoip-update.php --status        informe del espejo (alias --check); --ip=1.2.3.4 cambia la IP de prueba
 *   php bin/geoip-update.php --help
 *
 * La descarga requiere MAXMIND_ACCOUNT_ID y MAXMIND_LICENSE_KEY. Verifica el SHA-256 publicado por MaxMind,
 * extrae el .mmdb y lo sustituye de forma atómica (temporal + rename) en GEOIP_COUNTRY_DB / GEOIP_ASN_DB.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit(1);
}

const MAXMIND_DOWNLOAD_URL = 'https://download.maxmind.com/geoip/databases/%s/download?suffix=%s';
const GEOIP_STATUS_TEST_IP = '8.8.8.8';
const GEOIP_STATUS_MAX_AGE_DAYS = 30;
const GEOIP_STATUS_EDITIONS = ['country' => ['GeoLite2-Country', 'GEOIP_COUNTRY_DB'], 'asn' => ['GeoLite2-ASN', 'GEOIP_ASN_DB']];
const GEOIP_STATUS_HELP = <<<'TXT'
Uso: php bin/geoip-update.php [--status|--check] [--ip=IP] [--help]

  (sin opciones)     descarga GeoLite2-Country y GeoLite2-ASN (requiere MAXMIND_ACCOUNT_ID y MAXMIND_LICENSE_KEY)
  --status, --check  comprueba el lector, las bases, las credenciales y el estado del espejo; salida 0 solo si todo responde
  --ip=IP            IP pública para la consulta de prueba de --status (por defecto 8.8.8.8)
  --help, -h         esta ayuda

TXT;

/**
 * Descarga a un archivo (o a memoria si `$target` es null). Lanza RuntimeException si falla.
 */
function maxmindDownload(string $url, string $credentials, ?string $target): string
{
    $handle = $target === null ? null : fopen($target, 'wb');
    if ($handle === false) {
        throw new RuntimeException("No se puede escribir {$target}");
    }
    $ch = curl_init($url);
    if ($ch === false) {
        throw new RuntimeException('No se pudo iniciar curl');
    }
    curl_setopt_array($ch, [
        CURLOPT_USERPWD => $credentials,
        CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
        CURLOPT_FOLLOWLOCATION => true, // redirige al almacenamiento de MaxMind; curl no reenvía la autenticación a otro host
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT => 300,
        CURLOPT_USERAGENT => 'FurrGuard/' . FURRGUARD_VERSION,
        CURLOPT_FAILONERROR => true,
    ]);
    if ($handle !== null) {
        curl_setopt($ch, CURLOPT_FILE, $handle);
    } else {
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    }
    $result = curl_exec($ch);
    $error = curl_error($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($handle !== null) {
        fclose($handle);
    }
    if ($result === false) {
        throw new RuntimeException("Descarga fallida (HTTP {$status}): {$error}");
    }
    return is_string($result) ? $result : '';
}

/**
 * Copia `<edición>.mmdb` desde el tar.gz de MaxMind (va dentro de una carpeta con fecha).
 */
function extractMmdbFromArchive(string $archive, string $edition, string $destination): void
{
    $found = null;
    foreach (new RecursiveIteratorIterator(new PharData($archive)) as $entry) {
        if ($entry instanceof SplFileInfo && $entry->getFilename() === "{$edition}.mmdb") {
            $found = $entry->getPathname();
            break;
        }
    }
    if ($found === null || !copy($found, $destination)) {
        throw new RuntimeException("El archivo no contiene {$edition}.mmdb");
    }
}

function updateGeoDatabase(string $edition, string $target, string $credentials): void
{
    $dir = dirname($target);
    if (!is_dir($dir) && !mkdir($dir, 0750, true) && !is_dir($dir)) {
        throw new RuntimeException("No se puede crear {$dir}");
    }

    $checksum = maxmindDownload(sprintf(MAXMIND_DOWNLOAD_URL, $edition, 'tar.gz.sha256'), $credentials, null);
    if (!preg_match('/^([0-9a-f]{64})\b/i', trim($checksum), $m)) {
        throw new RuntimeException('Respuesta de SHA-256 inválida');
    }
    $expected = strtolower($m[1]);

    $suffix = bin2hex(random_bytes(6));
    $archive = "{$dir}/.{$edition}-{$suffix}.tar.gz";
    $temporary = "{$target}.{$suffix}.tmp";
    try {
        maxmindDownload(sprintf(MAXMIND_DOWNLOAD_URL, $edition, 'tar.gz'), $credentials, $archive);
        $actual = hash_file('sha256', $archive);
        if ($actual === false || !hash_equals($expected, $actual)) {
            throw new RuntimeException('El SHA-256 del archivo descargado no coincide');
        }

        extractMmdbFromArchive($archive, $edition, $temporary);
        if (class_exists(\MaxMind\Db\Reader::class)) {
            (new \MaxMind\Db\Reader($temporary))->close(); // lanza si la base está corrupta
        }
        chmod($temporary, 0640);
        if (!rename($temporary, $target)) {
            throw new RuntimeException("No se pudo sustituir {$target}");
        }
    } finally {
        foreach ([$archive, $temporary] as $file) {
            if (is_file($file)) {
                @unlink($file);
            }
        }
    }
}

// ─── --status ───────────────────────────────────────────────────────────────

/**
 * Versión de maxmind-db/reader según `vendor/composer/installed.json`, o null si no consta.
 */
function maxmindReaderVersion(): ?string
{
    $decoded = is_file(FURRGUARD_ROOT . '/vendor/composer/installed.json')
        ? json_decode((string) file_get_contents(FURRGUARD_ROOT . '/vendor/composer/installed.json'), true)
        : null;
    $packages = is_array($decoded) ? ($decoded['packages'] ?? $decoded) : [];
    foreach (is_array($packages) ? $packages : [] as $package) {
        if (is_array($package) && ($package['name'] ?? null) === 'maxmind-db/reader' && is_string($package['version'] ?? null)) {
            return $package['version'];
        }
    }
    return null;
}

/**
 * Metadatos y consulta de prueba de una base. `answer` es la lectura resumida (país o ASN) o null.
 *
 * @return array{edition: string, env: string, configured: string, path: string, exists: bool, size: ?int, build_epoch: ?int, age_days: ?int, type: ?string, answer: ?string, error: ?string}
 */
function geoStatusDatabase(string $key, string $ip, bool $readerInstalled): array
{
    [$edition, $env] = GEOIP_STATUS_EDITIONS[$key];
    $path = geoDatabasePath($key);
    $exists = is_file($path) && is_readable($path);
    $info = [
        'edition' => $edition, 'env' => $env, 'configured' => env($env), 'path' => $path, 'exists' => $exists,
        'size' => $exists ? (int) filesize($path) : null,
        'build_epoch' => null, 'age_days' => null, 'type' => null, 'answer' => null, 'error' => null,
    ];
    if (!$exists || !$readerInstalled) {
        return $info;
    }
    try {
        $reader = new \MaxMind\Db\Reader($path);
        $metadata = $reader->metadata();
        $record = $reader->get($ip);
        $reader->close();
        return [
            ...$info,
            'build_epoch' => $metadata->buildEpoch,
            'age_days' => intdiv(max(0, time() - $metadata->buildEpoch), 86400),
            'type' => $metadata->databaseType,
            'answer' => is_array($record) ? geoStatusAnswer($key, $record) : null,
        ];
    } catch (Throwable $e) {
        return [...$info, 'error' => $e->getMessage()];
    }
}

/**
 * @param array<string, mixed> $record
 */
function geoStatusAnswer(string $key, array $record): ?string
{
    if ($key === 'asn') {
        $number = $record['autonomous_system_number'] ?? null;
        $organization = $record['autonomous_system_organization'] ?? '';
        return is_int($number) ? trim("AS{$number} " . (is_string($organization) ? $organization : '')) : null;
    }
    $place = $record['country'] ?? $record['registered_country'] ?? null;
    $code = is_array($place) && is_string($place['iso_code'] ?? null) ? $place['iso_code'] : null;
    $name = is_array($place) && is_string($place['names']['en'] ?? null) ? " ({$place['names']['en']})" : '';
    return $code === null ? null : $code . $name;
}

/**
 * Informe de `--status`. `ok` (salida 0) exige espejo `ok` y respuesta de las dos consultas de prueba.
 * `$readerInstalled` solo se fuerza desde los tests (simular `disabled` sin tocar vendor/).
 *
 * @return array{ip: string, reader: array{installed: bool, version: ?string}, databases: array<string, array{edition: string, env: string, configured: string, path: string, exists: bool, size: ?int, build_epoch: ?int, age_days: ?int, type: ?string, answer: ?string, error: ?string}>, credentials: array<string, bool>, mirror: string, ip_api: ?string, db_error: ?string, ok: bool}
 */
function geoStatusReport(string $ip = GEOIP_STATUS_TEST_IP, ?PDO $db = null, ?string $dbError = null, ?bool $readerInstalled = null): array
{
    $readerInstalled ??= class_exists(\MaxMind\Db\Reader::class);
    $databases = [];
    foreach (array_keys(GEOIP_STATUS_EDITIONS) as $key) {
        $databases[$key] = geoStatusDatabase($key, $ip, $readerInstalled);
    }
    $mirror = $readerInstalled ? geoMirrorStatus() : 'disabled';
    $ipApi = null;
    if ($db !== null) {
        try {
            $ipApi = ipApiStatus($db);
        } catch (Throwable $e) {
            $dbError = $e->getMessage();
        }
    }
    $answered = array_filter($databases, static fn (array $info): bool => $info['answer'] !== null);
    return [
        'ip' => $ip,
        'reader' => ['installed' => $readerInstalled, 'version' => $readerInstalled ? maxmindReaderVersion() : null],
        'databases' => $databases,
        'credentials' => ['MAXMIND_ACCOUNT_ID' => env('MAXMIND_ACCOUNT_ID') !== '', 'MAXMIND_LICENSE_KEY' => env('MAXMIND_LICENSE_KEY') !== ''],
        'mirror' => $mirror,
        'ip_api' => $ipApi,
        'db_error' => $dbError,
        'ok' => $mirror === 'ok' && count($answered) === count($databases),
    ];
}

/**
 * @param array{ip: string, reader: array{installed: bool, version: ?string}, databases: array<string, array{edition: string, env: string, configured: string, path: string, exists: bool, size: ?int, build_epoch: ?int, age_days: ?int, type: ?string, answer: ?string, error: ?string}>, credentials: array<string, bool>, mirror: string, ip_api: ?string, db_error: ?string, ok: bool} $report
 */
function geoStatusRender(array $report): string
{
    $lines = ['FurrGuard: estado del espejo GeoIP (MaxMind)', ''];
    $lines[] = 'Lector MaxMind (maxmind-db/reader): ' . ($report['reader']['installed']
        ? 'instalado' . ($report['reader']['version'] !== null ? ', versión ' . $report['reader']['version'] : '')
        : 'NO instalado. Ejecuta `composer install --no-dev` en la raíz del proyecto');
    foreach ($report['databases'] as $info) {
        $lines[] = '';
        $lines[] = $info['edition'];
        $lines[] = sprintf('  Variable:   %s', $info['configured'] === '' ? "{$info['env']} sin definir (ruta por defecto)" : "{$info['env']}={$info['configured']}");
        $lines[] = sprintf('  Ruta:       %s', $info['path']);
        $lines[] = sprintf('  Archivo:    %s', $info['exists'] ? 'existe, ' . geoStatusSize((int) $info['size']) : 'NO existe o no es legible');
        if ($info['build_epoch'] !== null) {
            $age = (int) $info['age_days'];
            $lines[] = sprintf(
                '  Compilada:  %s UTC, hace %d días%s',
                gmdate('Y-m-d', $info['build_epoch']),
                $age,
                $age > GEOIP_STATUS_MAX_AGE_DAYS ? sprintf(' — AVISO: más de %d días, ejecuta php bin/geoip-update.php', GEOIP_STATUS_MAX_AGE_DAYS) : ''
            );
            $lines[] = sprintf('  Tipo:       %s', (string) $info['type']);
        }
        if ($info['error'] !== null) {
            $lines[] = sprintf('  Error:      %s', $info['error']);
        } elseif ($info['exists'] && $report['reader']['installed']) {
            $lines[] = sprintf('  Consulta %s: %s', $report['ip'], $info['answer'] ?? 'sin resultado (la IP no está en la base)');
        }
    }
    $missing = array_keys(array_filter($report['credentials'], static fn (bool $defined): bool => !$defined));
    $lines[] = '';
    $lines[] = 'Credenciales de actualización: ' . ($missing === []
        ? 'MAXMIND_ACCOUNT_ID y MAXMIND_LICENSE_KEY definidas'
        : 'faltan ' . implode(' y ', $missing) . ' en .env (necesarias solo para descargar)');
    if ($report['ip'] === GEOIP_STATUS_TEST_IP) {
        $lines[] = 'Esperado para 8.8.8.8: país US, AS15169 (Google)';
    }
    $lines[] = '';
    $lines[] = 'Espejo (como lo ve el panel): ' . $report['mirror'] . ' — ' . match ($report['mirror']) {
        'ok' => 'las dos bases están y se pueden leer',
        'missing' => 'faltan las bases o PHP no puede leerlas: ejecuta php bin/geoip-update.php con el usuario de la web y revisa permisos y rutas GEOIP_*',
        default => 'falta el lector: ejecuta `composer install --no-dev` y vuelve a comprobar',
    };
    $lines[] = 'ip-api: ' . ($report['ip_api'] ?? 'no comprobado, la base de datos no conecta' . ($report['db_error'] !== null ? " ({$report['db_error']})" : ''));
    $lines[] = '';
    $lines[] = $report['ok'] ? 'Resultado: OK (salida 0)' : 'Resultado: FALLO, el espejo no está operativo (salida 1)';
    return implode(PHP_EOL, $lines) . PHP_EOL;
}

function geoStatusSize(int $bytes): string
{
    return $bytes >= 1048576 ? sprintf('%.1f MB', $bytes / 1048576) : sprintf('%.0f KB', $bytes / 1024);
}

if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) !== __FILE__) {
    return;
}

require_once dirname(__DIR__) . '/includes/bootstrap.php';

if (in_array('--help', $argv, true) || in_array('-h', $argv, true)) {
    fwrite(STDOUT, GEOIP_STATUS_HELP);
    exit(0);
}

if (in_array('--status', $argv, true) || in_array('--check', $argv, true)) {
    $ip = GEOIP_STATUS_TEST_IP;
    foreach ($argv as $argument) {
        if (str_starts_with($argument, '--ip=')) {
            $ip = substr($argument, 5);
        }
    }
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
        fwrite(STDERR, "--ip debe ser una IP pública válida\n");
        exit(1);
    }
    $db = null;
    $dbError = null;
    try {
        $db = dbConnect(dbConfigFromEnv());
    } catch (Throwable $e) {
        $dbError = $e->getMessage();
    }
    $report = geoStatusReport($ip, $db, $dbError);
    fwrite(STDOUT, geoStatusRender($report));
    exit($report['ok'] ? 0 : 1);
}

$accountId = env('MAXMIND_ACCOUNT_ID');
$licenseKey = env('MAXMIND_LICENSE_KEY');
if ($accountId === '' || $licenseKey === '') {
    fwrite(STDERR, "Faltan MAXMIND_ACCOUNT_ID y/o MAXMIND_LICENSE_KEY en .env\n");
    exit(1);
}

$failed = false;
foreach (['GeoLite2-Country' => geoDatabasePath('country'), 'GeoLite2-ASN' => geoDatabasePath('asn')] as $edition => $target) {
    try {
        updateGeoDatabase($edition, $target, $accountId . ':' . $licenseKey);
        fwrite(STDOUT, "{$edition}: actualizada en {$target}\n");
    } catch (Throwable $e) {
        $failed = true;
        fwrite(STDERR, "{$edition}: " . $e->getMessage() . PHP_EOL);
    }
}
exit($failed ? 1 : 0);
