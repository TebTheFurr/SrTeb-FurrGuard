import React from 'react';
import { faScroll } from '@fortawesome/free-solid-svg-icons';
import { LogRow } from '@/api/furrguard/types';
import PageHeader from '@/components/elements/ui/PageHeader';
import { usePagedList } from '@/components/furrguard/hooks';
import { formatDateTime, timeAgo } from '@/components/furrguard/lib/format';
import { LOG_TYPES, logTypeLabel } from '@/components/furrguard/lib/labels';
import { sectionInfo } from '@/components/furrguard/sections';
import { CompactSelect, IpText, ListFrame, SearchBox, Stack, StatusChip, TextWithIps } from '@/components/furrguard/ui';

const LogsView = () => {
    const info = sectionInfo('logs');
    const list = usePagedList<LogRow, { type: string; search: string }>({
        action: 'get_logs',
        filters: { type: '', search: '' },
        allowed: { type: ['', ...LOG_TYPES.map((t) => t.value)] },
        perPage: 50,
    });

    return (
        <Stack>
            <PageHeader title={info.label} description={info.description} />
            <ListFrame
                list={list}
                label={'Registro de actividad'}
                emptyIcon={faScroll}
                emptyTitle={'No hay entradas con este filtro'}
                toolbar={
                    <>
                        <CompactSelect aria-label={'Tipo'} value={list.filters.type} onChange={(event) => list.setFilter('type', event.currentTarget.value)}>
                            <option value={''}>Todos los tipos</option>
                            {LOG_TYPES.map((type) => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </CompactSelect>
                        <SearchBox value={list.filters.search} onChange={(value) => list.setFilter('search', value)} label={'Buscar en el registro'} placeholder={'Acción o detalle…'} />
                    </>
                }
            >
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Acción</th>
                        <th>Detalles</th>
                        <th>IP</th>
                    </tr>
                </thead>
                <tbody>
                    {list.items.map((row) => (
                        <tr key={row.id}>
                            <td className={'nowrap'} title={timeAgo(row.created_at)}>
                                {formatDateTime(row.created_at)}
                            </td>
                            <td>
                                <StatusChip {...logTypeLabel(row.type)} />
                            </td>
                            <td>{row.action}</td>
                            <td className={'text'}>
                                <TextWithIps text={row.details} />
                            </td>
                            <td>
                                <IpText ip={row.ip_address} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </ListFrame>
        </Stack>
    );
};

export default LogsView;
