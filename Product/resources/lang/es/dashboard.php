<?php

return [
    'title' => 'Panel',
    'subtitle' => 'Tus servidores y carpetas.',
    'usage_servers' => ':count servidor(es)',
    'usage_folders' => ':count carpeta(s)',
    'search' => 'Buscar servidores...',
    'search_servers' => 'Buscar servidores...',
    'no_matches' => 'No se encontraron servidores que coincidan con los criterios de búsqueda.',
    'cpu_title' => 'CPU',
    'memory_title' => 'Memoria',
    'showing_others_servers' => 'Mostrando servidores de otros',
    'showing_your_servers' => 'Mostrando tus servidores',
    'home' => 'Inicio',
    'no_other_servers' => 'No hay otros servidores que mostrar.',
    'folder_empty' => 'Esta carpeta está vacía.',
    'no_servers' => 'No hay servidores asociados a tu cuenta.',
    'no_servers_found' => 'No se encontraron servidores',
    'no_servers_available' => 'No hay servidores disponibles',

    'claim' => [
        'page_title' => 'Reclamar servidores',
        'title' => 'Servidores gratuitos',
        'subtitle' => 'Reclama tus servidores gratuitos abajo para empezar.',
        'empty' => 'No hay servidores gratuitos disponibles ahora mismo.',
        'server_expires' => 'Este servidor caducará tras :count día(s).',
        'claim_before' => 'Reclama antes del :date.',
        'free' => 'Gratis',
        'action' => 'Reclamar',
        'errors' => [
            'failed' => 'No se pudo reclamar. Inténtalo de nuevo.',
        ],
        'requirements' => [
            'email_verified' => 'Correo verificado',
            'email_required' => 'Verificación de correo obligatoria',
            'resend_verification' => 'Reenviar correo de verificación',
            'resend_verification_sent' => 'Correo de verificación enviado.',
            'resend_verification_failed' => 'No se pudo reenviar el correo de verificación. Inténtalo de nuevo.',
            'resend_verification_wait' => 'Espera antes de solicitar otro correo de verificación.',
            'two_factor_enabled' => '2FA activado',
            'two_factor_required' => 'Autenticación en dos pasos obligatoria',
        ],
        'specs' => [
            'ram' => 'RAM',
            'disk' => 'Disco',
            'cpu' => 'CPU',
        ],
    ],

    'folders' => [
        'create' => 'Crear carpeta',
        'create_subfolder' => 'Crear subcarpeta',
        'create_directory' => 'Crear carpeta',
        'create_confirm' => 'Crear',
        'edit' => 'Editar carpeta',
        'delete' => 'Eliminar carpeta',
        'name' => 'Nombre de la carpeta',
        'placeholder' => 'Introduce el nombre de la carpeta',
        'color' => 'Color',
        'color_placeholder' => '#000000',
        'move_server' => 'Mover ":name"',
    ],

    // FurrGuard (components/furrguard). Always shown in Spanish, like the Vault: same block in en and es.
    // The section views carry their own Spanish defaults with t('furrguard.…', 'Texto').
    'furrguard' => [
        'title' => 'FurrGuard',
        'login' => [
            'title' => 'Entra en FurrGuard',
            'message' => 'FurrGuard protege la red de Minecraft: jugadores, conexiones, listas y filtros. Inicia sesión con Discord para entrar con tu rol.',
            'button' => 'Entrar con Discord',
            'redirecting' => 'Abriendo Discord…',
            'other_account' => 'Usar otra cuenta',
            'no_access_title' => 'Sin acceso a FurrGuard',
            'no_access' => 'Esa cuenta de Discord no tiene acceso a FurrGuard. Prueba con otra cuenta.',
            'cancelled' => 'Cancelaste el inicio de sesión en Discord.',
            'discord_error' => 'Discord no pudo completar el inicio de sesión. Vuelve a intentarlo en un momento.',
            'unreachable' => 'No se pudo conectar con FurrGuard. Vuelve a intentarlo en un momento.',
            'rate_limited' => 'Demasiados intentos de inicio de sesión. Espera unos minutos.',
            'expired' => 'Tu sesión de FurrGuard ha caducado. Vuelve a entrar con Discord.',
            'revoked' => 'Tu acceso a FurrGuard ha cambiado. Vuelve a entrar con Discord.',
            'generic_error' => 'No se pudo completar el inicio de sesión. Vuelve a intentarlo.',
        ],
        'header' => [
            'discord' => 'Cuenta de Discord',
            'role_hint' => 'Tu rol en FurrGuard',
            'hide_ips_hint' => 'Oculta las IPs en pantalla, por ejemplo mientras compartes pantalla',
            'ips_hidden' => 'IPs ocultas',
            'ips_visible' => 'IPs visibles',
        ],
        'actions' => [
            'sign_out' => 'Cerrar sesión de Discord',
        ],
        'nav' => [
            'label' => 'Secciones de FurrGuard',
        ],
        'forbidden' => [
            'title' => 'Sin acceso a esta sección',
            'section' => 'Tu rol de FurrGuard no incluye «:section».',
            'generic' => 'Tu rol de FurrGuard no incluye esta sección.',
        ],
        'errors' => [
            'load_title' => 'No se pudo cargar FurrGuard',
        ],
    ],
];
