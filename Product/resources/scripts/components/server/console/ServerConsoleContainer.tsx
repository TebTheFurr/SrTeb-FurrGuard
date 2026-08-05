import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ServerContext } from '@/state/server';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import isEqual from 'react-fast-compare';
import Spinner from '@/components/elements/Spinner';
import Features from '@feature/Features';
import Console from '@/components/server/console/Console';
import StatGraphs from '@/components/server/console/StatGraphs';
import ServerDetailsBlock from '@/components/server/console/ServerDetailsBlock';
import RamUpgradeAlert from '@/components/server/console/RamUpgradeAlert';
import { Alert } from '@/components/elements/alert';
import UptimeDisplay from '@/components/server/console/UptimeDisplay';
import StatusBadge from '@/components/server/console/StatusBadge';
import PageHeader from '@/components/elements/ui/PageHeader';

const ServerConsoleContainer = () => {
    const { t } = useTranslation('server');
    const name = ServerContext.useStoreState((state) => state.server.data!.name);
    const isInstalling = ServerContext.useStoreState((state) => state.server.isInstalling);
    const isTransferring = ServerContext.useStoreState((state) => state.server.data!.isTransferring);
    const eggFeatures = ServerContext.useStoreState((state) => state.server.data!.eggFeatures, isEqual);
    const isNodeUnderMaintenance = ServerContext.useStoreState((state) => state.server.data!.isNodeUnderMaintenance);
    const status = ServerContext.useStoreState((state) => state.status.value);

    return (
        <ServerContentBlock title={t('console.title')}>
            {(isNodeUnderMaintenance || isInstalling || isTransferring) && (
                <Alert type={'warning'} className={'mb-4'}>
                    {isNodeUnderMaintenance
                        ? t('console.maintenance_warning')
                        : isInstalling
                        ? t('console.installing_warning')
                        : t('console.transferring_warning')}
                </Alert>
            )}
            
            <PageHeader
                title={name}
                meta={
                    <>
                        <StatusBadge />
                        {status !== null && status !== 'offline' && (
                            <span className={'text-sm'} style={{ color: 'var(--color-inverted)' }}>
                                •
                            </span>
                        )}
                        <UptimeDisplay />
                    </>
                }
            />

            <ServerDetailsBlock className={'mb-4'} />

            <Spinner.Suspense>
                <Console />
            </Spinner.Suspense>
            
            <RamUpgradeAlert />

            <div className={'grid grid-cols-1 md:grid-cols-3 gap-4 mt-4'}>
                <Spinner.Suspense>
                    <StatGraphs />
                </Spinner.Suspense>
            </div>
            
            <Features enabled={eggFeatures} />
        </ServerContentBlock>
    );
};

export default memo(ServerConsoleContainer, isEqual);
