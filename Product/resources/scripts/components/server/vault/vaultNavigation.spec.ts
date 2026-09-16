import {
    filterBackupNavigation,
    isServerSectionLink,
    isVaultEnabledFor,
    setVaultAvailability,
} from '@/components/server/vault/vaultNavigation';
import { formatBytes, formatRelative, isJobActive, jobProgressPercent } from '@/components/server/vault/vaultFormat';

interface TestCategory {
    category: string;
    items: Array<{ key: string; to?: string; href?: string }>;
}

const categories: TestCategory[] = [
    {
        category: 'Management',
        items: [
            { key: 'files', to: '/server/1a2b3c4d/files' },
            { key: 'backups', to: '/server/1a2b3c4d/backups' },
            { key: 'vault', to: '/server/1a2b3c4d/vault/' },
        ],
    },
    { category: 'Only backups', items: [{ key: 'custom-backups', to: '/server/1a2b3c4d/backups#page' }] },
    { category: 'External', items: [{ key: 'status', href: 'https://status.tebby.lgbt' }] },
];

describe('@/components/server/vault/vaultNavigation.ts', function () {
    it('matches a section path with trailing slashes, hashes and sub-paths', function () {
        expect(isServerSectionLink('/server/1a2b3c4d/vault', '1a2b3c4d', 'vault')).toBe(true);
        expect(isServerSectionLink('/server/1a2b3c4d/vault/#Global/plugins', '1a2b3c4d', 'vault')).toBe(true);
        expect(isServerSectionLink('/server/1a2b3c4d/vaults', '1a2b3c4d', 'vault')).toBe(false);
        expect(isServerSectionLink('/server/ffffffff/vault', '1a2b3c4d', 'vault')).toBe(false);
        expect(isServerSectionLink(undefined, '1a2b3c4d', 'vault')).toBe(false);
    });

    it('drops Backups on Vault servers and removes emptied categories', function () {
        const result = filterBackupNavigation(categories, '1a2b3c4d', true);

        expect(result.map((c) => c.category)).toEqual(['Management', 'External']);
        expect(result[0].items.map((i) => i.key)).toEqual(['files', 'vault']);
    });

    it('drops Vault on servers without it', function () {
        const result = filterBackupNavigation(categories, '1a2b3c4d', false);

        expect(result[0].items.map((i) => i.key)).toEqual(['files', 'backups']);
        expect(result).toHaveLength(3);
    });

    it('leaves navigation untouched outside a server', function () {
        expect(filterBackupNavigation(categories, undefined, true)).toBe(categories);
    });

    it('remembers which servers have Vault for the keybinds', function () {
        expect(isVaultEnabledFor('1a2b3c4d')).toBe(false);
        setVaultAvailability('1a2b3c4d', true);
        expect(isVaultEnabledFor('1a2b3c4d')).toBe(true);
        setVaultAvailability('1a2b3c4d', false);
        expect(isVaultEnabledFor('1a2b3c4d')).toBe(false);
        expect(isVaultEnabledFor(null)).toBe(false);
    });
});

describe('@/components/server/vault/vaultFormat.ts', function () {
    const progress = { fase: null, archivos: 0, archivos_total: 0, bytes: 0, bytes_total: 0 };

    it('computes progress from bytes, then files, and null when unknown', function () {
        expect(jobProgressPercent({ ...progress, bytes: 50, bytes_total: 200, archivos: 9, archivos_total: 10 })).toBe(25);
        expect(jobProgressPercent({ ...progress, archivos: 3, archivos_total: 4 })).toBe(75);
        expect(jobProgressPercent(progress)).toBeNull();
        expect(jobProgressPercent({ ...progress, bytes: 300, bytes_total: 200 })).toBe(100);
    });

    it('formats bytes with the Spanish decimal comma', function () {
        expect(formatBytes(3_017_850_470, 'es')).toBe('2,81 GiB');
        expect(formatBytes(1024, 'es')).toBe('1 KiB');
        expect(formatBytes(0, 'es')).toBe('0 bytes');
        expect(formatBytes(-5, 'es')).toBe('0 bytes');
    });

    it('formats relative times in Spanish', function () {
        const now = Date.UTC(2026, 8, 14, 12, 0, 0);

        expect(formatRelative(now / 1000 - 3 * 3600, 'es', now)).toBe('hace 3 horas');
        expect(formatRelative(now / 1000 + 20 * 60, 'es', now)).toBe('dentro de 20 minutos');
    });

    it('treats queued, dispatched, running and processing jobs as active', function () {
        const job = { estado: 'en_curso' } as Parameters<typeof isJobActive>[0];

        expect(isJobActive(job)).toBe(true);
        expect(isJobActive({ ...job!, estado: 'ok' })).toBe(false);
        expect(isJobActive(null)).toBe(false);
    });
});
