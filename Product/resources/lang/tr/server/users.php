<?php

return [
    'title' => 'Kullanıcılar',

    'empty' => [
        'title' => 'Alt kullanıcı yok',
        'message' => 'Bu sunucuya henüz alt kullanıcı eklemediniz. Sunucunuzu yönetmeye yardım etmek için başkalarını davet edin.',
    ],

    'delete' => [
        'title' => 'Bu alt kullanıcı silinsin mi?',
    ],

    'permissions' => [
        'websocket_*' => 'Bu sunucu için websocket erişimine izin verir.',
        'control_console' => 'Kullanıcının sunucu konsoluna veri göndermesine izin verir.',
        'control_start' => 'Kullanıcının sunucu örneğini başlatmasına izin verir.',
        'control_stop' => 'Kullanıcının sunucu örneğini durdurmasına izin verir.',
        'control_restart' => 'Kullanıcının sunucu örneğini yeniden başlatmasına izin verir.',
        'control_kill' => 'Kullanıcının sunucu işlemini sonlandırmasına izin verir.',
        'user_create' => 'Kullanıcının sunucu için yeni kullanıcı hesapları oluşturmasına izin verir.',
        'user_read' => 'Kullanıcının bu sunucuyla ilişkili kullanıcıları görüntülemesine izin verir.',
        'user_update' => 'Kullanıcının bu sunucuyla ilişkili diğer kullanıcıları değiştirmesine izin verir.',
        'user_delete' => 'Kullanıcının bu sunucuyla ilişkili diğer kullanıcıları silmesine izin verir.',
        'file_create' => 'Kullanıcının yeni dosya ve dizin oluşturmasına izin verir.',
        'file_read' => 'Kullanıcının bu sunucu örneğiyle ilişkili dosya ve klasörleri ve içeriklerini görmesine izin verir.',
        'file_update' => 'Kullanıcının sunucuyla ilişkili dosya ve klasörleri güncellemesine izin verir.',
        'file_delete' => 'Kullanıcının dosya ve dizinleri silmesine izin verir.',
        'file_archive' => 'Kullanıcının dosya arşivleri oluşturmasına ve mevcut arşivleri açmasına izin verir.',
        'file_sftp' => 'Kullanıcının yukarıdaki dosya eylemlerini SFTP istemcisiyle yapmasına izin verir.',
        'allocation_read' => 'Sunucu tahsis yönetimi sayfalarına erişime izin verir.',
        'allocation_update' => 'Kullanıcının sunucunun tahsislerinde değişiklik yapmasına izin verir.',
        'database_create' => 'Kullanıcının sunucu için yeni veritabanı oluşturmasına izin verir.',
        'database_read' => 'Kullanıcının sunucu veritabanlarını görüntülemesine izin verir.',
        'database_update' => 'Kullanıcının bir veritabanını değiştirmesine izin verir. "Parolayı görüntüle" izni yoksa parolayı değiştiremez.',
        'database_delete' => 'Kullanıcının bir veritabanı örneğini silmesine izin verir.',
        'database_view_password' => 'Kullanıcının sistemde bir veritabanı parolasını görüntülemesine izin verir.',
        'schedule_create' => 'Kullanıcının sunucu için yeni zamanlama oluşturmasına izin verir.',
        'schedule_read' => 'Kullanıcının bir sunucunun zamanlamalarını görüntülemesine izin verir.',
        'schedule_update' => 'Kullanıcının mevcut bir sunucu zamanlamasını değiştirmesine izin verir.',
        'schedule_delete' => 'Kullanıcının sunucu için bir zamanlamayı silmesine izin verir.',
    ],
];
