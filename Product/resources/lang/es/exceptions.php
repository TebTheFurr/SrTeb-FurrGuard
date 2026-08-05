<?php

return [
    'daemon_connection_failed' => 'Se produjo una excepción al intentar comunicarse con el daemon, con código de respuesta HTTP/:code. Esta excepción se ha registrado.',
    'node' => [
        'servers_attached' => 'Un nodo solo puede eliminarse si no tiene servidores vinculados.',
        'daemon_off_config_updated' => 'La configuración del daemon <strong>se ha actualizado</strong>, pero hubo un error al intentar actualizar automáticamente el archivo de configuración en el daemon. Deberás actualizar manualmente el archivo de configuración (config.yml) para aplicar estos cambios.',
    ],
    'allocations' => [
        'server_using' => 'Hay un servidor asignado a esta asignación. Solo se puede eliminar una asignación si no hay ningún servidor asignado.',
        'too_many_ports' => 'No se admite añadir más de 1000 puertos en un solo rango de una vez.',
        'invalid_mapping' => 'El mapeo proporcionado para :port no era válido y no pudo procesarse.',
        'cidr_out_of_range' => 'La notación CIDR solo permite máscaras entre /25 y /32.',
        'port_out_of_range' => 'Los puertos en una asignación deben ser mayores que 1024 e inferiores o iguales a 65535.',
    ],
    'nest' => [
        'delete_has_servers' => 'No se puede eliminar del panel un Nest con servidores activos asociados.',
        'egg' => [
            'delete_has_servers' => 'No se puede eliminar del panel un Egg con servidores activos asociados.',
            'invalid_copy_id' => 'El Egg seleccionado para copiar un script no existe o está copiando un script él mismo.',
            'must_be_child' => 'La directiva "Copiar ajustes desde" de este Egg debe ser una opción hija del Nest seleccionado.',
            'has_children' => 'Este Egg es padre de uno o más Eggs. Elimina esos Eggs antes de eliminar este Egg.',
        ],
        'variables' => [
            'env_not_unique' => 'La variable de entorno :name debe ser única para este Egg.',
            'reserved_name' => 'La variable de entorno :name está protegida y no puede asignarse a una variable.',
            'bad_validation_rule' => 'La regla de validación ":rule" no es una regla válida para esta aplicación.',
        ],
        'importer' => [
            'json_error' => 'Hubo un error al intentar analizar el archivo JSON: :error.',
            'file_error' => 'El archivo JSON proporcionado no era válido.',
            'invalid_json_provided' => 'El archivo JSON proporcionado no está en un formato reconocible.',
        ],
    ],
    'subusers' => [
        'editing_self' => 'No está permitido editar tu propia cuenta de subusuario.',
        'user_is_owner' => 'No puedes añadir al propietario del servidor como subusuario de este servidor.',
        'subuser_exists' => 'Ya hay un usuario con ese correo asignado como subusuario de este servidor.',
    ],
    'databases' => [
        'delete_has_databases' => 'No se puede eliminar un servidor anfitrión de bases de datos que tenga bases de datos activas vinculadas.',
    ],
    'tasks' => [
        'chain_interval_too_long' => 'El intervalo máximo para una tarea encadenada es de 15 minutos.',
    ],
    'locations' => [
        'has_nodes' => 'No se puede eliminar una ubicación que tenga nodos activos asociados.',
    ],
    'users' => [
        'node_revocation_failed' => 'No se pudieron revocar las claves en el <a href=":link">nodo #:node</a>. :error',
    ],
    'deployment' => [
        'no_viable_nodes' => 'No se encontraron nodos que cumplan los requisitos especificados para el despliegue automático.',
        'no_viable_allocations' => 'No se encontraron asignaciones que cumplan los requisitos para el despliegue automático.',
    ],
    'api' => [
        'resource_not_found' => 'El recurso solicitado no existe en este servidor.',
    ],
];
