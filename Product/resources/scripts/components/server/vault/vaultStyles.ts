import styled, { css, keyframes } from 'styled-components/macro';
import tw from 'twin.macro';
import { stateColors } from '@/components/elements/ui/tokens';

/*
 * Building blocks shared by the Vault page. Surfaces and text use the theme
 * variables; only semantic states come from the tokens.
 */

export type Tone = 'info' | 'success' | 'warning' | 'danger';

export const toneColor = (tone: Tone): string =>
    tone === 'info' ? 'var(--color-primary)' : tone === 'success' ? stateColors.success : stateColors[tone];

export const Stack = styled.div`
    ${tw`flex flex-col gap-4`};
`;

/** 4 columns on desktop, 2×2 on tablets, 1 column on phones; grid rows keep tiles the same height. */
export const StatsGrid = styled.div`
    ${tw`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4`};
    align-items: stretch;
`;

export const Notice = styled.div<{ $tone: Tone }>`
    ${tw`flex items-start gap-3 px-4 py-3 text-sm`};
    color: var(--color-base);
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-left: 4px solid ${({ $tone }) => toneColor($tone)};
    border-radius: var(--border-radius, 8px);

    > svg {
        ${tw`flex-shrink-0 mt-0.5`};
        color: ${({ $tone }) => toneColor($tone)};
    }
`;

export const NoticeBody = styled.div`
    ${tw`flex-1 min-w-0`};

    strong {
        ${tw`font-semibold`};
    }
`;

export const Muted = styled.span`
    color: var(--color-muted);
`;

export const Mono = styled.span`
    ${tw`font-mono break-all`};
`;

export const Chip = styled.span<{ $tone?: Tone | 'neutral' }>`
    ${tw`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium whitespace-nowrap`};
    border-radius: 9999px;
    color: ${({ $tone }) => (!$tone || $tone === 'neutral' ? 'var(--color-muted)' : toneColor($tone))};
    background-color: var(--color-background);
    border: 1px solid
        ${({ $tone }) => (!$tone || $tone === 'neutral' ? 'var(--color-neutral)' : toneColor($tone))};

    svg {
        font-size: 0.65rem;
    }
`;

/** Button label that collapses to the icon on narrow screens. */
export const ButtonLabel = styled.span`
    ${tw`hidden sm:inline ml-2`};
`;

export const Toolbar = styled.div`
    ${tw`flex flex-wrap items-center justify-between gap-2 px-4 py-3`};
    background-color: var(--color-background);
    border-bottom: 1px solid var(--color-neutral);
`;

export const ToolbarGroup = styled.div`
    ${tw`flex flex-wrap items-center gap-2 min-w-0`};
`;

export const PlainButton = styled.button`
    ${tw`inline-flex items-center gap-2 px-2 py-1 text-sm transition-colors duration-150`};
    color: var(--color-muted);
    background: transparent;
    border-radius: var(--border-radius, 8px);

    &:hover:not(:disabled) {
        color: var(--color-base);
        background-color: var(--color-background-secondary);
    }

    &:disabled {
        ${tw`cursor-not-allowed opacity-50`};
    }
`;

const rowColumns = css`
    display: grid;
    grid-template-columns: 2.5rem minmax(0, 1fr) 2.5rem;
    align-items: center;

    @media (min-width: 640px) {
        grid-template-columns: 2.5rem minmax(0, 1fr) 7rem 2.5rem;
    }

    @media (min-width: 768px) {
        grid-template-columns: 2.5rem minmax(0, 1fr) 7rem 11rem 2.5rem;
    }
`;

export const TableHeader = styled.div`
    ${rowColumns};
    ${tw`py-2 text-xs font-medium uppercase tracking-wide`};
    color: var(--color-muted);
    background-color: var(--color-background);
    border-bottom: 1px solid var(--color-neutral);
`;

export const TableRow = styled.div<{ $selected?: boolean }>`
    ${rowColumns};
    ${tw`py-2 text-sm transition-colors duration-150`};
    color: var(--color-base);
    background-color: ${({ $selected }) =>
        $selected ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent'};

    &:not(:last-child) {
        border-bottom: 1px solid var(--color-neutral);
    }

    &:hover {
        background-color: var(--color-background);
    }
`;

export const Cell = styled.div`
    ${tw`flex items-center min-w-0`};
`;

export const CenterCell = styled(Cell)`
    ${tw`justify-center`};
`;

/** Size column: visible from `sm`. */
export const SizeCell = styled(Cell)`
    ${tw`hidden sm:flex justify-end pr-4 text-xs`};
    color: var(--color-muted);
`;

/** Date column: visible from `md`. */
export const DateCell = styled(Cell)`
    ${tw`hidden md:flex justify-end pr-4 text-xs`};
    color: var(--color-muted);
`;

export const NameButton = styled.button`
    ${tw`flex items-center gap-3 min-w-0 text-left`};
    color: inherit;

    &:hover > span {
        color: var(--color-primary);
    }

    &:disabled {
        cursor: default;
    }

    &:disabled:hover > span {
        color: inherit;
    }
`;

export const EntryIcon = styled.span<{ $folder?: boolean }>`
    ${tw`flex-shrink-0 w-5 text-center`};
    color: ${({ $folder }) => ($folder ? 'var(--color-primary)' : 'var(--color-muted)')};
`;

export const EntryName = styled.span`
    ${tw`truncate transition-colors duration-150`};
`;

export const KebabButton = styled.button`
    ${tw`flex items-center justify-center w-8 h-8 transition-colors duration-150`};
    color: var(--color-muted);
    border-radius: var(--border-radius, 8px);

    &:hover {
        color: var(--color-base);
        background-color: var(--color-background-secondary);
    }
`;

export const MenuItem = styled.button<{ $danger?: boolean }>`
    ${tw`w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors duration-100`};
    color: ${({ $danger }) => ($danger ? stateColors.danger : 'var(--color-muted)')};
    border-radius: 6px;

    svg {
        ${tw`w-4`};
        font-size: 0.75rem;
    }

    &:hover:not(:disabled) {
        color: ${({ $danger }) => ($danger ? stateColors.danger : 'var(--color-base)')};
        background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
    }

    &:disabled {
        ${tw`cursor-not-allowed opacity-50`};
    }
`;

export const Footer = styled.div`
    ${tw`flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs`};
    color: var(--color-muted);
    border-top: 1px solid var(--color-neutral);
`;

export const FormLabel = styled.label`
    ${tw`block text-xs font-medium uppercase tracking-wide mb-1.5`};
    color: var(--color-muted);
`;

export const HelpText = styled.p`
    ${tw`text-xs mt-1.5`};
    color: var(--color-muted);
`;

export const ErrorText = styled.p`
    ${tw`text-xs mt-1.5`};
    color: ${stateColors.danger};
`;

export const CheckRow = styled.label<{ $disabled?: boolean }>`
    ${tw`flex items-start gap-3 p-3`};
    cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
    background-color: var(--color-background);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);

    input {
        ${tw`mt-0.5`};
    }
`;

export const CheckText = styled.span`
    ${tw`flex flex-col gap-0.5 text-sm`};
    color: var(--color-base);

    small {
        ${tw`text-xs`};
        color: var(--color-muted);
    }
`;

const indeterminate = keyframes`
    from { transform: translateX(-100%); }
    to { transform: translateX(250%); }
`;

export const ProgressTrack = styled.div`
    ${tw`relative w-full h-1.5 rounded-full overflow-hidden`};
    background-color: var(--color-neutral);
`;

export const ProgressFill = styled.div<{ $percent: number | null }>`
    ${tw`h-full rounded-full`};
    background-color: var(--color-primary);
    transition: width 300ms ease;
    width: ${({ $percent }) => ($percent === null ? '40%' : `${$percent}%`)};
    ${({ $percent }) =>
        $percent === null &&
        css`
            animation: ${indeterminate} 1.4s ease-in-out infinite;
        `};
`;
