<?php

return [
    'validation' => [
        'fqdn_not_resolvable' => 'Sağlanan FQDN veya IP adresi geçerli bir IP adresine çözümlenmiyor.',
        'fqdn_required_for_ssl' => 'Bu düğümde SSL kullanmak için genel bir IP adresine çözümlenen tam nitelikli bir alan adı gerekir.',
    ],
    'notices' => [
        'allocations_added' => 'Tahsisler bu düğüme başarıyla eklendi.',
        'node_deleted' => 'Düğüm panelden başarıyla kaldırıldı.',
        'location_required' => 'Panele düğüm eklemeden önce en az bir konum yapılandırılmış olmalıdır.',
        'node_created' => 'Yeni düğüm başarıyla oluşturuldu. Bu makinede daemon\'u otomatik yapılandırmak için \'Yapılandırma\' sekmesini ziyaret edebilirsiniz. <strong>Sunucu eklemeden önce en az bir IP adresi ve port tahsis etmelisiniz.</strong>',
        'node_updated' => 'Düğüm bilgileri güncellendi. Daemon ayarları değiştiyse bu değişikliklerin uygulanması için yeniden başlatmanız gerekir.',
        'unallocated_deleted' => '<code>:ip</code> için tahsis edilmemiş tüm portlar silindi.',
    ],
];
