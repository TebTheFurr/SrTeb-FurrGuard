import { useCallback, useMemo } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { Carpeta } from '@/api/server/vault/types';
import { FOLDERS, isFolder, pathSegments } from '@/components/server/vault/vaultRules';

export type VaultTab = Carpeta | 'actividad' | 'exclusiones';

const TABS: VaultTab[] = [...FOLDERS, 'actividad', 'exclusiones'];

const isTab = (value: string): value is VaultTab => (TABS as string[]).indexOf(value) !== -1;

const safeDecode = (segment: string): string => {
    try {
        return decodeURIComponent(segment);
    } catch (error) {
        return segment;
    }
};

/**
 * The tab and folder live in the URL hash (`#Global/plugins/Essentials`) so
 * the back button walks up folders and links can be shared. The hash does not
 * remount the route, unlike the query string.
 */
export const parseVaultHash = (hash: string): { tab: VaultTab; ruta: string } => {
    const [first, ...rest] = hash.replace(/^#/, '').split('/').filter(Boolean).map(safeDecode);

    if (first && isTab(first)) {
        return { tab: first, ruta: isFolder(first) ? rest.join('/') : '' };
    }

    return { tab: 'Global', ruta: '' };
};

export const buildVaultHash = (tab: VaultTab, ruta = ''): string =>
    `#${[tab, ...(isFolder(tab) ? pathSegments(ruta) : [])].map(encodeURIComponent).join('/')}`;

const useVaultLocation = () => {
    const location = useLocation();
    const history = useHistory();
    const { tab, ruta } = useMemo(() => parseVaultHash(location.hash), [location.hash]);

    const navigate = useCallback(
        (nextTab: VaultTab, nextRuta = '') => {
            const hash = buildVaultHash(nextTab, nextRuta);
            if (hash === location.hash) return;

            history.push({ pathname: location.pathname, search: location.search, hash });
        },
        [history, location.pathname, location.search, location.hash]
    );

    return { tab, ruta, navigate };
};

export default useVaultLocation;
