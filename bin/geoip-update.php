<?php

declare(strict_types=1);

/**
 * Descarga GeoLite2-Country y GeoLite2-ASN de MaxMind (cron dos veces por semana).
 *
 *   php bin/geoip-update.php
 *
 * Requiere MAXMIND_ACCOUNT_ID y MAXMIND_LICENSE_KEY. Verifica el SHA-256 publicado por MaxMind,
 * extrae el .mmdb y lo sustituye de forma atómica (temporal + rename) en GEOIP_COUNTRY_DB / GEOIP_ASN_DB.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit(1);
}

const MAXMIND_DOWNLOAD_URL = 'https://download.maxmind.com/geoip/databases/%s/download?suffix=%s';

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

if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) !== __FILE__) {
    return;
}

require_once dirname(__DIR__) . '/includes/bootstrap.php';

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
