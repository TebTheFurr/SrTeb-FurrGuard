import React, { useEffect, useState } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGift, faSpinner, faEnvelope, faLock, faCheck, faMemory, faHdd, faMicrochip } from '@fortawesome/free-solid-svg-icons';
import { getPendingOffers, claimOffer, FreeServerClaim } from '@/api/account/freeServers';
import resendVerificationEmail from '@/api/account/resendVerificationEmail';
import { useStoreState } from '@/state/hooks';
import { ApplicationStore } from '@/state';
import PageContentBlock from '@/components/elements/PageContentBlock';
import Spinner from '@/components/elements/Spinner';
import { useTranslation } from 'react-i18next';

const PageHeader = styled.div`
    ${tw`mb-6`};
`;

const Title = styled.h1`
    ${tw`text-2xl font-bold`};
    color: var(--color-base);
`;

const Subtitle = styled.p`
    ${tw`text-sm mt-1`};
    color: var(--color-muted);
`;

const OfferGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1rem;
`;

const OfferCard = styled.div`
    background: var(--color-background-secondary);
    border-radius: var(--border-radius, 12px);
    overflow: hidden;
    transition: box-shadow 0.2s;
`;

const OfferCardBody = styled.div`
    ${tw`p-5`};
`;

const OfferName = styled.h3`
    ${tw`text-base font-semibold`};
    color: var(--color-base);
`;

const OfferDescription = styled.p`
    ${tw`text-sm mt-1`};
    color: var(--color-muted);
    line-height: 1.5;
`;

const SpecsGrid = styled.div`
    ${tw`mt-4`};
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
`;

const SpecItem = styled.div`
    ${tw`flex flex-col items-center py-2 px-1`};
    background: color-mix(in srgb, var(--color-neutral) 10%, transparent);
    border-radius: calc(var(--border-radius, 12px) * 0.6);
`;

const SpecIcon = styled.div`
    ${tw`text-xs mb-1`};
    color: var(--color-primary);
    opacity: 0.8;
`;

const SpecValue = styled.span`
    ${tw`text-sm font-semibold`};
    color: var(--color-base);
`;

const SpecLabel = styled.span`
    font-size: 10px;
    color: var(--color-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
`;

const ExpiryNote = styled.p`
    ${tw`text-xs mt-3`};
    color: var(--color-muted);
    font-style: italic;
`;

const CardFooter = styled.div`
    ${tw`px-5 py-3 flex items-center justify-between`};
    border-top: 1px solid color-mix(in srgb, var(--color-neutral) 15%, transparent);
`;

const ClaimButton = styled.button`
    ${tw`px-4 py-2 text-sm font-medium`};
    background: var(--color-primary);
    color: #fff;
    border: none;
    border-radius: calc(var(--border-radius, 12px) * 0.5);
    cursor: pointer;
    transition: filter 0.15s, opacity 0.15s;
    min-width: 80px;

    &:hover {
        filter: brightness(1.1);
    }

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;

const RequirementRow = styled.div`
    ${tw`flex items-center gap-1.5 text-xs`};
    color: var(--color-muted);
`;

const RequirementMet = styled.span`
    color: #22c55e;
    ${tw`flex items-center gap-1`};
`;

const RequirementUnmet = styled.span`
    color: #f59e0b;
    ${tw`flex items-center gap-1`};
`;

const ResendButton = styled.button`
    ${tw`ml-2 px-2.5 py-1 text-xs font-medium`};
    background: transparent;
    color: var(--color-primary);
    border: 1px solid var(--color-primary);
    border-radius: calc(var(--border-radius, 12px) * 0.5);
    cursor: pointer;
    transition: filter 0.15s, opacity 0.15s;

    &:hover {
        filter: brightness(1.1);
    }

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;

const RequirementMessage = styled.p`
    ${tw`text-xs mt-1 w-full`};
`;

const ErrorMsg = styled.p`
    ${tw`text-xs mt-2`};
    color: #ef4444;
`;

const EmptyState = styled.div`
    ${tw`flex flex-col items-center justify-center py-16`};
    color: var(--color-muted);
`;

const EmptyIcon = styled.div`
    ${tw`text-4xl mb-4`};
    opacity: 0.3;
`;

const EmptyText = styled.p`
    ${tw`text-base`};
`;

export default () => {
    const { t } = useTranslation('dashboard');
    const [offers, setOffers] = useState<FreeServerClaim[]>([]);
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState<number | null>(null);
    const [errors, setErrors] = useState<Record<number, string>>({});
    const [resending, setResending] = useState(false);
    const [resendMessage, setResendMessage] = useState<string | null>(null);
    const [resendError, setResendError] = useState<string | null>(null);

    const user = useStoreState((state: ApplicationStore) => state.user.data);
    const addons = useStoreState((state: ApplicationStore) => state.settings.data?.addons);
    const requireEmail = addons?.freeServers?.requireEmailVerified ?? false;
    const require2fa = addons?.freeServers?.require2fa ?? false;

    useEffect(() => {
        getPendingOffers()
            .then((data) => setOffers(data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const handleResendVerification = async () => {
        setResending(true);
        setResendMessage(null);
        setResendError(null);

        try {
            await resendVerificationEmail();
            setResendMessage(t('claim.requirements.resend_verification_sent', 'Verification email sent.'));
        } catch (e: any) {
            const status = e?.response?.status;
            if (status === 429) {
                setResendError(t('claim.requirements.resend_verification_wait', 'Please wait before requesting another verification email.'));
            } else {
                setResendError(
                    e?.response?.data?.errors?.[0]?.detail
                    || e?.response?.data?.error
                    || t('claim.requirements.resend_verification_failed', 'Failed to resend verification email. Please try again.')
                );
            }
        } finally {
            setResending(false);
        }
    };

    const handleClaim = async (claimId: number) => {
        setClaiming(claimId);
        setErrors((prev) => ({ ...prev, [claimId]: '' }));

        try {
            const result = await claimOffer(claimId);
            if (result.redirect_url) {
                window.location.href = result.redirect_url;
                return;
            }
            if (result.server_id) {
                window.location.href = `/server/${result.server_id}`;
                return;
            }
            setOffers((prev) => prev.filter((o) => o.id !== claimId));
        } catch (e: any) {
            setErrors((prev) => ({
                ...prev,
                [claimId]: e?.response?.data?.error || t('claim.errors.failed', 'Failed to claim. Try again.'),
            }));
        } finally {
            setClaiming(null);
        }
    };

    const formatMem = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`);

    if (loading) {
        return (
            <PageContentBlock title={t('claim.page_title', 'Claim Servers')}>
                <Spinner centered size="large" />
            </PageContentBlock>
        );
    }

    return (
        <PageContentBlock title={t('claim.page_title', 'Claim Servers')}>
            <PageHeader>
                <Title>{t('claim.title', 'Free Servers')}</Title>
                <Subtitle>{t('claim.subtitle', 'Claim your free servers below to get started.')}</Subtitle>
            </PageHeader>

            {(requireEmail || require2fa) && (
                <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {requireEmail && (
                        <RequirementRow>
                            <FontAwesomeIcon icon={faEnvelope} />
                            {user?.emailVerifiedAt ? (
                                <RequirementMet><FontAwesomeIcon icon={faCheck} /> {t('claim.requirements.email_verified', 'Email verified')}</RequirementMet>
                            ) : (
                                <>
                                    <RequirementUnmet><FontAwesomeIcon icon={faLock} /> {t('claim.requirements.email_required', 'Email verification required')}</RequirementUnmet>
                                    <ResendButton onClick={handleResendVerification} disabled={resending}>
                                        {resending ? (
                                            <FontAwesomeIcon icon={faSpinner} spin />
                                        ) : (
                                            t('claim.requirements.resend_verification', 'Resend verification email')
                                        )}
                                    </ResendButton>
                                </>
                            )}
                        </RequirementRow>
                    )}
                    {require2fa && (
                        <RequirementRow>
                            <FontAwesomeIcon icon={faLock} />
                            {user?.useTotp ? (
                                <RequirementMet><FontAwesomeIcon icon={faCheck} /> {t('claim.requirements.two_factor_enabled', '2FA enabled')}</RequirementMet>
                            ) : (
                                <RequirementUnmet><FontAwesomeIcon icon={faLock} /> {t('claim.requirements.two_factor_required', 'Two-factor authentication required')}</RequirementUnmet>
                            )}
                        </RequirementRow>
                    )}
                    {resendMessage && (
                        <RequirementMessage style={{ color: '#22c55e' }}>{resendMessage}</RequirementMessage>
                    )}
                    {resendError && (
                        <RequirementMessage style={{ color: '#ef4444' }}>{resendError}</RequirementMessage>
                    )}
                </div>
            )}

            {offers.length === 0 ? (
                <EmptyState>
                    <EmptyIcon>
                        <FontAwesomeIcon icon={faGift} />
                    </EmptyIcon>
                    <EmptyText>{t('claim.empty', 'No free servers available right now.')}</EmptyText>
                </EmptyState>
            ) : (
                <OfferGrid>
                    {offers.map((offer) => (
                        <OfferCard key={offer.id}>
                            <OfferCardBody>
                                <OfferName>{offer.offer_name}</OfferName>
                                {offer.offer_description && (
                                    <OfferDescription>{offer.offer_description}</OfferDescription>
                                )}
                                <SpecsGrid>
                                    {offer.memory > 0 && (
                                        <SpecItem>
                                            <SpecIcon><FontAwesomeIcon icon={faMemory} /></SpecIcon>
                                            <SpecValue>{formatMem(offer.memory)}</SpecValue>
                                            <SpecLabel>{t('claim.specs.ram', 'RAM')}</SpecLabel>
                                        </SpecItem>
                                    )}
                                    {offer.disk > 0 && (
                                        <SpecItem>
                                            <SpecIcon><FontAwesomeIcon icon={faHdd} /></SpecIcon>
                                            <SpecValue>{formatMem(offer.disk)}</SpecValue>
                                            <SpecLabel>{t('claim.specs.disk', 'Disk')}</SpecLabel>
                                        </SpecItem>
                                    )}
                                    {offer.cpu > 0 && (
                                        <SpecItem>
                                            <SpecIcon><FontAwesomeIcon icon={faMicrochip} /></SpecIcon>
                                            <SpecValue>{offer.cpu}%</SpecValue>
                                            <SpecLabel>{t('claim.specs.cpu', 'CPU')}</SpecLabel>
                                        </SpecItem>
                                    )}
                                </SpecsGrid>
                                {offer.server_expiry_days && (
                                    <ExpiryNote>
                                        {t('claim.server_expires', 'This server will expire after {{count}} day(s).', { count: offer.server_expiry_days })}
                                    </ExpiryNote>
                                )}
                                {offer.claim_expires_at && (
                                    <ExpiryNote>
                                        {t('claim.claim_before', 'Claim before {{date}}.', { date: new Date(offer.claim_expires_at).toLocaleDateString() })}
                                    </ExpiryNote>
                                )}
                                {errors[offer.id] && <ErrorMsg>{errors[offer.id]}</ErrorMsg>}
                            </OfferCardBody>
                            <CardFooter>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                                    {t('claim.free', 'Free')}
                                </span>
                                <ClaimButton
                                    onClick={() => handleClaim(offer.id)}
                                    disabled={claiming !== null}
                                >
                                    {claiming === offer.id ? (
                                        <FontAwesomeIcon icon={faSpinner} spin />
                                    ) : (
                                        t('claim.action', 'Claim')
                                    )}
                                </ClaimButton>
                            </CardFooter>
                        </OfferCard>
                    ))}
                </OfferGrid>
            )}
        </PageContentBlock>
    );
};
