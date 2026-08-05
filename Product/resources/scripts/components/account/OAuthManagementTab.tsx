import React, { useEffect, useMemo, useState } from 'react';
import tw from 'twin.macro';
import styled from 'styled-components/macro';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import { Button } from '@/components/elements/button/index';
import { Dialog } from '@/components/elements/dialog';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faKey, faLink, faUnlink } from '@fortawesome/free-solid-svg-icons';
import { faDiscord } from '@fortawesome/free-brands-svg-icons';
import { httpErrorToHuman } from '@/api/http';
import { getOAuthIdentities, getOAuthLinkUrl, OAuthIdentity, unlinkOAuthIdentity } from '@/api/oauth';
import { OAuthProvider, GOOGLE_OAUTH_ICON_URL, isGoogleOAuthProvider } from '@/components/auth/OAuthButtons';

const Grid = styled.div`
    ${tw`grid gap-6 lg:grid-cols-2`};
`;

const Card = styled.div`
    background: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    overflow: hidden;
`;

const CardHeader = styled.div`
    ${tw`px-5 py-4 flex items-center gap-3`};
    border-bottom: 1px solid var(--color-neutral);
`;

const CardBody = styled.div`
    ${tw`p-5 relative`};
`;

const ProviderRow = styled.div`
    ${tw`flex items-center gap-4 p-4 mb-3 last:mb-0`};
    background: var(--color-background);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
`;

const ProviderIcon = styled.div<{ $colour?: string }>`
    ${tw`flex items-center justify-center flex-shrink-0`};
    width: 42px;
    height: 42px;
    border-radius: var(--border-radius, 8px);
    background: ${(props) => props.$colour || 'var(--color-primary)'};
    color: ${(props) => ((props.$colour || '').toLowerCase() === '#ffffff' ? 'var(--color-base)' : '#fff')};
    border: 1px solid var(--color-neutral);
`;

const ProviderText = styled.div`
    ${tw`flex-1 min-w-0`};
`;

const ProviderName = styled.p`
    ${tw`text-sm font-semibold truncate`};
    color: var(--color-base);
`;

const ProviderMeta = styled.p`
    ${tw`text-xs truncate mt-1`};
    color: var(--color-muted);
`;

const EmptyText = styled.p`
    ${tw`text-center text-sm py-6`};
    color: var(--color-muted);
`;

const ErrorBox = styled.div`
    ${tw`p-3 mb-4 text-sm`};
    border: 1px solid #ef4444;
    border-radius: var(--border-radius, 8px);
    color: #fecaca;
    background: color-mix(in srgb, #ef4444 15%, transparent);
`;

const iconForProvider = (provider?: OAuthProvider | null): any => {
    if (provider?.provider_type === 'discord') {
        return faDiscord;
    }

    return faKey;
};

const renderProviderIcon = (provider?: OAuthProvider | null, size = 20) => {
    if (provider && isGoogleOAuthProvider(provider)) {
        return (
            <img
                src={GOOGLE_OAUTH_ICON_URL}
                alt=''
                width={size}
                height={size}
                css={tw`object-contain`}
            />
        );
    }

    return <FontAwesomeIcon icon={iconForProvider(provider)} />;
};

export default () => {
    const [providers, setProviders] = useState<OAuthProvider[]>([]);
    const [identities, setIdentities] = useState<OAuthIdentity[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [unlinkingId, setUnlinkingId] = useState<number | null>(null);

    const linkedProviderKeys = useMemo(
        () => identities.map((identity) => identity.provider?.provider_key).filter(Boolean),
        [identities]
    );

    const availableProviders = useMemo(
        () => providers.filter((provider) => !linkedProviderKeys.includes(provider.provider_key)),
        [providers, linkedProviderKeys]
    );

    const load = () => {
        setLoading(true);
        setError('');

        getOAuthIdentities()
            .then((response) => {
                setIdentities(response.identities);
                setProviders(response.providers);
            })
            .catch((error) => setError(httpErrorToHuman(error)))
            .then(() => setLoading(false));
    };

    useEffect(() => {
        load();
    }, []);

    const unlink = () => {
        if (!unlinkingId) return;

        setLoading(true);
        setError('');

        unlinkOAuthIdentity(unlinkingId)
            .then(() => {
                setIdentities((current) => current.filter((identity) => identity.id !== unlinkingId));
                setUnlinkingId(null);
            })
            .catch((error) => setError(httpErrorToHuman(error)))
            .then(() => setLoading(false));
    };

    return (
        <>
            <Dialog.Confirm
                title={'Unlink OAuth provider'}
                confirm={'Unlink provider'}
                open={unlinkingId !== null}
                onClose={() => setUnlinkingId(null)}
                onConfirmed={unlink}
            >
                This removes the OAuth connection from your account. You can link it again later.
            </Dialog.Confirm>

            {error && <ErrorBox>{error}</ErrorBox>}

            <Grid>
                <Card>
                    <CardHeader>
                        <FontAwesomeIcon icon={faLink} style={{ color: 'var(--color-primary)' }} />
                        <span className='font-medium' style={{ color: 'var(--color-base)' }}>
                            Linked providers
                        </span>
                    </CardHeader>
                    <CardBody>
                        <SpinnerOverlay visible={loading} />
                        {identities.length === 0 ? (
                            <EmptyText>No OAuth providers are linked to this account.</EmptyText>
                        ) : (
                            identities.map((identity) => (
                                <ProviderRow key={identity.id}>
                                    <ProviderIcon $colour={identity.provider?.button_colour}>
                                        {renderProviderIcon(identity.provider)}
                                    </ProviderIcon>
                                    <ProviderText>
                                        <ProviderName>{identity.provider?.name || 'OAuth Provider'}</ProviderName>
                                        <ProviderMeta>
                                            {identity.provider_email ||
                                                identity.provider_name ||
                                                'Connected OAuth identity'}
                                        </ProviderMeta>
                                    </ProviderText>
                                    <Button.Danger type='button' onClick={() => setUnlinkingId(identity.id)}>
                                        <FontAwesomeIcon icon={faUnlink} css={tw`mr-2`} />
                                        Unlink
                                    </Button.Danger>
                                </ProviderRow>
                            ))
                        )}
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <FontAwesomeIcon icon={faKey} style={{ color: 'var(--color-primary)' }} />
                        <span className='font-medium' style={{ color: 'var(--color-base)' }}>
                            Available providers
                        </span>
                    </CardHeader>
                    <CardBody>
                        <SpinnerOverlay visible={loading} />
                        {availableProviders.length === 0 ? (
                            <EmptyText>There are no additional OAuth providers available.</EmptyText>
                        ) : (
                            availableProviders.map((provider) => (
                                <ProviderRow key={provider.provider_key}>
                                    <ProviderIcon $colour={provider.button_colour}>
                                        {renderProviderIcon(provider)}
                                    </ProviderIcon>
                                    <ProviderText>
                                        <ProviderName>{provider.name}</ProviderName>
                                        <ProviderMeta>Link this provider to your existing account.</ProviderMeta>
                                    </ProviderText>
                                    <Button
                                        type='button'
                                        onClick={() => {
                                            window.location.href = getOAuthLinkUrl(provider.provider_key);
                                        }}
                                    >
                                        Link
                                    </Button>
                                </ProviderRow>
                            ))
                        )}
                    </CardBody>
                </Card>
            </Grid>
        </>
    );
};
