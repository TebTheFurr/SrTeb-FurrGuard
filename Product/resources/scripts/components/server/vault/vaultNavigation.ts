/**
 * Backups and Vault are mutually exclusive per server: with Vault enabled the
 * native Backups section disappears everywhere, and without it the Vault
 * section is hidden. These helpers are the single rule used by the sidebar,
 * the dashboard quick actions and the keybinds.
 */

export type BackupSection = 'backups' | 'vault';

/** The section that must be hidden for a server. */
export const hiddenBackupSection = (vaultEnabled: boolean): BackupSection => (vaultEnabled ? 'backups' : 'vault');

/** Strips query, hash and trailing slashes so a link can be compared with a route path. */
export const normalizeLinkPath = (path: string): string => (path.split(/[?#]/)[0] || '').replace(/\/+$/, '') || '/';

/** Whether an in-panel link points at `/server/{serverId}/{section}` or below it. */
export const isServerSectionLink = (to: string | null | undefined, serverId: string, section: BackupSection): boolean => {
    if (!to) return false;

    const path = normalizeLinkPath(to);
    const base = `/server/${serverId}/${section}`;

    return path === base || path.startsWith(`${base}/`);
};

export interface NavItemLike {
    to?: string;
}

export interface NavCategoryLike {
    items: NavItemLike[];
}

/**
 * Removes the hidden section from already-built navigation categories and
 * drops categories left empty. Works for route links and custom links alike
 * because both resolve to an in-panel `to` path.
 */
export const filterBackupNavigation = <C extends NavCategoryLike>(
    categories: C[],
    serverId: string | undefined,
    vaultEnabled: boolean
): C[] => {
    if (!serverId) return categories;

    const hidden = hiddenBackupSection(vaultEnabled);

    return categories
        .map(
            (category): C => ({
                ...category,
                items: category.items.filter((item) => !isServerSectionLink(item.to, serverId, hidden)),
            })
        )
        .filter((category) => category.items.length > 0);
};

/*
 * The keybinds manager lives outside the server store (it is mounted once for
 * the whole app), so the server router publishes here which servers have
 * Vault. A new Set replaces the old one on every change.
 */
let vaultServers: ReadonlySet<string> = new Set<string>();

export const setVaultAvailability = (serverId: string, enabled: boolean): void => {
    if (vaultServers.has(serverId) === enabled) return;

    const next = new Set(vaultServers);
    if (enabled) {
        next.add(serverId);
    } else {
        next.delete(serverId);
    }
    vaultServers = next;
};

export const isVaultEnabledFor = (serverId: string | null | undefined): boolean =>
    !!serverId && vaultServers.has(serverId);
