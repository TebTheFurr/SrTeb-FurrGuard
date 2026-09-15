<?php

declare(strict_types=1);

namespace FurrGuard\Tests\Integration;

use PDO;

/**
 * Geolocalización y perfiles de Minecraft con proveedores falsos (sin red).
 */
final class GeoAndMinecraftDbTest extends DatabaseTestCase
{
    private PDO $db;
    private int $ipApiCalls = 0;
    private int $mojangCalls = 0;

    protected function setUp(): void
    {
        $this->db = self::migratedDatabase();
        foreach (['ip_cache', 'ip_api_logs', 'minecraft_profiles', 'minecraft_names_cache'] as $table) {
            $this->db->exec("DELETE FROM {$table}");
        }
        @unlink(ipApiPauseFile());
        $this->ipApiCalls = 0;
        $this->mojangCalls = 0;
    }

    protected function tearDown(): void
    {
        geoUseTestDoubles(null, null);
        minecraftUseHttpClient(null);
    }

    /**
     * @param array<string, mixed>|null $body
     * @param array<string, string> $headers
     */
    private function fakeIpApi(int $status, ?array $body, array $headers = ['x-rl' => '44', 'x-ttl' => '60']): void
    {
        geoUseTestDoubles(function (string $ip) use ($status, $body, $headers): array {
            $this->ipApiCalls++;
            return ['status' => $status, 'headers' => $headers, 'body' => $body === null ? null : (string) json_encode($body + ['query' => $ip])];
        }, null);
    }

    public function testIpApiSuccessIsCachedAndCountedOnce(): void
    {
        $this->fakeIpApi(200, ['status' => 'success', 'country' => 'Spain', 'countryCode' => 'ES', 'proxy' => true, 'isp' => 'ISP']);
        $first = geoLookup($this->db, '::ffff:8.8.8.8');
        self::assertSame('ip-api', $first['source']);
        self::assertFalse($first['degraded']);
        self::assertTrue($first['data']['proxy']);

        $second = geoLookup($this->db, '8.8.8.8');
        self::assertSame('cache', $second['source']);
        self::assertSame($first['data'], $second['data']);
        self::assertSame(1, $this->ipApiCalls);
        // B6: los aciertos de caché no consumen presupuesto.
        self::assertSame(1, ipApiRequestsLastMinute($this->db));
        self::assertSame('1', (string) $this->db->query('SELECT success FROM ip_api_logs')->fetchColumn());
        self::assertSame(86400, $this->ttl('8.8.8.8'));
    }

    public function testMergedWithMaxmindAndDegradedWhenIpApiFails(): void
    {
        $maxmind = static fn (string $ip): array => ['country' => 'Spain', 'countryCode' => 'ES', 'continentCode' => 'EU', 'as' => 'AS3352 Telefonica', 'org' => 'Telefonica'];
        geoUseTestDoubles(function (): array {
            $this->ipApiCalls++;
            return ['status' => 200, 'headers' => [], 'body' => '{"status":"success","isp":"Movistar","proxy":false,"hosting":false,"mobile":true}'];
        }, $maxmind);
        $merged = geoLookup($this->db, '8.8.4.4');
        self::assertSame('merged', $merged['source']);
        self::assertSame('Movistar', $merged['data']['isp']);
        self::assertSame('EU', $merged['data']['continentCode']);

        geoUseTestDoubles(function (): array {
            $this->ipApiCalls++;
            return ['status' => 0, 'headers' => [], 'body' => null];
        }, $maxmind);
        $degraded = geoLookup($this->db, '1.1.1.1');
        self::assertSame(['data' => $maxmind('1.1.1.1'), 'source' => 'maxmind', 'degraded' => true], $degraded);
        self::assertSame(300, $this->ttl('1.1.1.1'), 'fallo cacheado 5 min');
        self::assertSame('maxmind', geoLookup($this->db, '1.1.1.1')['source']);
        self::assertSame(2, $this->ipApiCalls, 'con un fallo reciente no se reintenta ip-api');
    }

    public function testBudgetAndRateHeadersStopRemoteCalls(): void
    {
        $this->fakeIpApi(200, ['status' => 'success', 'country' => 'X']);
        $this->db->exec('INSERT INTO ip_api_logs (ip, success, created_at) VALUES ' . implode(',', array_fill(0, IP_API_BUDGET_PER_MIN, "('9.9.9.9', 1, NOW())")));
        self::assertSame(['data' => [], 'source' => 'none', 'degraded' => false], geoLookup($this->db, '8.8.8.8'));
        self::assertSame(0, $this->ipApiCalls);
        self::assertSame('limited', ipApiStatus($this->db));
        self::assertSame(0, (int) $this->db->query("SELECT COUNT(*) FROM ip_cache")->fetchColumn(), 'sin petición real no se cachea fallo');

        $this->db->exec('DELETE FROM ip_api_logs');
        $this->fakeIpApi(200, ['status' => 'success', 'country' => 'X'], ['x-rl' => '0', 'x-ttl' => '40']);
        self::assertSame('ip-api', geoLookup($this->db, '8.8.8.8')['source']);
        self::assertGreaterThan(time() + 30, ipApiPausedUntil());
        self::assertSame('none', geoLookup($this->db, '9.9.9.9')['source'], 'X-Rl=0 pausa las llamadas');
        self::assertSame(1, $this->ipApiCalls);
    }

    public function testNoRemoteAndPrivateIps(): void
    {
        $this->fakeIpApi(200, ['status' => 'success', 'country' => 'X']);
        self::assertSame('none', geoLookup($this->db, '8.8.8.8', false)['source']);
        self::assertSame('none', geoLookup($this->db, '192.168.1.10')['source']);
        self::assertSame('none', geoLookup($this->db, 'nope')['source']);
        self::assertSame(0, $this->ipApiCalls);
        self::assertSame('ok', geoHealth($this->db)['ip_api']);
        self::assertContains(geoHealth($this->db)['geo_mirror'], ['missing', 'ok']);

        $this->db->exec("INSERT INTO ip_api_logs (ip, success, created_at) VALUES
            ('8.8.8.8', 0, NOW() - INTERVAL 3 MINUTE), ('8.8.8.8', 0, NOW() - INTERVAL 2 MINUTE), ('8.8.8.8', 0, NOW() - INTERVAL 1 MINUTE)");
        self::assertSame('down', geoHealth($this->db)['ip_api']);
    }

    public function testProfileByNameCachesPremiumAndNotFoundButNotUnknown(): void
    {
        $responses = [
            'Notch' => ['status' => 200, 'headers' => [], 'body' => '{"id":"069a79f444e94726a5befca90e38aaf5","name":"Notch"}'],
            'NoSuchPlayer' => ['status' => 404, 'headers' => [], 'body' => '{"errorMessage":"not found"}'],
            'Busy' => ['status' => 429, 'headers' => [], 'body' => null],
        ];
        minecraftUseHttpClient(function (string $url) use ($responses): array {
            $this->mojangCalls++;
            return $responses[basename($url)] ?? ['status' => 500, 'headers' => [], 'body' => null];
        });

        $premium = ['status' => 'premium', 'uuid' => '069a79f4-44e9-4726-a5be-fca90e38aaf5', 'name' => 'Notch'];
        self::assertSame($premium, minecraftProfileByName($this->db, 'Notch'));
        self::assertSame($premium, minecraftProfileByName($this->db, 'notch'), 'caché sin distinguir mayúsculas');
        self::assertSame(['status' => 'not_found', 'uuid' => null, 'name' => null], minecraftProfileByName($this->db, 'NoSuchPlayer'));
        self::assertSame('not_found', minecraftProfileByName($this->db, 'NoSuchPlayer')['status']);
        self::assertSame('unknown', minecraftProfileByName($this->db, 'Busy')['status']);
        self::assertSame('unknown', minecraftProfileByName($this->db, 'Busy')['status']);
        self::assertSame('unknown', minecraftProfileByName($this->db, 'Other', false)['status']);
        self::assertSame('not_found', minecraftProfileByName($this->db, '.BedrockUser')['status']);
        self::assertSame(4, $this->mojangCalls, 'Notch 1 + NoSuchPlayer 1 + Busy 2 (unknown no se cachea)');
        self::assertSame(0, (int) $this->db->query("SELECT COUNT(*) FROM minecraft_profiles WHERE lookup_name = 'Busy'")->fetchColumn());
    }

    public function testNamesByUuidSkipOfflineAndLimitRemoteCalls(): void
    {
        minecraftUseHttpClient(function (string $url): array {
            $this->mojangCalls++;
            $uuid = basename($url);
            return str_ends_with($uuid, 'aaf5')
                ? ['status' => 200, 'headers' => [], 'body' => '{"id":"' . str_replace('-', '', $uuid) . '","name":"Notch"}']
                : ['status' => 404, 'headers' => [], 'body' => null];
        });
        $mojang = '069a79f4-44e9-4726-a5be-fca90e38aaf5';
        $missing = '069a79f4-44e9-4726-a5be-fca90e38aaf6';
        $offline = '5627dd98-e6be-3c21-b8a8-e92344183641';

        self::assertSame('Notch', minecraftNameByUuid($this->db, strtoupper($mojang)));
        self::assertNull(minecraftNameByUuid($this->db, $offline));
        self::assertNull(minecraftNameByUuid($this->db, $missing));
        self::assertNull(minecraftNameByUuid($this->db, $missing), 'caché negativa');
        self::assertSame(2, $this->mojangCalls);

        $this->db->exec('DELETE FROM minecraft_names_cache');
        $this->mojangCalls = 0;
        $many = [$mojang, $offline, $missing, '069a79f4-44e9-4726-a5be-fca90e38aaf7', '069a79f4-44e9-4726-a5be-fca90e38aaf8'];
        self::assertSame([$mojang => 'Notch'], minecraftNamesForUuids($this->db, $many, 2));
        self::assertSame(2, $this->mojangCalls);
    }

    public function testNameHistoryReportsSourcesThatDidNotAnswer(): void
    {
        self::assertSame(
            ['uuid' => null, 'history' => [['name' => 'Notch', 'changed_at' => null]], 'complete' => false, 'failed_sources' => ['mojang', 'laby', 'namemc']],
            $this->nameHistoryWithDown(['api.mojang.com', 'namemc.com'], 'Notch'),
            'todo caído (sin Mojang no hay UUID para Laby): solo el nombre pedido, pero avisando'
        );

        $full = $this->nameHistoryWithDown([], 'Notch');
        self::assertSame([true, [], ['OldNotch', 'Notch']], [$full['complete'], $full['failed_sources'], array_column($full['history'], 'name')]);

        $partial = $this->nameHistoryWithDown(['laby.net'], 'notch');
        self::assertSame(['069a79f4-44e9-4726-a5be-fca90e38aaf5', false, ['laby']], [$partial['uuid'], $partial['complete'], $partial['failed_sources']]);

        $this->db->exec('DELETE FROM minecraft_profiles');
        $nonPremium = $this->nameHistoryWithDown([], 'NoPremium_1');
        self::assertSame([true, []], [$nonPremium['complete'], $nonPremium['failed_sources']], 'nick sin cuenta de Mojang: sin Laby, pero completo');
    }

    /**
     * Historial con Mojang, Laby y NameMC falsos; los hosts de `$down` no responden.
     *
     * @param list<string> $down
     * @return array{uuid: ?string, history: list<array{name: string, changed_at: ?string}>, complete: bool, failed_sources: list<string>}
     */
    private function nameHistoryWithDown(array $down, string $name): array
    {
        minecraftUseHttpClient(static function (string $url) use ($down): array {
            $host = (string) parse_url($url, PHP_URL_HOST);
            return match (true) {
                in_array($host, $down, true) => ['status' => $host === 'api.mojang.com' ? 429 : 403, 'headers' => [], 'body' => null],
                $host === 'api.mojang.com' => str_ends_with(strtolower($url), '/notch')
                    ? ['status' => 200, 'headers' => [], 'body' => '{"id":"069a79f444e94726a5befca90e38aaf5","name":"Notch"}']
                    : ['status' => 404, 'headers' => [], 'body' => null],
                $host === 'laby.net' => ['status' => 200, 'headers' => [], 'body' => '[{"name":"OldNotch","changed_at":null},{"name":"Notch","changed_at":"2015-01-01T00:00:00Z"}]'],
                default => ['status' => 200, 'headers' => [], 'body' => '<html>sin tabla de nombres</html>'],
            };
        });
        return minecraftNameHistory($this->db, $name);
    }

    private function ttl(string $ip): int
    {
        $stmt = $this->db->prepare('SELECT TIMESTAMPDIFF(SECOND, NOW(), expires_at) FROM ip_cache WHERE ip = ?');
        $stmt->execute([$ip]);
        $seconds = (int) $stmt->fetchColumn();
        return (int) (round($seconds / 60) * 60);
    }
}
