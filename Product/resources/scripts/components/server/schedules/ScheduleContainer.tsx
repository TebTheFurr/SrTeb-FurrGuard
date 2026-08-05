import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import getServerSchedules from '@/api/server/schedules/getServerSchedules';
import { ServerContext } from '@/state/server';
import Spinner from '@/components/elements/Spinner';
import { useHistory, useRouteMatch } from 'react-router-dom';
import FlashMessageRender from '@/components/FlashMessageRender';
import ScheduleRow from '@/components/server/schedules/ScheduleRow';
import { httpErrorToHuman } from '@/api/http';
import EditScheduleModal from '@/components/server/schedules/EditScheduleModal';
import Can from '@/components/elements/Can';
import useFlash from '@/plugins/useFlash';
import tw from 'twin.macro';
import GreyRowBox from '@/components/elements/GreyRowBox';
import { Button } from '@/components/elements/button/index';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import EmptyState from '@/components/elements/EmptyState';
import ScheduleCheatsheetCards from '@/components/server/schedules/ScheduleCheatsheetCards';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';

export default () => {
    const { t } = useTranslation('server');
    const match = useRouteMatch();
    const history = useHistory();

    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { clearFlashes, addError } = useFlash();
    const [loading, setLoading] = useState(true);
    const [visible, setVisible] = useState(false);
    const [showCheatsheet, setShowCheatsheet] = useState(false);

    const schedules = ServerContext.useStoreState((state) => state.schedules.data);
    const setSchedules = ServerContext.useStoreActions((actions) => actions.schedules.setSchedules);

    useEffect(() => {
        clearFlashes('schedules');
        getServerSchedules(uuid)
            .then((schedules) => setSchedules(schedules))
            .catch((error) => {
                addError({ message: httpErrorToHuman(error), key: 'schedules' });
                console.error(error);
            })
            .then(() => setLoading(false));
    }, []);

    useEffect(() => {
        const handler = () => setVisible(true);
        window.addEventListener('luna:keybind:create-schedule', handler as EventListener);
        return () => window.removeEventListener('luna:keybind:create-schedule', handler as EventListener);
    }, []);

    return (
        <ServerContentBlock title={t('schedules.title')}>
            <FlashMessageRender byKey={'schedules'} css={tw`mb-4`} />
            {!schedules.length && loading ? (
                <Spinner size={'large'} centered />
            ) : (
                <>
                    <EditScheduleModal visible={visible} onModalDismissed={() => setVisible(false)} />
                    
                    <Can action={'schedule.create'}>
                        <div css={tw`mb-4 flex justify-end`}>
                            <Button type={'button'} onClick={() => setVisible(true)}>
                                {t('schedules.create')}
                            </Button>
                        </div>
                    </Can>
                        <div
                            css={tw`mb-4 overflow-hidden`}
                            style={{
                                backgroundColor: 'var(--color-background-secondary)',
                                border: '1px solid var(--color-neutral)',
                                borderRadius: 'var(--border-radius, 12px)',
                            }}
                        >
                            <button
                                css={tw`w-full flex items-center justify-between p-4`}
                                style={{ color: 'var(--color-base)' }}
                                onClick={() => setShowCheatsheet((s) => !s)}
                                type="button"
                            >
                                <span css={tw`font-medium`}>{t('schedules.cron_cheatsheet')}</span>
                                <FontAwesomeIcon
                                    icon={showCheatsheet ? faChevronUp : faChevronDown}
                                    style={{ color: 'var(--color-muted)' }}
                                />
                            </button>
                            {showCheatsheet && (
                                <div
                                    css={tw`block md:flex w-full`}
                                    style={{ borderTop: '1px solid var(--color-neutral)' }}
                                >
                                    <ScheduleCheatsheetCards />
                                </div>
                            )}
                        </div>
                    {schedules.length === 0 ? (
                        <EmptyState
                            title={t('schedules.empty.title')}
                            message={t('schedules.empty.message')}
                        />
                    ) : (
                        schedules.map((schedule) => (
                            <GreyRowBox
                                as={'a'}
                                key={schedule.id}
                                href={`${match.url}/${schedule.id}`}
                                css={tw`cursor-pointer mb-2 flex-wrap`}
                                onClick={(e: any) => {
                                    e.preventDefault();
                                    history.push(`${match.url}/${schedule.id}`);
                                }}
                            >
                                <ScheduleRow schedule={schedule} />
                            </GreyRowBox>
                        ))
                    )}
                </>
            )}
        </ServerContentBlock>
    );
};
