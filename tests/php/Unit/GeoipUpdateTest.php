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
}
