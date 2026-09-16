import React, { useEffect, useState } from 'react';
import useVaultTranslation from '@/components/server/vault/useVaultTranslation';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { httpErrorToHuman } from '@/api/http';
import { Cursor, EventoServidor, getVaultActivity } from '@/api/server/vault';
import { Button } from '@/components/elements/button/index';
import Spinner from '@/components/elements/Spinner';
import EmptyState from '@/components/elements/EmptyState';
import Panel, { PanelHeader, PanelList } from '@/components/elements/ui/Panel';
import { PrivacyBlurSurface } from '@/components/elements/PrivacyServerHostBlur';
import { faStream } from '@fortawesome/free-solid-svg-icons';
import { useVault } from '@/components/server/vault/VaultContext';
import { formatDateTime, formatRelative, humanizeCode, formatBytes } from '@/components/server/vault/vaultFormat';
import { Chip, Footer, Mono, Muted, Notice, NoticeBody } from '@/components/server/vault/vaultStyles';

const PAGE_SIZE = 50;

const Item = styled.div`
    ${tw`flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 py-3 text-sm`};
`;

const Main = styled.div`
    ${tw`flex-1 min-w-0 flex flex-col gap-1`};
`;

const Headline = styled.div`
    ${tw`flex flex-wrap items-center gap-2`};
    color: var(--color-base);
`;

const Path = styled.div`
    ${tw`text-xs truncate`};
    color: var(--color-muted);
`;

const Side = styled.div`
    ${tw`flex flex-wrap items-center gap-3 text-xs sm:justify-end`};
    color: var(--color-muted);
`;

const Padded = styled.div`
    ${tw`p-4`};
`;

interface State {
    status: 'loading' | 'ready' | 'error';
    entradas: EventoServidor[];
    siguiente: Cursor | null;
    error: string | null;
}

const VaultActivity = () => {
    const { t, locale } = useVaultTranslation();
    const { uuid, listingVersion, interceptError, reportError } = useVault();
    const [state, setState] = useState<State>({ status: 'loading', entradas: [], siguiente: null, error: null });
    const [loadingMore, setLoadingMore] = useState(false);

    const actions: Record<string, string> = {
        login_panel: t('vault.activity.actions.login_panel', 'Inicio de sesión desde el panel'),
        login_panel_denegado: t('vault.activity.actions.login_panel_denegado', 'Acceso denegado'),
        logout: t('vault.activity.actions.logout', 'Cierre de sesión'),
        download: t('vault.activity.actions.download', 'Descarga'),
        download_zip: t('vault.activity.actions.download_zip', 'Descarga en ZIP'),
        descargar: t('vault.activity.actions.download', 'Descarga'),
        zip: t('vault.activity.actions.download_zip', 'Descarga en ZIP'),
        restaurar: t('vault.activity.actions.restaurar', 'Restauración'),
        sincronizar: t('vault.activity.actions.sincronizar', 'Sincronización'),
        backup_manual: t('vault.activity.actions.backup_manual', 'M-Backup creada'),
        backup_diaria: t('vault.activity.actions.backup_diaria', 'Copia diaria'),
        borrar_backup: t('vault.activity.actions.borrar_backup', 'Copia borrada'),
        delete: t('vault.activity.actions.borrar_backup', 'Copia borrada'),
        fijar: t('vault.activity.actions.fijar', 'Copia fijada'),
        desfijar: t('vault.activity.actions.desfijar', 'Copia desfijada'),
        exclusiones: t('vault.activity.actions.exclusiones', 'Exclusiones cambiadas'),
        cancelar: t('vault.activity.actions.cancelar', 'Trabajo cancelado'),
        importar: t('vault.activity.actions.importar', 'Copia importada'),
    };

    useEffect(() => {
        let cancelled = false;
        setState((current) => ({ ...current, status: 'loading', error: null }));

        getVaultActivity(uuid, { limite: PAGE_SIZE })
            .then((page) => {
                if (cancelled) return;
                setState({ status: 'ready', entradas: page.entradas, siguiente: page.siguiente, error: null });
            })
            .catch((error) => {
                if (cancelled || interceptError(error)) return;
                setState({ status: 'error', entradas: [], siguiente: null, error: httpErrorToHuman(error) });
            });

        return () => {
            cancelled = true;
        };
    }, [uuid, listingVersion]);

    const loadMore = () => {
        if (state.siguiente === null) return;

        setLoadingMore(true);
        getVaultActivity(uuid, { cursor: state.siguiente, limite: PAGE_SIZE })
            .then((page) =>
                setState((current) => ({
                    ...current,
                    entradas: [...current.entradas, ...page.entradas],
                    siguiente: page.siguiente,
                }))
            )
            .catch(reportError)
            .then(() => setLoadingMore(false));
    };

    return (
        <Panel>
            <PanelHeader
                icon={faStream}
                title={t('vault.activity.title', 'Actividad del Vault')}
                hint={t('vault.activity.hint', 'Todo lo que ha leído o modificado las copias de este servidor.')}
            />
            {state.status === 'loading' && state.entradas.length === 0 ? (
                <Padded>
                    <Spinner size={'base'} />
                </Padded>
            ) : state.status === 'error' ? (
                <Padded>
                    <Notice $tone={'danger'}>
                        <NoticeBody>{state.error}</NoticeBody>
                    </Notice>
                </Padded>
            ) : state.entradas.length === 0 ? (
                <Padded>
                    <EmptyState
                        title={t('vault.activity.empty_title', 'Todavía no hay actividad')}
                        message={t('vault.activity.empty', 'Aquí aparecerán las descargas, restauraciones y copias.')}
                    />
                </Padded>
            ) : (
                <PanelList>
                    {state.entradas.map((evento) => (
                        <Item key={String(evento.id)}>
                            <Main>
                                <Headline>
                                    <strong>{evento.usuario?.nombre || t('vault.activity.system', 'Sistema')}</strong>
                                    <Chip $tone={evento.ok ? 'neutral' : 'danger'}>
                                        {actions[evento.accion] || humanizeCode(evento.accion)}
                                    </Chip>
                                    {!evento.ok && <Chip $tone={'danger'}>{t('vault.activity.failed', 'Fallido')}</Chip>}
                                </Headline>
                                {(evento.carpeta || evento.ruta || evento.detalle) && (
                                    <Path title={[evento.carpeta, evento.ruta].filter(Boolean).join('/')}>
                                        {(evento.carpeta || evento.ruta) && (
                                            <Mono>{[evento.carpeta, evento.ruta].filter(Boolean).join('/')}</Mono>
                                        )}
                                        {evento.detalle && <Muted> {evento.detalle}</Muted>}
                                    </Path>
                                )}
                            </Main>
                            <Side>
                                {evento.bytes > 0 && <span>{formatBytes(evento.bytes, locale)}</span>}
                                {evento.ip && <PrivacyBlurSurface>{evento.ip}</PrivacyBlurSurface>}
                                <span title={formatDateTime(evento.ts, locale)}>{formatRelative(evento.ts, locale)}</span>
                            </Side>
                        </Item>
                    ))}
                </PanelList>
            )}
            {state.siguiente !== null && state.entradas.length > 0 && (
                <Footer>
                    <span />
                    <Button size={Button.Sizes.Small} variant={Button.Variants.Secondary} onClick={loadMore} disabled={loadingMore}>
                        {t('vault.explorer.load_more', 'Cargar más')}
                    </Button>
                </Footer>
            )}
        </Panel>
    );
};

export default VaultActivity;
