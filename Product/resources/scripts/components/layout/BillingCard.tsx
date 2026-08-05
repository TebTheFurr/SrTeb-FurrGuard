import React, { useEffect, useState } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCreditCard } from '@fortawesome/free-solid-svg-icons';
import { useStoreState } from '@/state/hooks';
import getBilling, { BillingInfo } from '@/api/server/getBilling';
import BillingDetailsModal from '@/components/server/billing/BillingDetailsModal';

const BillingCardContainer = styled.div<{ $disabled?: boolean }>`
    ${tw`w-full flex items-center justify-between gap-2`};
    transition: background-color 150ms ease;
    background: transparent;
    cursor: ${({ $disabled }) => ($disabled ? 'default' : 'pointer')};
    text-align: left;
    opacity: ${({ $disabled }) => ($disabled ? 0.6 : 1)};
`;

const PlanContent = styled.div`
    ${tw`min-w-0 flex-1`};
`;

const PlanHeading = styled.div`
    ${tw`text-xs mb-0.5`};
    color: var(--color-muted);
`;

const PlanLabel = styled.div`
    ${tw`truncate text-sm font-medium`};
    color: var(--color-base);
`;

const StatusLabel = styled.span<{ $status?: string | null }>`
    ${tw`flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-medium capitalize`};
    color: ${({ $status }) => getStatusColour($status)};
`;

const StatusDot = styled.span<{ $status?: string | null }>`
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    background-color: ${({ $status }) => getStatusColour($status)};
`;

const BillingRowEnd = styled.div`
    ${tw`flex items-center flex-shrink-0`};
`;

const BillingCardWrapper = styled.div`
    ${tw`w-full flex flex-col gap-2`};
`;

const BillingProgressTrack = styled.div`
    ${tw`w-full rounded-full overflow-hidden`};
    height: 3px;
    background-color: color-mix(in srgb, var(--color-neutral) 70%, transparent);
`;

const BillingProgressFill = styled.div<{ $progress: number; $status?: string | null; $overdue?: boolean }>`
    height: 100%;
    width: ${({ $progress }) => $progress}%;
    border-radius: inherit;
    transition: width 400ms ease;
    background-color: ${({ $overdue, $status }) => ($overdue ? '#ef4444' : getStatusColour($status))};
`;

const BillingProgressMeta = styled.div`
    ${tw`flex items-center justify-between gap-2 text-xs leading-none`};
    color: var(--color-muted);
`;

const BillingProgressLabel = styled.span`
    ${tw`truncate overflow-visible`};
`;

const BillingProgressDays = styled.span`
    ${tw`flex-shrink-0`};
    color: var(--color-base);
    font-weight: 500;
`;

const NavDropdownButton = styled.button`
    ${tw`flex items-center gap-2 w-full px-3 py-2 text-sm no-underline`};
    color: var(--color-muted);
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: color 150ms ease, background-color 150ms ease;

    &:hover:not(:disabled) {
        color: var(--color-base);
        background-color: color-mix(in srgb, var(--color-primary) 8%, transparent);
    }

    &:disabled {
        cursor: default;
        opacity: 0.6;
    }

    svg {
        width: 0.875rem;
    }
`;

const getErrorMessage = (error: any) => {
    const detail = error?.response?.data?.error || error?.response?.data?.errors?.[0]?.detail;
    return typeof detail === 'string' && detail.length > 0 ? detail : 'Billing details could not be loaded right now.';
};

const getStatusColour = (status?: string | null) => {
    const normalised = (status || '').toLowerCase();
    if (['active', 'running', 'paid'].includes(normalised)) return '#22c55e';
    if (['pending', 'unpaid', 'overdue'].includes(normalised)) return '#eab308';
    if (['suspended', 'cancelled', 'canceled', 'terminated', 'fraud', 'unavailable'].includes(normalised)) return '#ef4444';
    return 'var(--color-muted)';
};

const parseRenewalDate = (value?: string | null) => {
    const clean = (value || '').trim();
    if (!clean) return null;

    const parsed = new Date(clean);
    if (Number.isNaN(parsed.getTime())) return null;

    parsed.setHours(0, 0, 0, 0);
    return parsed;
};

const subtractBillingPeriod = (renewalDate: Date, cycle?: string | null) => {
    const normalised = (cycle || '').trim().toLowerCase();
    const periodStart = new Date(renewalDate);

    const applyMonths = (months: number) => {
        periodStart.setMonth(periodStart.getMonth() - months);
        return periodStart;
    };

    const applyYears = (years: number) => {
        periodStart.setFullYear(periodStart.getFullYear() - years);
        return periodStart;
    };

    const applyDays = (days: number) => {
        periodStart.setDate(periodStart.getDate() - days);
        return periodStart;
    };

    const monthMatch = normalised.match(/(\d+)\s*month/);
    if (monthMatch || normalised.includes('month')) {
        return applyMonths(monthMatch ? parseInt(monthMatch[1], 10) : 1);
    }

    const yearMatch = normalised.match(/(\d+)\s*year/);
    if (yearMatch || normalised.includes('year') || normalised.includes('annual')) {
        return applyYears(yearMatch ? parseInt(yearMatch[1], 10) : 1);
    }

    const weekMatch = normalised.match(/(\d+)\s*week/);
    if (weekMatch || normalised.includes('week')) {
        return applyDays((weekMatch ? parseInt(weekMatch[1], 10) : 1) * 7);
    }

    const dayMatch = normalised.match(/(\d+)\s*day/);
    if (dayMatch || (normalised.includes('day') && !normalised.includes('today'))) {
        return applyDays(dayMatch ? parseInt(dayMatch[1], 10) : 1);
    }

    if (normalised.includes('quarter')) return applyMonths(3);
    if (normalised.includes('semi')) return applyMonths(6);
    if (normalised.includes('biennial')) return applyYears(2);
    if (normalised.includes('triennial')) return applyYears(3);

    return applyMonths(1);
};

const formatRenewalLabel = (renewalDate: Date) =>
    new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
    }).format(renewalDate);

const getBillingPeriodProgress = (billing: BillingInfo) => {
    const renewalDate = parseRenewalDate(billing.renewsAt);
    if (!renewalDate) return null;

    const periodStart = subtractBillingPeriod(renewalDate, billing.billingCycle);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const totalMs = renewalDate.getTime() - periodStart.getTime();
    if (totalMs <= 0) return null;

    const elapsedMs = now.getTime() - periodStart.getTime();
    const progress = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
    const daysRemaining = Math.ceil((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const overdue = daysRemaining < 0;

    let daysLabel = 'Renews today';
    if (overdue) {
        daysLabel = `${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'} overdue`;
    } else if (daysRemaining === 1) {
        daysLabel = '1 day left';
    } else if (daysRemaining > 1) {
        daysLabel = `${daysRemaining} days left`;
    }

    return {
        progress: overdue ? 100 : progress,
        overdue,
        renewalLabel: formatRenewalLabel(renewalDate),
        daysLabel,
    };
};

interface Props {
    serverUuid?: string;
    externalId?: string | null;
    variant?: 'sidebar' | 'dropdown';
    onOpen?: () => void;
}

export default ({ serverUuid, externalId, variant = 'sidebar', onOpen }: Props) => {
    const billingSettings = useStoreState((state) => state.settings.data?.advanced?.billingIntegration);
    const [billing, setBilling] = useState<BillingInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    const shouldLoad = !!billingSettings?.enabled && !!billingSettings?.configured && !!serverUuid && !!externalId;

    useEffect(() => {
        if (!shouldLoad || !serverUuid) {
            setBilling(null);
            setLoading(false);
            return;
        }

        let mounted = true;

        setLoading(true);
        getBilling(serverUuid)
            .then((data) => {
                if (!mounted) return;
                setBilling(data.enabled === false ? null : data);
            })
            .catch((error) => {
                if (!mounted) return;
                if (error?.response?.status === 403) {
                    setBilling(null);
                    return;
                }

                setBilling({
                    enabled: true,
                    configured: true,
                    serviceId: externalId || undefined,
                    productName: 'Billing unavailable',
                    status: 'Unavailable',
                    error: getErrorMessage(error),
                });
            })
            .finally(() => {
                if (mounted) {
                    setLoading(false);
                }
            });

        return () => {
            mounted = false;
        };
    }, [shouldLoad, serverUuid, externalId]);

    if (!shouldLoad || (!billing && !loading)) {
        return null;
    }

    const openModal = () => {
        if (!billing || loading) {
            return;
        }
        onOpen?.();
        setModalOpen(true);
    };

    const planName = loading
        ? 'Loading...'
        : billing?.productName || billing?.planName || 'Billing service';
    const status = loading ? null : billing?.status || 'Unknown';
    const billingProgress = !loading && billing ? getBillingPeriodProgress(billing) : null;

    return (
        <>
            {variant === 'dropdown' ? (
                <NavDropdownButton type="button" onClick={openModal} disabled={!billing || loading}>
                    <FontAwesomeIcon icon={faCreditCard} />
                    {planName}
                </NavDropdownButton>
            ) : (
                <BillingCardWrapper>
                    <BillingCardContainer onClick={openModal} $disabled={!billing || loading}>
                        <PlanContent>
                            <PlanHeading>Your plan:</PlanHeading>
                            <PlanLabel>{planName}</PlanLabel>
                        </PlanContent>
                        {status && (
                            <BillingRowEnd>
                                <StatusLabel $status={billing?.status}>
                                    <StatusDot $status={billing?.status} />
                                    {status}
                                </StatusLabel>
                            </BillingRowEnd>
                        )}
                    </BillingCardContainer>
                    {billingProgress && (
                        <>
                            <BillingProgressTrack>
                                <BillingProgressFill
                                    $progress={billingProgress.progress}
                                    $status={billing?.status}
                                    $overdue={billingProgress.overdue}
                                />
                            </BillingProgressTrack>
                            <BillingProgressMeta>
                                <BillingProgressLabel>Renews {billingProgress.renewalLabel}</BillingProgressLabel>
                                <BillingProgressDays>{billingProgress.daysLabel}</BillingProgressDays>
                            </BillingProgressMeta>
                        </>
                    )}
                </BillingCardWrapper>
            )}

            <BillingDetailsModal visible={modalOpen} billing={billing} onModalDismissed={() => setModalOpen(false)} />
        </>
    );
};
