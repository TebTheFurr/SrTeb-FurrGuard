import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityLogFilters, useActivityLogs } from '@/api/account/activity';
import { useFlashKey } from '@/plugins/useFlash';
import PageContentBlock from '@/components/elements/PageContentBlock';
import FlashMessageRender from '@/components/FlashMessageRender';
import { Link } from 'react-router-dom';
import PaginationFooter from '@/components/elements/table/PaginationFooter';
import { XCircleIcon, TerminalIcon } from '@heroicons/react/solid';
import Spinner from '@/components/elements/Spinner';
import { styles as btnStyles } from '@/components/elements/button/index';
import classNames from 'classnames';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import useLocationHash from '@/plugins/useLocationHash';
import { format, isToday, isYesterday } from 'date-fns';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import Translate from '@/components/elements/Translate';
import { ActivityLog } from '@definitions/user';
import { getObjectKeys, isObject } from '@/lib/objects';
import ActivityLogMetaButton from '@/components/elements/activity/ActivityLogMetaButton';

const TimelineRow = styled.div`
    ${tw`flex`};
`;

const DateColumn = styled.div`
    ${tw`flex-shrink-0 pt-1 pr-6 text-right hidden sm:block`};
    width: 120px;
    color: var(--color-muted);
    font-size: 0.8rem;
`;

const TimelineColumn = styled.div`
    ${tw`hidden sm:block flex-shrink-0 relative self-stretch`};
    width: 24px;

    &::before {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        left: calc(50% - 5px);
        width: 2px;
        transform: translateX(-50%);
        background-color: var(--color-neutral);
    }
`;

const TimelineDot = styled.div`
    ${tw`w-3 h-3 rounded-full flex-shrink-0 relative`};
    z-index: 1;
    background-color: var(--color-primary);
    box-shadow: 0 0 0 4px var(--color-background);
`;

const ContentColumn = styled.div`
    ${tw`flex-1 pb-6 pl-0 sm:pl-4`};
`;

const ActivityItem = styled.div`
    ${tw`p-3 rounded-lg mb-2 last:mb-0`};
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
`;

const ActivityHeader = styled.div`
    ${tw`flex items-center justify-between gap-2`};
`;

const ActivityMeta = styled.div`
    ${tw`flex items-center gap-2 text-xs mt-1`};
    color: var(--color-inverted);
`;

function wrapProperties(value: unknown): any {
    if (value === null || typeof value === 'string' || typeof value === 'number') {
        return `<strong>${String(value)}</strong>`;
    }

    if (isObject(value)) {
        return getObjectKeys(value).reduce((obj, key) => {
            if (key === 'count' || (typeof key === 'string' && key.endsWith('_count'))) {
                return { ...obj, [key]: value[key] };
            }
            return { ...obj, [key]: wrapProperties(value[key]) };
        }, {} as Record<string, unknown>);
    }

    if (Array.isArray(value)) {
        return value.map(wrapProperties);
    }

    return value;
}

interface ActivityItemEntryProps {
    activity: ActivityLog;
}

const isDemo = window.location.hostname === 'luna-ptero.buzz.dev';

const ActivityItemEntry = ({ activity }: ActivityItemEntryProps) => {
    const { t } = useTranslation('account');
    const { pathTo } = useLocationHash();
    const properties = wrapProperties(activity.properties);

    return (
        <ActivityItem>
            <ActivityHeader>
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm" style={{ color: 'var(--color-base)' }}>
                        {t('activity.account')}
                    </span>
                    <Link
                        to={`#${pathTo({ event: activity.event })}`}
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ 
                            backgroundColor: 'var(--color-background)',
                            color: 'var(--color-primary)',
                            border: '1px solid var(--color-neutral)',
                        }}
                    >
                        {activity.event.replace(/[:.]/g, ' ')}
                    </Link>
                    {activity.isApi && (
                        <Tooltip placement="top" content={t('activity.using_api_key')}>
                            <TerminalIcon className="w-4 h-4" style={{ color: 'var(--color-muted)' }} />
                        </Tooltip>
                    )}
                </div>
                {activity.hasAdditionalMetadata && (
                    <ActivityLogMetaButton meta={activity.properties} />
                )}
            </ActivityHeader>
            <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
                <Translate ns="activity" values={properties} i18nKey={activity.event.replace(':', '.')} />
            </p>
            <ActivityMeta>
                <Tooltip placement="top" content={format(activity.timestamp, 'MMM do, yyyy H:mm:ss')}>
                    <span>{format(activity.timestamp, 'h:mm a')}</span>
                </Tooltip>
                {activity.ip && (
                    <>
                        <span>•</span>
                        <span>{isDemo ? '***.***.***.***' : activity.ip}</span>
                    </>
                )}
            </ActivityMeta>
        </ActivityItem>
    );
};

interface DaySectionProps {
    date: string;
    activities: ActivityLog[];
}

const DaySection = ({ date, activities }: DaySectionProps) => {
    const { t } = useTranslation('account');
    
    const formatDayLabel = (d: Date): string => {
        if (isToday(d)) return t('activity.today');
        if (isYesterday(d)) return t('activity.yesterday');
        return format(d, 'MMM d, yyyy');
    };

    return (
        <TimelineRow>
            <DateColumn>
                {formatDayLabel(new Date(date))}
            </DateColumn>
            <TimelineColumn>
                <TimelineDot />
            </TimelineColumn>
            <ContentColumn>
                {activities.map((activity) => (
                    <ActivityItemEntry key={activity.id} activity={activity} />
                ))}
            </ContentColumn>
        </TimelineRow>
    );
};

export default () => {
    const { t } = useTranslation('account');
    const { hash } = useLocationHash();
    const { clearAndAddHttpError } = useFlashKey('account');
    const [filters, setFilters] = useState<ActivityLogFilters>({ page: 1, sorts: { timestamp: -1 } });
    const { data, isValidating, error } = useActivityLogs(filters, {
        revalidateOnMount: true,
        revalidateOnFocus: false,
    });

    useEffect(() => {
        setFilters((value) => ({ ...value, filters: { ip: hash.ip, event: hash.event } }));
    }, [hash]);

    useEffect(() => {
        clearAndAddHttpError(error);
    }, [error]);

    const groupedByDay = useMemo(() => {
        if (!data?.items) return {};
        
        return data.items.reduce((groups, activity) => {
            const day = format(activity.timestamp, 'yyyy-MM-dd');
            if (!groups[day]) {
                groups[day] = [];
            }
            groups[day].push(activity);
            return groups;
        }, {} as Record<string, ActivityLog[]>);
    }, [data?.items]);

    const sortedDays = useMemo(() => {
        return Object.keys(groupedByDay).sort((a, b) => b.localeCompare(a));
    }, [groupedByDay]);

    return (
        <PageContentBlock title={t('activity.title')}>
            <FlashMessageRender byKey={'account'} />
            {(filters.filters?.event || filters.filters?.ip) && (
                <div className={'flex justify-end mb-4'}>
                    <Link
                        to={'#'}
                        className={classNames(btnStyles.button, btnStyles.text, 'w-full sm:w-auto')}
                        onClick={() => setFilters((value) => ({ ...value, filters: {} }))}
                    >
                        {t('activity.clear_filters')} <XCircleIcon className={'w-4 h-4 ml-2'} />
                    </Link>
                </div>
            )}
            {!data && isValidating ? (
                <Spinner centered />
            ) : !data?.items.length ? (
                <div 
                    className="text-center py-12 rounded-lg"
                    style={{ 
                        backgroundColor: 'var(--color-background-secondary)',
                        border: '1px solid var(--color-neutral)',
                        borderRadius: 'var(--border-radius, 8px)',
                    }}
                >
                    <p className="text-sm" style={{ color: 'var(--color-inverted)' }}>
                        {t('activity.no_logs')}
                    </p>
                </div>
            ) : (
                <div>
                    {sortedDays.map((day) => (
                        <DaySection 
                            key={day} 
                            date={day}
                            activities={groupedByDay[day]}
                        />
                    ))}
                </div>
            )}
            {data && (
                <PaginationFooter
                    pagination={data.pagination}
                    onPageSelect={(page) => setFilters((value) => ({ ...value, page }))}
                />
            )}
        </PageContentBlock>
    );
};
