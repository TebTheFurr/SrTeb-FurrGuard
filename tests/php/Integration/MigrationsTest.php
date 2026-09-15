<?php

declare(strict_types=1);

namespace FurrGuard\Tests\Integration;

use PDO;

final class MigrationsTest extends DatabaseTestCase
{
    public function testCleanInstallIsCompleteAndIdempotent(): void
    {
        $db = self::freshDatabase();
        $applied = runMigrations($db);
        self::assertSame(array_keys(migrationFiles()), $applied);
        self::assertSame([], runMigrations($db), 'la segunda ejecución no tiene pendientes');

        $before = $this->schema($db);
        $db->exec('DELETE FROM schema_migrations');
        runMigrations($db);
        self::assertSame($before, $this->schema($db), 'volver a ejecutar cada migración no cambia el esquema');

        // Esquema de la auditoría.
        self::assertFalse(dbColumnExists($db, 'players', 'is_whitelisted'));
        self::assertFalse(dbColumnExists($db, 'players', 'is_blacklisted'));
        self::assertStringNotContainsString('on update', dbColumnInfo($db, 'players', 'last_seen')['extra'] ?? 'missing');
        self::assertStringContainsString('on update', dbColumnInfo($db, 'settings', 'updated_at')['extra'] ?? '');
        self::assertTrue(dbIndexExists($db, 'players', 'idx_first_nick'));
        self::assertTrue(dbIndexExists($db, 'player_connections', 'idx_uuid_created'));
        self::assertFalse(dbIndexExists($db, 'blacklist', 'idx_type'));
        self::assertTrue(dbIndexExists($db, 'activity_logs', 'idx_type_created'));
        self::assertTrue(dbColumnExists($db, 'admin_sessions', 'session_token_hash'));
        self::assertFalse(dbColumnExists($db, 'admin_sessions', 'session_token'));
        self::assertTrue(dbTableExists($db, 'minecraft_profiles'));
        self::assertTrue(dbColumnInfo($db, 'minecraft_names_cache', 'username')['nullable'] ?? false);
        self::assertFalse(dbIndexExists($db, 'ip_cache', 'idx_ip'));
        self::assertSame('utf8mb4_unicode_ci', dbTableCollation($db, 'ip_api_logs'));
        self::assertTrue(dbColumnExists($db, 'furrsecurity_failed_attempts', 'window_started_at'));
        self::assertTrue(dbIndexExists($db, 'furrsecurity_verifications', 'idx_uuid_status_expires'));

        $timestamps = (int) $db->query("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND DATA_TYPE = 'timestamp'")->fetchColumn();
        self::assertSame(0, $timestamps, 'no quedan columnas TIMESTAMP');

        // Semillas.
        self::assertSame(count(loadProvidersTsv()), (int) $db->query('SELECT COUNT(*) FROM blocked_providers')->fetchColumn());
        self::assertSame('founder', $db->query("SELECT role FROM admin_users WHERE discord_id = '1227233322044887082'")->fetchColumn());
        $messageKeys = $db->query('SELECT `key` FROM messages')->fetchAll(PDO::FETCH_COLUMN);
        self::assertCount(69, $messageKeys);
        self::assertCount(25, array_filter($messageKeys, static fn ($k) => str_starts_with((string) $k, 'furr_security_')));
        self::assertNotContains('furrsecurity_prefix', $messageKeys);
        foreach (['kick_default', 'kick_mobile', 'notify_continent_blocked', 'fur_perms_logged'] as $key) {
            self::assertContains($key, $messageKeys);
        }
        self::assertStringContainsString("\n", (string) $db->query("SELECT value FROM messages WHERE `key` = 'kick_proxy'")->fetchColumn());

        $settings = $db->query('SELECT `key`, value FROM settings')->fetchAll(PDO::FETCH_KEY_PAIR);
        foreach (settingDefinitions() as $key => $definition) {
            if ($definition['default'] !== null) {
                self::assertSame($definition['default'], $settings[$key] ?? null, $key);
            }
        }
        self::assertArrayNotHasKey('api_key', $settings);
        self::assertArrayNotHasKey('webhook_url', $settings);
        self::assertFalse(apiKeyConfigured($db), 'una instalación nueva no acepta ninguna API key');
    }

    public function testUpgradeConvertsApiKeyAndNormalizesIdentities(): void
    {
        $db = self::freshDatabase();
        $files = migrationFiles();
        // Estado "producción": solo el esquema legado con datos antiguos.
        (require $files['0001_legacy_schema'])($db);
        $key = 'fg_' . str_repeat('c', 48);
        $db->exec("INSERT INTO settings (`key`, value) VALUES ('api_key', '{$key}'), ('webhook_url', 'x'), ('notify_blocks', '1')");
        $db->exec("INSERT INTO messages (`key`, value) VALUES ('furrsecurity_prefix', 'old')");
        $db->exec("INSERT INTO activity_logs (type, action) VALUES ('login', 'Admin login')");
        $db->exec("INSERT INTO whitelist (type, value, created_at) VALUES
            ('uuid', '7AAA768D415A4F7DBACBC1D2A8ADD707', '2020-01-01 00:00:00'),
            ('ip', '::ffff:1.2.3.4', '2020-01-01 00:00:00'),
            ('ip', '1.2.3.4', '2021-01-01 00:00:00'),
            ('as', 'as1234 Some ISP', '2020-01-01 00:00:00'),
            ('ip_range', '10.1.2.3/8', '2020-01-01 00:00:00'),
            ('ip_range', 'not-a-range', '2020-01-01 00:00:00')");
        $db->exec("INSERT INTO blacklist (id, ban_id, type, value, active, expires_at, created_at) VALUES
            (1, 'AAAAAAAAAAAA', 'ip', '::ffff:5.6.7.8', 0, NULL, '2019-01-01 00:00:00'),
            (2, 'BBBBBBBBBBBB', 'ip', '5.6.7.8', 1, NULL, '2022-01-01 00:00:00'),
            (3, 'CCCCCCCCCCCC', 'nick', 'Child', 1, NULL, '2023-01-01 00:00:00')");
        $db->exec('UPDATE blacklist SET parent_id = 1 WHERE id = 3');
        $db->exec("INSERT INTO players (uuid, first_nick, last_nick) VALUES ('7AAA768D415A4F7DBACBC1D2A8ADD708', 'A', 'A')");

        runMigrations($db);

        self::assertTrue(apiKeyValidate($db, $key), 'la clave existente sigue funcionando');
        self::assertSame('fg_ccccccc', apiKeyInfo($db)['prefix']);
        $settings = $db->query('SELECT `key` FROM settings')->fetchAll(PDO::FETCH_COLUMN);
        self::assertNotContains('api_key', $settings);
        self::assertNotContains('webhook_url', $settings);
        self::assertSame(0, (int) $db->query("SELECT COUNT(*) FROM messages WHERE `key` = 'furrsecurity_prefix'")->fetchColumn());
        self::assertSame(0, (int) $db->query("SELECT COUNT(*) FROM activity_logs WHERE type = 'login'")->fetchColumn());

        $whitelist = $db->query('SELECT type, value FROM whitelist ORDER BY type, value')->fetchAll(PDO::FETCH_NUM);
        self::assertSame([
            ['uuid', '7aaa768d-415a-4f7d-bacb-c1d2a8add707'],
            ['ip', '1.2.3.4'],
            ['as', 'AS1234'],
            ['ip_range', '10.0.0.0/8'],
            ['ip_range', 'not-a-range'],
        ], $whitelist);

        // Choque en blacklist: se conserva la activa (id 2) y la hija del descartado pasa a ella.
        $blacklist = $db->query('SELECT id, value, parent_id FROM blacklist ORDER BY id')->fetchAll(PDO::FETCH_NUM);
        self::assertSame([[2, '5.6.7.8', null], [3, 'Child', 2]], $blacklist);
        self::assertSame('7aaa768d-415a-4f7d-bacb-c1d2a8add708', $db->query('SELECT uuid FROM players')->fetchColumn());
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function schema(PDO $db): array
    {
        return $db->query(
            'SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLLATION_NAME
             FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION'
        )->fetchAll();
    }
}
