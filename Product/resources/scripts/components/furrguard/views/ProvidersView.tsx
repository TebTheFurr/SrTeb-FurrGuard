import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faEyeSlash, faPlus, faServer, faTrash, faUserSecret } from '@fortawesome/free-solid-svg-icons';
import { furr } from '@/api/furrguard/client';
import { ProviderRow, ProviderType } from '@/api/furrguard/types';
import { Button } from '@/components/elements/button/index';
import Input from '@/components/elements/Input';
import Select from '@/components/elements/Select';
import PageHeader from '@/components/elements/ui/PageHeader';
import { useFurrGuard } from '@/components/furrguard/FurrGuardContext';
import { ConfirmDialog, Field, FormDialog } from '@/components/furrguard/dialogs/FormDialog';
import { useBusy, useConfirm, usePagedList } from '@/components/furrguard/hooks';
import { formatNumber, isOn } from '@/components/furrguard/lib/format';
import { sectionInfo } from '@/components/furrguard/sections';
import { ActiveSwitch, FilterTabs, IconButton, ListFrame, Mono, SearchBox, Stack, StatCard, StatsGrid, StatusChip } from '@/components/furrguard/ui';

const TYPES: Record<ProviderType, { label: string; icon: typeof faServer }> = {
    hosting: { label: 'Hosting', icon: faServer },
    vpn: { label: 'VPN', icon: faEyeSlash },
    proxy: { label: 'Proxy', icon: faUserSecret },
};

const TYPE_TABS = [{ value: '', label: 'Todos' }, ...(Object.keys(TYPES) as ProviderType[]).map((value) => ({ value, ...TYPES[value] }))];

const ProvidersView = () => {
    const { notify } = useFurrGuard();
    const info = sectionInfo('providers');
    const list = usePagedList<ProviderRow, { type: string; search: string }>({
        action: 'get_providers',
        filters: { type: '', search: '' },
        allowed: { type: TYPE_TABS.map((t) => t.value) },
    });
    const { busy, run } = useBusy();
    const { confirm, pending, settle } = useConfirm();
    const stats = (list.data.stats ?? {}) as Record<string, unknown>;

    const [dialogOpen, setDialogOpen] = useState(false);
    const [name, setName] = useState('');
    const [pattern, setPattern] = useState('');
    const [type, setType] = useState<ProviderType>('hosting');

    const openDialog = () => {
        setName('');
        setPattern('');
        setType('hosting');
        setDialogOpen(true);
    };

    const submit = async () => {
        if (!name.trim() || pattern.trim().length < 3) throw new Error('Escribe un nombre y un patrón de al menos 3 caracteres.');
        await furr('add_provider', { name: name.trim(), pattern: pattern.trim(), type });
        notify('Proveedor añadido.', 'success');
        setDialogOpen(false);
        list.reload();
    };

    const toggle = async (row: ProviderRow, active: boolean) => {
        if (await run(row.id, () => furr('toggle_provider', { id: row.id, active }), active ? 'Proveedor activado.' : 'Proveedor desactivado.')) list.reload();
    };

    const remove = async (row: ProviderRow) => {
        const ok = await confirm({ title: 'Eliminar proveedor', message: `Se eliminará «${row.name}» (${row.pattern}).`, confirmText: 'Eliminar' });
        if (ok && (await run(row.id, () => furr('delete_provider', { id: row.id }), 'Proveedor eliminado.'))) list.reload();
    };

    return (
        <Stack>
            <PageHeader
                title={info.label}
                description={info.description}
                actions={
                    <Button onClick={openDialog}>
                        <FontAwesomeIcon icon={faPlus} />
                        <span className={'ml-2'}>Añadir</span>
                    </Button>
                }
            />

            <StatsGrid $min={140}>
                <StatCard label={'Hosting'} value={stats.hosting} icon={faServer} />
                <StatCard label={'VPN'} value={stats.vpn} icon={faEyeSlash} />
                <StatCard label={'Proxy'} value={stats.proxy} icon={faUserSecret} />
            </StatsGrid>

            <ListFrame
                list={list}
                label={'Proveedores bloqueados'}
                emptyIcon={faBuilding}
                emptyTitle={'No hay proveedores con este filtro'}
                toolbar={
                    <>
                        <FilterTabs value={list.filters.type} onChange={(value) => list.setFilter('type', value)} options={TYPE_TABS} label={'Filtrar por tipo'} />
                        <SearchBox value={list.filters.search} onChange={(value) => list.setFilter('search', value)} label={'Buscar proveedores'} placeholder={'Nombre o patrón…'} />
                    </>
                }
            >
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Patrón</th>
                        <th>Tipo</th>
                        <th className={'right'}>Bloqueos</th>
                        <th>Activo</th>
                        <th className={'actions'}>
                            <span className={'sr-only'}>Acciones</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {list.items.map((row) => (
                        <tr key={row.id}>
                            <td>{row.name}</td>
                            <td>
                                <Mono>{row.pattern}</Mono>
                            </td>
                            <td>
                                <StatusChip label={TYPES[row.type]?.label ?? row.type} icon={TYPES[row.type]?.icon ?? faBuilding} />
                            </td>
                            <td className={'right'}>{formatNumber(row.block_count)}</td>
                            <td>
                                <ActiveSwitch active={isOn(row.active)} busy={busy === row.id} label={`Proveedor ${row.name} activo`} onChange={(active) => toggle(row, active)} />
                            </td>
                            <td className={'actions'}>
                                <IconButton icon={faTrash} label={`Eliminar ${row.name}`} danger onClick={() => remove(row)} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </ListFrame>

            <FormDialog open={dialogOpen} title={'Añadir proveedor'} submitLabel={'Añadir'} onClose={() => setDialogOpen(false)} onSubmit={submit}>
                <Field label={'Nombre'} htmlFor={'provider-name'}>
                    <Input id={'provider-name'} value={name} onChange={(event) => setName(event.currentTarget.value)} maxLength={255} autoFocus />
                </Field>
                <Field label={'Patrón'} htmlFor={'provider-pattern'} help={'Texto que se busca (sin distinguir mayúsculas) en el ISP, la organización y el AS.'}>
                    <Input id={'provider-pattern'} value={pattern} onChange={(event) => setPattern(event.currentTarget.value)} maxLength={255} placeholder={'ovh'} className={'font-mono'} />
                </Field>
                <Field label={'Tipo'} htmlFor={'provider-type'}>
                    <Select id={'provider-type'} value={type} onChange={(event) => setType(event.currentTarget.value as ProviderType)}>
                        {(Object.keys(TYPES) as ProviderType[]).map((value) => (
                            <option key={value} value={value}>
                                {TYPES[value].label}
                            </option>
                        ))}
                    </Select>
                </Field>
            </FormDialog>
            <ConfirmDialog pending={pending} onSettle={settle} />
        </Stack>
    );
};

export default ProvidersView;
