import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ServerContext } from '@/state/server';
import reinstallServer from '@/api/server/reinstallServer';
import { Actions, useStoreActions } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import { httpErrorToHuman } from '@/api/http';
import { Button } from '@/components/elements/button/index';
import { Dialog } from '@/components/elements/dialog';
import styled from 'styled-components/macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSync } from '@fortawesome/free-solid-svg-icons';
import tw from 'twin.macro';

const Card = styled.div`
    background: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    overflow: hidden;
`;

const CardHeader = styled.div`
    ${tw`px-5 py-4 flex items-center gap-3`};
    border-bottom: 1px solid var(--color-neutral);
`;

const CardBody = styled.div`
    ${tw`p-5`};
`;

const WarningList = styled.ul`
    ${tw`space-y-2`};
`;

const WarningItem = styled.li`
    ${tw`flex items-start gap-2 text-sm`};
    color: var(--color-muted);
`;

const CardFooter = styled.div`
    ${tw`px-5 py-4 flex items-center justify-between`};
    background: color-mix(in srgb, var(--color-neutral) 30%, transparent);
    border-top: 1px solid var(--color-neutral);
`;

export default () => {
    const { t } = useTranslation('server');
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const [modalVisible, setModalVisible] = useState(false);
    const { addFlash, clearFlashes } = useStoreActions((actions: Actions<ApplicationStore>) => actions.flashes);

    const reinstall = () => {
        clearFlashes('settings');
        reinstallServer(uuid)
            .then(() => {
                addFlash({
                    key: 'settings',
                    type: 'success',
                    message: t('settings.reinstall.success'),
                });
            })
            .catch((error) => {
                console.error(error);
                addFlash({ key: 'settings', type: 'error', message: httpErrorToHuman(error) });
            })
            .then(() => setModalVisible(false));
    };

    useEffect(() => {
        clearFlashes();
    }, []);

    return (
        <Card>
            <Dialog.Confirm
                open={modalVisible}
                title={t('settings.reinstall.confirm_title')}
                confirm={t('settings.reinstall.confirm_button')}
                onClose={() => setModalVisible(false)}
                onConfirmed={reinstall}
            >
                {t('settings.reinstall.confirm_message')}
            </Dialog.Confirm>
            
            <CardHeader>
                <FontAwesomeIcon icon={faSync} style={{ color: '#ef4444' }} />
                <span className="font-medium" style={{ color: 'var(--color-base)' }}>
                    {t('settings.reinstall.title')}
                </span>
            </CardHeader>
            
            <CardBody>
                <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>
                    {t('settings.reinstall.description')}
                </p>
                
                <WarningList>
                    <WarningItem>
                        <span>- {t('settings.reinstall.warning_stop')}</span>
                    </WarningItem>
                    <WarningItem>
                        <span>- {t('settings.reinstall.warning_config')}</span>
                    </WarningItem>
                    <WarningItem>
                        <span>- {t('settings.reinstall.warning_data')}</span>
                    </WarningItem>
                    <WarningItem>
                        <span>- {t('settings.reinstall.warning_undo')}</span>
                    </WarningItem>
                </WarningList>
            </CardBody>
            
            <CardFooter>
                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                    {t('settings.reinstall.immediate')}
                </p>
                <Button.Danger onClick={() => setModalVisible(true)}>
                    <FontAwesomeIcon icon={faSync} className="mr-2" />
                    {t('settings.reinstall.button')}
                </Button.Danger>
            </CardFooter>
        </Card>
    );
};
