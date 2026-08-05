<?php

return [
    'location' => [
        'no_location_found' => 'No se encontró ningún registro que coincida con el código corto proporcionado.',
        'ask_short' => 'Código corto de la ubicación',
        'ask_long' => 'Descripción de la ubicación',
        'created' => 'Se ha creado correctamente una nueva ubicación (:name) con ID :id.',
        'deleted' => 'Se ha eliminado correctamente la ubicación solicitada.',
    ],
    'user' => [
        'search_users' => 'Introduce un nombre de usuario, ID de usuario o dirección de correo',
        'select_search_user' => 'ID del usuario a eliminar (introduce \'0\' para volver a buscar)',
        'deleted' => 'Usuario eliminado correctamente del panel.',
        'confirm_delete' => '¿Seguro que quieres eliminar este usuario del panel?',
        'no_users_found' => 'No se encontraron usuarios para el término de búsqueda proporcionado.',
        'multiple_found' => 'Se encontraron varias cuentas para el usuario indicado; no se puede eliminar por el indicador --no-interaction.',
        'ask_admin' => '¿Es este usuario administrador?',
        'ask_email' => 'Dirección de correo',
        'ask_username' => 'Nombre de usuario',
        'ask_name_first' => 'Nombre',
        'ask_name_last' => 'Apellidos',
        'ask_password' => 'Contraseña',
        'ask_password_tip' => 'Si quieres crear una cuenta con una contraseña aleatoria enviada por correo, vuelve a ejecutar este comando (CTRL+C) y pasa el indicador `--no-password`.',
        'ask_password_help' => 'Las contraseñas deben tener al menos 8 caracteres e incluir al menos una mayúscula y un número.',
        '2fa_help_text' => [
            'Este comando desactivará la autenticación en dos pasos en la cuenta de un usuario si está activada. Solo debe usarse como recuperación de cuenta si el usuario no puede acceder.',
            'Si no es lo que quieres hacer, pulsa CTRL+C para salir.',
        ],
        '2fa_disabled' => 'Se ha desactivado la autenticación en dos pasos para :email.',
    ],
    'schedule' => [
        'output_line' => 'Enviando trabajo para la primera tarea en `:schedule` (:hash).',
    ],
    'maintenance' => [
        'deleting_service_backup' => 'Eliminando archivo de copia de seguridad del servicio :file.',
    ],
    'server' => [
        'rebuild_failed' => 'La solicitud de reconstrucción para ":name" (#:id) en el nodo ":node" falló con el error: :message',
        'reinstall' => [
            'failed' => 'La solicitud de reinstalación para ":name" (#:id) en el nodo ":node" falló con el error: :message',
            'confirm' => 'Vas a reinstalar un grupo de servidores. ¿Deseas continuar?',
        ],
        'power' => [
            'confirm' => 'Vas a realizar una acción :action contra :count servidores. ¿Deseas continuar?',
            'action_failed' => 'La solicitud de acción de energía para ":name" (#:id) en el nodo ":node" falló con el error: :message',
        ],
    ],
    'environment' => [
        'mail' => [
            'ask_smtp_host' => 'Host SMTP (p. ej. smtp.gmail.com)',
            'ask_smtp_port' => 'Puerto SMTP',
            'ask_smtp_username' => 'Usuario SMTP',
            'ask_smtp_password' => 'Contraseña SMTP',
            'ask_mailgun_domain' => 'Dominio de Mailgun',
            'ask_mailgun_endpoint' => 'Endpoint de Mailgun',
            'ask_mailgun_secret' => 'Secreto de Mailgun',
            'ask_mandrill_secret' => 'Secreto de Mandrill',
            'ask_postmark_username' => 'Clave API de Postmark',
            'ask_driver' => '¿Qué controlador debe usarse para enviar correos?',
            'ask_mail_from' => 'Dirección desde la que deben enviarse los correos',
            'ask_mail_name' => 'Nombre con el que deben aparecer los correos',
            'ask_encryption' => 'Método de cifrado a usar',
        ],
    ],
];
