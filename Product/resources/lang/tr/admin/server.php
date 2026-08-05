<?php

return [
    'exceptions' => [
        'no_new_default_allocation' => 'Bu sunucunun varsayılan tahsisini siliyorsunuz ancak kullanılacak yedek tahsis yok.',
        'marked_as_failed' => 'Bu sunucu önceki bir kurulumda başarısız olarak işaretlendi. Bu durumda mevcut durum değiştirilemez.',
        'bad_variable' => ':name değişkeninde doğrulama hatası oluştu.',
        'daemon_exception' => 'Daemon ile iletişim kurulurken bir istisna oluştu; HTTP/:code yanıt kodu alındı. Bu istisna günlüğe kaydedildi. (istek kimliği: :request_id)',
        'default_allocation_not_found' => 'İstenen varsayılan tahsis bu sunucunun tahsisleri arasında bulunamadı.',
    ],
    'alerts' => [
        'startup_changed' => 'Bu sunucunun başlangıç yapılandırması güncellendi. Nest veya egg değiştiyse şimdi yeniden kurulum gerçekleşecektir.',
        'server_deleted' => 'Sunucu sistemden başarıyla silindi.',
        'server_created' => 'Sunucu panelde başarıyla oluşturuldu. Daemon\'un bu sunucuyu tamamen kurması için birkaç dakika bekleyin.',
        'build_updated' => 'Bu sunucunun derleme ayrıntıları güncellendi. Bazı değişikliklerin etkili olması için yeniden başlatma gerekebilir.',
        'suspension_toggled' => 'Sunucu askıya alma durumu :status olarak değiştirildi.',
        'rebuild_on_boot' => 'Bu sunucu Docker konteynerinin yeniden oluşturulması gerektiği olarak işaretlendi. Bu, sunucu bir sonraki başlatıldığında gerçekleşecektir.',
        'install_toggled' => 'Bu sunucunun kurulum durumu değiştirildi.',
        'server_reinstalled' => 'Bu sunucu şimdi başlayan yeniden kurulum için kuyruğa alındı.',
        'details_updated' => 'Sunucu ayrıntıları başarıyla güncellendi.',
        'docker_image_updated' => 'Bu sunucu için kullanılacak varsayılan Docker imgesi başarıyla değiştirildi. Bu değişikliği uygulamak için yeniden başlatma gerekir.',
        'node_required' => 'Panele sunucu eklemeden önce en az bir düğüm yapılandırılmış olmalıdır.',
        'transfer_nodes_required' => 'Sunucuları aktarmadan önce en az iki düğüm yapılandırılmış olmalıdır.',
        'transfer_started' => 'Sunucu aktarımı başlatıldı.',
        'transfer_not_viable' => 'Seçtiğiniz düğümde bu sunucuyu barındırmak için yeterli disk alanı veya bellek yok.',
    ],
];
