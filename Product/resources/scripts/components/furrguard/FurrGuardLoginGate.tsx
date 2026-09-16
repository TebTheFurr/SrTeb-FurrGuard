import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faPaw, faSignInAlt, faUserSlash } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/components/elements/button/index';
import Panel, { PanelBody } from '@/components/elements/ui/Panel';
import PageHeader from '@/components/elements/ui/PageHeader';
import { Notice, NoticeBody } from '@/components/server/vault/vaultStyles';
import useFurrGuardTranslation from '@/components/furrguard/useFurrGuardTranslation';

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

type LoginError = 'no_access' | 'cancelled' | 'discord' | 'unreachable' | 'unavailable' | 'rejected' | 'bridge' | 'rate_limited' | 'expired';

const KNOWN: LoginError[] = ['no_access', 'cancelled', 'discord', 'unreachable', 'unavailable', 'rejected', 'bridge', 'rate_limited', 'expired'];

const knownError = (value: string | null): LoginError | 'other' | null => {
    if (!value) return null;

    return (KNOWN as string[]).includes(value) ? (value as LoginError) : 'other';
};

interface Props {
    /** Set when the session was lost while using the page (expired or revoked). */
    lostReason?: string | null;
}

/** Discord sign-in bridge of FurrGuard docs/API.md §9.2: the panel does the OAuth and keeps the session. */
const FurrGuardLoginGate = ({ lostReason }: Props) => {
    const { t } = useFurrGuardTranslation();
    const { search } = useLocation();
    const [redirecting, setRedirecting] = useState(false);

    const error = knownError(new URLSearchParams(search).get('error')) ?? (lostReason ? 'expired' : null);

    const signIn = () => {
        setRedirecting(true);
        window.location.href = '/furrguard/login';
    };

    const signInButton = (label: string) => (
        <Button onClick={signIn} disabled={redirecting}>
            <FontAwesomeIcon icon={faSignInAlt} />
            <span className={'ml-2'}>{redirecting ? t('furrguard.login.redirecting', 'Abriendo Discord…') : label}</span>
        </Button>
    );

    if (error === 'no_access') {
        return (
            <>
                <PageHeader title={t('furrguard.title', 'FurrGuard')} />
                <Card>
                    <Body>
                        <Emblem>
                            <FontAwesomeIcon icon={faUserSlash} />
                        </Emblem>
                        <Title>{t('furrguard.login.no_access_title', 'Sin acceso a FurrGuard')}</Title>
                        <Message>
                            {t(
                                'furrguard.login.no_access',
                                'Esa cuenta de Discord no tiene acceso a FurrGuard. Prueba con otra cuenta.'
                            )}
                        </Message>
                        {signInButton(t('furrguard.login.other_account', 'Usar otra cuenta'))}
                    </Body>
                </Card>
            </>
        );
    }

    const errorText: Record<Exclude<LoginError, 'no_access'> | 'other', string> = {
        cancelled: t('furrguard.login.cancelled', 'Cancelaste el inicio de sesión en Discord.'),
        discord: t('furrguard.login.discord_error', 'Discord no pudo completar el inicio de sesión. Vuelve a intentarlo en un momento.'),
        unreachable: t('furrguard.login.unreachable', 'No se pudo conectar con FurrGuard. Vuelve a intentarlo en un momento.'),
        unavailable: t('furrguard.login.unavailable', 'FurrGuard no está disponible ahora mismo: su base de datos no responde. Inténtalo en unos minutos.'),
        rejected: t(
            'furrguard.login.rejected',
            'FurrGuard ha rechazado la conexión del panel: la clave compartida no coincide, el reloj de alguna de las dos máquinas va desviado o la IP del panel no está autorizada. Avisa a un administrador.'
        ),
        bridge: t(
            'furrguard.login.bridge',
            'FurrGuard no responde como puente: en su servidor revisa PTERODACTYL_URL y PTERODACTYL_PANEL_KEY del .env, la línea de nginx que ejecuta api/panel.php, la aplicación de Discord y que nada (Cloudflare, firewall) bloquee al panel.'
        ),
        rate_limited: t('furrguard.login.rate_limited', 'Demasiados intentos de inicio de sesión. Espera unos minutos.'),
        expired: lostReason === 'access_revoked'
            ? t('furrguard.login.revoked', 'Tu acceso a FurrGuard ha cambiado. Vuelve a entrar con Discord.')
            : t('furrguard.login.expired', 'Tu sesión de FurrGuard ha caducado. Vuelve a entrar con Discord.'),
        other: t('furrguard.login.generic_error', 'No se pudo completar el inicio de sesión. Vuelve a intentarlo.'),
    };

    return (
        <>
            <PageHeader title={t('furrguard.title', 'FurrGuard')} />
            <Card>
                <Body>
                    <Emblem>
                        <FontAwesomeIcon icon={faPaw} />
                    </Emblem>
                    <Title>{t('furrguard.login.title', 'Entra en FurrGuard')}</Title>
                    <Message>
                        {t(
                            'furrguard.login.message',
                            'FurrGuard protege la red de Minecraft: jugadores, conexiones, listas y filtros. Inicia sesión con Discord para entrar con tu rol.'
                        )}
                    </Message>
                    {error && (
                        <Notice $tone={error === 'cancelled' || error === 'expired' ? 'warning' : 'danger'}>
                            <FontAwesomeIcon icon={faExclamationTriangle} />
                            <NoticeBody>{errorText[error]}</NoticeBody>
                        </Notice>
                    )}
                    {signInButton(t('furrguard.login.button', 'Entrar con Discord'))}
                </Body>
            </Card>
        </>
    );
};

export default FurrGuardLoginGate;
