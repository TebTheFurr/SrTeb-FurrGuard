import React from 'react';
import Icon from '@/components/elements/Icon';
import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import classNames from 'classnames';
import styles from './style.module.css';
import CopyOnClick from '@/components/elements/CopyOnClick';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';

interface StatBlockProps {
    title: string;
    copyOnClick?: string;
    color?: string | undefined;
    icon: IconDefinition;
    children: React.ReactNode;
    className?: string;
}

const DefaultStatBlock = ({ title, copyOnClick, icon, color, className, children }: StatBlockProps) => {
    return (
        <CopyOnClick text={copyOnClick}>
            <div className={classNames(styles.stat_block, className)}>
                <div className={classNames(styles.status_bar, color)} style={!color ? { backgroundColor: 'transparent' } : {}} />
                <div className={classNames(styles.icon, color)} style={!color ? { backgroundColor: 'var(--color-neutral)' } : {}}>
                    <Icon
                        icon={icon}
                        style={{ color: color ? 'var(--color-base)' : 'var(--color-muted)' }}
                    />
                </div>
                <div className={'flex flex-col justify-center overflow-hidden w-full'}>
                    <p
                        className={'font-header font-medium leading-tight text-xs md:text-sm pl-3'}
                        style={{ color: 'var(--color-muted)' }}
                    >
                        {title}
                    </p>
                    <div
                        className={'w-full font-semibold truncate h-[1.5rem] pl-3 text-[12px] md:text-[14px]'}
                        style={{ color: 'var(--color-base)' }}
                    >
                        {children}
                    </div>
                </div>
            </div>
        </CopyOnClick>
    );
};

const CenteredStatBlock = ({ title, copyOnClick, icon, color, className, children }: StatBlockProps) => {
    return (
        <CopyOnClick text={copyOnClick}>
            <div 
                className={classNames(className)}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    padding: '1rem',
                    backgroundColor: 'var(--color-background-secondary)',
                    border: '1px solid var(--color-neutral)',
                    borderRadius: 'var(--border-radius, 12px)',
                    textAlign: 'center',
                    gap: '0.5rem',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {color && (
                    <div 
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: '4px',
                            borderTopLeftRadius: 'var(--border-radius, 12px)',
                            borderBottomLeftRadius: 'var(--border-radius, 12px)',
                        }}
                        className={color}
                    />
                )}
                <div 
                    style={{
                        width: '2.5rem',
                        height: '2.5rem',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: color ? undefined : 'var(--color-neutral)',
                        opacity: color ? 0.9 : 1,
                    }}
                    className={color}
                >
                    <Icon
                        icon={icon}
                        style={{ 
                            color: color ? 'var(--color-base)' : 'var(--color-muted)',
                            width: '1rem',
                            height: '1rem',
                        }}
                    />
                </div>
                <div
                    className={'w-full font-semibold overflow-hidden text-[12px] md:text-[14px]'}
                    style={{ color: 'var(--color-base)' }}
                >
                    {children}
                </div>
                <p
                    className={'text-[12px] md:text-[14px] font-medium'}
                    style={{ color: 'var(--color-muted)' }}
                >
                    {title}
                </p>
            </div>
        </CopyOnClick>
    );
};

const MinimalStatBlock = ({ title, copyOnClick, icon, color, className, children }: StatBlockProps) => {
    return (
        <CopyOnClick text={copyOnClick}>
            <div 
                className={classNames(className)}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '1rem',
                    backgroundColor: 'var(--color-background-secondary)',
                    border: '1px solid var(--color-neutral)',
                    borderRadius: 'var(--border-radius, 12px)',
                    gap: '0.5rem',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {color && (
                    <div 
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: '4px',
                            borderTopLeftRadius: 'var(--border-radius, 12px)',
                            borderBottomLeftRadius: 'var(--border-radius, 12px)',
                        }}
                        className={color}
                    />
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p
                        className={'text-[12px] md:text-[14px] font-medium'}
                        style={{ color: 'var(--color-muted)' }}
                    >
                        {title}
                    </p>
                    <div 
                        style={{
                            width: '1.5rem',
                            height: '1.5rem',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: color ? undefined : 'var(--color-neutral)',
                            opacity: color ? 0.6 : 0.8,
                        }}
                        className={color}
                    >
                        <Icon
                            icon={icon}
                            style={{ 
                                color: color ? 'var(--color-base)' : 'var(--color-muted)',
                                width: '0.75rem',
                                height: '0.75rem',
                            }}
                        />
                    </div>
                </div>
                <div
                    className={'w-full font-semibold overflow-hidden text-[12px] md:text-[14px]'}
                    style={{ color: 'var(--color-base)' }}
                >
                    {children}
                </div>
            </div>
        </CopyOnClick>
    );
};

const ReversedStatBlock = ({ title, copyOnClick, icon, color, className, children }: StatBlockProps) => {
    return (
        <CopyOnClick text={copyOnClick}>
            <div className={classNames(styles.stat_block, styles.stat_block_reversed, className)}>
                <div className={classNames(styles.status_bar, color)} style={!color ? { backgroundColor: 'transparent' } : {}} />
                <div className={'flex flex-col justify-center overflow-hidden w-full'}>
                    <p
                        className={'font-header font-medium leading-tight text-xs md:text-sm'}
                        style={{ color: 'var(--color-muted)' }}
                    >
                        {title}
                    </p>
                    <div
                        className={'w-full font-semibold truncate h-[1.5rem] text-[12px] md:text-[14px]'}
                        style={{ color: 'var(--color-base)' }}
                    >
                        {children}
                    </div>
                </div>
                <div className={classNames(styles.icon, color)} style={!color ? { backgroundColor: 'var(--color-neutral)' } : {}}>
                    <Icon
                        icon={icon}
                        style={{ color: color ? 'var(--color-base)' : 'var(--color-muted)' }}
                    />
                </div>
            </div>
        </CopyOnClick>
    );
};

const CompactStatBlock = ({ title, copyOnClick, icon, color, className, children }: StatBlockProps) => {
    return (
        <CopyOnClick text={copyOnClick}>
            <div
                className={classNames(className)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.625rem 0.875rem',
                    backgroundColor: 'var(--color-background-secondary)',
                    border: '1px solid var(--color-neutral)',
                    borderRadius: 'var(--border-radius, 12px)',
                    gap: '0.75rem',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: '3px',
                    }}
                    className={color || ''}
                />
                <div
                    style={{
                        width: '1.75rem',
                        height: '1.75rem',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: color ? undefined : 'var(--color-neutral)',
                        opacity: color ? 0.15 : 0.8,
                        flexShrink: 0,
                    }}
                    className={color}
                >
                    <Icon
                        icon={icon}
                        style={{
                            color: color ? 'var(--color-base)' : 'var(--color-muted)',
                            width: '0.875rem',
                            height: '0.875rem',
                            opacity: color ? 6 : 1,
                        }}
                    />
                </div>
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '0.5rem',
                        minWidth: 0,
                    }}
                >
                    <span
                        className={'flex-1 min-w-0 overflow-hidden font-semibold text-[12px] md:text-[14px]'}
                        style={{ color: 'var(--color-base)' }}
                    >
                        {children}
                    </span>
                    <span
                        className={'text-[10px] md:text-[11px] font-medium uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis'}
                        style={{ color: 'var(--color-muted)' }}
                    >
                        {title}
                    </span>
                </div>
            </div>
        </CopyOnClick>
    );
};

const SplitStatBlock = ({ title, copyOnClick, icon, color, className, children }: StatBlockProps) => {
    return (
        <CopyOnClick text={copyOnClick}>
            <div
                className={classNames(className)}
                style={{
                    display: 'flex',
                    backgroundColor: 'var(--color-background-secondary)',
                    border: '1px solid var(--color-neutral)',
                    borderRadius: 'var(--border-radius, 12px)',
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        width: '3.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: color ? undefined : 'var(--color-neutral)',
                        flexShrink: 0,
                    }}
                    className={color}
                >
                    <Icon
                        icon={icon}
                        style={{
                            color: 'var(--color-base)',
                            width: '1.125rem',
                            height: '1.125rem',
                        }}
                    />
                </div>
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        padding: '0.75rem 1rem',
                        gap: '0.125rem',
                        minWidth: 0,
                    }}
                >
                    <span
                        className={'w-full overflow-hidden font-bold leading-tight text-[12px] md:text-[14px]'}
                        style={{ color: 'var(--color-base)' }}
                    >
                        {children}
                    </span>
                    <span
                        className={'text-[10px] md:text-[11px] font-medium uppercase tracking-wide'}
                        style={{ color: 'var(--color-muted)' }}
                    >
                        {title}
                    </span>
                </div>
            </div>
        </CopyOnClick>
    );
};

export default (props: StatBlockProps) => {
    const statCardVariant = useStoreState((state: ApplicationStore) => state.settings.data?.components?.statCard ?? 'default');

    switch (statCardVariant) {
        case 'centered':
            return <CenteredStatBlock {...props} />;
        case 'minimal':
            return <MinimalStatBlock {...props} />;
        case 'gradient':
            return <ReversedStatBlock {...props} />;
        case 'compact':
            return <CompactStatBlock {...props} />;
        case 'split':
            return <SplitStatBlock {...props} />;
        default:
            return <DefaultStatBlock {...props} />;
    }
};
