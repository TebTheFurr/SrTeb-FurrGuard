<?php

declare(strict_types=1);

namespace FurrGuard\Tests\Unit;

use PHPUnit\Framework\TestCase;
use ValidationError;

final class RateLimitAndSettingsTest extends TestCase
{
    public function testSlidingWindowEvaluate(): void
    {
        $state = [];
        for ($i = 0; $i < 30; $i++) {
            $r = rateLimitEvaluate($state, 30, 60, 120 + $i, true);
            self::assertTrue($r['allowed']);
            $state = $r['state'];
        }
        $denied = rateLimitEvaluate($state, 30, 60, 150, true);
        self::assertFalse($denied['allowed']);
        self::assertSame(30, $denied['retry_after'], 'hasta que empiece la ventana siguiente');

        // Mitad de la ventana siguiente: la anterior pesa 50 % → caben 15.
        $allowed = 0;
        $r = ['state' => $state];
        for ($i = 0; $i < 20; $i++) {
            $r = rateLimitEvaluate($r['state'], 30, 60, 210, true);
            $allowed += $r['allowed'] ? 1 : 0;
        }
        self::assertSame(15, $allowed);
        self::assertGreaterThan(0, $r['retry_after']);

        // Dos ventanas después, la cuenta se reinicia.
        self::assertTrue(rateLimitEvaluate($state, 30, 60, 400, true)['allowed']);
        // Consultar sin consumir no suma.
        self::assertSame($state['current'], rateLimitEvaluate($state, 30, 60, 170, false)['state']['current']);
    }

    public function testFileBucketIsAtomicAndCounts(): void
    {
        $bucket = 'unit-test-' . bin2hex(random_bytes(4));
        for ($i = 0; $i < 3; $i++) {
            self::assertTrue(rateLimitCheck($bucket, 3, 60, true, 1000)['allowed']);
        }
        $blocked = rateLimitCheck($bucket, 3, 60, true, 1001);
        self::assertFalse($blocked['allowed']);
        self::assertGreaterThanOrEqual(1, $blocked['retry_after']);
        self::assertFalse(rateLimitCheck($bucket, 3, 60, false, 1001)['allowed']);
        self::assertTrue(rateLimitCheck($bucket . '-other', 3, 60, true, 1001)['allowed']);
    }

    public function testValidateSettingsNormalizes(): void
    {
        $normalized = validateSettingsInput([
            'block_proxy' => true,
            'block_vpn' => '0',
            'country_change_min_connections' => '15',
            'country_change_min_percentage' => 70.50,
            'server_name' => '  Mi Red &6Furry  ',
            'discord_url' => '',
            'furrsecurity_verify_url' => 'https://furrguard.test/verify.php',
            'furrsecurity_alert_times' => '3600, 60 ,0',
            'furrsecurity_admin_permission' => 'furrsecurity.notify',
            'retention_logs_days' => 0,
        ]);
        self::assertSame([
            'block_proxy' => '1',
            'block_vpn' => '0',
            'country_change_min_connections' => '15',
            'country_change_min_percentage' => '70.5',
            'server_name' => 'Mi Red &6Furry',
            'discord_url' => '',
            'furrsecurity_verify_url' => 'https://furrguard.test/verify.php',
            'furrsecurity_alert_times' => '3600,60,0',
            'furrsecurity_admin_permission' => 'furrsecurity.notify',
            'retention_logs_days' => '0',
        ], $normalized);
    }

    public function testValidateSettingsRejects(): void
    {
        $invalid = [
            ['unknown_key', '1'],
            ['cache_version', '5'],
            ['api_key_hash', str_repeat('a', 64)],
            ['block_proxy', 'yes'],
            ['country_change_min_connections', 0],
            ['country_change_min_connections', '1.5'],
            ['country_change_min_percentage', 101],
            ['server_name', str_repeat('x', 65)],
            ['server_name', "dos\nlíneas"],
            ['server_name', ''],
            ['discord_url', 'discord.gg/tuservidor'],
            ['discord_url', 'http://discord.gg/x'],
            ['discord_url', 'javascript:alert(1)'],
            ['furrsecurity_verify_url', ''],
            ['furrsecurity_session_duration', 604801],
            ['furrsecurity_token_expiration', 59],
            ['furrsecurity_alert_times', '60,-1'],
            ['furrsecurity_alert_times', ''],
            ['furrsecurity_admin_permission', 'Furr Security'],
            ['retention_connections_days', 3651],
        ];
        foreach ($invalid as [$key, $value]) {
            try {
                validateSettingsInput([$key => $value]);
                self::fail("Debería rechazar {$key}=" . var_export($value, true));
            } catch (ValidationError $e) {
                self::assertSame($key, $e->field);
            }
        }
    }

    public function testDefinitionsCoverContract(): void
    {
        $definitions = settingDefinitions();
        self::assertCount(36, $definitions);
        self::assertSame('https://furrguard.test/verify.php', $definitions['furrsecurity_verify_url']['default']);
        self::assertArrayNotHasKey('api_key', $definitions);
        self::assertArrayNotHasKey('webhook_url', $definitions);
        self::assertArrayNotHasKey('notify_blocks', $definitions);
        self::assertTrue($definitions['api_key_hash']['secret'] ?? false);
    }
}
