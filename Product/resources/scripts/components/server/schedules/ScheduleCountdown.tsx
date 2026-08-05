import React, { useEffect, useState } from 'react';

interface Props {
    nextRunAt: Date | null;
    className?: string;
}

const formatCountdown = (targetDate: Date): { text: string; isPast: boolean } => {
    const now = new Date();
    let diff = targetDate.getTime() - now.getTime();
    const isPast = diff <= 0;

    if (isPast) {
        diff = Math.abs(diff);
    }

    const seconds = Math.floor(diff / 1000) % 60;
    const minutes = Math.floor(diff / (1000 * 60)) % 60;
    const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    const parts: string[] = [];

    if (days > 0) {
        parts.push(`${days}d`);
    }
    if (hours > 0) {
        parts.push(`${hours}h`);
    }
    if (minutes > 0 || (days === 0 && hours === 0)) {
        parts.push(`${minutes}m`);
    }
    if (days === 0 && hours === 0) {
        parts.push(`${seconds}s`);
    }

    return { text: parts.join(' '), isPast };
};

const ScheduleCountdown: React.FC<Props> = ({ nextRunAt, className }) => {
    const [countdown, setCountdown] = useState<{ text: string; isPast: boolean }>({ text: '', isPast: false });

    useEffect(() => {
        if (!nextRunAt) {
            setCountdown({ text: '', isPast: false });
            return;
        }

        const targetDate = nextRunAt instanceof Date ? nextRunAt : new Date(nextRunAt);

        const update = () => {
            setCountdown(formatCountdown(targetDate));
        };

        update();
        const interval = setInterval(update, 1000);

        return () => clearInterval(interval);
    }, [nextRunAt]);

    if (!nextRunAt) {
        return <span className={className} style={{ color: 'var(--color-inverted)' }}>n/a</span>;
    }

    if (countdown.isPast) {
        return (
            <span className={className} style={{ color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {countdown.text} ago
            </span>
        );
    }

    return (
        <span className={className} style={{ color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {countdown.text}
        </span>
    );
};

export default ScheduleCountdown;
