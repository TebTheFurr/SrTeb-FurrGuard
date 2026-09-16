import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import styled, { css } from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faChevronLeft, faChevronRight, faExclamationTriangle, faRedo, faSearch } from '@fortawesome/free-solid-svg-icons';
import { stateColors } from '@/components/elements/ui/tokens';
import { Panel, PanelHeader } from '@/components/elements/ui/Panel';
import { Button } from '@/components/elements/button/index';
import Input from '@/components/elements/Input';
import Select from '@/components/elements/Select';
import { Notice, NoticeBody } from '@/components/server/vault/vaultStyles';
import { useFurrGuard } from '@/components/furrguard/FurrGuardContext';
import { Filters, PER_PAGE_OPTIONS, PagedList } from '@/components/furrguard/hooks';
import { displayCount, formatNumber, initials } from '@/components/furrguard/lib/format';
import { splitIps } from '@/components/furrguard/lib/ips';
import { Label, Tone } from '@/components/furrguard/lib/labels';
import { parseMc } from '@/components/furrguard/lib/mc';

/*
 * Building blocks of the FurrGuard page. Surfaces and text use the theme variables (so the
 * page follows the palette and light/dark mode like the rest of the panel); only the
 * semantic states come from the tokens.
 */

export const toneColor = (tone: Tone | undefined): string => {
    switch (tone) {
        case 'ok':
            return stateColors.success;
        case 'warn':
        case 'gold':
            return stateColors.warning;
        case 'down':
            return stateColors.danger;
        case 'accent':
            return 'var(--color-primary)';
        default:
            return 'var(--color-muted)';
    }
};

export const Stack = styled.div`
    ${tw`flex flex-col gap-4`};
`;

export const TwoColumns = styled.div`
    ${tw`grid grid-cols-1 gap-4 xl:grid-cols-2`};
    align-items: start;
`;

export const Muted = styled.span`
    color: var(--color-muted);
`;

export const Mono = styled.span`
    ${tw`font-mono text-xs break-all`};
`;

/** Secondary line inside a cell (previous nick, ban author…). */
export const SubText = styled.span`
    ${tw`block text-xs truncate`};
    color: var(--color-muted);
`;

/* ── Chips ──────────────────────────────────────────────────────────────── */

const ChipWrapper = styled.span<{ $tone?: Tone }>`
    ${tw`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium whitespace-nowrap max-w-full`};
    border-radius: 9999px;
    color: ${({ $tone }) => toneColor($tone)};
    background-color: var(--color-background);
    border: 1px solid ${({ $tone }) => (!$tone || $tone === 'neutral' ? 'var(--color-neutral)' : toneColor($tone))};

    svg {
        font-size: 0.65rem;
        flex-shrink: 0;
    }

    > span {
        ${tw`truncate`};
    }
`;

export interface ChipProps {
    tone?: Tone;
    icon?: IconDefinition;
    title?: string;
    children: React.ReactNode;
}

export const Chip = ({ tone, icon, title, children }: ChipProps) => (
    <ChipWrapper $tone={tone} title={title}>
        {icon && <FontAwesomeIcon icon={icon} />}
        <span>{children}</span>
    </ChipWrapper>
);

export const StatusChip = ({ label, icon, tone, title }: Label) => (
    <Chip tone={tone} icon={icon} title={title}>
        {label}
    </Chip>
);

export const Chips = styled.span`
    ${tw`inline-flex flex-wrap items-center gap-1`};
`;

const LiveDot = styled.span`
    ${tw`inline-block w-1.5 h-1.5 rounded-full`};
    background-color: ${stateColors.success};
    box-shadow: 0 0 0 3px color-mix(in srgb, ${stateColors.success} 25%, transparent);
`;

export const OnlineChip = () => (
    <ChipWrapper $tone={'ok'}>
        <LiveDot />
        <span>Online</span>
    </ChipWrapper>
);

/* ── Stats ──────────────────────────────────────────────────────────────── */

export const StatsGrid = styled.div<{ $min?: number }>`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(${({ $min }) => $min ?? 170}px, 1fr));
    ${tw`gap-3`};
`;

const statCard = css<{ $tone?: Tone }>`
    ${tw`flex flex-col gap-2 p-3 h-full rounded-[var(--border-radius)] transition-colors duration-150`};
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    text-decoration: none;

    &[href]:hover {
        border-color: var(--color-primary);
    }
`;

const StatCardBox = styled.div<{ $tone?: Tone }>`
    ${statCard};
`;

const StatCardLink = styled(Link)<{ $tone?: Tone }>`
    ${statCard};
`;

const StatLabel = styled.span`
    ${tw`inline-flex items-center gap-2 text-xs font-medium`};
    color: var(--color-muted);

    svg {
        font-size: 0.7rem;
    }
`;

const StatValue = styled.span<{ $tone?: Tone }>`
    ${tw`text-xl font-semibold leading-none`};
    color: ${({ $tone }) => (!$tone || $tone === 'neutral' ? 'var(--color-base)' : toneColor($tone))};
    font-variant-numeric: tabular-nums;
`;

export interface StatCardProps {
    label: string;
    value: unknown;
    icon: IconDefinition;
    tone?: Tone;
    to?: string;
    hint?: string;
}

/** One counter. Counters may arrive as text; «—» means unknown. */
export const StatCard = ({ label, value, icon, tone, to, hint }: StatCardProps) => {
    const body = (
        <>
            <StatLabel>
                <FontAwesomeIcon icon={icon} />
                {label}
            </StatLabel>
            <StatValue $tone={tone}>{displayCount(value)}</StatValue>
            {hint && <SubText>{hint}</SubText>}
        </>
    );

    return to ? <StatCardLink to={to}>{body}</StatCardLink> : <StatCardBox>{body}</StatCardBox>;
};

/* ── Toolbar: tabs and search ───────────────────────────────────────────── */

export const Toolbar = styled.div`
    ${tw`flex flex-wrap items-center gap-2 px-4 py-3`};
    background-color: var(--color-background);
    border-bottom: 1px solid var(--color-neutral);
`;

export const Spacer = styled.span`
    ${tw`flex-1`};
`;

const TabList = styled.div`
    ${tw`flex flex-wrap items-center gap-1`};
`;

const Tab = styled.button<{ $active: boolean }>`
    ${tw`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-150`};
    border-radius: 9999px;
    color: ${({ $active }) => ($active ? 'var(--color-base)' : 'var(--color-muted)')};
    background-color: ${({ $active }) => ($active ? 'color-mix(in srgb, var(--color-primary) 18%, transparent)' : 'transparent')};
    border: 1px solid ${({ $active }) => ($active ? 'var(--color-primary)' : 'var(--color-neutral)')};

    svg {
        font-size: 0.65rem;
    }

    &:hover {
        color: var(--color-base);
    }
`;

const TabCount = styled.span`
    ${tw`text-xs`};
    opacity: 0.7;
    font-variant-numeric: tabular-nums;
`;

export interface TabOption {
    value: string;
    label: string;
    icon?: IconDefinition;
    count?: number | null;
}

export interface FilterTabsProps {
    value: string;
    onChange: (value: string) => void;
    options: readonly TabOption[];
    label: string;
    className?: string;
}

export const FilterTabs = ({ value, onChange, options, label, className }: FilterTabsProps) => (
    <TabList role={'tablist'} aria-label={label} className={className}>
        {options.map((option) => (
            <Tab
                key={option.value}
                type={'button'}
                role={'tab'}
                aria-selected={value === option.value}
                $active={value === option.value}
                onClick={() => onChange(option.value)}
            >
                {option.icon && <FontAwesomeIcon icon={option.icon} />}
                {option.label}
                {option.count !== undefined && option.count !== null && <TabCount>{formatNumber(option.count)}</TabCount>}
            </Tab>
        ))}
    </TabList>
);

const SearchWrapper = styled.label`
    ${tw`relative flex items-center w-full sm:w-64`};

    svg {
        ${tw`absolute left-3 pointer-events-none`};
        font-size: 0.7rem;
        color: var(--color-muted);
    }

    input {
        ${tw`pl-8 py-1.5`};
    }
`;

export interface SearchBoxProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label: string;
}

export const SearchBox = ({ value, onChange, placeholder, label }: SearchBoxProps) => (
    <SearchWrapper>
        <FontAwesomeIcon icon={faSearch} />
        <Input
            type={'search'}
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
            placeholder={placeholder}
            aria-label={label}
            autoComplete={'off'}
            spellCheck={false}
        />
    </SearchWrapper>
);

export const CompactSelect = styled(Select)`
    ${tw`w-auto py-1.5`};
`;

/* ── Tables ─────────────────────────────────────────────────────────────── */

const TableScroll = styled.div<{ $refreshing?: boolean }>`
    ${tw`w-full overflow-x-auto`};
    scrollbar-width: thin;
    opacity: ${({ $refreshing }) => ($refreshing ? 0.6 : 1)};
    transition: opacity 150ms ease;
`;

export const StyledTable = styled.table`
    ${tw`w-full text-sm`};
    border-collapse: collapse;
    color: var(--color-base);

    th {
        ${tw`px-4 py-2 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap`};
        color: var(--color-muted);
        background-color: var(--color-background);
        border-bottom: 1px solid var(--color-neutral);
    }

    td {
        ${tw`px-4 py-2 align-middle`};
        border-bottom: 1px solid var(--color-neutral);
    }

    tbody tr:last-child td {
        border-bottom: 0;
    }

    tbody tr:hover td {
        background-color: color-mix(in srgb, var(--color-background) 60%, transparent);
    }

    tr.blocked td:first-child {
        box-shadow: inset 2px 0 0 ${stateColors.danger};
    }

    tr.child td {
        background-color: color-mix(in srgb, var(--color-background) 40%, transparent);
    }

    th.right,
    td.right {
        text-align: right;
        font-variant-numeric: tabular-nums;
    }

    th.actions,
    td.actions {
        text-align: right;
        white-space: nowrap;
        width: 1%;
    }

    td.nowrap {
        white-space: nowrap;
    }

    td.text {
        max-width: 320px;
        overflow-wrap: anywhere;
    }
`;

export const Table = ({ children, refreshing }: { children: React.ReactNode; refreshing?: boolean }) => (
    <TableScroll $refreshing={refreshing} aria-busy={refreshing}>
        <StyledTable>{children}</StyledTable>
    </TableScroll>
);

export const RowActions = styled.span`
    ${tw`inline-flex items-center justify-end gap-1`};
`;

/** Link that looks like the row's main text. */
export const RowLink = styled(Link)`
    ${tw`font-medium`};
    color: var(--color-base);

    &:hover {
        color: var(--color-primary);
    }
`;

/** Inline link in the accent colour ("Ir a Ajustes", "Ver jugador"). */
export const PrimaryLink = styled(Link)`
    ${tw`text-sm font-medium whitespace-nowrap`};
    color: var(--color-primary);

    &:hover {
        text-decoration: underline;
    }
`;

export const RowButton = styled.button`
    ${tw`font-medium text-left`};
    color: var(--color-base);

    &:hover {
        color: var(--color-primary);
    }
`;

const GhostButton = styled.button<{ $danger?: boolean }>`
    ${tw`inline-flex items-center justify-center w-8 h-8 transition-colors duration-150`};
    color: var(--color-muted);
    border-radius: var(--border-radius, 8px);

    &:hover:not(:disabled) {
        color: ${({ $danger }) => ($danger ? stateColors.danger : 'var(--color-base)')};
        background-color: var(--color-background);
    }

    &:disabled {
        ${tw`cursor-not-allowed opacity-50`};
    }

    svg {
        font-size: 0.75rem;
    }
`;

export interface IconButtonProps {
    icon: IconDefinition;
    label: string;
    onClick: () => void;
    busy?: boolean;
    danger?: boolean;
    disabled?: boolean;
}

export const IconButton = ({ icon, label, onClick, busy, danger, disabled }: IconButtonProps) => (
    <GhostButton type={'button'} aria-label={label} title={label} onClick={onClick} disabled={busy || disabled} aria-busy={busy} $danger={danger}>
        <FontAwesomeIcon icon={busy ? faRedo : icon} spin={busy} />
    </GhostButton>
);

/* ── Switch ─────────────────────────────────────────────────────────────── */

const Toggle = styled.button<{ $on: boolean }>`
    ${tw`relative inline-block w-9 h-5 rounded-full flex-shrink-0 transition-colors duration-200`};
    background-color: ${({ $on }) => ($on ? 'var(--color-primary)' : 'var(--color-neutral)')};

    &::after {
        ${tw`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200`};
        content: '';
        left: ${({ $on }) => ($on ? 'calc(100% - 1.125rem)' : '0.125rem')};
        background-color: ${({ $on }) => ($on ? 'var(--color-base)' : 'var(--color-muted)')};
    }

    &:disabled {
        ${tw`cursor-not-allowed opacity-50`};
    }

    &:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
    }
`;

export interface ActiveSwitchProps {
    active: boolean;
    busy?: boolean;
    label: string;
    onChange: (active: boolean) => void;
}

export const ActiveSwitch = ({ active, busy, label, onChange }: ActiveSwitchProps) => (
    <Toggle type={'button'} role={'switch'} aria-checked={active} aria-label={label} title={label} disabled={busy} $on={active} onClick={() => onChange(!active)} />
);

/* ── Domain bits ────────────────────────────────────────────────────────── */

const HiddenIp = styled.span`
    ${tw`font-mono text-xs tracking-wider`};
    color: var(--color-muted);
`;

export interface IpTextProps {
    ip: string | null | undefined;
    hiddenByServer?: boolean;
}

/** The only component that paints IPs: it honours the "hide IPs" switch and the IPs the server hides. */
export const IpText = ({ ip, hiddenByServer }: IpTextProps) => {
    const { hideIps } = useFurrGuard();
    if (!ip) return <Muted title={hiddenByServer ? 'Tu rol no puede ver IPs' : undefined}>{hiddenByServer ? 'oculta' : '—'}</Muted>;
    if (hideIps) {
        return (
            <HiddenIp title={'IP oculta: puedes mostrarla desde la cabecera'}>
                <span aria-hidden={'true'}>•••.•••.•••</span>
                <span className={'sr-only'}>IP oculta</span>
            </HiddenIp>
        );
    }

    return <Mono>{ip}</Mono>;
};

/** Free text (log details) with its IPs hidden like the IP columns. */
export const TextWithIps = ({ text }: { text: string | null | undefined }) => {
    const { hideIps } = useFurrGuard();
    const parts = useMemo(() => splitIps(text ?? ''), [text]);
    if (!text) return <Muted>—</Muted>;
    if (!hideIps) return <>{text}</>;

    return (
        <>
            {parts.map((part, index) =>
                part.ip ? (
                    <HiddenIp key={index} title={'IP oculta'}>
                        •••.•••.•••
                    </HiddenIp>
                ) : (
                    <React.Fragment key={index}>{part.text}</React.Fragment>
                )
            )}
        </>
    );
};

const Head = styled.span<{ $size: number }>`
    ${tw`inline-flex items-center justify-center flex-shrink-0 overflow-hidden font-semibold`};
    width: ${({ $size }) => $size}px;
    height: ${({ $size }) => $size}px;
    font-size: ${({ $size }) => Math.max(10, $size * 0.4)}px;
    border-radius: ${({ $size }) => ($size >= 48 ? 10 : 6)}px;
    color: var(--color-muted);
    background-color: var(--color-background);
    border: 1px solid var(--color-neutral);

    img {
        ${tw`w-full h-full object-cover`};
        image-rendering: pixelated;
    }
`;

export interface PlayerHeadProps {
    id: string;
    name?: string;
    size?: number;
}

/** 2D head of the player (mc-heads.net). Falls back to the initial. */
export const PlayerHead = ({ id, name = '', size = 26 }: PlayerHeadProps) => {
    const [failed, setFailed] = useState(false);
    const src = `https://mc-heads.net/avatar/${encodeURIComponent(id)}/64`;

    return (
        <Head $size={size} aria-hidden={'true'}>
            {id && !failed ? <img src={src} alt={''} loading={'lazy'} referrerPolicy={'no-referrer'} onError={() => setFailed(true)} /> : initials(name || id)}
        </Head>
    );
};

export const PlayerCell = styled.span`
    ${tw`inline-flex items-center gap-2.5 min-w-0`};
`;

const CountryCode = styled.span`
    ${tw`inline-flex items-center justify-center h-5 px-1 font-mono text-xs`};
    min-width: 26px;
    border-radius: 4px;
    color: var(--color-base);
    background-color: var(--color-background);
    border: 1px solid var(--color-neutral);
`;

export interface CountryTagProps {
    code: string | null | undefined;
    name?: string | null;
    showName?: boolean;
}

export const CountryTag = ({ code, name, showName }: CountryTagProps) => {
    if (!code && !name) return <Muted>—</Muted>;

    return (
        <span className={'inline-flex items-center gap-2 min-w-0'} title={name ?? undefined}>
            <CountryCode>{code || '??'}</CountryCode>
            {showName && name && <span className={'truncate'}>{name}</span>}
        </span>
    );
};

const McBox = styled.div`
    ${tw`px-3 py-2 text-sm whitespace-pre-wrap break-words`};
    min-height: 2.5rem;
    font-family: 'Minecraft', ui-monospace, monospace;
    color: #f0f0f0;
    background-color: #1c1c1c;
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);

    .b {
        font-weight: 700;
    }

    .i {
        font-style: italic;
    }

    .u {
        text-decoration: underline;
    }

    .s {
        text-decoration: line-through;
    }

    .u.s {
        text-decoration: underline line-through;
    }

    .k {
        opacity: 0.6;
    }
`;

/** Preview of a text with & / § codes as styled spans. Never HTML. */
export const McPreview = ({ text, label }: { text: string; label?: string }) => {
    const segments = useMemo(() => parseMc(text), [text]);

    return (
        <McBox aria-label={label}>
            {segments.map((segment, index) => (
                <span
                    key={index}
                    className={[segment.bold && 'b', segment.italic && 'i', segment.underline && 'u', segment.strike && 's', segment.obfuscated && 'k']
                        .filter(Boolean)
                        .join(' ')}
                    style={segment.color ? { color: segment.color } : undefined}
                >
                    {segment.text}
                </span>
            ))}
        </McBox>
    );
};

/* ── Details ────────────────────────────────────────────────────────────── */

export const DetailList = styled.dl`
    ${tw`grid grid-cols-1 sm:grid-cols-2 gap-3 m-0`};
`;

const DetailBox = styled.div`
    ${tw`px-3 py-2 min-w-0 rounded-[var(--border-radius)]`};
    background-color: var(--color-background);
    border: 1px solid var(--color-neutral);

    dt {
        ${tw`text-xs font-medium uppercase tracking-wide`};
        color: var(--color-muted);
    }

    dd {
        ${tw`text-sm mt-0.5 m-0 break-words`};
        color: var(--color-base);
    }
`;

export const Detail = ({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) => (
    <DetailBox>
        <dt>{label}</dt>
        <dd className={mono ? 'font-mono text-xs' : undefined}>{children}</dd>
    </DetailBox>
);

/* ── States ─────────────────────────────────────────────────────────────── */

const EmptyBox = styled.div<{ $tone?: Tone }>`
    ${tw`flex flex-col items-center justify-center text-center gap-2 px-6 py-10`};
    color: var(--color-muted);

    > svg {
        ${tw`text-2xl mb-1`};
        color: ${({ $tone }) => ($tone === 'down' ? stateColors.danger : 'var(--color-muted)')};
        opacity: 0.7;
    }

    strong {
        ${tw`text-sm font-semibold`};
        color: var(--color-base);
    }

    p {
        ${tw`text-sm max-w-md`};
    }

    > div {
        ${tw`flex flex-wrap justify-center gap-2 mt-2`};
    }
`;

export interface EmptyStateProps {
    icon?: IconDefinition;
    title: string;
    text?: string;
    tone?: Tone;
    children?: React.ReactNode;
}

export const EmptyState = ({ icon, title, text, tone, children }: EmptyStateProps) => (
    <EmptyBox $tone={tone} role={tone === 'down' ? 'alert' : undefined}>
        {icon && <FontAwesomeIcon icon={icon} />}
        <strong>{title}</strong>
        {text && <p>{text}</p>}
        {children && <div>{children}</div>}
    </EmptyBox>
);

const SkeletonRow = styled.span<{ $width: number }>`
    ${tw`block h-3 rounded-full`};
    width: ${({ $width }) => $width}%;
    background-color: var(--color-neutral);
    opacity: 0.6;
`;

const SkeletonList = styled.div`
    ${tw`flex flex-col gap-3 px-5 py-5`};
`;

export const Skeleton = ({ rows = 5 }: { rows?: number }) => (
    <SkeletonList aria-busy={'true'}>
        <span className={'sr-only'}>Cargando…</span>
        {Array.from({ length: rows }, (_, index) => (
            <SkeletonRow key={index} $width={[88, 60, 72][index % 3]} />
        ))}
    </SkeletonList>
);

export interface RetryProps {
    title: string;
    message: string;
    onRetry: () => void;
}

export const RetryNotice = ({ title, message, onRetry }: RetryProps) => (
    <Notice $tone={'danger'}>
        <FontAwesomeIcon icon={faExclamationTriangle} />
        <NoticeBody>
            <strong>{title}</strong>
            <p>{message}</p>
        </NoticeBody>
        <Button size={Button.Sizes.Small} variant={Button.Variants.Secondary} onClick={onRetry}>
            <FontAwesomeIcon icon={faRedo} />
            <span className={'ml-2'}>Reintentar</span>
        </Button>
    </Notice>
);

/* ── List frame: toolbar, states and pagination ─────────────────────────── */

const Footer = styled.div`
    ${tw`flex flex-wrap items-center gap-2 px-4 py-3 text-xs`};
    color: var(--color-muted);
    border-top: 1px solid var(--color-neutral);
    font-variant-numeric: tabular-nums;
`;

const PageButton = styled.button`
    ${tw`inline-flex items-center justify-center w-7 h-7 transition-colors duration-150`};
    color: var(--color-muted);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);

    &:hover:not(:disabled) {
        color: var(--color-base);
        border-color: var(--color-primary);
    }

    &:disabled {
        ${tw`cursor-not-allowed opacity-40`};
    }

    svg {
        font-size: 0.6rem;
    }
`;

const InlineNotice = styled.div`
    ${tw`px-4 pt-3`};
`;

/** What the frame needs from a paged list (rows, state and paging), whatever its filters are. */
export type ListLike<T> = Pick<PagedList<T, Filters>, 'items' | 'pagination' | 'loading' | 'error' | 'perPage' | 'setPage' | 'setPerPage' | 'reload'>;

export interface ListFrameProps<T> {
    list: ListLike<T>;
    label: string;
    emptyIcon?: IconDefinition;
    emptyTitle?: string;
    emptyText?: string;
    toolbar?: React.ReactNode;
    /** Header of the panel; omit for a plain list. */
    header?: React.ReactNode;
    children: React.ReactNode;
}

/** Common frame of the paginated lists: toolbar, loading, error, empty and pagination. */
export function ListFrame<T>({ list, label, emptyIcon, emptyTitle = 'No hay nada que mostrar', emptyText, toolbar, header, children }: ListFrameProps<T>) {
    const { pagination, items, loading, error } = list;
    const page = pagination.page;
    const totalPages = Math.max(1, pagination.total_pages);
    const from = pagination.total ? (page - 1) * pagination.per_page + 1 : 0;
    const to = Math.min(pagination.total, page * pagination.per_page);

    return (
        <Panel aria-label={label}>
            {header}
            {toolbar && <Toolbar>{toolbar}</Toolbar>}
            {error && items.length > 0 && (
                <InlineNotice>
                    <RetryNotice title={'No se pudo actualizar la lista'} message={error.message} onRetry={list.reload} />
                </InlineNotice>
            )}
            {error && items.length === 0 ? (
                <EmptyState icon={faExclamationTriangle} tone={'down'} title={'No se pudo cargar'} text={error.message}>
                    <Button size={Button.Sizes.Small} variant={Button.Variants.Secondary} onClick={list.reload}>
                        <FontAwesomeIcon icon={faRedo} />
                        <span className={'ml-2'}>Reintentar</span>
                    </Button>
                </EmptyState>
            ) : loading && items.length === 0 ? (
                <Skeleton />
            ) : items.length === 0 ? (
                <EmptyState icon={emptyIcon} title={emptyTitle} text={emptyText} />
            ) : (
                <Table refreshing={loading}>{children}</Table>
            )}
            {pagination.total > 0 && (
                <Footer>
                    <span>
                        {formatNumber(from)}–{formatNumber(to)} de {formatNumber(pagination.total)}
                    </span>
                    <Spacer />
                    <label className={'hidden sm:inline-flex items-center gap-2'}>
                        Por página
                        <CompactSelect value={list.perPage} onChange={(event) => list.setPerPage(Number(event.currentTarget.value))}>
                            {PER_PAGE_OPTIONS.map((n) => (
                                <option key={n} value={n}>
                                    {n}
                                </option>
                            ))}
                        </CompactSelect>
                    </label>
                    <PageButton type={'button'} disabled={page <= 1} aria-label={'Página anterior'} onClick={() => list.setPage(page - 1)}>
                        <FontAwesomeIcon icon={faChevronLeft} />
                    </PageButton>
                    <span aria-live={'polite'}>
                        Página {page} de {totalPages}
                    </span>
                    <PageButton type={'button'} disabled={page >= totalPages} aria-label={'Página siguiente'} onClick={() => list.setPage(page + 1)}>
                        <FontAwesomeIcon icon={faChevronRight} />
                    </PageButton>
                </Footer>
            )}
        </Panel>
    );
}

/* ── Section panels ─────────────────────────────────────────────────────── */

export interface SectionPanelProps {
    icon?: IconDefinition;
    title: React.ReactNode;
    hint?: React.ReactNode;
    actions?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}

/** A Panel with a header, for the blocks of a page. */
export const SectionPanel = ({ icon, title, hint, actions, children, className }: SectionPanelProps) => (
    <Panel className={className}>
        <PanelHeader icon={icon} title={title} hint={hint} actions={actions} />
        {children}
    </Panel>
);

export const PanelText = styled.p`
    ${tw`px-4 py-3 text-sm`};
    color: var(--color-muted);
`;

/** Rows of a panel list (entries of a player card, recent events…). */
export const Rows = styled.ul`
    ${tw`flex flex-col m-0 p-0`};
    list-style: none;

    > li {
        ${tw`flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm`};
        color: var(--color-base);
    }

    > li + li {
        border-top: 1px solid var(--color-neutral);
    }

    > li.blocked {
        box-shadow: inset 2px 0 0 ${stateColors.danger};
    }
`;

export const RowMain = styled.span`
    ${tw`flex-1 min-w-0 flex flex-col leading-tight`};
`;

export const TimeText = styled.time`
    ${tw`text-xs whitespace-nowrap`};
    color: var(--color-muted);
`;

/** Sticky bar with unsaved changes (messages, settings). */
export const SaveBar = styled.div`
    ${tw`sticky bottom-4 z-10 flex flex-wrap items-center gap-3 px-4 py-3 text-sm shadow-lg`};
    color: var(--color-base);
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-primary);
    border-radius: var(--border-radius, 12px);

    > span {
        ${tw`flex-1`};
    }
`;
