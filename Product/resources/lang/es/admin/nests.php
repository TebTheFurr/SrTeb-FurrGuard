<?php

return [
    'notices' => [
        'created' => 'Se ha creado correctamente un nuevo nest, :name.',
        'deleted' => 'Se ha eliminado correctamente el nest solicitado del panel.',
        'updated' => 'Se han actualizado correctamente las opciones de configuración del nest.',
    ],
    'eggs' => [
        'notices' => [
            'imported' => 'Se ha importado correctamente este Egg y sus variables asociadas.',
            'updated_via_import' => 'Este Egg se ha actualizado con el archivo proporcionado.',
            'deleted' => 'Se ha eliminado correctamente el egg solicitado del panel.',
            'updated' => 'La configuración del Egg se ha actualizado correctamente.',
            'script_updated' => 'El script de instalación del Egg se ha actualizado y se ejecutará cuando se instalen servidores.',
            'egg_created' => 'Se ha creado un nuevo egg correctamente. Deberás reiniciar los daemons en ejecución para aplicar este nuevo egg.',
        ],
    ],
    'variables' => [
        'notices' => [
            'variable_deleted' => 'La variable ":variable" se ha eliminado y dejará de estar disponible para los servidores una vez reconstruidos.',
            'variable_updated' => 'La variable ":variable" se ha actualizado. Deberás reconstruir los servidores que usen esta variable para aplicar los cambios.',
            'variable_created' => 'La nueva variable se ha creado correctamente y se ha asignado a este egg.',
        ],
    ],
];
