import React from 'react';
import { Schedule } from '@/api/server/schedules/getServerSchedules';
import classNames from 'classnames';

interface Props {
    cron: Schedule['cron'];
    className?: string;
}

const formatValue = (value: string): { display: string; isActive: boolean } => {
    if (value === '*') {
        return { display: '-', isActive: false };
    }
    
    const intervalMatch = value.match(/^\*\/(\d+)$/);
    if (intervalMatch) {
        return { display: intervalMatch[1], isActive: true };
    }
    
    return { display: value, isActive: true };
};

const ScheduleCronRow = ({ cron, className }: Props) => {
    const minute = formatValue(cron.minute);
    const hour = formatValue(cron.hour);
    const dayOfMonth = formatValue(cron.dayOfMonth);
    const month = formatValue(cron.month);
    const dayOfWeek = formatValue(cron.dayOfWeek);

    return (
        <div className={classNames('flex', className)}>
            <div className={'w-1/5 sm:w-auto text-center'}>
                <p 
                    className={'font-medium'} 
                    style={{ color: minute.isActive ? 'var(--color-base)' : 'var(--color-inverted)' }}
                >
                    {minute.display}
                </p>
                <p className={'text-2xs uppercase'} style={{ color: 'var(--color-inverted)' }}>Minute</p>
            </div>
            <div className={'w-1/5 sm:w-auto text-center ml-4'}>
                <p 
                    className={'font-medium'} 
                    style={{ color: hour.isActive ? 'var(--color-base)' : 'var(--color-inverted)' }}
                >
                    {hour.display}
                </p>
                <p className={'text-2xs uppercase'} style={{ color: 'var(--color-inverted)' }}>Hour</p>
            </div>
            <div className={'w-1/5 sm:w-auto text-center ml-4'}>
                <p 
                    className={'font-medium'} 
                    style={{ color: dayOfMonth.isActive ? 'var(--color-base)' : 'var(--color-inverted)' }}
                >
                    {dayOfMonth.display}
                </p>
                <p className={'text-2xs uppercase'} style={{ color: 'var(--color-inverted)' }}>Day (Month)</p>
            </div>
            <div className={'w-1/5 sm:w-auto text-center ml-4'}>
                <p 
                    className={'font-medium'} 
                    style={{ color: month.isActive ? 'var(--color-base)' : 'var(--color-inverted)' }}
                >
                    {month.display}
                </p>
                <p className={'text-2xs uppercase'} style={{ color: 'var(--color-inverted)' }}>Month</p>
            </div>
            <div className={'w-1/5 sm:w-auto text-center ml-4'}>
                <p 
                    className={'font-medium'} 
                    style={{ color: dayOfWeek.isActive ? 'var(--color-base)' : 'var(--color-inverted)' }}
                >
                    {dayOfWeek.display}
                </p>
                <p className={'text-2xs uppercase'} style={{ color: 'var(--color-inverted)' }}>Day (Week)</p>
            </div>
        </div>
    );
};

export default ScheduleCronRow;
