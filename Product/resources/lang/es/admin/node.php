<?php

return [
    'validation' => [
        'fqdn_not_resolvable' => 'El FQDN o la dirección IP proporcionados no resuelven a una dirección IP válida.',
        'fqdn_required_for_ssl' => 'Se requiere un nombre de dominio completo que resuelva a una dirección IP pública para usar SSL en este nodo.',
    ],
    'notices' => [
        'allocations_added' => 'Las asignaciones se han añadido correctamente a este nodo.',
        'node_deleted' => 'El nodo se ha eliminado correctamente del panel.',
        'location_required' => 'Debes tener al menos una ubicación configurada antes de poder añadir un nodo a este panel.',
        'node_created' => 'Nuevo nodo creado correctamente. Puedes configurar automáticamente el daemon en esta máquina visitando la pestaña \'Configuración\'. <strong>Antes de poder añadir servidores debes asignar al menos una dirección IP y un puerto.</strong>',
        'node_updated' => 'La información del nodo se ha actualizado. Si se cambió algún ajuste del daemon, deberás reiniciarlo para que surtan efecto los cambios.',
        'unallocated_deleted' => 'Se han eliminado todos los puertos no asignados para <code>:ip</code>.',
    ],
];
