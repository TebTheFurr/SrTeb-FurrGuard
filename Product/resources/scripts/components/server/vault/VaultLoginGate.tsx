import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import useVaultTranslation from '@/components/server/vault/useVaultTranslation';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faShieldAlt, faSignInAlt, faUserSlash } from '@fortawesome/free-solid-svg-icons';
import { ServerContext } from '@/state/server';
import { Button } from '@/components/elements/button/index';
import Panel, { PanelBody } from '@/components/elements/ui/Panel';
import PageHeader from '@/components/elements/ui/PageHeader';
import { Notice, NoticeBody } from '@/components/server/vault/vaultStyles';

const Card = styled(Panel)`
    ${tw`max-w-xl mx-auto`};
`;

const Body = styled(PanelBody)`
    ${tw`flex flex-col items-center text-center gap-4 py-8`};
`;

const Emblem = styled.span`
    ${tw`flex items-center justify-center w-14 h-14 text-2xl rounded-full`};
    color: var(--color-primary);
    background-color: var(--color-background);
    border: 1px solid var(--color-neutral);
`;

const Title = styled.h2`
    ${tw`text-lg font-semibold`};
    color: var(--color-base);
`;

const Message = styled.p`
    ${tw`text-sm max-w-md`};
    color: var(--color-muted);
`;

type LoginError = 'sin_acceso' | 'cancelado' | 'discord';

const knownError = (value: string | null): LoginError | 'otro' | null => {
    if (!value) return null;

    return value === 'sin_acceso' || value === 'cancelado' || value === 'discord' ? value : 'otro';
};

/** Discord sign-in bridge of vault/docs/PTERODACTYL.md §4.2: the panel does the OAuth and keeps the session. */
const VaultLoginGate = () => {
    const { t } = useVaultTranslation();
    const { search } = useLocation();
    const serverId = ServerContext.useStoreState((state) => state.server.data!.id);
    const [redirecting, setRedirecting] = useState(false);

    const params = new URLSearchParams(search);
    const error = knownError(params.get('error'));
    const discordName = (params.get('nombre') || '').trim();

    const signIn = () => {
        setRedirecting(true);
        window.location.href = `/vault/login?servidor=${encodeURIComponent(serverId)}`;
    };

    if (error === 'sin_acceso') {
        return (
            <>
                <PageHeader title={t('vault.title', 'Vault')} />
                <Card>
                    <Body>
                        <Emblem>
                            <FontAwesomeIcon icon={faUserSlash} />
                        </Emblem>
                        <Title>{t('vault.login.no_access_title', 'Sin acceso a este Vault')}</Title>
                        <Message>
                            {discordName
                                ? t(
                                      'vault.login.no_access_named',
                                      'La cuenta de Discord {{name}} no tiene acceso al Vault de este servidor. Pide al dueño del servidor que la añada o entra con otra cuenta.',
                                      { name: discordName }
                                  )
                                : t(
                                      'vault.login.no_access',
                                      'Esa cuenta de Discord no tiene acceso al Vault de este servidor. Pide al dueño del servidor que la añada o entra con otra cuenta.'
                                  )}
                        </Message>
                        <Button onClick={signIn} disabled={redirecting}>
                            <FontAwesomeIcon icon={faSignInAlt} />
                            <span className={'ml-2'}>{t('vault.login.other_account', 'Usar otra cuenta')}</span>
                        </Button>
                    </Body>
                </Card>
            </>
        );
    }

    return (
        <>
            <PageHeader title={t('vault.title', 'Vault')} />
            <Card>
                <Body>
                    <Emblem>
                        <FontAwesomeIcon icon={faShieldAlt} />
                    </Emblem>
                    <Title>{t('vault.login.title', 'Entra en el Vault')}</Title>
                    <Message>
                        {t(
                            'vault.login.message',
                            'Las copias de este servidor se guardan en Tebby Vault. Inicia sesión con Discord para ver qué puede descargar, restaurar o gestionar tu cuenta.'
                        )}
                    </Message>
                    {error && (
                        <Notice $tone={error === 'cancelado' ? 'warning' : 'danger'}>
                            <FontAwesomeIcon icon={faExclamationTriangle} />
                            <NoticeBody>
                                {error === 'cancelado'
                                    ? t('vault.login.cancelled', 'Cancelaste el inicio de sesión en Discord.')
                                    : error === 'discord'
                                    ? t('vault.login.discord_error', 'Discord no pudo completar el inicio de sesión. Vuelve a intentarlo en un momento.')
                                    : t('vault.login.generic_error', 'No se pudo completar el inicio de sesión. Vuelve a intentarlo.')}
                            </NoticeBody>
                        </Notice>
                    )}
                    <Button onClick={signIn} disabled={redirecting}>
                        <FontAwesomeIcon icon={faSignInAlt} />
                        <span className={'ml-2'}>
                            {redirecting
                                ? t('vault.login.redirecting', 'Abriendo Discord…')
                                : t('vault.login.button', 'Entrar con Discord')}
                        </span>
                    </Button>
                </Body>
            </Card>
        </>
    );
};

export default VaultLoginGate;
