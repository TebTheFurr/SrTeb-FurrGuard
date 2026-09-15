<?php

declare(strict_types=1);

namespace FurrGuard\Tests\Unit;

use PHPUnit\Framework\TestCase;

/** Normalización de cada proveedor remoto a partir de respuestas reales (recortadas). */
final class GeoProvidersTest extends TestCase
{
    protected function tearDown(): void
    {
        self::setEnv('GEO_PROVIDERS', 'ip-api');
        self::setEnv('IPAPI_IS_API_KEY', null);
        self::setEnv('PROXYCHECK_API_KEY', null);
    }

    /** env() lee primero $_ENV (lo rellena el bootstrap), así que hay que tocar los dos sitios. */
    public static function setEnv(string $key, ?string $value): void
    {
        if ($value === null) {
            putenv($key);
            unset($_ENV[$key]);
            return;
        }
        putenv("{$key}={$value}");
        $_ENV[$key] = $value;
    }

    public function testProviderListFollowsEnvAndNeedsKeyForIpapiIs(): void
    {
        self::setEnv('GEO_PROVIDERS', 'proxycheck, ipapi-is,freeipapi,desconocido');
        self::assertSame(['proxycheck', 'freeipapi'], array_keys(geoProviders()), 'ipapi-is sin clave se omite');
        self::assertSame(90, geoProviders()['proxycheck']['budget']);
        self::setEnv('IPAPI_IS_API_KEY', 'k');
        self::setEnv('PROXYCHECK_API_KEY', 'p');
        self::assertSame(['proxycheck', 'ipapi-is', 'freeipapi'], array_keys(geoProviders()));
        self::assertSame(950, geoProviders()['proxycheck']['budget']);
        self::assertStringContainsString('key=p', geoProviderUrl('proxycheck', '1.1.1.1'));
        self::assertStringNotContainsString('key', geoProviderUrl('freeipapi', '1.1.1.1'));
    }

    public function testProxycheckIsNormalizedWithFlags(): void
    {
        $body = ['status' => 'ok', '3.5.140.2' => ['asn' => 'AS16509', 'provider' => 'Amazon.com, Inc.', 'organisation' => 'Amazon Data Services', 'continentcode' => 'AS', 'country' => 'South Korea', 'isocode' => 'KR', 'region' => 'Incheon', 'city' => 'Incheon', 'proxy' => 'yes', 'type' => 'VPN']];
        $data = geoProviderParse('proxycheck', '3.5.140.2', 200, [], $body)['data'];
        self::assertNotNull($data);
        self::assertSame(['KR', 'AS', 'AS16509 Amazon.com, Inc.', true, true, false, false], [$data['countryCode'], $data['continentCode'], $data['as'], $data['proxy'], $data['vpn'], $data['hosting'], $data['mobile']]);
        $hosting = geoProviderParse('proxycheck', '1.1.1.1', 200, [], ['status' => 'ok', '1.1.1.1' => ['isocode' => 'AU', 'proxy' => 'no', 'type' => 'Hosting', 'asn' => 'AS13335', 'provider' => 'Cloudflare']])['data'];
        self::assertSame([false, false, true], [$hosting['proxy'], $hosting['vpn'], $hosting['hosting']]);

        $denied = geoProviderParse('proxycheck', '1.1.1.1', 200, [], ['status' => 'denied', 'message' => 'You have exceeded your query limit']);
        self::assertSame(['data' => null, 'pause' => 3600], $denied, 'cuota agotada = pausa de una hora');
    }

    public function testIpapiIsAndFreeipapiAreNormalized(): void
    {
        $body = ['ip' => '3.5.140.2', 'is_proxy' => false, 'is_vpn' => false, 'is_datacenter' => true, 'is_mobile' => false, 'is_tor' => false,
            'company' => ['name' => 'Amazon Data Services'], 'asn' => ['asn' => 16509, 'org' => 'Amazon.com, Inc.'],
            'location' => ['continent' => 'AS', 'country_code' => 'KR', 'country' => 'South Korea', 'state' => 'Incheon', 'city' => 'Incheon', 'timezone' => 'Asia/Seoul']];
        $data = geoProviderParse('ipapi-is', '3.5.140.2', 200, [], $body)['data'];
        self::assertNotNull($data);
        self::assertSame(['KR', 'AS', 'AS16509 Amazon.com, Inc.', false, false, true, false], [$data['countryCode'], $data['continentCode'], $data['as'], $data['proxy'], $data['vpn'], $data['hosting'], $data['mobile']]);
        self::assertSame(['data' => null, 'pause' => 120], geoProviderParse('ipapi-is', '1.1.1.1', 429, ['retry-after' => '120'], null), 'respeta Retry-After');

        $free = geoProviderParse('freeipapi', '1.1.1.1', 200, [], ['countryCode' => 'AU', 'countryName' => 'Australia', 'continentCode' => 'OC', 'asn' => '13335', 'asnOrganization' => 'Cloudflare, Inc.', 'isProxy' => false, 'timeZones' => ['Australia/Sydney']])['data'];
        self::assertNotNull($free);
        self::assertSame(['AU', 'OC', 'AS13335 Cloudflare, Inc.', false, null, null, null, 'Australia/Sydney'], [$free['countryCode'], $free['continentCode'], $free['as'], $free['proxy'], $free['vpn'], $free['hosting'], $free['mobile'], $free['timezone']], 'las banderas que no aporta quedan desconocidas');
        self::assertSame('down', geoRemoteSummary(['ip-api' => 'down', 'freeipapi' => 'down']));
        self::assertSame('limited', geoRemoteSummary(['ip-api' => 'limited', 'freeipapi' => 'down']));
        self::assertSame('ok', geoRemoteSummary(['ip-api' => 'down', 'freeipapi' => 'ok']));
    }
}
