import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Subuser } from '@/state/server/subusers';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPencilAlt, faShieldAlt, faKey } from '@fortawesome/free-solid-svg-icons';
import RemoveSubuserButton from '@/components/server/users/RemoveSubuserButton';
import EditSubuserModal from '@/components/server/users/EditSubuserModal';
import Can from '@/components/elements/Can';
import { useStoreState } from 'easy-peasy';
import styled from 'styled-components/macro';

interface Props {
    subuser: Subuser;
}

const UserCard = styled.div`
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 12px);
    margin-bottom: 0.75rem;
    transition: border-color 150ms ease;

    &:hover {
        border-color: color-mix(in srgb, var(--color-primary) 50%, transparent);
    }
`;

const Avatar = styled.div`
    width: 48px;
    height: 48px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    background-color: var(--color-neutral);

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
`;

const UserInfo = styled.div`
    flex: 1;
    min-width: 0;
`;

const UserEmail = styled.p`
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--color-base);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const UserMeta = styled.div`
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 0.25rem;
`;

const MetaItem = styled.span<{ $warning?: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: ${(props) => (props.$warning ? '#ef4444' : 'var(--color-muted)')};

    svg {
        font-size: 0.625rem;
    }
`;

const ActionButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: calc(var(--border-radius, 12px) * 0.5);
    background-color: transparent;
    border: 1px solid transparent;
    color: var(--color-muted);
    transition: all 150ms ease;
    cursor: pointer;

    &:hover {
        background-color: var(--color-neutral);
        color: var(--color-base);
    }

    &.danger:hover {
        background-color: rgba(239, 68, 68, 0.15);
        color: #ef4444;
    }
`;

const Actions = styled.div`
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
`;

export default ({ subuser }: Props) => {
    const { t } = useTranslation('server');
    const uuid = useStoreState((state) => state.user!.data!.uuid);
    const [visible, setVisible] = useState(false);
    const permissionCount = subuser.permissions.filter((permission) => permission !== 'websocket.connect').length;

    return (
        <UserCard>
            <EditSubuserModal subuser={subuser} visible={visible} onModalDismissed={() => setVisible(false)} />
            <Avatar>
                <img src={`${subuser.image}?s=400`} alt={subuser.email} />
            </Avatar>
            <UserInfo>
                <UserEmail>{subuser.email}</UserEmail>
                <UserMeta>
                    <MetaItem $warning={!subuser.twoFactorEnabled}>
                        <FontAwesomeIcon icon={faShieldAlt} />
                        {subuser.twoFactorEnabled
                            ? t('users.row.two_factor_enabled')
                            : t('users.row.two_factor_disabled')}
                    </MetaItem>
                    <MetaItem>
                        <FontAwesomeIcon icon={faKey} />
                        {permissionCount === 1
                            ? t('users.row.permission_singular', { count: permissionCount })
                            : t('users.row.permission_plural', { count: permissionCount })}
                    </MetaItem>
                </UserMeta>
            </UserInfo>
            {subuser.uuid !== uuid && (
                <Actions>
                    <Can action={'user.update'}>
                        <ActionButton type="button" aria-label={t('users.row.edit_aria')} onClick={() => setVisible(true)}>
                            <FontAwesomeIcon icon={faPencilAlt} />
                        </ActionButton>
                    </Can>
                    <Can action={'user.delete'}>
                        <RemoveSubuserButton subuser={subuser} />
                    </Can>
                </Actions>
            )}
        </UserCard>
    );
};
