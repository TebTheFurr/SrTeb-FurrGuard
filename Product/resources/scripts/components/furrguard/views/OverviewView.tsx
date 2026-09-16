import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
    faBan,
    faBroadcastTower,
    faBuilding,
    faClipboardCheck,
    faGamepad,
    faGlobeEurope,
    faKey,
    faMap,
    faPlug,
    faRedo,
    faSignal,
} from '@fortawesome/free-solid-svg-icons';
import { furr } from '@/api/furrguard/client';
import { Overview } from '@/api/furrguard/types';
import { Button } from '@/components/elements/button/index';
import PageHeader from '@/components/elements/ui/PageHeader';
import { Notice, NoticeBody } from '@/components/server/vault/vaultStyles';
import { useFurrGuard } from '@/components/furrguard/FurrGuardContext';
import { useLoader } from '@/components/furrguard/hooks';
import { formatDateTime, isOn, timeAgo } from '@/components/furrguard/lib/format';
import { entryLabel, isIpEntry, reasonLabel } from '@/components/furrguard/lib/labels';
import { playerPath, sectionInfo, sectionPath } from '@/components/furrguard/sections';
import {
    Chip,
    CountryTag,
    EmptyState,
    IpText,
    Mono,
    Muted,
    PlayerHead,
    PrimaryLink,
    RowLink,
    RowMain,
    Rows,
    RetryNotice,
    SectionPanel,
    Skeleton,
    Stack,
    StatCard,
    StatsGrid,
    StatusChip,
    SubText,
    TimeText,
    TwoColumns,
} from '@/components/furrguard/ui';

interface HealthNotice {
    tone: 'danger' | 'warning';
    icon: IconDefinition;
    title: string;
    text: string;
    settings?: boolean;
}

const noticesOf = (data: Overview): HealthNotice[] => {
    const { health } = data;
    const list: HealthNotice[] = [];
    if (!health.api_key_configured) {
        list.push({ tone: 'danger', icon: faKey, title: 'Falta la API key', text: 'Los plugins no pueden conectarse hasta que se genere una en Ajustes.', settings: true });
    }
    if (health.ip_api === 'down') {
        list.push({
            tone: 'warning',
            icon: faSignal,
            title: 'Los proveedores de IP no responden',
            text:
                health.geo_mirror === 'ok'
                    ? 'Se usa solo el espejo MaxMind: país, continente y ASN siguen funcionando, pero no se detectan proxy, hosting ni redes móviles.'
                    : 'Y el espejo MaxMind no está disponible: las conexiones nuevas no tienen datos de geolocalización.',
        });
    } else if (health.ip_api === 'limited') {
        list.push({ tone: 'warning', icon: faSignal, title: 'Proveedores de IP limitados', text: 'Se ha agotado el presupuesto por minuto: algunas comprobaciones usan solo caché y MaxMind.' });
    }
    if (health.geo_mirror === 'missing') {
        list.push({ tone: 'warning', icon: faMap, title: 'Falta el espejo MaxMind', text: 'Configura GEOIP_COUNTRY_DB y GEOIP_ASN_DB o ejecuta bin/geoip-update.php en FurrGuard.' });
    } else if (health.geo_mirror === 'disabled') {
        list.push({ tone: 'warning', icon: faMap, title: 'Espejo MaxMind desactivado', text: 'Falta el lector de MaxMind: ejecuta composer install --no-dev en el servidor de FurrGuard.' });
    }

    return list;
};

const OverviewView = () => {
    const { can } = useFurrGuard();
    const info = sectionInfo('overview');
    const { data, loading, error, reload } = useLoader<Overview>((signal) => furr<Overview>('get_overview', {}, signal));

    const link = (section: 'players' | 'connections' | 'whitelist' | 'blacklist' | 'providers' | 'countries' | 'continents', query = '') =>
        can(section) ? `${sectionPath(section)}${query}` : undefined;

    return (
        <Stack>
            <PageHeader
                title={info.label}
                description={info.description}
                actions={
                    <Button size={Button.Sizes.Small} variant={Button.Variants.Secondary} onClick={reload} disabled={loading}>
                        <FontAwesomeIcon icon={faRedo} spin={loading && !!data} />
                        <span className={'ml-2'}>Actualizar</span>
                    </Button>
                }
            />

            {error && !data ? (
                <RetryNotice title={'No se pudo cargar el resumen'} message={error.message} onRetry={reload} />
            ) : !data ? (
                <Skeleton rows={4} />
            ) : (
                <>
                    {noticesOf(data).map((notice) => (
                        <Notice key={notice.title} $tone={notice.tone} role={'status'}>
                            <FontAwesomeIcon icon={notice.icon} />
                            <NoticeBody>
                                <strong>{notice.title}</strong>
                                <p>{notice.text}</p>
                            </NoticeBody>
                            {notice.settings && can('settings') && (
                                <PrimaryLink to={sectionPath('settings')}>Ir a Ajustes</PrimaryLink>
                            )}
                        </Notice>
                    ))}

                    <StatsGrid>
                        <StatCard label={'Jugadores online'} value={data.online_players} icon={faBroadcastTower} tone={'ok'} to={link('players', '?filter=online')} />
                        <StatCard label={'Jugadores registrados'} value={data.total_players} icon={faGamepad} to={link('players')} />
                        <StatCard label={'Conexiones 24 h'} value={data.connections_24h} icon={faPlug} to={link('connections')} />
                        <StatCard label={'Bloqueos 24 h'} value={data.blocked_24h} icon={faBan} tone={'down'} to={link('connections', '?filter=blocked')} />
                    </StatsGrid>

                    <StatsGrid $min={140}>
                        <StatCard label={'Whitelist'} value={data.counts.whitelist} icon={faClipboardCheck} to={link('whitelist')} />
                        <StatCard label={'Blacklist'} value={data.counts.blacklist} icon={faBan} to={link('blacklist')} />
                        <StatCard label={'Proveedores'} value={data.counts.providers} icon={faBuilding} to={link('providers')} />
                        <StatCard label={'Países'} value={data.counts.countries} icon={faMap} to={link('countries')} />
                        <StatCard label={'Continentes'} value={data.counts.continents} icon={faGlobeEurope} to={link('continents')} />
                    </StatsGrid>

                    <TwoColumns>
                        <SectionPanel icon={faPlug} title={'Conexiones recientes'}>
                            {data.recent_connections.length === 0 ? (
                                <EmptyState icon={faPlug} title={'Sin conexiones recientes'} />
                            ) : (
                                <Rows>
                                    {data.recent_connections.map((item, index) => (
                                        <li key={item.id ?? index} className={isOn(item.blocked) ? 'blocked' : undefined}>
                                            <PlayerHead id={item.uuid ?? ''} name={item.nick} />
                                            <RowMain>
                                                {item.uuid && can('players') ? <RowLink to={playerPath(item.uuid)}>{item.nick}</RowLink> : <strong>{item.nick}</strong>}
                                                <SubText>
                                                    <IpText ip={item.ip} /> · <CountryTag code={item.country_code} name={item.country} />
                                                </SubText>
                                            </RowMain>
                                            <StatusChip {...reasonLabel(isOn(item.blocked) ? item.block_reason : 'allowed')} />
                                            <TimeText dateTime={item.created_at} title={formatDateTime(item.created_at)}>
                                                {timeAgo(item.created_at)}
                                            </TimeText>
                                        </li>
                                    ))}
                                </Rows>
                            )}
                        </SectionPanel>

                        <SectionPanel icon={faBan} title={'Baneos recientes'}>
                            {data.recent_blocks.length === 0 ? (
                                <EmptyState icon={faBan} title={'Sin baneos recientes'} />
                            ) : (
                                <Rows>
                                    {data.recent_blocks.map((item, index) => (
                                        <li key={item.id ?? index}>
                                            <Chip>{entryLabel(item.type)}</Chip>
                                            <RowMain>
                                                {isIpEntry(item.type) ? <IpText ip={item.value} /> : <Mono className={'font-medium'}>{item.minecraft_name || item.value}</Mono>}
                                                <SubText>{item.reason || <Muted>Sin motivo</Muted>}</SubText>
                                            </RowMain>
                                            <TimeText dateTime={item.created_at} title={formatDateTime(item.created_at)}>
                                                {timeAgo(item.created_at)}
                                            </TimeText>
                                        </li>
                                    ))}
                                </Rows>
                            )}
                        </SectionPanel>
                    </TwoColumns>
                </>
            )}
        </Stack>
    );
};

export default OverviewView;
