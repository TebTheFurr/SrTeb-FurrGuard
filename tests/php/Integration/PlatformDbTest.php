<?php

declare(strict_types=1);

namespace FurrGuard\Tests\Integration;

use InvalidArgumentException;
use PDO;

/**
 * Ajustes, API key, auditoría y limpieza contra MariaDB/MySQL.
 */
final class PlatformDbTest extends DatabaseTestCase
{
    private PDO $db;

    protected function setUp(): void
    {
        $this->db = self::migratedDatabase();
        $this->db->exec('DELETE FROM activity_logs');
    }

    public function testGetSettingUsesStoredValueThenDefault(): void
    {
        $this->db->exec("DELETE FROM settings WHERE `key` IN ('block_mobile', 'server_name')");
        self::assertSame('0', getSetting($this->db, 'block_mobile'));
        self::assertSame('x', getSetting($this->db, 'server_name', 'x'));
        setSetting($this->db, 'server_name', 'Red');
        self::assertSame('Red', getSetting($this->db, 'server_name'));
        self::assertSame(['server_name' => 'Red', 'block_mobile' => '0'], getSettings($this->db, ['server_name', 'block_mobile']));
        self::assertNull(getSetting($this->db, 'no_such_key'));
    }

    public function testSaveChangedSettingsOnlyWritesChangesAndLogsWithoutSecrets(): void
    {
        setSetting($this->db, 'block_vpn', '1');
        setSetting($this->db, 'server_name', 'Antes');
        $version = (int) getSetting($this->db, 'cache_version');

        $changed = saveChangedSettings($this->db, validateSettingsInput(['block_vpn' => 1, 'server_name' => 'Después']), 'Tester');
        self::assertSame(['server_name'], $changed);
        self::assertSame('Después', getSetting($this->db, 'server_name'));
        self::assertSame($version + 1, (int) getSetting($this->db, 'cache_version'));
        $log = $this->db->query("SELECT type, action, details FROM activity_logs ORDER BY id DESC LIMIT 1")->fetch();
        self::assertSame('settings', $log['type']);
        self::assertStringContainsString('server_name: Antes → Después', (string) $log['details']);
        self::assertStringNotContainsString('block_vpn', (string) $log['details']);

        self::assertSame([], saveChangedSettings($this->db, ['server_name' => 'Después']));
        self::assertSame($version + 1, (int) getSetting($this->db, 'cache_version'), 'sin cambios no se incrementa');

        $panel = settingsForPanel($this->db);
        self::assertArrayHasKey('furrsecurity_verify_url', $panel);
        self::assertArrayNotHasKey('api_key_hash', $panel);
        self::assertArrayNotHasKey('cache_version', $panel);
    }

    public function testIncrementCacheVersionIsAtomicAndSelfHealing(): void
    {
        $this->db->exec("DELETE FROM settings WHERE `key` = 'cache_version'");
        self::assertSame(1, incrementCacheVersion($this->db));
        $other = dbConnect(self::testDbConfig());
        self::assertSame(2, incrementCacheVersion($other));
        self::assertSame(3, incrementCacheVersion($this->db));
        self::assertSame('3', getSetting($this->db, 'cache_version'));
    }

    public function testApiKeyLifecycle(): void
    {
        $this->db->exec("DELETE FROM settings WHERE `key` LIKE 'api\\_key%'");
        self::assertFalse(apiKeyConfigured($this->db));
        self::assertSame(['configured' => false, 'prefix' => null, 'created_at' => null], apiKeyInfo($this->db));
        self::assertFalse(apiKeyValidate($this->db, API_KEY_PLACEHOLDER));

        $first = apiKeyRegenerate($this->db, 'Tester');
        self::assertMatchesRegularExpression('/^fg_[0-9a-f]{48}\z/', $first['api_key']);
        self::assertSame(substr($first['api_key'], 0, 10), $first['prefix']);
        self::assertTrue(apiKeyValidate($this->db, $first['api_key']));
        self::assertNotSame($first['api_key'], getSetting($this->db, 'api_key_hash'), 'solo se guarda el hash');
        $info = apiKeyInfo($this->db);
        self::assertTrue($info['configured']);
        self::assertMatchesRegularExpression('/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\z/', (string) $info['created_at']);

        $second = apiKeyRegenerate($this->db);
        self::assertFalse(apiKeyValidate($this->db, $first['api_key']), 'la anterior deja de valer');
        self::assertTrue(apiKeyValidate($this->db, $second['api_key']));
        $details = (string) $this->db->query("SELECT details FROM activity_logs WHERE action = 'api_key_regenerated' ORDER BY id DESC LIMIT 1")->fetchColumn();
        self::assertStringNotContainsString($second['api_key'], $details);
    }

    public function testLogActivityValidatesType(): void
    {
        logActivity($this->db, 'auth', str_repeat('a', 150), 'detalle', '::ffff:1.2.3.4');
        $row = $this->db->query('SELECT type, action, ip_address FROM activity_logs ORDER BY id DESC LIMIT 1')->fetch();
        self::assertSame(['type' => 'auth', 'action' => str_repeat('a', 100), 'ip_address' => '1.2.3.4'], $row);
        logActivity($this->db, 'players', 'cli');
        self::assertNull($this->db->query('SELECT ip_address FROM activity_logs ORDER BY id DESC LIMIT 1')->fetchColumn());
        $this->expectException(InvalidArgumentException::class);
        logActivity($this->db, 'login', 'x');
    }

    public function testCleanupRemovesExpiredData(): void
    {
        require_once dirname(__DIR__, 3) . '/bin/cleanup.php';
        $db = $this->db;
        $db->exec("INSERT INTO ip_cache (ip, data, status, expires_at) VALUES
            ('198.51.100.1', '{}', 'fail', NOW() - INTERVAL 1 MINUTE), ('198.51.100.2', '{}', 'success', NOW() + INTERVAL 1 HOUR)");
        $db->exec("INSERT INTO ip_api_logs (ip, success, created_at) VALUES ('198.51.100.1', 1, NOW() - INTERVAL 2 HOUR), ('198.51.100.1', 1, NOW())");
        $db->exec("INSERT INTO admin_sessions (discord_id, session_token_hash, expires_at, revoked_at) VALUES
            ('1', REPEAT('a', 64), NOW() - INTERVAL 2 DAY, NULL), ('2', REPEAT('b', 64), NOW() + INTERVAL 1 HOUR, NOW() - INTERVAL 3 DAY),
            ('3', REPEAT('c', 64), NOW() + INTERVAL 1 HOUR, NULL)");
        $db->exec("INSERT INTO player_connections (nick, ip, created_at) VALUES ('old', '198.51.100.1', NOW() - INTERVAL 400 DAY)");
        setSetting($db, 'retention_connections_days', '0');

        $result = runCleanup($db);
        self::assertGreaterThanOrEqual(1, $result['ip_cache']);
        self::assertSame(1, (int) $db->query('SELECT COUNT(*) FROM ip_cache')->fetchColumn());
        self::assertSame(1, (int) $db->query('SELECT COUNT(*) FROM ip_api_logs')->fetchColumn());
        self::assertSame(['3'], $db->query('SELECT discord_id FROM admin_sessions')->fetchAll(PDO::FETCH_COLUMN));
        self::assertSame(1, (int) $db->query("SELECT COUNT(*) FROM player_connections WHERE nick = 'old'")->fetchColumn(), 'retención 0 = conservar');

        setSetting($db, 'retention_connections_days', '30');
        runCleanup($db);
        self::assertSame(0, (int) $db->query("SELECT COUNT(*) FROM player_connections WHERE nick = 'old'")->fetchColumn());
        $db->exec('DELETE FROM ip_cache');
        $db->exec('DELETE FROM ip_api_logs');
        $db->exec('DELETE FROM admin_sessions');
        setSetting($db, 'retention_connections_days', '0');
    }
}
