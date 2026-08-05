<?php

return [
    'title' => 'Usuarios',

    'empty' => [
        'title' => 'Sin subusuarios',
        'message' => 'Aún no has añadido subusuarios a este servidor. Invita a otros para ayudar a gestionar tu servidor.',
    ],

    'delete' => [
        'title' => '¿Eliminar este subusuario?',
    ],

    'permissions' => [
        'websocket_*' => 'Permite el acceso al websocket de este servidor.',
        'control_console' => 'Permite enviar datos a la consola del servidor.',
        'control_start' => 'Permite iniciar la instancia del servidor.',
        'control_stop' => 'Permite detener la instancia del servidor.',
        'control_restart' => 'Permite reiniciar la instancia del servidor.',
        'control_kill' => 'Permite forzar el cierre del proceso del servidor.',
        'user_create' => 'Permite crear nuevas cuentas de usuario para el servidor.',
        'user_read' => 'Permite ver los usuarios asociados a este servidor.',
        'user_update' => 'Permite modificar otros usuarios asociados a este servidor.',
        'user_delete' => 'Permite eliminar otros usuarios asociados a este servidor.',
        'file_create' => 'Permite crear nuevos archivos y directorios.',
        'file_read' => 'Permite ver archivos y carpetas de esta instancia del servidor, así como su contenido.',
        'file_update' => 'Permite actualizar archivos y carpetas asociados al servidor.',
        'file_delete' => 'Permite eliminar archivos y directorios.',
        'file_archive' => 'Permite crear archivos comprimidos y descomprimir archivos existentes.',
        'file_sftp' => 'Permite realizar las acciones de archivo anteriores mediante un cliente SFTP.',
        'allocation_read' => 'Permite acceder a las páginas de gestión de asignaciones del servidor.',
        'allocation_update' => 'Permite modificar las asignaciones del servidor.',
        'database_create' => 'Permite crear una nueva base de datos para el servidor.',
        'database_read' => 'Permite ver las bases de datos del servidor.',
        'database_update' => 'Permite modificar una base de datos. Sin el permiso "Ver contraseña" no podrá cambiar la contraseña.',
        'database_delete' => 'Permite eliminar una instancia de base de datos.',
        'database_view_password' => 'Permite ver la contraseña de una base de datos en el sistema.',
        'schedule_create' => 'Permite crear una nueva programación para el servidor.',
        'schedule_read' => 'Permite ver las programaciones del servidor.',
        'schedule_update' => 'Permite modificar una programación existente del servidor.',
        'schedule_delete' => 'Permite eliminar una programación del servidor.',
    ],
];
