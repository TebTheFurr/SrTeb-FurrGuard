import React from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCalendarAlt,
    faCreditCard,
    faEnvelope,
    faExternalLinkAlt,
} from '@fortawesome/free-solid-svg-icons';
import { BillingInfo } from '@/api/server/getBilling';
import asModal from '@/hoc/asModal';

const Overlay = styled.div``;

const PlanHeader = styled.div`
    ${tw`mb-5 pb-4`};
    border-bottom: 1px solid var(--color-neutral);
`;

const PlanName = styled.div`
    ${tw`text-lg font-semibold truncate`};
    color: var(--color-base);
`;

const PlanMeta = styled.div`
    ${tw`text-sm mt-1 flex items-center gap-2 min-w-0`};
    color: var(--color-muted);
`;

const PlanMetaText = styled.span`
    ${tw`truncate`};
`;

const DetailsGrid = styled.div`
    ${tw`grid grid-cols-1 gap-3`};
`;

const DetailRow = styled.div`
    ${tw`flex items-center justify-between gap-4 py-3`};
    border-bottom: 1px solid color-mix(in srgb, var(--color-neutral) 55%, transparent);

    &:last-child {
        border-bottom: none;
    }
`;

const DetailLabel = styled.div`
    ${tw`flex items-center gap-2 text-sm`};
    color: var(--color-muted);
`;

const DetailValue = styled.div`
    ${tw`text-sm font-medium text-right break-words`};
    color: var(--color-base);
`;

const Footer = styled.div`
    ${tw`flex items-center justify-between gap-3 mt-6 pt-4`};
    border-top: 1px solid var(--color-neutral);
`;

const FooterText = styled.div`
    ${tw`text-xs`};
    color: var(--color-muted);
`;

const ExternalLink = styled.a`
    ${tw`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold no-underline transition-colors duration-150`};
    color: #fff;
    background: var(--color-primary);
    border: 1px solid var(--color-primary);

    &:hover {
        color: #fff;
        background: color-mix(in srgb, var(--color-primary) 82%, #000);
    }
`;

const StatusIndicator = styled.span<{ $status?: string | null }>`
    ${tw`inline-flex items-center gap-2 text-sm font-medium capitalize`};
    color: ${({ $status }) => getStatusColour($status)};
`;

const StatusDot = styled.span<{ $status?: string | null }>`
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    background-color: ${({ $status }) => getStatusColour($status)};
`;

const getStatusColour = (status?: string | null) => {
    const normalised = (status || '').toLowerCase();
    if (['active', 'running', 'paid'].includes(normalised)) return '#22c55e';
    if (['pending', 'unpaid', 'overdue'].includes(normalised)) return '#eab308';
    if (['suspended', 'cancelled', 'canceled', 'terminated', 'fraud'].includes(normalised)) return '#ef4444';
    return 'var(--color-muted)';
};

const formatValue = (value?: string | null, fallback = 'Not available') => {
    const clean = (value || '').trim();
    return clean.length > 0 ? clean : fallback;
};

const formatDate = (value?: string | null) => {
    const clean = (value || '').trim();
    if (!clean) return 'Not available';

    const parsed = new Date(clean);
    if (Number.isNaN(parsed.getTime())) return clean;

    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(parsed);
};

interface Props {
    billing: BillingInfo | null;
}

const BillingDetailsModal = ({ billing }: Props) => {
    if (!billing) {
        return null;
    }

    return (
        <Overlay>
            <PlanHeader>
                <PlanName>{formatValue(billing.productName, 'Billing service')}</PlanName>
                <PlanMeta>
                    <PlanMetaText>
                        {formatValue(billing.planName, 'Plan details unavailable')}
                    </PlanMetaText>
                    <span aria-hidden="true">·</span>
                    <StatusIndicator $status={billing.status}>
                        <StatusDot $status={billing.status} />
                        {formatValue(billing.status, 'Unknown')}
                    </StatusIndicator>
                </PlanMeta>
            </PlanHeader>

            <DetailsGrid>
                <DetailRow>
                    <DetailLabel>
                        <FontAwesomeIcon icon={faCreditCard} />
                        Amount
                    </DetailLabel>
                    <DetailValue>{formatValue(billing.amount)}</DetailValue>
                </DetailRow>
                <DetailRow>
                    <DetailLabel>
                        <FontAwesomeIcon icon={faCalendarAlt} />
                        Billing cycle
                    </DetailLabel>
                    <DetailValue>{formatValue(billing.billingCycle)}</DetailValue>
                </DetailRow>
                <DetailRow>
                    <DetailLabel>
                        <FontAwesomeIcon icon={faCalendarAlt} />
                        Renews
                    </DetailLabel>
                    <DetailValue>{formatDate(billing.renewsAt)}</DetailValue>
                </DetailRow>
                <DetailRow>
                    <DetailLabel>
                        <FontAwesomeIcon icon={faEnvelope} />
                        Billing email
                    </DetailLabel>
                    <DetailValue>{formatValue(billing.billingEmail)}</DetailValue>
                </DetailRow>
            </DetailsGrid>

            <Footer>
                <FooterText>Service ID: {formatValue(billing.serviceId, 'Not linked')}</FooterText>
                {billing.viewUrl && (
                    <ExternalLink href={billing.viewUrl} target="_blank" rel="noreferrer">
                        View billing
                        <FontAwesomeIcon icon={faExternalLinkAlt} />
                    </ExternalLink>
                )}
            </Footer>
        </Overlay>
    );
};

export default asModal<Props>()(BillingDetailsModal);
