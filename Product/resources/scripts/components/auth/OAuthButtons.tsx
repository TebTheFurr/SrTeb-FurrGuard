import React, { useEffect, useState } from 'react';
import http from '@/api/http';
import tw from 'twin.macro';
import styled from 'styled-components/macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faKey } from '@fortawesome/free-solid-svg-icons';
import { faDiscord } from '@fortawesome/free-brands-svg-icons';

export const GOOGLE_OAUTH_ICON_URL =
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/3840px-Google_%22G%22_logo.svg.png';

export interface OAuthProvider {
    id: number;
    name: string;
    provider_key: string;
    provider_type: string;
    icon: string;
    button_colour: string;
    redirect_uri: string;
}

interface Props {
    label?: string;
}

const Divider = styled.div`
    ${tw`flex items-center my-6`};
    color: var(--color-inverted);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;

    &::before,
    &::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--color-neutral);
    }

    span {
        ${tw`px-3`};
    }
`;

const ButtonGrid = styled.div`
    ${tw`grid gap-3`};
`;

const OAuthButton = styled.button<{ $colour: string; $light: boolean }>`
    ${tw`w-full flex items-center justify-center gap-3 transition-colors duration-150`};
    height: 44px;
    border-radius: var(--border-radius, 8px);
    border: 1px solid ${(props) => (props.$light ? 'var(--color-neutral)' : props.$colour)};
    background: ${(props) => (props.$light ? 'var(--color-background)' : props.$colour)};
    color: ${(props) => (props.$light ? 'var(--color-base)' : '#fff')};
    font-weight: 600;

    &:hover {
        filter: brightness(1.08);
        border-color: ${(props) => (props.$light ? 'var(--color-primary)' : props.$colour)};
    }
`;

const iconForProvider = (provider: OAuthProvider): any => {
    if (provider.provider_type === 'discord') {
        return faDiscord;
    }

    return faKey;
};

export const isGoogleOAuthProvider = (provider: Pick<OAuthProvider, 'provider_type'>) =>
    provider.provider_type === 'google';

const OAuthProviderIcon = ({ provider, size = 18 }: { provider: OAuthProvider; size?: number }) => {
    if (isGoogleOAuthProvider(provider)) {
        return (
            <img
                src={GOOGLE_OAUTH_ICON_URL}
                alt=''
                width={size}
                height={size}
                css={tw`object-contain flex-shrink-0`}
            />
        );
    }

    return <FontAwesomeIcon icon={iconForProvider(provider)} />;
};

export default ({ label = 'Continue with' }: Props) => {
    const [providers, setProviders] = useState<OAuthProvider[]>([]);

    useEffect(() => {
        http.get('/auth/oauth/providers')
            .then(({ data }) => setProviders(data.data || []))
            .catch(() => setProviders([]));
    }, []);

    if (providers.length === 0) {
        return null;
    }

    return (
        <>
            <Divider>
                <span>or</span>
            </Divider>
            <ButtonGrid>
                {providers.map((provider) => {
                    const colour = provider.button_colour || '#5865F2';
                    const light = colour.toLowerCase() === '#ffffff';

                    return (
                        <OAuthButton
                            key={provider.provider_key}
                            type={'button'}
                            $colour={colour}
                            $light={light}
                            onClick={() => {
                                window.location.href = `/auth/oauth/${encodeURIComponent(provider.provider_key)}`;
                            }}
                        >
                            <OAuthProviderIcon provider={provider} />
                            {label} {provider.name}
                        </OAuthButton>
                    );
                })}
            </ButtonGrid>
        </>
    );
};
