<?php

declare(strict_types=1);

namespace FurrGuard\Tests\Integration;

use HttpError;

/**
 * Semántica de baneos de docs/API.md §1.4: upsert manual y automático, hijas, rangos, AS e IPv6 /64.
 */
final class BansTest extends DomainTestCase
{
    public function testManualUpsertConflictsWhileInForceAndReactivatesWithNewData(): void
    {
        $first = upsertBan($this->db, ['type' => 'uuid', 'value' => self::UUID, 'reason' => 'a', 'added_by' => 'Admin1', 'duration_seconds' => 3600], 'manual');
        self::assertSame('created', $first['status']);
        self::assertSame(3600, (int) $this->row('SELECT TIMESTAMPDIFF(SECOND, NOW(), expires_at) AS s FROM blacklist WHERE id = ?', [$first['id']])['s'], 'expiración calculada en SQL');

        try {
            upsertBan($this->db, ['type' => 'uuid', 'value' => self::UUID, 'reason' => 'b', 'added_by' => 'Admin2'], 'manual');
            self::fail('un baneo en vigor debe dar 409');
        } catch (HttpError $e) {
            self::assertSame([409, 'duplicate'], [$e->status, $e->slug]);
        }

        banSetActive($this->db, $first['id'], false);
        $second = upsertBan($this->db, ['type' => 'uuid', 'value' => self::UUID, 'reason' => 'b', 'added_by' => 'Admin2'], 'manual');
        self::assertSame(['id' => $first['id'], 'status' => 'reactivated'], ['id' => $second['id'], 'status' => $second['status']]);
        self::assertNotSame($first['ban_id'], $second['ban_id'], 'ban_id nuevo');
        $row = $this->row('SELECT reason, added_by, active, expires_at FROM blacklist WHERE id = ?', [$first['id']]);
        self::assertSame(['reason' => 'b', 'added_by' => 'Admin2', 'active' => 1, 'expires_at' => null], $row);

        // Activo pero caducado también se reactiva (A1: antes conservaba el expires_at vencido).
        $this->db->exec('UPDATE blacklist SET expires_at = NOW() - INTERVAL 1 MINUTE');
        $third = upsertBan($this->db, ['type' => 'uuid', 'value' => self::UUID, 'reason' => 'c', 'added_by' => 'Admin3', 'duration_seconds' => 60], 'manual');
        self::assertSame('reactivated', $third['status']);
        self::assertSame(1, $this->countRows('blacklist', 'expires_at > NOW()'));
    }

    public function testAutoUpsertNeverTouchesABanInForce(): void
    {
        $manual = upsertBan($this->db, ['type' => 'nick', 'value' => 'Griefer', 'reason' => 'decisión del admin', 'added_by' => 'Admin', 'duration_seconds' => 86400], 'manual');
        $auto = upsertBan($this->db, ['type' => 'nick', 'value' => 'GRIEFER', 'reason' => 'automático', 'added_by' => 'FurrGuard'], 'auto');
        self::assertSame(['id' => $manual['id'], 'ban_id' => $manual['ban_id'], 'status' => 'in_force'], $auto);
        $row = $this->row('SELECT reason, added_by, expires_at IS NOT NULL AS temporal FROM blacklist WHERE id = ?', [$manual['id']]);
        self::assertSame(['reason' => 'decisión del admin', 'added_by' => 'Admin', 'temporal' => 1], $row);
        self::assertSame(1, $this->countRows('activity_logs', "type = 'security' AND action = 'auto_ban' AND details LIKE 'nick: GRIEFER%'"), 'siempre deja traza');

        banSetActive($this->db, $manual['id'], false);
        $reactivated = upsertBan($this->db, ['type' => 'nick', 'value' => 'Griefer', 'reason' => 'automático', 'added_by' => 'FurrGuard'], 'auto');
        self::assertSame('reactivated', $reactivated['status']);
        self::assertSame(['reason' => 'automático', 'added_by' => 'FurrGuard', 'expires_at' => null, 'active' => 1], $this->row('SELECT reason, added_by, expires_at, active FROM blacklist WHERE id = ?', [$manual['id']]), 'automático sin duración = permanente');

        banSetActive($this->db, $manual['id'], false);
        $temporary = upsertBan($this->db, ['type' => 'nick', 'value' => 'Griefer', 'reason' => 'comprometida', 'added_by' => 'FurrGuard', 'duration_seconds' => 3600], 'auto');
        self::assertSame('reactivated', $temporary['status']);
        self::assertSame(['temporal' => 1, 'active' => 1], $this->row('SELECT expires_at > NOW() AS temporal, active FROM blacklist WHERE id = ?', [$manual['id']]), 'automático con duración = temporal');
    }

    public function testStainedIpsAreChildrenThatFollowTheParent(): void
    {
        updatePlayerInfo($this->db, self::UUID, 'Player', '8.8.8.8', []);
        updatePlayerInfo($this->db, self::UUID, 'Player', '2606:4700:10:20::1', []);
        updatePlayerInfo($this->db, self::UUID, 'Player', '2606:4700:10:20::ffff', []);
        updatePlayerInfo($this->db, self::UUID, 'Player', '192.168.1.20', []);
        upsertBan($this->db, ['type' => 'ip', 'value' => '1.1.1.1', 'reason' => 'otra', 'added_by' => 'Admin'], 'manual');

        $ban = banAddManual($this->db, ['type' => 'uuid', 'value' => self::UUID], 'hacks', 'Admin', 60, true);
        self::assertSame(2, $ban['stained'], 'IPv4 + una /64 (dos IPv6 de la misma red); la privada no');
        $children = $this->db->query("SELECT type, value, reason, expires_at FROM blacklist WHERE parent_id = {$ban['id']} ORDER BY type")->fetchAll();
        $root = $this->row('SELECT expires_at FROM blacklist WHERE id = ?', [$ban['id']]);
        self::assertSame([
            ['type' => 'ip', 'value' => '8.8.8.8', 'reason' => 'hacks', 'expires_at' => $root['expires_at']],
            ['type' => 'ip_range', 'value' => '2606:4700:10:20::/64', 'reason' => 'hacks', 'expires_at' => $root['expires_at']],
        ], $children, 'las hijas heredan la expiración');
        self::assertSame(1, $this->countRows('activity_logs', "type = 'blacklist' AND action = 'add' AND details LIKE ?", ['uuid: ' . self::UUID . ' · %']));

        banEdit($this->db, $ban['id'], 'hacks', 0);
        self::assertSame(3, $this->countRows('blacklist', 'expires_at IS NULL AND (id = ? OR parent_id = ?)', [$ban['id'], $ban['id']]), 'la expiración se propaga');
        banEdit($this->db, $ban['id'], 'otro motivo', null);
        self::assertSame(3, $this->countRows('blacklist', 'expires_at IS NULL AND (id = ? OR parent_id = ?)', [$ban['id'], $ban['id']]), 'null = sin cambios');

        banSetActive($this->db, $ban['id'], false);
        self::assertSame(0, $this->countRows('blacklist', 'active = 1 AND (id = ? OR parent_id = ?)', [$ban['id'], $ban['id']]), 'desactivar arrastra a las hijas');
        $inactive = findActiveBan($this->db, [], null, '2606:4700:10:20::abcd', null);
        self::assertNull($inactive);
        banSetActive($this->db, $ban['id'], true);
        self::assertSame('ip_range', findActiveBan($this->db, [], null, '2606:4700:10:20::abcd', null)['type'] ?? null);

        $this->db->prepare('DELETE FROM blacklist WHERE id = ?')->execute([$ban['id']]);
        self::assertSame(1, $this->countRows('blacklist'), 'borrar el padre borra las hijas (FK en cascada)');
    }

    public function testMatchingPriorityCaseAsAndRanges(): void
    {
        foreach ([['ip_range', '8.8.0.0/16'], ['ip', '8.8.8.8'], ['as', 'AS15169'], ['nick', 'Target'], ['uuid', self::UUID]] as [$type, $value]) {
            upsertBan($this->db, ['type' => $type, 'value' => $value, 'reason' => $type, 'added_by' => 'Admin'], 'manual');
        }
        $asn = normalizeAsn('AS15169 Google LLC');
        self::assertSame('uuid', findActiveBan($this->db, [self::UUID], 'target', '8.8.8.8', $asn)['type'] ?? null);
        self::assertSame('nick', findActiveBan($this->db, [], 'TARGET', '8.8.8.8', $asn)['type'] ?? null, 'nick sin distinguir mayúsculas');
        self::assertSame('as', findActiveBan($this->db, [], 'Other', '8.8.8.8', $asn)['type'] ?? null);
        self::assertSame('ip', findActiveBan($this->db, [], 'Other', '8.8.8.8', null)['type'] ?? null);
        self::assertSame('ip_range', findActiveBan($this->db, [], 'Other', '8.8.4.4', null)['type'] ?? null, 'B2: los rangos se evalúan');
        self::assertNull(findActiveBan($this->db, [], 'Other', '9.9.9.9', null));

        $this->db->exec("UPDATE blacklist SET expires_at = NOW() - INTERVAL 1 SECOND WHERE type = 'ip_range'");
        self::assertNull(findActiveBan($this->db, [], null, '8.8.4.4', null), 'un baneo caducado no coincide');
        $this->db->exec("UPDATE blacklist SET active = 0 WHERE type = 'uuid'");
        self::assertSame('nick', findActiveBan($this->db, [self::UUID], 'target', null, null)['type'] ?? null, 'un baneo inactivo no coincide');
    }

    public function testWhitelistMatchingAndDuplicates(): void
    {
        whitelistAdd($this->db, 'nick', 'Friend', null, 'Admin');
        whitelistAdd($this->db, 'ip_range', '2606:4700::/32', 'red', 'Admin');
        self::assertSame('nick', findWhitelistEntry($this->db, null, 'FRIEND', '9.9.9.9', null)['type'] ?? null);
        self::assertSame('ip_range', findWhitelistEntry($this->db, self::UUID, 'Other', '2606:4700:1::1', null)['type'] ?? null);
        self::assertNull(findWhitelistEntry($this->db, self::UUID, 'Other', '9.9.9.9', 'AS1'));
        $this->expectExceptionObject(new HttpError(409, 'duplicate', 'Ese valor ya está en la whitelist.'));
        whitelistAdd($this->db, 'nick', 'fRiEnD', null, 'Admin');
    }

    public function testChildOfAnotherBanIsReparentedToOneLevel(): void
    {
        $nick = banAddManual($this->db, ['type' => 'nick', 'value' => 'Alt'], 'viejo', 'Admin', 0, false);
        upsertBan($this->db, ['type' => 'ip', 'value' => '8.8.8.8', 'reason' => 'viejo', 'added_by' => 'Admin', 'parent_id' => $nick['id']], 'manual');
        banSetActive($this->db, $nick['id'], false);

        $root = upsertBan($this->db, ['type' => 'uuid', 'value' => self::UUID, 'reason' => 'nuevo', 'added_by' => 'FurrSecurity'], 'auto');
        $child = upsertBan($this->db, ['type' => 'nick', 'value' => 'Alt', 'reason' => 'nuevo', 'added_by' => 'FurrSecurity', 'parent_id' => $root['id']], 'auto');
        self::assertSame(['reactivated', $nick['id']], [$child['status'], $child['id']]);
        self::assertSame(0, $this->countRows('blacklist', 'parent_id = ?', [$nick['id']]), 'sin nietos: las hijas del nick pasan a la raíz');
        self::assertSame(2, $this->countRows('blacklist', 'parent_id = ?', [$root['id']]));
    }
}
