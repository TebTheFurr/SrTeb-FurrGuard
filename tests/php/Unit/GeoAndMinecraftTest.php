<?php

declare(strict_types=1);

namespace FurrGuard\Tests\Unit;

use PHPUnit\Framework\TestCase;

final class GeoAndMinecraftTest extends TestCase
{
    public function testMergeKeepsIpApiAndFillsFromMaxmind(): void
    {
        $ipApi = ['status' => 'success', 'country' => '', 'countryCode' => 'ES', 'isp' => 'Telefonica', 'proxy' => false, 'as' => ''];
        $maxmind = ['country' => 'Spain', 'countryCode' => 'FR', 'continentCode' => 'EU', 'as' => 'AS3352 Telefonica', 'isp' => 'ignored'];
        $merged = geoMerge($ipApi, $maxmind);
        self::assertSame('Spain', $merged['country']);
        self::assertSame('ES', $merged['countryCode'], 'ip-api manda si trae el dato');
        self::assertSame('EU', $merged['continentCode']);
        self::assertSame('AS3352 Telefonica', $merged['as']);
        self::assertSame('Telefonica', $merged['isp'], 'MaxMind nunca pisa el ISP');
        self::assertFalse($merged['proxy']);
        self::assertSame($ipApi, geoMerge($ipApi, null));
    }

    public function testIpApiRateHeaders(): void
    {
        self::assertSame(0, ipApiPauseFromResponse(200, ['x-rl' => '44', 'x-ttl' => '60']));
        self::assertSame(37, ipApiPauseFromResponse(200, ['x-rl' => '0', 'x-ttl' => '37']));
        self::assertSame(60, ipApiPauseFromResponse(429, []));
        self::assertSame(12, ipApiPauseFromResponse(429, ['x-ttl' => '12']));
        self::assertSame(0, ipApiPauseFromResponse(0, []));
    }

    public function testMojangUuidDetection(): void
    {
        self::assertTrue(isMojangUuid('069a79f4-44e9-4726-a5be-fca90e38aaf5'));
        // UUID offline v3 de "OfflinePlayer:Steve" y UUID de Floodgate (v0): nunca existen en Mojang.
        self::assertFalse(isMojangUuid('5627dd98-e6be-3c21-b8a8-e92344183641'));
        self::assertFalse(isMojangUuid('00000000-0000-0000-0009-01f2a3b4c5d6'));
        self::assertFalse(isMojangUuid('bad'));
    }

    public function testParseMojangProfile(): void
    {
        $ok = ['status' => 200, 'headers' => [], 'body' => '{"id":"069a79f444e94726a5befca90e38aaf5","name":"Notch"}'];
        self::assertSame(['uuid' => '069a79f4-44e9-4726-a5be-fca90e38aaf5', 'name' => 'Notch'], parseMojangProfile($ok));
        self::assertNull(parseMojangProfile(['status' => 200, 'headers' => [], 'body' => '{"id":"x","name":"Notch"}']));
        self::assertNull(parseMojangProfile(['status' => 429, 'headers' => [], 'body' => '{"id":"069a79f444e94726a5befca90e38aaf5","name":"Notch"}']));
        self::assertNull(parseMojangProfile(['status' => 200, 'headers' => [], 'body' => '<html>']));
    }

    public function testMergeNameHistorySources(): void
    {
        $rows = [
            ['name' => 'OldName', 'changed_at' => null],
            ['name' => 'MidName', 'changed_at' => '2020-05-01T10:00:00+02:00'],
            ['name' => 'oldname', 'changed_at' => null],
            ['name' => 'CurrentName', 'changed_at' => '2021-01-01T00:00:00Z'],
            ['name' => 'MIDNAME', 'changed_at' => null],
        ];
        self::assertSame([
            ['name' => 'OldName', 'changed_at' => null],
            ['name' => 'MidName', 'changed_at' => '2020-05-01 08:00:00'],
            ['name' => 'CurrentName', 'changed_at' => '2021-01-01 00:00:00'],
        ], mergeNameHistorySources($rows, 'CurrentName'));
        self::assertSame([['name' => 'Solo', 'changed_at' => null]], mergeNameHistorySources([], 'Solo'));
    }
}
