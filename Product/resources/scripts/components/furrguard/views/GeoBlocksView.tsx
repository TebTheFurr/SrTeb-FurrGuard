import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBan, faCheck, faEdit, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { furr } from '@/api/furrguard/client';
import { Flag, Num } from '@/api/furrguard/types';
import { Button } from '@/components/elements/button/index';
import Input from '@/components/elements/Input';
import Select from '@/components/elements/Select';
import PageHeader from '@/components/elements/ui/PageHeader';
import { useFurrGuard } from '@/components/furrguard/FurrGuardContext';
import { ConfirmDialog, Field, FormDialog } from '@/components/furrguard/dialogs/FormDialog';
import { TextAreaField } from '@/components/furrguard/dialogs/fields';
import { useBusy, useConfirm, usePagedList } from '@/components/furrguard/hooks';
import { formatNumber, isOn } from '@/components/furrguard/lib/format';
import { sectionInfo } from '@/components/furrguard/sections';
import { ActiveSwitch, IconButton, ListFrame, McPreview, Mono, Muted, RowActions, SearchBox, Stack, StatCard, StatsGrid } from '@/components/furrguard/ui';

type Kind = 'country' | 'continent';
type GeoRow = { id: number; kick_message: string | null; block_count: Num; active: Flag } & Record<string, unknown>;

const CONTINENTS = [
    { code: 'AF', name: 'África' },
    { code: 'AN', name: 'Antártida' },
    { code: 'AS', name: 'Asia' },
    { code: 'EU', name: 'Europa' },
    { code: 'NA', name: 'Norteamérica' },
    { code: 'OC', name: 'Oceanía' },
    { code: 'SA', name: 'Sudamérica' },
];

/** Countries and continents: the same view, only the field prefix and actions change (§4.4). */
const GeoBlocksView = ({ kind }: { kind: Kind }) => {
    const { notify } = useFurrGuard();
    const info = sectionInfo(kind === 'country' ? 'countries' : 'continents');
    const one = kind === 'country' ? 'país' : 'continente';
    const list = usePagedList<GeoRow, { search: string }>({
        action: kind === 'country' ? 'get_countries' : 'get_continents',
        filters: { search: '' },
        legacyKey: kind === 'country' ? 'countries' : 'continents',
    });
    const { busy, run } = useBusy();
    const { confirm, pending, settle } = useConfirm();
    const stats = (list.data.stats ?? {}) as Record<string, unknown>;

    const codeOf = (row: GeoRow): string => String(row[`${kind}_code`] ?? '');
    const nameOf = (row: GeoRow): string => String(row[`${kind}_name`] ?? '');

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<GeoRow | null>(null);
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [kickMessage, setKickMessage] = useState('');

    const openDialog = (row: GeoRow | null) => {
        setEditing(row);
        setCode(row ? codeOf(row) : '');
        setName(row ? nameOf(row) : '');
        setKickMessage(row?.kick_message ?? '');
        setDialogOpen(true);
    };

    const pickContinent = (value: string) => {
        setCode(value);
        const known = CONTINENTS.find((c) => c.code === value);
        if (known) setName(known.name);
    };

    const submit = async () => {
        const upper = code.trim().toUpperCase();
        if (!/^[A-Z]{2}$/.test(upper) || !name.trim()) throw new Error(`Escribe el código de ${one} (2 letras) y su nombre.`);
        const fields = { [`${kind}_name`]: name.trim(), kick_message: kickMessage.trim() };
        if (editing) await furr(`edit_${kind}`, { id: editing.id, ...fields });
        else await furr(`add_${kind}`, { [`${kind}_code`]: upper, ...fields });
        notify(editing ? 'Cambios guardados.' : `${kind === 'country' ? 'País' : 'Continente'} bloqueado.`, 'success');
        setDialogOpen(false);
        list.reload();
    };

    const toggle = async (row: GeoRow, active: boolean) => {
        if (await run(row.id, () => furr(`toggle_${kind}`, { id: row.id, active }), active ? 'Bloqueo activado.' : 'Bloqueo desactivado.')) list.reload();
    };

    const remove = async (row: GeoRow) => {
        const ok = await confirm({ title: `Desbloquear ${one}`, message: `Se eliminará el bloqueo de ${nameOf(row)} (${codeOf(row)}).`, confirmText: 'Eliminar' });
        if (ok && (await run(row.id, () => furr(`delete_${kind}`, { id: row.id }), 'Bloqueo eliminado.'))) list.reload();
    };

    return (
        <Stack>
            <PageHeader
                title={info.label}
                description={info.description}
                actions={
                    <Button onClick={() => openDialog(null)}>
                        <FontAwesomeIcon icon={faPlus} />
                        <span className={'ml-2'}>Bloquear {one}</span>
                    </Button>
                }
            />

            <StatsGrid $min={140}>
                <StatCard label={'Bloqueados'} value={stats.total} icon={info.icon} />
                <StatCard label={'Activos'} value={stats.active} icon={faCheck} tone={'ok'} />
                <StatCard label={'Expulsiones'} value={stats.total_blocks} icon={faBan} tone={'down'} />
            </StatsGrid>

            <ListFrame
                list={list}
                label={info.label}
                emptyIcon={info.icon}
                emptyTitle={`No hay ningún ${one} bloqueado`}
                toolbar={<SearchBox value={list.filters.search} onChange={(value) => list.setFilter('search', value)} label={`Buscar ${info.label.toLowerCase()}`} placeholder={'Código o nombre…'} />}
            >
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Nombre</th>
                        <th>Mensaje propio</th>
                        <th className={'right'}>Expulsiones</th>
                        <th>Activo</th>
                        <th className={'actions'}>
                            <span className={'sr-only'}>Acciones</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {list.items.map((row) => (
                        <tr key={row.id}>
                            <td>
                                <Mono>{codeOf(row)}</Mono>
                            </td>
                            <td>{nameOf(row)}</td>
                            <td className={'text'}>{row.kick_message || <Muted>Mensaje genérico</Muted>}</td>
                            <td className={'right'}>{formatNumber(row.block_count)}</td>
                            <td>
                                <ActiveSwitch active={isOn(row.active)} busy={busy === row.id} label={`Bloqueo de ${nameOf(row)} activo`} onChange={(active) => toggle(row, active)} />
                            </td>
                            <td className={'actions'}>
                                <RowActions>
                                    <IconButton icon={faEdit} label={`Editar ${nameOf(row)}`} onClick={() => openDialog(row)} />
                                    <IconButton icon={faTrash} label={`Eliminar ${nameOf(row)}`} danger onClick={() => remove(row)} />
                                </RowActions>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </ListFrame>

            <FormDialog open={dialogOpen} title={editing ? `Editar ${one}` : `Bloquear ${one}`} onClose={() => setDialogOpen(false)} onSubmit={submit}>
                <div className={'grid grid-cols-1 sm:grid-cols-3 gap-4'}>
                    <Field label={'Código'} htmlFor={'geo-code'}>
                        {kind === 'continent' ? (
                            <Select id={'geo-code'} value={code} onChange={(event) => pickContinent(event.currentTarget.value)} disabled={!!editing}>
                                <option value={''} disabled>
                                    Elige…
                                </option>
                                {CONTINENTS.map((c) => (
                                    <option key={c.code} value={c.code}>
                                        {c.code} · {c.name}
                                    </option>
                                ))}
                            </Select>
                        ) : (
                            <Input id={'geo-code'} value={code} onChange={(event) => setCode(event.currentTarget.value)} maxLength={2} placeholder={'ES'} disabled={!!editing} className={'font-mono'} autoFocus />
                        )}
                    </Field>
                    <div className={'sm:col-span-2'}>
                        <Field label={'Nombre'} htmlFor={'geo-name'}>
                            <Input id={'geo-name'} value={name} onChange={(event) => setName(event.currentTarget.value)} maxLength={100} />
                        </Field>
                    </div>
                </div>
                <TextAreaField
                    id={'geo-kick'}
                    label={'Mensaje de expulsión'}
                    value={kickMessage}
                    onChange={setKickMessage}
                    rows={4}
                    maxLength={2000}
                    help={'Admite códigos & y §. Vacío = mensaje genérico de Mensajes.'}
                    optional
                    mono
                />
                {kickMessage && <McPreview text={kickMessage} label={'Vista previa'} />}
            </FormDialog>
            <ConfirmDialog pending={pending} onSettle={settle} />
        </Stack>
    );
};

export default GeoBlocksView;
