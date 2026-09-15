<?php

declare(strict_types=1);

namespace FurrGuard\Tests\Unit;

use PharData;
use PHPUnit\Framework\TestCase;
use RuntimeException;

final class GeoipUpdateTest extends TestCase
{
    public function testExtractsMmdbFromMaxmindArchiveLayout(): void
    {
        require_once dirname(__DIR__, 3) . '/bin/geoip-update.php';
        $dir = storagePath('geoip-test-' . bin2hex(random_bytes(4)));
        mkdir($dir, 0700, true);

        // Se comprime a mano con otro nombre: leer en el mismo proceso un .tar.gz recién creado con
        // PharData::compress() devuelve contenidos vacíos por la caché interna de phar.
        $tar = new PharData($dir . '/source.tar');
        $tar->addFromString('GeoLite2-Country_20260915/COPYRIGHT.txt', 'copyright');
        $tar->addFromString('GeoLite2-Country_20260915/GeoLite2-Country.mmdb', 'fake-mmdb-bytes');
        unset($tar);
        file_put_contents($dir . '/GeoLite2-Country.tar.gz', gzencode((string) file_get_contents($dir . '/source.tar')));

        extractMmdbFromArchive($dir . '/GeoLite2-Country.tar.gz', 'GeoLite2-Country', $dir . '/out.mmdb');
        self::assertSame('fake-mmdb-bytes', file_get_contents($dir . '/out.mmdb'));

        $this->expectException(RuntimeException::class);
        extractMmdbFromArchive($dir . '/GeoLite2-Country.tar.gz', 'GeoLite2-ASN', $dir . '/asn.mmdb');
    }

    public function testStatusReportIsMissingWithoutDatabasesAndDisabledWithoutReader(): void
    {
        require_once dirname(__DIR__, 3) . '/bin/geoip-update.php';
        $missingDir = storagePath('geoip-status-' . bin2hex(random_bytes(4)));
        putenv("GEOIP_COUNTRY_DB={$missingDir}/GeoLite2-Country.mmdb");
        putenv("GEOIP_ASN_DB={$missingDir}/GeoLite2-ASN.mmdb");
        try {
            $report = geoStatusReport('8.8.8.8', null, 'sin base de datos');
            self::assertSame('missing', $report['mirror']);
            self::assertFalse($report['ok']);
            self::assertTrue($report['reader']['installed']);
            self::assertSame("{$missingDir}/GeoLite2-Country.mmdb", $report['databases']['country']['path']);
            self::assertFalse($report['databases']['country']['exists']);
            self::assertNull($report['databases']['asn']['answer']);
            self::assertNull($report['ip_api']);
            $text = geoStatusRender($report);
            self::assertStringContainsString('Espejo (como lo ve el panel): missing', $text);
            self::assertStringContainsString('GEOIP_COUNTRY_DB=' . $missingDir, $text);
            self::assertStringContainsString('sin base de datos', $text);
            self::assertStringContainsString('salida 1', $text);

            $disabled = geoStatusReport('8.8.8.8', null, null, false);
            self::assertSame('disabled', $disabled['mirror']);
            self::assertFalse($disabled['ok']);
            self::assertFalse($disabled['reader']['installed']);
            self::assertStringContainsString('composer install --no-dev', geoStatusRender($disabled));
        } finally {
            putenv('GEOIP_COUNTRY_DB');
            putenv('GEOIP_ASN_DB');
        }
    }

    public function testStatusReportIsOkWhenBothDatabasesAnswer(): void
    {
        require_once dirname(__DIR__, 3) . '/bin/geoip-update.php';
        $country = getenv('FG_TEST_GEOIP_COUNTRY_DB');
        $asn = getenv('FG_TEST_GEOIP_ASN_DB');
        if (!is_string($country) || !is_file($country) || !is_string($asn) || !is_file($asn)) {
            self::markTestSkipped('Define FG_TEST_GEOIP_COUNTRY_DB y FG_TEST_GEOIP_ASN_DB con las bases de prueba de MaxMind (test-data).');
        }
        putenv("GEOIP_COUNTRY_DB={$country}");
        putenv("GEOIP_ASN_DB={$asn}");
        try {
            // 216.160.83.56 está en las dos bases de prueba de MaxMind: US y AS209.
            $report = geoStatusReport('216.160.83.56');
            self::assertSame('ok', $report['mirror']);
            self::assertTrue($report['ok']);
            self::assertStringStartsWith('US', (string) $report['databases']['country']['answer']);
            self::assertStringStartsWith('AS209', (string) $report['databases']['asn']['answer']);
            self::assertSame('GeoLite2-Country', $report['databases']['country']['type']);
            self::assertIsInt($report['databases']['country']['build_epoch']);
            self::assertStringContainsString('salida 0', geoStatusRender($report));
        } finally {
            putenv('GEOIP_COUNTRY_DB');
            putenv('GEOIP_ASN_DB');
        }
    }
}
