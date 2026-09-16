import React, { useEffect, useState } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faArchive, faFilter, faGlobe, faGlobeEurope, faHistory, faStream } from '@fortawesome/free-solid-svg-icons';
import { CarpetaCopias, countVaultCopies, isVaultSessionError } from '@/api/server/vault';
import { useVault } from '@/components/server/vault/VaultContext';
import useVaultTranslation from '@/components/server/vault/useVaultTranslation';
import { VaultTab } from '@/components/server/vault/useVaultLocation';
import { formatBytes, formatCount } from '@/components/server/vault/vaultFormat';

const Bar = styled.div`
    ${tw`flex gap-1 overflow-x-auto`};
    border-bottom: 1px solid var(--color-neutral);
    scrollbar-width: thin;
`;

const Tab = styled.button<{ $active: boolean }>`
    ${tw`flex items-center gap-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-150`};
    margin-bottom: -1px;
    color: ${({ $active }) => ($active ? 'var(--color-base)' : 'var(--color-muted)')};
    border-bottom: 2px solid ${({ $active }) => ($active ? 'var(--color-primary)' : 'transparent')};

    svg {
        font-size: 0.8rem;
        color: ${({ $active }) => ($active ? 'var(--color-primary)' : 'inherit')};
    }

    &:hover {
        color: var(--color-base);
    }
`;

const Badge = styled.span<{ $active: boolean }>`
    ${tw`hidden sm:inline-flex items-center px-2 py-0.5 text-xs font-normal leading-none rounded-full`};
    color: ${({ $active }) => ($active ? 'var(--color-base)' : 'var(--color-muted)')};
    background-color: ${({ $active }) =>
        $active ? 'color-mix(in srgb, var(--color-primary) 18%, transparent)' : 'var(--color-background)'};
    border: 1px solid ${({ $active }) => ($active ? 'var(--color-primary)' : 'var(--color-neutral)')};
`;

type CopyCounts = Partial<Record<CarpetaCopias, number>>;

/**
 * Copies share unchanged files through hard links, so the summed bytes of
 * Backups / M-Backups overstate their real size: those tabs show how many
 * copies there are instead.
 */
const useCopyCounts = (): CopyCounts => {
    const { uuid, resumen, listingVersion, interceptError } = useVault();
    const [counts, setCounts] = useState<CopyCounts>({});

    useEffect(() => {
        let cancelled = false;

        (['Backups', 'M-Backups'] as CarpetaCopias[]).forEach((carpeta) => {
            countVaultCopies(uuid, carpeta)
                .then((count) => {
                    if (!cancelled) setCounts((current) => ({ ...current, [carpeta]: count }));
                })
                .catch((error) => {
                    // A missing badge is harmless; only a lost session needs handling.
                    if (!cancelled && isVaultSessionError(error)) interceptError(error);
                });
        });

        return () => {
            cancelled = true;
        };
    }, [uuid, resumen, listingVersion]);

    return counts;
};

interface Props {
    active: VaultTab;
    onSelect: (tab: VaultTab) => void;
}

const VaultTabs = ({ active, onSelect }: Props) => {
    const { t, locale } = useVaultTranslation();
    const { resumen, canManage } = useVault();
    const counts = useCopyCounts();

    const copiesLabel = (count: number | undefined): string | null => {
        if (count === undefined) return null;
        if (count === 0) return t('vault.tabs.no_copies', 'sin copias');
        if (count === 1) return t('vault.tabs.one_copy', '1 copia');

        // Placeholder names need 2+ characters: the panel converts `:name` with a regex that skips 1-letter names.
        return t('vault.tabs.copies', '{{copies}} copias', { copies: formatCount(count, locale) });
    };

    const sizeLabel = (id: VaultTab): string | null => {
        const folder = resumen.carpetas.find((carpeta) => carpeta.id === id);

        return folder && folder.bytes > 0 ? formatBytes(folder.bytes, locale) : null;
    };

    const tabs: Array<{ id: VaultTab; label: string; icon: IconDefinition; badge: string | null }> = [
        { id: 'Global', label: t('vault.tabs.global', 'Global'), icon: faGlobe, badge: sizeLabel('Global') },
        { id: 'Mundos', label: t('vault.tabs.mundos', 'Mundos'), icon: faGlobeEurope, badge: sizeLabel('Mundos') },
        { id: 'Backups', label: t('vault.tabs.backups', 'Backups'), icon: faHistory, badge: copiesLabel(counts.Backups) },
        { id: 'M-Backups', label: t('vault.tabs.m_backups', 'M-Backups'), icon: faArchive, badge: copiesLabel(counts['M-Backups']) },
        { id: 'actividad', label: t('vault.tabs.activity', 'Actividad'), icon: faStream, badge: null },
        ...(canManage
            ? [{ id: 'exclusiones' as VaultTab, label: t('vault.tabs.exclusions', 'Exclusiones'), icon: faFilter, badge: null }]
            : []),
    ];

    return (
        <Bar role={'tablist'}>
            {tabs.map((tab) => (
                <Tab
                    key={tab.id}
                    type={'button'}
                    role={'tab'}
                    aria-selected={active === tab.id}
                    $active={active === tab.id}
                    onClick={() => onSelect(tab.id)}
                >
                    <FontAwesomeIcon icon={tab.icon} />
                    {tab.label}
                    {tab.badge && <Badge $active={active === tab.id}>{tab.badge}</Badge>}
                </Tab>
            ))}
        </Bar>
    );
};

export default VaultTabs;
