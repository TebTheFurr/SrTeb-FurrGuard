import React from 'react';
import { Schedule } from '@/api/server/schedules/getServerSchedules';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import tw from 'twin.macro';
import ScheduleCronRow from '@/components/server/schedules/ScheduleCronRow';
import ScheduleCountdown from '@/components/server/schedules/ScheduleCountdown';

export default ({ schedule }: { schedule: Schedule }) => (
    <>
        <div css={tw`hidden md:block`} style={{ color: 'var(--color-muted)' }}>
            <FontAwesomeIcon icon={faCalendarAlt} fixedWidth />
        </div>
        <div css={tw`flex-1 md:ml-4`}>
            <p style={{ color: 'var(--color-base)' }}>{schedule.name}</p>
            <p css={tw`text-xs`} style={{ color: 'var(--color-inverted)' }}>
                Last run: {schedule.lastRunAt ? format(schedule.lastRunAt, "MMM do 'at' h:mma") : 'never'}
                {schedule.isActive && schedule.nextRunAt && (
                    <>
                        <span css={tw`mx-2`}>·</span>
                        Next in <ScheduleCountdown nextRunAt={schedule.nextRunAt} />
                    </>
                )}
            </p>
        </div>
        <div>
            <p
                css={tw`py-1 px-3 text-xs uppercase sm:hidden`}
                style={{
                    backgroundColor: schedule.isActive ? 'var(--color-primary)' : 'var(--color-neutral)',
                    color: 'var(--color-base)',
                    borderRadius: 'calc(var(--border-radius, 12px) * 0.5)',
                }}
            >
                {schedule.isActive ? 'Active' : 'Inactive'}
            </p>
        </div>
        <ScheduleCronRow cron={schedule.cron} css={tw`mx-auto sm:mx-8 w-full sm:w-auto mt-4 sm:mt-0`} />
        <div>
            <p
                css={tw`py-1 px-3 text-xs uppercase hidden sm:block`}
                style={{
                    backgroundColor: schedule.isActive && !schedule.isProcessing ? 'var(--color-primary)' : 'var(--color-neutral)',
                    color: 'var(--color-base)',
                    borderRadius: 'calc(var(--border-radius, 12px) * 0.5)',
                }}
            >
                {schedule.isProcessing ? 'Processing' : schedule.isActive ? 'Active' : 'Inactive'}
            </p>
        </div>
    </>
);
