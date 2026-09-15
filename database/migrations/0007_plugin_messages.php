<?php

declare(strict_types=1);

/**
 * Mensajes nuevos de las piezas 2.0 que aún no existían, para que el panel pueda editarlos. Solo
 * inserta los que faltan. Textos por defecto de cada cliente:
 * - plugin Velocity: FurrGuard-plugin/src/main/resources/messages.yml
 * - FurrPerms: MessageUtil.DEFAULTS (los `furr_security_*` de FurrSecurity ya estaban todos en 0001)
 * Las líneas se unen con "\n" explícito: el texto no depende de los finales de línea del checkout.
 */
return static function (PDO $db): void {
    $inserted = seedMessagesIfMissing($db, [
        [
            'fur_perms_uuid_mismatch',
            '&c✘ &cTu cuenta no coincide con la autorizada para usar &f{command}&c.',
            'FurrPerms: el nick está autorizado pero con otro UUID',
        ],
        [
            'fur_perms_needs_furrsecurity',
            '&c✘ &cVerifica tu identidad con FurrSecurity antes de usar &f{command}&c.',
            'FurrPerms: el staff debe tener una sesión de FurrSecurity verificada desde su IP',
        ],
        [
            'fur_perms_unavailable',
            '&c✘ &cNo se ha podido comprobar tu autorización. Inténtalo de nuevo en unos segundos.',
            'FurrPerms: la API no respondió (se deniega el comando)',
        ],
        [
            'notify_mobile_blocked',
            '&c&l🛡 &c{player} &7bloqueado &8• &f{ip} &8• &cRed móvil detectada',
            'Notificación a admins: red móvil detectada',
        ],
        [
            'notify_player_kicked',
            '&c&l⚔ &c{player} &7expulsado &8• &f{ip} &8• &c{reason}',
            'Notificación a admins: jugador expulsado al re-verificar tras un cambio en el panel',
        ],
        [
            'kick_starting',
            implode("\n", [
                '&8╔════════════════════════════════════╗',
                '&8║  &6&l{server_name}&8',
                '&8║                                    ║',
                '&8║     &e&l⚠ SERVIDOR INICIANDO ⚠&8',
                '&8║                                    ║',
                '&8║   &7El sistema de seguridad aún     ║',
                '&8║   &7no está listo.                  ║',
                '&8║                                    ║',
                '&8║   &fReintenta en unos segundos.     ║',
                '&8╚════════════════════════════════════╝',
            ]),
            'Kick mientras el plugin arranca o si su configuración no es válida',
        ],
        [
            'kick_unlicensed',
            implode("\n", [
                '&8━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
                '&c     FurrGuard - Sin Licencia',
                '&8━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
                '',
                '&7  El plugin no está verificado.',
                '&7  Contacta con el administrador.',
                '',
                '&8  Discord: &b{discord}',
                '&8━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            ]),
            'Kick si el plugin no tiene licencia válida. {discord} es license.discord-url de config.yml',
        ],
    ]);
    migrationLog("  mensajes del plugin y de FurrPerms insertados: {$inserted}");
};
