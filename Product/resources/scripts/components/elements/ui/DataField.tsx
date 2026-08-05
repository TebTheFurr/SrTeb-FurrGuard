import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { faCopy } from '@fortawesome/free-solid-svg-icons';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import CopyOnClick from '@/components/elements/CopyOnClick';

/**
 * A labelled, boxed value — connection addresses, DNS record fields, tokens.
 * Optionally renders a copy affordance on the right.
 */

const Field = styled.div`
    ${tw`flex items-center gap-3 px-3 py-2.5 min-w-0 rounded-[var(--border-radius)]`};
    background-color: var(--color-background);
    border: 1px solid var(--color-neutral);
`;

const LeadIcon = styled.span`
    ${tw`flex-shrink-0`};
    color: var(--color-muted);

    svg {
        font-size: 0.8rem;
    }
`;

const Body = styled.div`
    ${tw`flex-1 min-w-0`};
`;

const Label = styled.span`
    ${tw`block text-xs font-medium uppercase tracking-wide`};
    color: var(--color-muted);
`;

const Value = styled.div<{ $mono?: boolean }>`
    ${tw`text-sm font-medium break-all`};
    ${({ $mono }) => $mono && tw`font-mono`};
    color: var(--color-base);
`;

const CopyButton = styled.button`
    ${tw`flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-[var(--border-radius)] transition-colors duration-150`};
    background-color: transparent;
    border: 1px solid var(--color-neutral);
    color: var(--color-muted);
    cursor: pointer;

    &:hover {
        color: var(--color-base);
        border-color: var(--color-primary);
        background-color: var(--color-background-secondary);
    }

    svg {
        font-size: 0.75rem;
    }
`;

export interface DataFieldProps {
    icon?: IconProp;
    label?: React.ReactNode;
    value: React.ReactNode;
    /** Raw text placed on the clipboard; omit to hide the copy button. */
    copyValue?: string;
    mono?: boolean;
    className?: string;
}

const DataField = ({ icon, label, value, copyValue, mono, className }: DataFieldProps) => (
    <Field className={className}>
        {icon && (
            <LeadIcon>
                <FontAwesomeIcon icon={icon} />
            </LeadIcon>
        )}
        <Body>
            {label && <Label>{label}</Label>}
            <Value $mono={mono}>{value}</Value>
        </Body>
        {copyValue && (
            <CopyOnClick text={copyValue}>
                <CopyButton type={'button'}>
                    <FontAwesomeIcon icon={faCopy} />
                </CopyButton>
            </CopyOnClick>
        )}
    </Field>
);

export default DataField;
