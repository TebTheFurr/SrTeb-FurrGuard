import React, { useCallback, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import getServerSchedule from '@/api/server/schedules/getServerSchedule';
import Spinner from '@/components/elements/Spinner';
import FlashMessageRender from '@/components/FlashMessageRender';
import EditScheduleModal from '@/components/server/schedules/EditScheduleModal';
import NewTaskButton from '@/components/server/schedules/NewTaskButton';
import DeleteScheduleButton from '@/components/server/schedules/DeleteScheduleButton';
import Can from '@/components/elements/Can';
import useFlash from '@/plugins/useFlash';
import { ServerContext } from '@/state/server';
import PageContentBlock from '@/components/elements/PageContentBlock';
import tw from 'twin.macro';
import { Button } from '@/components/elements/button/index';
import ScheduleTaskRow from '@/components/server/schedules/ScheduleTaskRow';
import isEqual from 'react-fast-compare';
import { format } from 'date-fns';
import ScheduleCronRow from '@/components/server/schedules/ScheduleCronRow';
import RunScheduleButton from '@/components/server/schedules/RunScheduleButton';
import ScheduleCountdown from '@/components/server/schedules/ScheduleCountdown';
import { useTranslation } from 'react-i18next';

interface Params {
    id: string;
}

const formatCronValue = (value: string): { display: string; isActive: boolean } => {
    if (value === '*') {
        return { display: '-', isActive: false };
    }
    const intervalMatch = value.match(/^\*\/(\d+)$/);
    if (intervalMatch) {
        return { display: intervalMatch[1], isActive: true };
    }
    return { display: value, isActive: true };
};

const CronBox = ({ title, value }: { title: string; value: string }) => {
    const formatted = formatCronValue(value);
    return (
        <div
            css={tw`p-3`}
            style={{
                backgroundColor: 'var(--color-background-secondary)',
                border: '1px solid var(--color-neutral)',
                borderRadius: 'var(--border-radius, 12px)',
                opacity: formatted.isActive ? 1 : 0.5,
            }}
        >
            <p css={tw`text-sm`} style={{ color: 'var(--color-muted)' }}>{title}</p>
            <p css={tw`text-xl font-medium`} style={{ color: formatted.isActive ? 'var(--color-base)' : 'var(--color-inverted)' }}>
                {formatted.display}
            </p>
        </div>
    );
};

const ActivePill = ({ active }: { active: boolean }) => {
    const { t } = useTranslation('server');

    return (
        <span
            css={tw`px-2 py-px text-xs ml-4 uppercase`}
            style={{
                backgroundColor: active ? '#16a34a' : '#dc2626',
                color: '#fff',
                borderRadius: 'calc(var(--border-radius, 12px) * 0.5)',
            }}
        >
            {active ? t('schedules.status.active', 'Active') : t('schedules.status.inactive', 'Inactive')}
        </span>
    );
};

export default () => {
    const { t } = useTranslation('server');
    const history = useHistory();
    const { id: scheduleId } = useParams<Params>();

    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);

    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const [isLoading, setIsLoading] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);

    const schedule = ServerContext.useStoreState(
        (st) => st.schedules.data.find((s) => s.id === Number(scheduleId)),
        isEqual
    );
    const appendSchedule = ServerContext.useStoreActions((actions) => actions.schedules.appendSchedule);

    useEffect(() => {
        if (schedule?.id === Number(scheduleId)) {
            setIsLoading(false);
            return;
        }

        clearFlashes('schedules');
        getServerSchedule(uuid, Number(scheduleId))
            .then((schedule) => appendSchedule(schedule))
            .catch((error) => {
                console.error(error);
                clearAndAddHttpError({ error, key: 'schedules' });
            })
            .then(() => setIsLoading(false));
    }, [scheduleId]);

    const toggleEditModal = useCallback(() => {
        setShowEditModal((s) => !s);
    }, []);

    return (
        <PageContentBlock title={t('schedules.title', 'Schedules')}>
            <FlashMessageRender byKey={'schedules'} css={tw`mb-4`} />
            {!schedule || isLoading ? (
                <Spinner size={'large'} centered />
            ) : (
                <>
                    <ScheduleCronRow
                        cron={schedule.cron}
                        css={tw`sm:hidden mb-4 p-3`}
                        style={{
                            backgroundColor: 'var(--color-background-secondary)',
                            border: '1px solid var(--color-neutral)',
                            borderRadius: 'var(--border-radius, 12px)',
                        }}
                    />
                    <div
                        style={{
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            css={tw`sm:flex items-center p-3 sm:p-6`}
                            style={{
                                backgroundColor: 'var(--color-background-secondary)',
                                borderRadius: 'var(--border-radius, 12px)',
                                border: '1px solid var(--color-neutral)',
                            }}
                        >
                            <div css={tw`flex-1`}>
                                <h3 css={tw`flex items-center text-2xl`} style={{ color: 'var(--color-base)' }}>
                                    {schedule.name}
                                    {schedule.isProcessing ? (
                                        <span
                                            css={tw`flex items-center px-2 py-px text-xs ml-4 uppercase`}
                                            style={{
                                                backgroundColor: 'var(--color-neutral)',
                                                color: 'var(--color-base)',
                                                borderRadius: 'calc(var(--border-radius, 12px) * 0.5)',
                                            }}
                                        >
                                            <Spinner css={tw`w-3! h-3! mr-2`} />
                                            {t('schedules.status.processing', 'Processing')}
                                        </span>
                                    ) : (
                                        <ActivePill active={schedule.isActive} />
                                    )}
                                </h3>
                                <p css={tw`mt-1 text-sm`} style={{ color: 'var(--color-muted)' }}>
                                    {t('schedules.last_run_at', 'Last run at:')}&nbsp;
                                    {schedule.lastRunAt ? (
                                        format(schedule.lastRunAt, "MMM do 'at' h:mma")
                                    ) : (
                                        <span style={{ color: 'var(--color-inverted)' }}>{t('schedules.not_available_short', 'n/a')}</span>
                                    )}
                                    <span
                                        css={tw`ml-4 pl-4 py-px`}
                                        style={{ borderLeft: '4px solid var(--color-neutral)' }}
                                    >
                                        {t('schedules.next_run_in', 'Next run in:')}&nbsp;
                                        <ScheduleCountdown nextRunAt={schedule.nextRunAt} />
                                        {schedule.nextRunAt && (
                                            <span style={{ color: 'var(--color-inverted)' }}>
                                                &nbsp;({format(schedule.nextRunAt, "MMM do 'at' h:mma")})
                                            </span>
                                        )}
                                    </span>
                                </p>
                            </div>
                            <div css={tw`flex sm:block mt-3 sm:mt-0`}>
                                <Can action={'schedule.update'}>
                                    <Button.Text className={'flex-1 mr-4'} onClick={toggleEditModal}>
                                        {t('schedules.edit', 'Edit')}
                                    </Button.Text>
                                    <NewTaskButton schedule={schedule} />
                                </Can>
                            </div>
                        </div>
                        <div css={tw`hidden sm:grid grid-cols-5 md:grid-cols-5 gap-4 mb-4 mt-4`}>
                            <CronBox title={t('schedules.modal.cron.minute', 'Minute')} value={schedule.cron.minute} />
                            <CronBox title={t('schedules.modal.cron.hour', 'Hour')} value={schedule.cron.hour} />
                            <CronBox title={t('schedules.modal.cron.day_month', 'Day (Month)')} value={schedule.cron.dayOfMonth} />
                            <CronBox title={t('schedules.modal.cron.month', 'Month')} value={schedule.cron.month} />
                            <CronBox title={t('schedules.modal.cron.day_week', 'Day (Week)')} value={schedule.cron.dayOfWeek} />
                        </div>
                        <div
                            style={{
                                backgroundColor: 'var(--color-background-secondary)',
                                borderRadius: 'var(--border-radius, 12px)',
                                border: '1px solid var(--color-neutral)',
                            }}
                        >
                            {schedule.tasks.length > 0 ? (
                                schedule.tasks
                                    .sort((a, b) =>
                                        a.sequenceId === b.sequenceId ? 0 : a.sequenceId > b.sequenceId ? 1 : -1
                                    )
                                    .map((task) => (
                                        <ScheduleTaskRow
                                            key={`${schedule.id}_${task.id}`}
                                            task={task}
                                            schedule={schedule}
                                        />
                                    ))
                            ) : (
                                <div css={tw`flex flex-col items-center justify-center py-12 px-6`} style={{ backgroundColor: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius, 12px)' }}>
                                    <h4
                                        css={tw`text-lg font-medium mb-1`}
                                        style={{ color: 'var(--color-base)' }}
                                    >
                                        {t('schedules.tasks.empty_title', 'No tasks yet')}
                                    </h4>
                                    <p
                                        css={tw`text-sm text-center max-w-xs`}
                                        style={{ color: 'var(--color-muted)' }}
                                    >
                                        {t('schedules.tasks.empty_message', 'Add a task to this schedule to automate commands, power actions, or backups.')}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                    <EditScheduleModal visible={showEditModal} schedule={schedule} onModalDismissed={toggleEditModal} />
                    <div css={tw`mt-6 flex sm:justify-end`}>
                        <Can action={'schedule.delete'}>
                            <DeleteScheduleButton
                                scheduleId={schedule.id}
                                onDeleted={() => history.push(`/server/${id}/schedules`)}
                            />
                        </Can>
                        {schedule.tasks.length > 0 && (
                            <Can action={'schedule.update'}>
                                <RunScheduleButton schedule={schedule} />
                            </Can>
                        )}
                    </div>
                </>
            )}
        </PageContentBlock>
    );
};
