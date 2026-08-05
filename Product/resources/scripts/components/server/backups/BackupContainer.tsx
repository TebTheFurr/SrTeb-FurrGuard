import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Spinner from '@/components/elements/Spinner';
import useFlash from '@/plugins/useFlash';
import Can from '@/components/elements/Can';
import CreateBackupButton from '@/components/server/backups/CreateBackupButton';
import FlashMessageRender from '@/components/FlashMessageRender';
import BackupRow from '@/components/server/backups/BackupRow';
import tw from 'twin.macro';
import getServerBackups, { Context as ServerBackupContext } from '@/api/swr/getServerBackups';
import { ServerContext } from '@/state/server';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import Pagination from '@/components/elements/Pagination';
import EmptyState from '@/components/elements/EmptyState';
import PageHeader from '@/components/elements/ui/PageHeader';
import MetaChip from '@/components/elements/ui/MetaChip';
import { faArchive } from '@fortawesome/free-solid-svg-icons';

const BackupContainer = () => {
    const { t } = useTranslation('server');
    const { setPage } = useContext(ServerBackupContext);
    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const { data: backups, error, isValidating } = getServerBackups();

    const backupLimit = ServerContext.useStoreState((state) => state.server.data!.featureLimits.backups);

    useEffect(() => {
        if (!error) {
            clearFlashes('backups');

            return;
        }

        clearAndAddHttpError({ error, key: 'backups' });
    }, [error]);

    if (!backups || (error && isValidating)) {
        return <Spinner size={'large'} centered />;
    }

    return (
        <ServerContentBlock title={t('backups.title')}>
            <FlashMessageRender byKey={'backups'} css={tw`mb-4`} />
            <PageHeader
                title={t('backups.title')}
                description={t('backups.subtitle')}
                meta={
                    backupLimit > 0 && (
                        <MetaChip icon={faArchive}>
                            {t('backups.usage', { current: backups.backupCount, limit: backupLimit })}
                        </MetaChip>
                    )
                }
                actions={
                    backupLimit > backups.backupCount && (
                        <Can action={'backup.create'}>
                            <CreateBackupButton />
                        </Can>
                    )
                }
            />
            {backupLimit === 0 ? (
                <EmptyState
                    title={t('backups.disabled.title')}
                    message={t('backups.disabled.message')}
                />
            ) : (
                <>
                    <Pagination data={backups} onPageSelect={setPage}>
                        {({ items }) =>
                            !items.length ? (
                                <EmptyState
                                    title={t('backups.empty.title')}
                                    message={t('backups.empty.message')}
                                />
                            ) : (
                                items.map((backup, index) => (
                                    <BackupRow key={backup.uuid} backup={backup} css={index > 0 ? tw`mt-2` : undefined} />
                                ))
                            )
                        }
                    </Pagination>
                </>
            )}
        </ServerContentBlock>
    );
};

export default () => {
    const [page, setPage] = useState<number>(1);
    return (
        <ServerBackupContext.Provider value={{ page, setPage }}>
            <BackupContainer />
        </ServerBackupContext.Provider>
    );
};
