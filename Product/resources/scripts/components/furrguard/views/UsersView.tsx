import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faUserPlus, faUsers } from '@fortawesome/free-solid-svg-icons';
import { furr } from '@/api/furrguard/client';
import { AdminUserRow, Role } from '@/api/furrguard/types';
import { Button } from '@/components/elements/button/index';
import Input from '@/components/elements/Input';
import Select from '@/components/elements/Select';
import PageHeader from '@/components/elements/ui/PageHeader';
import { useFurrGuard } from '@/components/furrguard/FurrGuardContext';
import { ConfirmDialog, Field, FormDialog } from '@/components/furrguard/dialogs/FormDialog';
import { useBusy, useConfirm, usePagedList } from '@/components/furrguard/hooks';
import { formatDateTime, timeAgo } from '@/components/furrguard/lib/format';
import { isDiscordId, ROLE_LABELS } from '@/components/furrguard/lib/labels';
import { sectionInfo } from '@/components/furrguard/sections';
import { Chip, IconButton, ListFrame, Mono, Muted, RowMain, Stack, SubText } from '@/components/furrguard/ui';

const ASSIGNABLE: Exclude<Role, 'founder'>[] = ['owner', 'manager', 'sradmin', 'admin'];

const UsersView = () => {
    const { user, notify } = useFurrGuard();
    const info = sectionInfo('users');
    const list = usePagedList<AdminUserRow, Record<string, string>>({ action: 'get_admin_users', filters: {}, legacyKey: 'users' });
    const { busy, run } = useBusy();
    const { confirm, pending, settle } = useConfirm();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [discordId, setDiscordId] = useState('');
    const [role, setRole] = useState<Exclude<Role, 'founder'>>('admin');

    const openDialog = () => {
        setDiscordId('');
        setRole('admin');
        setDialogOpen(true);
    };

    const submit = async () => {
        if (!isDiscordId(discordId)) throw new Error('El Discord ID son 17 a 20 dígitos (Ajustes de Discord → Avanzado → Modo desarrollador → Copiar ID).');
        await furr('add_admin_user', { discord_id: discordId.trim(), role });
        notify('Usuario añadido. Podrá entrar con su cuenta de Discord.', 'success');
        setDialogOpen(false);
        list.reload();
    };

    const remove = async (row: AdminUserRow) => {
        const ok = await confirm({
            title: 'Quitar acceso',
            message: `${row.discord_username || row.discord_id} perderá el acceso y se cerrarán sus sesiones abiertas.`,
            confirmText: 'Quitar acceso',
        });
        if (ok && (await run(row.id, () => furr('remove_admin_user', { id: row.id }), 'Acceso retirado.'))) list.reload();
    };

    return (
        <Stack>
            <PageHeader
                title={info.label}
                description={info.description}
                actions={
                    <Button onClick={openDialog}>
                        <FontAwesomeIcon icon={faUserPlus} />
                        <span className={'ml-2'}>Añadir usuario</span>
                    </Button>
                }
            />
            <ListFrame list={list} label={'Usuarios del panel'} emptyIcon={faUsers} emptyTitle={'No hay usuarios'}>
                <thead>
                    <tr>
                        <th>Usuario</th>
                        <th>Discord ID</th>
                        <th>Rol</th>
                        <th>Añadido por</th>
                        <th>Desde</th>
                        <th className={'actions'}>
                            <span className={'sr-only'}>Acciones</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {list.items.map((row) => (
                        <tr key={row.id}>
                            <td>
                                <RowMain>
                                    {row.discord_username || <Muted>Aún no ha entrado</Muted>}
                                    {row.discord_id === user.discord_id && <SubText>Tú</SubText>}
                                </RowMain>
                            </td>
                            <td>
                                <Mono>{row.discord_id}</Mono>
                            </td>
                            <td>
                                <Chip tone={row.role === 'founder' ? 'gold' : row.role === 'owner' ? 'accent' : undefined}>{ROLE_LABELS[row.role] ?? row.role}</Chip>
                            </td>
                            <td>
                                <Mono>{row.created_by || '—'}</Mono>
                            </td>
                            <td className={'nowrap'} title={formatDateTime(row.created_at)}>
                                {timeAgo(row.created_at)}
                            </td>
                            <td className={'actions'}>
                                {row.removable && (
                                    <IconButton icon={faTrash} label={`Quitar acceso a ${row.discord_username || row.discord_id}`} busy={busy === row.id} danger onClick={() => remove(row)} />
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </ListFrame>

            <FormDialog open={dialogOpen} title={'Añadir usuario'} submitLabel={'Añadir'} onClose={() => setDialogOpen(false)} onSubmit={submit}>
                <Field label={'Discord ID'} htmlFor={'user-discord'}>
                    <Input id={'user-discord'} value={discordId} onChange={(event) => setDiscordId(event.currentTarget.value)} inputMode={'numeric'} maxLength={20} className={'font-mono'} autoFocus />
                </Field>
                <Field label={'Rol'} htmlFor={'user-role'} help={'Owner: todo salvo proveedores, ajustes y usuarios. Manager: jugadores, conexiones, IPs y listas. Sr. Admin y Admin: jugadores y listas, sin IPs.'}>
                    <Select id={'user-role'} value={role} onChange={(event) => setRole(event.currentTarget.value as Exclude<Role, 'founder'>)}>
                        {ASSIGNABLE.map((value) => (
                            <option key={value} value={value}>
                                {ROLE_LABELS[value]}
                            </option>
                        ))}
                    </Select>
                </Field>
            </FormDialog>
            <ConfirmDialog pending={pending} onSettle={settle} />
        </Stack>
    );
};

export default UsersView;
