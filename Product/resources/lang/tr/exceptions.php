<?php

return [
    'daemon_connection_failed' => 'Daemon ile iletişim kurulurken bir istisna oluştu; HTTP/:code yanıt kodu alındı. Bu istisna günlüğe kaydedildi.',
    'node' => [
        'servers_attached' => 'Bir düğüm silinebilmesi için ona bağlı sunucu olmamalıdır.',
        'daemon_off_config_updated' => 'Daemon yapılandırması <strong>güncellendi</strong>, ancak yapılandırma dosyasının Daemon üzerinde otomatik güncellenmesi sırasında bir hata oluştu. Değişikliklerin uygulanması için yapılandırma dosyasını (config.yml) manuel olarak güncellemeniz gerekir.',
    ],
    'allocations' => [
        'server_using' => 'Bu tahsise şu anda bir sunucu atanmış. Tahsis yalnızca atanmış sunucu yokken silinebilir.',
        'too_many_ports' => 'Tek seferde 1000\'den fazla port eklenmesi desteklenmez.',
        'invalid_mapping' => ':port için sağlanan eşleme geçersizdi ve işlenemedi.',
        'cidr_out_of_range' => 'CIDR gösterimi yalnızca /25 ile /32 arası maskelere izin verir.',
        'port_out_of_range' => 'Tahsislerdeki portlar 1024\'ten büyük ve 65535\'e kadar olmalıdır.',
    ],
    'nest' => [
        'delete_has_servers' => 'Aktif sunucuları olan bir Nest Panelden silinemez.',
        'egg' => [
            'delete_has_servers' => 'Aktif sunucuları olan bir Egg Panelden silinemez.',
            'invalid_copy_id' => 'Betik kopyalamak için seçilen Egg ya mevcut değil ya da kendisi bir betiği kopyalıyor.',
            'must_be_child' => 'Bu Egg için "Ayarları Kopyala" seçeneği, seçilen Nest için alt seçenek olmalıdır.',
            'has_children' => 'Bu Egg bir veya daha fazla Egg\'in üstüdür. Bu Egg\'i silmeden önce alt Egg\'leri silin.',
        ],
        'variables' => [
            'env_not_unique' => ':name ortam değişkeni bu Egg için benzersiz olmalıdır.',
            'reserved_name' => ':name ortam değişkeni korunmaktadır ve bir değişkene atanamaz.',
            'bad_validation_rule' => '":rule" doğrulama kuralı bu uygulama için geçerli bir kural değildir.',
        ],
        'importer' => [
            'json_error' => 'JSON dosyası ayrıştırılırken hata oluştu: :error.',
            'file_error' => 'Sağlanan JSON dosyası geçerli değildi.',
            'invalid_json_provided' => 'Sağlanan JSON dosyası tanınabilir bir biçimde değil.',
        ],
    ],
    'subusers' => [
        'editing_self' => 'Kendi alt kullanıcı hesabınızı düzenlemenize izin verilmez.',
        'user_is_owner' => 'Sunucu sahibini bu sunucu için alt kullanıcı olarak ekleyemezsiniz.',
        'subuser_exists' => 'Bu e-posta adresine sahip bir kullanıcı zaten bu sunucu için alt kullanıcı olarak atanmış.',
    ],
    'databases' => [
        'delete_has_databases' => 'Aktif veritabanları bağlı olan bir veritabanı ana bilgisayarı silinemez.',
    ],
    'tasks' => [
        'chain_interval_too_long' => 'Zincirlenmiş bir görev için maksimum aralık süresi 15 dakikadır.',
    ],
    'locations' => [
        'has_nodes' => 'Aktif düğümler bağlı olan bir konum silinemez.',
    ],
    'users' => [
        'node_revocation_failed' => '<a href=":link">Düğüm #:node</a> üzerinde anahtarlar iptal edilemedi. :error',
    ],
    'deployment' => [
        'no_viable_nodes' => 'Otomatik dağıtım için belirtilen gereksinimleri karşılayan düğüm bulunamadı.',
        'no_viable_allocations' => 'Otomatik dağıtım gereksinimlerini karşılayan tahsis bulunamadı.',
    ],
    'api' => [
        'resource_not_found' => 'İstenen kaynak bu sunucuda mevcut değil.',
    ],
];
