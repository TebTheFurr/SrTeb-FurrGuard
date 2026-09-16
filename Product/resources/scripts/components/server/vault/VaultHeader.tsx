import React, { useState } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
    faCalendarAlt,
    faClock,
    faExclamationTriangle,
    faEye,
    faHdd,
    faHistory,
    faPlus,
    faShieldAlt,
    faSignOutAlt,
    faSync,
    faUndoAlt,
    faUser,
    faUserShield,
} from '@fortawesome/free-solid-svg-icons';
import { logoutVault, Nivel, syncVault } from '@/api/server/vault';
import { ServerContext } from '@/state/server';
import { Button } from '@/components/elements/button/index';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import PageHeader from '@/components/elements/ui/PageHeader';
import StatTile from '@/components/elements/ui/StatTile';
import { percentOf } from '@/components/elements/ui/tokens';
import { useVault } from '@/components/server/vault/VaultContext';
import useVaultTranslation from '@/components/server/vault/useVaultTranslation';
import { formatBytes, formatDateTime, formatRelative } from '@/components/server/vault/vaultFormat';
import { ButtonLabel, Chip, Notice, NoticeBody, StatsGrid, Tone } from '@/components/server/vault/vaultStyles';

const TitleLine = styled.span`
    ${tw`inline-flex items-baseline gap-2 max-w-full`};
`;

const TitleIcon = styled.span`
    ${tw`self-center text-base`};
    color: var(--color-primary);
    opacity: 0.8;
`;

const ServerName = styled.span`
    ${tw`text-base font-normal truncate`};
    color: var(--color-muted);
`;

const IdentityChip = styled(Chip)`
    ${tw`pr-0.5`};
    color: var(--color-base);
`;

const Avatar = styled.img`
    ${tw`w-4 h-4 rounded-full object-cover flex-shrink-0`};
`;

const IdentityName = styled.span`
    ${tw`truncate`};
    max-width: 12rem;
`;

const SignOutButton = styled.button`
    ${tw`flex items-center justify-center w-5 h-5 ml-0.5 rounded-full transition-colors duration-150`};
    color: var(--color-muted);

    svg {
        font-size: 0.6rem;
    }

    &:hover:not(:disabled),
    &:focus-visible {
        color: var(--color-base);
        background-color: var(--color-neutral);
    }

    &:disabled {
        ${tw`cursor-not-allowed opacity-50`};
    }
`;

const LEVEL_TONES: Record<Nivel, Tone | 'neutral'> = { ver: 'neutral', restaurar: 'info', gestionar: 'success' };
const LEVEL_ICONS: Record<Nivel, IconDefinition> = { ver: faEye, restaurar: faUndoAlt, gestionar: faUserShield };

/** Only Discord CDN style https URLs are rendered as images. */
const safeAvatar = (url: string): string | null => (/^https:\/\//i.test(url) ? url : null);

interface Props {
    onSignedOut: () => void;
}

const VaultHeader = ({ onSignedOut }: Props) => {
    const { t, locale } = useVaultTranslation();
    const { uuid, resumen, canManage, jobActive, startJob, reportError, openCreateBackup } = useVault();
    const serverName = ServerContext.useStoreState((state) => state.server.data!.name);
    const [syncing, setSyncing] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const [avatarFailed, setAvatarFailed] = useState(false);

    const levelNames: Record<Nivel, string> = {
        ver: t('vault.levels.ver', 'Solo ver'),
        restaurar: t('vault.levels.restaurar', 'Restaurar'),
        gestionar: t('vault.levels.gestionar', 'Gestionar'),
    };

    const onSync = () => {
        setSyncing(true);
        syncVault(uuid)
            .then(startJob)
            .catch(reportError)
            .then(() => setSyncing(false));
    };

    const onSignOut = () => {
        setSigningOut(true);
        logoutVault(uuid)
            .then(onSignedOut)
            .catch((error) => {
                setSigningOut(false);
                reportError(error);
            });
    };

    const { cuota, ultima_diaria: lastDaily, proxima_diaria_ts: nextDaily, ultima_sync_ts: lastSync, usuario } = resumen;
    const avatar = avatarFailed ? null : safeAvatar(usuario.avatar || '');
    const busyHint = jobActive ? t('vault.actions.busy', 'Ya hay otro trabajo del Vault en marcha') : undefined;
    const signOutLabel = t('vault.actions.sign_out', 'Cerrar sesión de Discord');
    const days = resumen.retencion_dias;

    const timeValue = (timestamp: number | null, empty: string) =>
        timestamp ? <span title={formatDateTime(timestamp, locale)}>{formatRelative(timestamp, locale)}</span> : empty;
    const timeHint = (timestamp: number | null) => (timestamp ? formatDateTime(timestamp, locale) : undefined);
    const never = t('vault.stats.never', 'Nunca');

    return (
        <>
            <PageHeader
                title={
                    <TitleLine>
                        <TitleIcon>
                            <FontAwesomeIcon icon={faShieldAlt} />
                        </TitleIcon>
                        {t('vault.title', 'Vault')}
                        <ServerName title={serverName}>{serverName}</ServerName>
                    </TitleLine>
                }
                meta={
                    <>
                        <Chip $tone={LEVEL_TONES[resumen.nivel]} title={t('vault.header.level_hint', 'Tu nivel de acceso a este Vault')}>
                            <FontAwesomeIcon icon={LEVEL_ICONS[resumen.nivel]} />
                            {t('vault.header.level', 'Nivel: {{level}}', { level: levelNames[resumen.nivel] })}
                        </Chip>
                        <IdentityChip title={t('vault.header.discord', 'Cuenta de Discord')}>
                            {avatar ? (
                                <Avatar src={avatar} alt={''} referrerPolicy={'no-referrer'} onError={() => setAvatarFailed(true)} />
                            ) : (
                                <FontAwesomeIcon icon={faUser} />
                            )}
                            <IdentityName>{usuario.nombre}</IdentityName>
                            <Tooltip placement={'top'} content={signOutLabel}>
                                <SignOutButton type={'button'} onClick={onSignOut} disabled={signingOut} aria-label={signOutLabel}>
                                    <FontAwesomeIcon icon={faSignOutAlt} />
                                </SignOutButton>
                            </Tooltip>
                        </IdentityChip>
                        <Chip>
                            <FontAwesomeIcon icon={faHistory} />
                            {days === 1
                                ? t('vault.header.retention_one', 'Copias diarias: 1 día')
                                : t('vault.header.retention', 'Copias diarias: {{days}} días', { days })}
                        </Chip>
                    </>
                }
                actions={
                    canManage ? (
                        <>
                            <Button onClick={openCreateBackup} disabled={jobActive} title={busyHint}>
                                <FontAwesomeIcon icon={faPlus} />
                                <ButtonLabel>{t('vault.actions.create_mbackup', 'Crear M-Backup')}</ButtonLabel>
                            </Button>
                            <Button
                                variant={Button.Variants.Secondary}
                                onClick={onSync}
                                disabled={jobActive || syncing}
                                title={busyHint || t('vault.actions.sync_hint', 'Actualiza ahora los espejos Global y Mundos')}
                            >
                                <FontAwesomeIcon icon={faSync} spin={syncing} />
                                <ButtonLabel>{t('vault.actions.sync_now', 'Sincronizar ahora')}</ButtonLabel>
                            </Button>
                        </>
                    ) : undefined
                }
            />
            <StatsGrid>
                <StatTile
                    icon={faHdd}
                    label={t('vault.stats.storage', 'Espacio')}
                    value={formatBytes(cuota.usado, locale)}
                    limit={cuota.total > 0 ? formatBytes(cuota.total, locale) : undefined}
                    percentage={cuota.total > 0 ? percentOf(cuota.usado, cuota.total) : null}
                    hideLimit={cuota.total <= 0}
                    hint={cuota.total > 0 ? undefined : t('vault.stats.unlimited', 'sin límite')}
                />
                <StatTile
                    icon={faHistory}
                    label={t('vault.stats.last_daily', 'Última copia diaria')}
                    value={timeValue(lastDaily ? lastDaily.creado_ts : null, never)}
                    hint={timeHint(lastDaily ? lastDaily.creado_ts : null)}
                    hideLimit
                />
                <StatTile
                    icon={faCalendarAlt}
                    label={t('vault.stats.next_daily', 'Próxima copia diaria')}
                    value={timeValue(nextDaily, '—')}
                    hint={timeHint(nextDaily)}
                    hideLimit
                />
                <StatTile
                    icon={faClock}
                    label={t('vault.stats.last_sync', 'Última sincronización')}
                    value={timeValue(lastSync, never)}
                    hint={timeHint(lastSync)}
                    hideLimit
                />
            </StatsGrid>
            {cuota.superada && (
                <Notice $tone={'danger'} className={'mb-4'}>
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                    <NoticeBody>
                        <strong>{t('vault.quota.exceeded_title', 'Cuota de almacenamiento superada')}</strong>
                        <p>
                            {t(
                                'vault.quota.exceeded',
                                'Las sincronizaciones y copias nuevas se rechazan hasta liberar espacio. Descargar, restaurar y borrar copias sigue funcionando.'
                            )}
                        </p>
                    </NoticeBody>
                </Notice>
            )}
        </>
    );
};

export default VaultHeader;
