<?php

declare(strict_types=1);

namespace FurrGuard\Tests\Integration;

/**
 * FurrSecurity (docs/API.md §2) y check_furr_perms_whitelist: sesión atada a la IP, reutilización de
 * enlaces, renovación, ventana de intentos, auto-baneo y peticiones de los módulos 2.0.
 */
final class FurrSecurityTest extends DomainTestCase
{
    private const DISCORD = '222222222222222222';

    protected function setUp(): void
    {
        parent::setUp();
        $this->db->prepare("INSERT INTO furrsecurity_staff (discord_id, minecraft_nick, added_by) VALUES (?, 'StaffNick', 'test')")->execute([self::DISCORD]);
    }

    private function verifiedSession(string $ip): string
    {
        $token = furrSecurityGenerateToken($this->db, self::UUID, 'StaffNick', $ip)['token'];
        self::assertSame('verified', furrSecurityCompleteVerification($this->db, $token, self::DISCORD, '203.0.113.9')['result']);
        return $token;
    }

    public function testCheckStatusSessionIsBoundToTheIpScope(): void
    {
        self::assertSame(['needs_verification' => false, 'reason' => 'not_staff'], furrSecurityCheckStatus($this->db, self::UUID, 'Other', '8.8.8.8'));
        self::assertSame(['needs_verification' => true, 'reason' => 'no_valid_session', 'discord_id' => self::DISCORD], furrSecurityCheckStatus($this->db, self::UUID, 'staffnick', '8.8.8.8'));

        $this->verifiedSession('8.8.8.8');
        $status = furrSecurityCheckStatus($this->db, self::UUID, 'StaffNick', '8.8.8.8');
        self::assertSame(['already_verified', false], [$status['reason'], $status['needs_verification']]);
        self::assertEqualsWithDelta(28800, $status['session']['time_remaining_seconds'], 5);
        self::assertMatchesRegularExpression('/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\z/', $status['session']['expires_at']);
        self::assertSame(['ip_changed', true], [furrSecurityCheckStatus($this->db, self::UUID, 'StaffNick', '8.8.4.4')['reason'], true]);
        self::assertSame(1, $this->countRows('furrsecurity_logs', "action = 'ip_changed'"));
        self::assertTrue(furrSecurityGetSession($this->db, self::UUID, '8.8.8.8')['has_session']);
        self::assertFalse(furrSecurityGetSession($this->db, self::UUID, '8.8.4.4')['has_session']);

        $this->verifiedSession('2606:4700:aa:bb::1');
        self::assertSame('already_verified', furrSecurityCheckStatus($this->db, self::UUID, 'StaffNick', '2606:4700:aa:bb:ffff::2')['reason'], 'misma /64');
        self::assertSame('ip_changed', furrSecurityCheckStatus($this->db, self::UUID, 'StaffNick', '2606:4700:aa:cc::1')['reason']);

        $this->settings(['furrsecurity_enabled' => '0']);
        self::assertSame('module_disabled', furrSecurityCheckStatus($this->db, self::UUID, 'StaffNick', '1.1.1.1')['reason']);
    }

    public function testTokenIsReusedOnlyFromTheSameIpWhileAlive(): void
    {
        self::assertSame(['success' => false, 'error' => 'not_in_whitelist'], furrSecurityGenerateToken($this->db, self::UUID, 'Other', '8.8.8.8'));
        $first = furrSecurityGenerateToken($this->db, self::UUID, 'StaffNick', '8.8.8.8');
        self::assertSame([false, 180], [$first['existing'], $first['token_expires_in_seconds']]);
        self::assertSame('https://furrguard.test/verify.php?token=' . $first['token'], $first['verify_url']);
        $again = furrSecurityGenerateToken($this->db, self::UUID, 'StaffNick', '8.8.8.8');
        self::assertSame([$first['token'], true], [$again['token'], $again['existing']]);
        self::assertSame('pending', furrSecurityTokenStatus($this->db, $first['token'])['status']);

        $other = furrSecurityGenerateToken($this->db, self::UUID, 'StaffNick', '1.1.1.1');
        self::assertNotSame($first['token'], $other['token']);
        self::assertSame('expired', $this->row('SELECT status FROM furrsecurity_verifications WHERE verification_token = ?', [$first['token']])['status'], 'desde otra IP se expira el anterior');

        $this->db->exec('UPDATE furrsecurity_verifications SET token_expires_at = NOW() - INTERVAL 1 SECOND');
        self::assertSame(['status' => 'token_expired', 'verified' => false], furrSecurityTokenStatus($this->db, $other['token']));
        self::assertFalse(furrSecurityGenerateToken($this->db, self::UUID, 'StaffNick', '1.1.1.1')['existing'], 'un enlace caducado nunca se reutiliza');
        self::assertSame(['status' => 'not_found', 'verified' => false], furrSecurityTokenStatus($this->db, str_repeat('a', 64)));
    }

    public function testVerificationUsesSqlTimesAndEarlyReverificationRenewsTheSession(): void
    {
        $token = $this->verifiedSession('8.8.8.8');
        $status = furrSecurityTokenStatus($this->db, $token);
        self::assertSame(['verified', true], [$status['status'], $status['verified']]);
        self::assertSame(['result' => 'expired', 'attempts' => 0, 'max_attempts' => 0], furrSecurityCompleteVerification($this->db, $token, self::DISCORD, '1.1.1.1'), 'un token ya usado no vuelve a verificar');

        // Re-verificación anticipada: un enlace nuevo con la sesión aún válida, sin invalidarla.
        $this->db->exec("UPDATE furrsecurity_verifications SET expires_at = NOW() + INTERVAL 100 SECOND WHERE status = 'verified'");
        $early = furrSecurityGenerateToken($this->db, self::UUID, 'StaffNick', '8.8.8.8');
        self::assertTrue(furrSecurityCheckStatus($this->db, self::UUID, 'StaffNick', '8.8.8.8')['session']['time_remaining_seconds'] <= 100, 'la sesión sigue en vigor');
        furrSecurityCompleteVerification($this->db, $early['token'], self::DISCORD, '203.0.113.9');
        self::assertSame(2, $this->countRows('furrsecurity_verifications', "status = 'verified' AND expires_at > NOW() + INTERVAL 28000 SECOND"), 'la sesión anterior (misma IP) también se renueva');
        self::assertEqualsWithDelta(28800, furrSecurityTokenStatus($this->db, $token)['time_remaining_seconds'], 5);
    }

    public function testExtendSessionRequiresALiveSessionFromTheSameIp(): void
    {
        self::assertSame(['success' => false, 'error' => 'no_active_session'], furrSecurityExtendSession($this->db, self::UUID, '8.8.8.8', null));
        $token = $this->verifiedSession('8.8.8.8');
        $this->db->exec("UPDATE furrsecurity_verifications SET expires_at = NOW() + INTERVAL 60 SECOND WHERE status = 'verified'");

        self::assertSame(['success' => false, 'error' => 'ip_changed'], furrSecurityExtendSession($this->db, self::UUID, '1.1.1.1', null));
        self::assertSame(['success' => false, 'error' => 'invalid_token'], furrSecurityExtendSession($this->db, self::UUID, '8.8.8.8', str_repeat('b', 64)));
        $extended = furrSecurityExtendSession($this->db, self::UUID, '8.8.8.8', $token);
        self::assertTrue($extended['success']);
        self::assertEqualsWithDelta(28800, $extended['time_remaining_seconds'], 5);

        $this->db->exec("UPDATE furrsecurity_verifications SET expires_at = NOW() - INTERVAL 1 SECOND WHERE status = 'verified'");
        self::assertSame(['success' => false, 'error' => 'no_active_session'], furrSecurityExtendSession($this->db, self::UUID, '8.8.8.8', null), 'A6: una sesión caducada no se renueva');
    }

    public function testFailedAttemptsCountWithinTheWindowAndAutoBan(): void
    {
        self::assertSame(['attempts' => 1, 'max_attempts' => 3, 'blacklisted' => false], furrSecurityRecordFailedAttempt($this->db, self::UUID, 'StaffNick', '8.8.8.8'));
        self::assertSame(2, furrSecurityRecordFailedAttempt($this->db, self::UUID, 'StaffNick', '8.8.8.8')['attempts']);
        $this->db->exec('UPDATE furrsecurity_failed_attempts SET window_started_at = NOW() - INTERVAL 86401 SECOND');
        self::assertSame(1, furrSecurityRecordFailedAttempt($this->db, self::UUID, 'StaffNick', '8.8.8.8')['attempts'], 'fuera de la ventana vuelve a empezar');

        furrSecurityGenerateToken($this->db, self::UUID, 'StaffNick', '8.8.8.8');
        furrSecurityRecordFailedAttempt($this->db, self::UUID, 'StaffNick', '8.8.8.8');
        $banned = furrSecurityCompleteVerification($this->db, (string) $this->row("SELECT verification_token FROM furrsecurity_verifications WHERE status = 'pending'")['verification_token'], '999999999999999999', '2606:4700:9:9::1');
        self::assertSame(['blacklisted', 3, 3], [$banned['result'], $banned['attempts'], $banned['max_attempts']]);

        $root = $this->row("SELECT id, added_by FROM blacklist WHERE type = 'uuid' AND value = ?", [self::UUID]);
        self::assertSame('FurrSecurity', $root['added_by']);
        self::assertSame([['nick', 'StaffNick'], ['ip_range', '2606:4700:9:9::/64']], $this->db->query("SELECT type, value FROM blacklist WHERE parent_id = {$root['id']} ORDER BY type")->fetchAll(\PDO::FETCH_NUM));
        self::assertSame(0, $this->countRows('furrsecurity_failed_attempts'));
        self::assertSame(1, $this->countRows('furrsecurity_logs', "action = 'wrong_discord_attempt' AND discord_id = '999999999999999999'"));
        self::assertSame(1, $this->countRows('furrsecurity_logs', "action = 'auto_blacklisted_wrong_discord'"));
        self::assertSame(0, $this->countRows('furrsecurity_verifications', "status = 'pending'"));
    }

    public function testDisconnectAndRecordFailedAttemptNeverCountTheSameTokenTwice(): void
    {
        furrSecurityPlayerDisconnect($this->db, self::UUID, 'Other', false);
        self::assertSame(0, $this->countRows('furrsecurity_logs'), 'ni staff ni bloqueado: sin traza');

        furrSecurityGenerateToken($this->db, self::UUID, 'StaffNick', '8.8.8.8');
        furrSecurityPlayerDisconnect($this->db, self::UUID, 'StaffNick', true);
        self::assertSame(1, (int) $this->row('SELECT failed_attempts FROM furrsecurity_failed_attempts')['failed_attempts'], 'se fue con un enlace pendiente');

        // El módulo expulsa por enlace caducado: record_failed_attempt y después player_disconnect(locked=1).
        furrSecurityRecordFailedAttempt($this->db, self::UUID, 'StaffNick', '8.8.8.8', expirePendingTokens: true);
        furrSecurityPlayerDisconnect($this->db, self::UUID, 'StaffNick', true);
        self::assertSame(2, (int) $this->row('SELECT failed_attempts FROM furrsecurity_failed_attempts')['failed_attempts']);
        self::assertSame(1, $this->countRows('furrsecurity_verifications', "status = 'token_expired'"));

        $this->verifiedSession('8.8.8.8');
        self::assertSame(['success' => true, 'sessions_expired' => 1], furrSecurityResetSession($this->db, self::UUID, 'StaffNick'));
        self::assertSame('no_valid_session', furrSecurityCheckStatus($this->db, self::UUID, 'StaffNick', '8.8.8.8')['reason']);
    }

    public function testFurrPermsWhitelistCheck(): void
    {
        self::assertSame(['allowed' => false, 'reason' => 'not_whitelisted'], furrPermsCheck($this->db, 'Nobody', self::UUID, '8.8.8.8'));
        $this->db->exec("INSERT INTO fur_perms_whitelist (nick, uuid) VALUES ('Builder', '11111111-2222-4333-8444-555555555555'), ('StaffNick', NULL), ('Legacy', 'OLD-FORMAT')");
        self::assertSame(['allowed' => true, 'reason' => 'ok'], furrPermsCheck($this->db, 'builder', self::UUID, '8.8.8.8'));
        self::assertSame(['allowed' => false, 'reason' => 'uuid_mismatch'], furrPermsCheck($this->db, 'Builder', '99999999-2222-4333-8444-555555555555', '8.8.8.8'));
        self::assertSame(['allowed' => false, 'reason' => 'uuid_mismatch'], furrPermsCheck($this->db, 'Legacy', self::UUID, '8.8.8.8'), 'un UUID ilegible falla en cerrado');

        self::assertSame(['allowed' => false, 'reason' => 'needs_furrsecurity'], furrPermsCheck($this->db, 'StaffNick', self::UUID, '8.8.8.8'));
        $this->verifiedSession('8.8.8.8');
        self::assertSame(['allowed' => true, 'reason' => 'ok'], furrPermsCheck($this->db, 'StaffNick', self::UUID, '8.8.8.8'));
        self::assertSame(['allowed' => false, 'reason' => 'needs_furrsecurity'], furrPermsCheck($this->db, 'StaffNick', self::UUID, '1.1.1.1'), 'la sesión es de otra IP');

        $this->settings(['furrsecurity_enabled' => '0']);
        self::assertSame(['allowed' => true, 'reason' => 'ok'], furrPermsCheck($this->db, 'StaffNick', self::UUID, '1.1.1.1'));
        $this->settings(['fur_perms_enabled' => '0']);
        self::assertSame(['allowed' => true, 'reason' => 'module_disabled'], furrPermsCheck($this->db, 'Nobody', self::UUID, '1.1.1.1'));
    }

    public function testSettingsAndPrefixedMessages(): void
    {
        $settings = furrSecuritySettings($this->db);
        self::assertSame('180', $settings['furrsecurity_token_expiration']);
        self::assertSame([], array_filter(array_keys($settings), static fn (string $key): bool => !str_starts_with($key, 'furrsecurity_')));
        $this->db->exec("INSERT INTO messages (`key`, value) VALUES ('furrXsecurity_trap', 'no')");
        $messages = (array) messagesMap($this->db, 'furr_security_');
        self::assertCount(25, $messages, 'LIKE con _ escapado');
        self::assertStringContainsString("\n", $messages['furr_security_kick_unverified']);
        $this->db->exec("DELETE FROM messages WHERE `key` = 'furrXsecurity_trap'");
        self::assertSame(['staff' => [['nick' => 'StaffNick']]], furrSecurityStaffList($this->db));
    }
}
