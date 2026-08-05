import React, { useEffect, useState, useMemo } from 'react';
import { useActivityLogs, ActivityLogFilters } from '@/api/server/activity';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import { useFlashKey } from '@/plugins/useFlash';
import FlashMessageRender from '@/components/FlashMessageRender';
import Spinner from '@/components/elements/Spinner';
import PaginationFooter from '@/components/elements/table/PaginationFooter';
import { Link } from 'react-router-dom';
import { TerminalIcon, FolderOpenIcon, SearchIcon } from '@heroicons/react/solid';
import useLocationHash from '@/plugins/useLocationHash';
import { format, isToday, isYesterday } from 'date-fns';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import Translate from '@/components/elements/Translate';
import { ActivityLog } from '@definitions/user';
import { getObjectKeys, isObject } from '@/lib/objects';
import ActivityLogMetaButton from '@/components/elements/activity/ActivityLogMetaButton';
import { PrivacyBlurSurface } from '@/components/elements/PrivacyServerHostBlur';
import { useTranslation } from 'react-i18next';

const TimelineRow = styled.div`
    ${tw`flex items-stretch`};
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


const SearchInput = styled.input`
    width: 100%;
    padding: 0.5rem 1rem 0.5rem 2.25rem;
    font-size: 0.875rem;
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    color: var(--color-base);
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &::placeholder {
        color: var(--color-muted);
    }

    &:focus {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 20%, transparent);
    }
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

const formatDayLabel = (date: Date, t: (key: string, fallback: string) => string): string => {
    if (isToday(date)) return t('activity.today', 'Today');
    if (isYesterday(date)) return t('activity.yesterday', 'Yesterday');
    return format(date, 'MMM d, yyyy');
};

interface ActivityItemEntryProps {
    activity: ActivityLog;
}

const isDemo = window.location.hostname === 'luna-ptero.buzz.dev';

const ActivityItemEntry = ({ activity }: ActivityItemEntryProps) => {
    const { t } = useTranslation('account');
    const { pathTo } = useLocationHash();
    const actor = activity.relationships.actor;
    const properties = wrapProperties(activity.properties);

    return (
        <ActivityItem>
            <ActivityHeader>
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm" style={{ color: 'var(--color-base)' }}>
                        {actor?.username || t('system', 'System')}
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
                        {activity.event.split(':').pop()?.replace(/\./g, ' ')}
                    </Link>
                    {activity.isApi && (
                        <Tooltip placement="top" content={t('activity.using_api_key', 'Using API Key')}>
                            <TerminalIcon className="w-4 h-4" style={{ color: 'var(--color-muted)' }} />
                        </Tooltip>
                    )}
                    {activity.event.startsWith('server:sftp.') && (
                        <Tooltip placement="top" content={t('activity.using_sftp', 'Using SFTP')}>
                            <FolderOpenIcon className="w-4 h-4" style={{ color: 'var(--color-muted)' }} />
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
                        <PrivacyBlurSurface>{isDemo ? '***.***.***.***' : activity.ip}</PrivacyBlurSurface>
                    </>
                )}
            </ActivityMeta>
        </ActivityItem>
    );
};

interface DaySectionProps {
    date: string;
    activities: ActivityLog[];
    isContinuation: boolean;
}

const DaySection = ({ date, activities, isContinuation }: DaySectionProps) => {
    const { t } = useTranslation('account');

    return (
        <TimelineRow>
            <DateColumn>
                {!isContinuation && formatDayLabel(new Date(date), t)}
            </DateColumn>
            <TimelineColumn>
                {!isContinuation && <TimelineDot />}
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
    const { t } = useTranslation('server');
    const { hash } = useLocationHash();
    const { clearAndAddHttpError } = useFlashKey('server:activity');
    const [filters, setFilters] = useState<ActivityLogFilters>({ page: 1, sorts: { timestamp: -1 } });
    const [previousPageLastDay, setPreviousPageLastDay] = useState<string | null>(null);
    const [usernameSearch, setUsernameSearch] = useState('');
    const [debouncedUsername, setDebouncedUsername] = useState('');

    const { data, isValidating, error } = useActivityLogs(filters, {
        revalidateOnMount: true,
        revalidateOnFocus: false,
    });

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedUsername(usernameSearch);
        }, 400);
        return () => clearTimeout(timer);
    }, [usernameSearch]);

    useEffect(() => {
        setFilters((value) => ({ 
            ...value, 
            page: 1,
            filters: { 
                ...value.filters, 
                username: debouncedUsername || undefined 
            } 
        }));
    }, [debouncedUsername]);

    useEffect(() => {
        setFilters((value) => ({ ...value, filters: { ...value.filters, ip: hash.ip, event: hash.event } }));
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

    const handlePageSelect = (page: number) => {
        if (sortedDays.length > 0) {
            setPreviousPageLastDay(sortedDays[sortedDays.length - 1]);
        }
        setFilters((value) => ({ ...value, page }));
    };

    useEffect(() => {
        if (filters.page === 1) {
            setPreviousPageLastDay(null);
        }
    }, [filters.page]);

    return (
        <ServerContentBlock title={t('activity.title', 'Activity Log')}>
            <FlashMessageRender byKey={'server:activity'} />
            <div className="mb-6 sm:flex sm:justify-end">
                <div className="relative w-full sm:max-w-xs">
                    <SearchIcon 
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                        style={{ color: 'var(--color-muted)' }}
                    />
                    <SearchInput
                        type="text"
                        placeholder={t('activity.filter_username', 'Filter by username...')}
                        value={usernameSearch}
                        onChange={(e) => setUsernameSearch(e.target.value)}
                    />
                </div>
            </div>
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
                        {t('activity.no_logs', 'No activity logs available for this server.')}
                    </p>
                </div>
            ) : (
                <div>
                    {sortedDays.map((day, index) => {
                        const isFirstOnPage = index === 0;
                        const hasPreviousPages = data.pagination.currentPage > 1;
                        const isContinuation = isFirstOnPage && hasPreviousPages && previousPageLastDay === day;
                        
                        return (
                            <DaySection 
                                key={day} 
                                date={day}
                                activities={groupedByDay[day]}
                                isContinuation={isContinuation}
                            />
                        );
                    })}
                </div>
            )}
            {data && (
                <div css={tw`mt-6 pt-4`} style={{ borderTop: '1px solid var(--color-neutral)' }}>
                    <PaginationFooter
                        pagination={data.pagination}
                        onPageSelect={handlePageSelect}
                    />
                </div>
            )}
        </ServerContentBlock>
    );
};
