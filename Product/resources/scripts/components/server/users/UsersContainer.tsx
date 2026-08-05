import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ServerContext } from '@/state/server';
import { Actions, useStoreActions, useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import Spinner from '@/components/elements/Spinner';
import AddSubuserButton from '@/components/server/users/AddSubuserButton';
import UserRow from '@/components/server/users/UserRow';
import FlashMessageRender from '@/components/FlashMessageRender';
import getServerSubusers from '@/api/server/users/getServerSubusers';
import { httpErrorToHuman } from '@/api/http';
import Can from '@/components/elements/Can';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import tw from 'twin.macro';
import EmptyState from '@/components/elements/EmptyState';
import PageHeader from '@/components/elements/ui/PageHeader';
import MetaChip from '@/components/elements/ui/MetaChip';
import { faUsers } from '@fortawesome/free-solid-svg-icons';

export default () => {
    const { t } = useTranslation('server');
    const [loading, setLoading] = useState(true);

    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const subusers = ServerContext.useStoreState((state) => state.subusers.data);
    const setSubusers = ServerContext.useStoreActions((actions) => actions.subusers.setSubusers);

    const permissions = useStoreState((state: ApplicationStore) => state.permissions.data);
    const getPermissions = useStoreActions((actions: Actions<ApplicationStore>) => actions.permissions.getPermissions);
    const { addError, clearFlashes } = useStoreActions((actions: Actions<ApplicationStore>) => actions.flashes);

    useEffect(() => {
        clearFlashes('users');
        getServerSubusers(uuid)
            .then((subusers) => {
                setSubusers(subusers);
                setLoading(false);
            })
            .catch((error) => {
                console.error(error);
                addError({ key: 'users', message: httpErrorToHuman(error) });
            });
    }, []);

    useEffect(() => {
        getPermissions().catch((error) => {
            addError({ key: 'users', message: httpErrorToHuman(error) });
            console.error(error);
        });
    }, []);

    if (!subusers.length && (loading || !Object.keys(permissions).length)) {
        return <Spinner size={'large'} centered />;
    }

    return (
        <ServerContentBlock title={t('users.title')}>
            <FlashMessageRender byKey={'users'} css={tw`mb-4`} />
            <PageHeader
                title={t('users.title')}
                description={t('users.subtitle')}
                meta={
                    subusers.length > 0 && (
                        <MetaChip icon={faUsers}>{t('users.usage', { count: subusers.length })}</MetaChip>
                    )
                }
                actions={
                    <Can action={'user.create'}>
                        <AddSubuserButton />
                    </Can>
                }
            />
            {!subusers.length ? (
                <EmptyState
                    title={t('users.empty.title')}
                    message={t('users.empty.message')}
                />
            ) : (
                subusers.map((subuser) => <UserRow key={subuser.uuid} subuser={subuser} />)
            )}
        </ServerContentBlock>
    );
};
