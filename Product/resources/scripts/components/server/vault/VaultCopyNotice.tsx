import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useVaultTranslation from '@/components/server/vault/useVaultTranslation';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faShieldAlt, faTimes } from '@fortawesome/free-solid-svg-icons';
import { ServerContext } from '@/state/server';
import { VAULT_COPY_EVENT, VaultCopyOutcome } from '@/components/server/vault/useCopyToVault';
import { Notice, NoticeBody, PlainButton } from '@/components/server/vault/vaultStyles';

const AUTO_DISMISS_MS = 15000;

const Wrapper = styled.div`
    ${tw`mb-4`};
`;

const VaultLink = styled(Link)`
    ${tw`flex-shrink-0 text-sm font-medium no-underline whitespace-nowrap`};
    color: var(--color-primary);

    &:hover {
        text-decoration: underline;
    }
`;

/** Outcome of "Copy to Vault" in the file manager, with a link to follow the M-Backup. */
const VaultCopyNotice = () => {
    const { t } = useVaultTranslation();
    const serverId = ServerContext.useStoreState((state) => state.server.data!.id);
    const [outcome, setOutcome] = useState<VaultCopyOutcome | null>(null);

    useEffect(() => {
        const listener = (event: Event) => setOutcome((event as CustomEvent<VaultCopyOutcome>).detail);
        window.addEventListener(VAULT_COPY_EVENT, listener);

        return () => window.removeEventListener(VAULT_COPY_EVENT, listener);
    }, []);

    useEffect(() => {
        if (outcome?.kind !== 'started') return;

        const timer = setTimeout(() => setOutcome(null), AUTO_DISMISS_MS);

        return () => clearTimeout(timer);
    }, [outcome]);

    if (!outcome) return null;

    const started = outcome.kind === 'started';

    return (
        <Wrapper>
            <Notice $tone={started ? 'success' : 'warning'} role={'status'}>
                <FontAwesomeIcon icon={started ? faCheckCircle : faShieldAlt} />
                <NoticeBody>
                    {started
                        ? t('vault.copy.started', 'Copiando {{count}} elemento(s) al Vault como M-Backup.', { count: outcome.count })
                        : t('vault.copy.sign_in', 'Entra en el Vault con Discord antes de copiar archivos.')}
                </NoticeBody>
                <VaultLink to={`/server/${serverId}/vault${started ? '#M-Backups' : ''}`}>
                    {started ? t('vault.copy.open', 'Abrir el Vault') : t('vault.login.button', 'Entrar con Discord')}
                </VaultLink>
                <PlainButton type={'button'} onClick={() => setOutcome(null)} aria-label={t('vault.actions.dismiss', 'Cerrar')}>
                    <FontAwesomeIcon icon={faTimes} />
                </PlainButton>
            </Notice>
        </Wrapper>
    );
};

export default VaultCopyNotice;
