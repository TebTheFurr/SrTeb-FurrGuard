import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import EditSubuserModal from '@/components/server/users/EditSubuserModal';
import { Button } from '@/components/elements/button/index';

export default () => {
    const { t } = useTranslation('server');
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const handler = () => setVisible(true);
        window.addEventListener('luna:keybind:create-subuser', handler as EventListener);
        return () => window.removeEventListener('luna:keybind:create-subuser', handler as EventListener);
    }, []);

    return (
        <>
            <EditSubuserModal visible={visible} onModalDismissed={() => setVisible(false)} />
            <Button onClick={() => setVisible(true)}>{t('users.add')}</Button>
        </>
    );
};
