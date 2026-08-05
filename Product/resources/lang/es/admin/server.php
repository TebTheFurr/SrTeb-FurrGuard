<?php

return [
    'exceptions' => [
        'no_new_default_allocation' => 'Estás intentando eliminar la asignación predeterminada de este servidor pero no hay una asignación alternativa.',
        'marked_as_failed' => 'Este servidor se marcó como fallido en una instalación anterior. No se puede cambiar el estado actual en esta situación.',
        'bad_variable' => 'Hubo un error de validación con la variable :name.',
        'daemon_exception' => 'Se produjo una excepción al intentar comunicarse con el daemon, con código de respuesta HTTP/:code. Esta excepción se ha registrado. (id de solicitud: :request_id)',
        'default_allocation_not_found' => 'La asignación predeterminada solicitada no se encontró entre las asignaciones de este servidor.',
    ],
    'alerts' => [
        'startup_changed' => 'Se ha actualizado la configuración de arranque de este servidor. Si se cambió el nest o el egg del servidor, se realizará una reinstalación ahora.',
        'server_deleted' => 'El servidor se ha eliminado correctamente del sistema.',
        'server_created' => 'El servidor se creó correctamente en el panel. Espera unos minutos a que el daemon termine de instalar este servidor.',
        'build_updated' => 'Se han actualizado los detalles de compilación de este servidor. Algunos cambios pueden requerir un reinicio para surtir efecto.',
        'suspension_toggled' => 'El estado de suspensión del servidor se ha cambiado a :status.',
        'rebuild_on_boot' => 'Este servidor se ha marcado como que requiere reconstruir el contenedor Docker. Ocurrirá la próxima vez que se inicie el servidor.',
        'install_toggled' => 'Se ha alternado el estado de instalación de este servidor.',
        'server_reinstalled' => 'Este servidor se ha puesto en cola para una reinstalación que comienza ahora.',
        'details_updated' => 'Los detalles del servidor se han actualizado correctamente.',
        'docker_image_updated' => 'Se ha cambiado correctamente la imagen Docker predeterminada para este servidor. Se requiere un reinicio para aplicar este cambio.',
        'node_required' => 'Debes tener al menos un nodo configurado antes de poder añadir un servidor a este panel.',
        'transfer_nodes_required' => 'Debes tener al menos dos nodos configurados antes de poder transferir servidores.',
        'transfer_started' => 'Se ha iniciado la transferencia del servidor.',
        'transfer_not_viable' => 'El nodo seleccionado no dispone del espacio en disco o memoria necesarios para este servidor.',
    ],
];
