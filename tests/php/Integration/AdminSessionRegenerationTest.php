<?php

declare(strict_types=1);

namespace FurrGuard\Tests\Integration;

use PHPUnit\Framework\Attributes\RunInSeparateProcess;

/**
 * Regeneración del ID de sesión cada 30 min con sesión PHP real (sin cookies, en un proceso aparte).
 */
final class AdminSessionRegenerationTest extends DatabaseTestCase
{
    #[RunInSeparateProcess]
    public function testOldIdGetsShortGraceAfterRegeneration(): void
    {
        $db = self::reusableMigratedDatabase();
        $founder = '111111111111111111';
        $db->prepare('DELETE FROM admin_sessions WHERE discord_id = ?')->execute([$founder]);

        $path = storagePath('sessions-regeneration');
        @mkdir($path, 0700, true);
        ini_set('session.use_cookies', '0');
        ini_set('session.use_only_cookies', '0');
        ini_set('session.use_strict_mode', '0');
        session_save_path($path);
        session_cache_limiter('');
        $_SERVER['REMOTE_ADDR'] = '198.51.100.20';

        session_id('fgregen' . bin2hex(random_bytes(8)));
        session_start();
        adminSessionStart($db, ['discord_id' => $founder, 'username' => 'Regen', 'avatar' => null], 'founder');
        $loginId = (string) session_id();
        $_SESSION[ADMIN_SESSION_KEY]['regenerated_at'] = time() - ADMIN_SESSION_REGENERATE_EVERY;

        self::assertNull(adminSessionValidate($db)['error']);
        $newId = (string) session_id();
        self::assertNotSame($loginId, $newId, 'pasados 30 min se regenera el ID');
        self::assertArrayNotHasKey(ADMIN_SESSION_OBSOLETE_KEY, $_SESSION);
        session_write_close();

        // Una petición en vuelo con el ID antiguo sigue valiendo durante la gracia y no vuelve a regenerar.
        session_id($loginId);
        session_start();
        self::assertIsInt($_SESSION[ADMIN_SESSION_OBSOLETE_KEY] ?? null);
        self::assertNull(adminSessionValidate($db)['error']);
        self::assertSame($loginId, session_id());
        $_SESSION[ADMIN_SESSION_OBSOLETE_KEY] = time() - ADMIN_SESSION_OBSOLETE_GRACE - 1;
        self::assertSame('session_expired', adminSessionValidate($db)['error'], 'pasada la gracia, el ID antiguo no vale');
        session_write_close();

        session_id($newId);
        session_start();
        self::assertNull(adminSessionValidate($db)['error'], 'el ID nuevo sigue siendo válido');
        session_write_close();
    }
}
