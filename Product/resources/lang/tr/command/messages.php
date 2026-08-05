<?php

return [
    'location' => [
        'no_location_found' => 'Sağlanan kısa kodla eşleşen kayıt bulunamadı.',
        'ask_short' => 'Konum kısa kodu',
        'ask_long' => 'Konum açıklaması',
        'created' => 'Yeni konum (:name) ID :id ile başarıyla oluşturuldu.',
        'deleted' => 'İstenen konum başarıyla silindi.',
    ],
    'user' => [
        'search_users' => 'Kullanıcı adı, kullanıcı ID veya e-posta adresi girin',
        'select_search_user' => 'Silinecek kullanıcının ID\'si (yeniden aramak için \'0\' girin)',
        'deleted' => 'Kullanıcı Panelden başarıyla silindi.',
        'confirm_delete' => 'Bu kullanıcıyı Panelden silmek istediğinizden emin misiniz?',
        'no_users_found' => 'Sağlanan arama terimi için kullanıcı bulunamadı.',
        'multiple_found' => 'Sağlanan kullanıcı için birden fazla hesap bulundu; --no-interaction bayrağı nedeniyle kullanıcı silinemiyor.',
        'ask_admin' => 'Bu kullanıcı yönetici mi?',
        'ask_email' => 'E-posta adresi',
        'ask_username' => 'Kullanıcı adı',
        'ask_name_first' => 'Ad',
        'ask_name_last' => 'Soyad',
        'ask_password' => 'Parola',
        'ask_password_tip' => 'Kullanıcıya rastgele parola içeren e-posta ile hesap oluşturmak isterseniz bu komutu (CTRL+C) durdurun ve `--no-password` bayrağını kullanın.',
        'ask_password_help' => 'Parolalar en az 8 karakter olmalı ve en az bir büyük harf ile rakam içermelidir.',
        '2fa_help_text' => [
            'Bu komut, etkinse bir kullanıcının hesabında 2 faktörlü kimlik doğrulamayı kapatır. Bu yalnızca kullanıcı hesabına kilitlendiyse hesap kurtarma için kullanılmalıdır.',
            'Bunu yapmak istemiyorsanız bu işlemden çıkmak için CTRL+C tuşlarına basın.',
        ],
        '2fa_disabled' => ':email için 2 faktörlü kimlik doğrulama kapatıldı.',
    ],
    'schedule' => [
        'output_line' => '`:schedule` (:hash) içindeki ilk görev için iş gönderiliyor.',
    ],
    'maintenance' => [
        'deleting_service_backup' => ':file hizmet yedek dosyası siliniyor.',
    ],
    'server' => [
        'rebuild_failed' => '":node" düğümündeki ":name" (#:id) için yeniden oluşturma isteği şu hatayla başarısız: :message',
        'reinstall' => [
            'failed' => '":node" düğümündeki ":name" (#:id) için yeniden kurulum isteği şu hatayla başarısız: :message',
            'confirm' => 'Bir sunucu grubuna karşı yeniden kurulum yapmak üzeresiniz. Devam etmek istiyor musunuz?',
        ],
        'power' => [
            'confirm' => ':count sunucuya karşı :action gerçekleştirmek üzeresiniz. Devam etmek istiyor musunuz?',
            'action_failed' => '":node" düğümündeki ":name" (#:id) için güç eylemi isteği şu hatayla başarısız: :message',
        ],
    ],
    'environment' => [
        'mail' => [
            'ask_smtp_host' => 'SMTP sunucusu (ör. smtp.gmail.com)',
            'ask_smtp_port' => 'SMTP portu',
            'ask_smtp_username' => 'SMTP kullanıcı adı',
            'ask_smtp_password' => 'SMTP parolası',
            'ask_mailgun_domain' => 'Mailgun etki alanı',
            'ask_mailgun_endpoint' => 'Mailgun uç noktası',
            'ask_mailgun_secret' => 'Mailgun gizli anahtarı',
            'ask_mandrill_secret' => 'Mandrill gizli anahtarı',
            'ask_postmark_username' => 'Postmark API anahtarı',
            'ask_driver' => 'E-posta gönderimi için hangi sürücü kullanılsın?',
            'ask_mail_from' => 'E-postaların gönderileceği adres',
            'ask_mail_name' => 'E-postaların görüneceği ad',
            'ask_encryption' => 'Kullanılacak şifreleme yöntemi',
        ],
    ],
];
