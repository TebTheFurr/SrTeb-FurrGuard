import React, { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGift, faServer, faHdd, faMicrochip, faClock, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { getPendingOffers, claimOffer, FreeServerClaim } from '@/api/account/freeServers';
import { useStoreActions } from 'easy-peasy';
import { ApplicationStore } from '@/state';

const slideIn = keyframes`
    from { opacity: 0; transform: translateY(-12px); }
    to { opacity: 1; transform: translateY(0); }
`;

const Banner = styled.div`
    animation: ${slideIn} 0.4s ease-out;
    background: var(--color-background-secondary);
    border: 1px solid var(--color-primary);
    border-left: 4px solid var(--color-primary);
    border-radius: var(--border-radius, 8px);
    ${tw`mb-4 overflow-hidden`};
`;

const BannerInner = styled.div`
    ${tw`p-5`};
`;

const BannerHeader = styled.div`
    ${tw`flex items-center gap-3 mb-3`};
`;

const IconCircle = styled.div`
    ${tw`flex items-center justify-center flex-shrink-0`};
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--color-primary) 15%, transparent);
    color: var(--color-primary);
    font-size: 1rem;
`;

const Title = styled.h3`
    ${tw`text-base font-semibold`};
    color: var(--color-base);
`;

const Description = styled.p`
    ${tw`text-sm mb-4`};
    color: var(--color-muted);
`;

const SpecsRow = styled.div`
    ${tw`flex flex-wrap gap-4 mb-4`};
`;

const Spec = styled.div`
    ${tw`flex items-center gap-2 text-xs px-3 py-1.5`};
    background: var(--color-background);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    color: var(--color-base);
    
    svg {
        color: var(--color-primary);
        font-size: 0.7rem;
    }
`;

const ExpiryNote = styled.p`
    ${tw`text-xs mb-4`};
    color: var(--color-inverted);
    
    svg {
        ${tw`mr-1`};
    }
`;

const ClaimButton = styled.button`
    ${tw`px-5 py-2 text-sm font-medium transition-all duration-150`};
    background: var(--color-primary);
    color: #fff;
    border: none;
    border-radius: var(--border-radius, 8px);
    cursor: pointer;
    
    &:hover {
        filter: brightness(1.1);
    }
    
    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;

const ErrorText = styled.p`
    ${tw`text-xs mt-2`};
    color: #ef4444;
`;

const SuccessText = styled.p`
    ${tw`text-xs mt-2`};
    color: #22c55e;
`;

export default () => {
    const [offers, setOffers] = useState<FreeServerClaim[]>([]);
    const [claiming, setClaiming] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const { addFlash } = useStoreActions((actions: ApplicationStore) => actions.flashes);

    useEffect(() => {
        getPendingOffers()
            .then(setOffers)
            .catch(() => {});
    }, []);

    if (offers.length === 0) return null;

    const handleClaim = async (claimId: number) => {
        setClaiming(claimId);
        setError(null);
        setSuccess(null);

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
            setOffers(prev => prev.filter(o => o.id !== claimId));
            setSuccess('Server created successfully! Refresh to see it in your server list.');
            addFlash({
                type: 'success',
                key: 'dashboard',
                message: 'Your free server has been created! It will appear in your server list shortly.',
            });
            setTimeout(() => window.location.reload(), 2000);
        } catch (e: any) {
            const message = e?.response?.data?.error || 'Failed to claim offer. Please try again.';
            setError(message);
        } finally {
            setClaiming(null);
        }
    };

    const formatExpiry = (dateStr: string | null) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = date.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) return 'Expiring soon';
        if (diffDays === 1) return '1 day left to claim';
        return `${diffDays} days left to claim`;
    };

    return (
        <>
            {offers.map((offer) => (
                <Banner key={offer.id}>
                    <BannerInner>
                        <BannerHeader>
                            <IconCircle>
                                <FontAwesomeIcon icon={faGift} />
                            </IconCircle>
                            <div>
                                <Title>{offer.offer_name}</Title>
                                {offer.offer_description && (
                                    <Description style={{ marginBottom: 0 }}>{offer.offer_description}</Description>
                                )}
                            </div>
                        </BannerHeader>

                        <SpecsRow>
                            {offer.memory > 0 && (
                                <Spec>
                                    <FontAwesomeIcon icon={faServer} />
                                    {offer.memory >= 1024 ? `${(offer.memory / 1024).toFixed(1)} GB` : `${offer.memory} MB`} RAM
                                </Spec>
                            )}
                            {offer.disk > 0 && (
                                <Spec>
                                    <FontAwesomeIcon icon={faHdd} />
                                    {offer.disk >= 1024 ? `${(offer.disk / 1024).toFixed(1)} GB` : `${offer.disk} MB`} Disk
                                </Spec>
                            )}
                            {offer.cpu > 0 && (
                                <Spec>
                                    <FontAwesomeIcon icon={faMicrochip} />
                                    {offer.cpu}% CPU
                                </Spec>
                            )}
                            {offer.server_expiry_days && (
                                <Spec>
                                    <FontAwesomeIcon icon={faClock} />
                                    {offer.server_expiry_days} day{offer.server_expiry_days !== 1 ? 's' : ''} server access
                                </Spec>
                            )}
                        </SpecsRow>

                        {offer.claim_expires_at && (
                            <ExpiryNote>
                                <FontAwesomeIcon icon={faClock} />
                                {formatExpiry(offer.claim_expires_at)}
                            </ExpiryNote>
                        )}

                        <ClaimButton
                            onClick={() => handleClaim(offer.id)}
                            disabled={claiming !== null}
                        >
                            {claiming === offer.id ? (
                                <>
                                    <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 8 }} />
                                    Creating server...
                                </>
                            ) : (
                                'Claim Free Server'
                            )}
                        </ClaimButton>

                        {error && <ErrorText>{error}</ErrorText>}
                        {success && <SuccessText>{success}</SuccessText>}
                    </BannerInner>
                </Banner>
            ))}
        </>
    );
};
