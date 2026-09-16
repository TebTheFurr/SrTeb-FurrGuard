import {
    buildRestoreRequest,
    joinPath,
    levelAllows,
    normalizeDestination,
    parentPath,
    parseExclusions,
    restoreRules,
    serverRelativePaths,
    splitBackupPath,
    togglePattern,
    touchesWorld,
    validateExclusions,
} from '@/components/server/vault/vaultRules';

const WORLDS = ['world', 'world_nether', 'worlds/bedrock'];

const defaults = { destino: '/', detener: false, vaciar: false, encender: true };

describe('@/components/server/vault/vaultRules.ts', function () {
    describe('levelAllows()', function () {
        it('orders ver < restaurar < gestionar', function () {
            expect(levelAllows('ver', 'ver')).toBe(true);
            expect(levelAllows('ver', 'restaurar')).toBe(false);
            expect(levelAllows('restaurar', 'restaurar')).toBe(true);
            expect(levelAllows('restaurar', 'gestionar')).toBe(false);
            expect(levelAllows('gestionar', 'ver')).toBe(true);
        });
    });

    describe('paths', function () {
        it('joins without empty segments', function () {
            expect(joinPath('', 'plugins')).toBe('plugins');
            expect(joinPath('/plugins/', '/Essentials/')).toBe('plugins/Essentials');
            expect(joinPath('')).toBe('');
        });

        it('computes the parent folder', function () {
            expect(parentPath('plugins/Essentials')).toBe('plugins');
            expect(parentPath('plugins')).toBe('');
        });

        it('splits the copy name from the path inside it', function () {
            expect(splitBackupPath('backup-1a2b3c4d-2026-09-13_04-00/plugins/a.jar')).toEqual({
                backup: 'backup-1a2b3c4d-2026-09-13_04-00',
                rest: 'plugins/a.jar',
            });
            expect(splitBackupPath('')).toEqual({ backup: null, rest: '' });
        });

        it('builds server-root relative paths without a leading slash', function () {
            expect(serverRelativePaths('/', ['plugins', 'server.properties'])).toEqual(['plugins', 'server.properties']);
            expect(serverRelativePaths('/plugins/', ['Essentials'])).toEqual(['plugins/Essentials']);
        });
    });

    describe('touchesWorld()', function () {
        it('detects world roots, paths inside them and folders containing them', function () {
            expect(touchesWorld('world', WORLDS)).toBe(true);
            expect(touchesWorld('world/region/r.0.0.mca', WORLDS)).toBe(true);
            expect(touchesWorld('worlds', WORLDS)).toBe(true);
            expect(touchesWorld('world_backup', WORLDS)).toBe(false);
            expect(touchesWorld('plugins', WORLDS)).toBe(false);
        });
    });

    describe('normalizeDestination()', function () {
        it.each([
            ['', '/'],
            ['/', '/'],
            ['restored', '/restored'],
            ['/a//b/', '/a/b'],
            [' /copia ', '/copia'],
        ])('normalises %j to %j', function (input, output) {
            expect(normalizeDestination(input)).toBe(output);
        });

        it.each([['../etc'], ['/a/./b'], ['a\\b'], [`bad${String.fromCharCode(0)}name`]])('rejects %j', function (input) {
            expect(normalizeDestination(input)).toBeNull();
        });
    });

    describe('restoreRules()', function () {
        it('forces a stop for anything restored from Mundos', function () {
            const rules = restoreRules({ carpeta: 'Mundos', backup: null, rutas: ['world'] }, '/', false, WORLDS);

            expect(rules.stopForced).toBe(true);
            expect(rules.stopReason).toBe('worlds');
            expect(rules.canWipe).toBe(false);
        });

        it('forces a stop for a whole copy and allows wiping everything', function () {
            const rules = restoreRules({ carpeta: 'Backups', backup: 'backup-x', rutas: [] }, '/', false, WORLDS);

            expect(rules.stopReason).toBe('whole_backup');
            expect(rules.canWipe).toBe(true);
            expect(rules.wipeScope).toBe('todo');
        });

        it('forces a stop when a copy path contains a world', function () {
            const rules = restoreRules({ carpeta: 'M-Backups', backup: 'backup-x', rutas: ['world_nether'] }, '/', false, WORLDS);

            expect(rules.stopReason).toBe('worlds');
        });

        it('does not force a stop for a plugin restored from Global', function () {
            const rules = restoreRules({ carpeta: 'Global', backup: null, rutas: ['plugins/Essentials'] }, '/', false, WORLDS);

            expect(rules.stopForced).toBe(false);
            expect(rules.canWipe).toBe(false);
            expect(rules.rutas).toEqual(['plugins/Essentials']);
        });

        it('offers wiping without worlds for the whole Global mirror, and forces a stop once chosen', function () {
            const source = { carpeta: 'Global' as const, backup: null, rutas: [] };

            expect(restoreRules(source, '/', false, WORLDS)).toMatchObject({ canWipe: true, wipeScope: 'sin_mundos', stopForced: false });
            expect(restoreRules(source, '/', true, WORLDS)).toMatchObject({ stopForced: true, stopReason: 'wipe' });
        });

        it('only allows wiping when restoring to the server root', function () {
            const rules = restoreRules({ carpeta: 'Mundos', backup: null, rutas: [] }, '/restaurado', true, WORLDS);

            expect(rules.canWipe).toBe(false);
            expect(rules.wipeScope).toBeNull();
        });

        it('restores imported copies whole', function () {
            const rules = restoreRules(
                { carpeta: 'Backups', backup: 'backup-x', backupType: 'importada', rutas: ['plugins'] },
                '/',
                false,
                WORLDS
            );

            expect(rules.wholeOnly).toBe(true);
            expect(rules.rutas).toEqual([]);
            expect(rules.stopReason).toBe('whole_backup');
        });

        it('treats a selection that includes the root as everything and removes duplicates', function () {
            expect(restoreRules({ carpeta: 'Global', backup: null, rutas: ['a', ''] }, '/', false, []).rutas).toEqual([]);
            expect(restoreRules({ carpeta: 'Global', backup: null, rutas: ['a', '/a/'] }, '/', false, []).rutas).toEqual(['a']);
        });
    });

    describe('buildRestoreRequest()', function () {
        it('applies forced values and drops a wipe that is not allowed', function () {
            expect(
                buildRestoreRequest(
                    { carpeta: 'Mundos', backup: null, rutas: ['world'] },
                    { ...defaults, destino: 'copia', vaciar: true },
                    WORLDS
                )
            ).toEqual({
                carpeta: 'Mundos',
                backup: null,
                rutas: ['world'],
                destino: '/copia',
                detener: true,
                vaciar: false,
                encender: true,
            });
        });

        it('keeps the copy name for Backups and clears it for mirrors', function () {
            expect(buildRestoreRequest({ carpeta: 'Backups', backup: 'backup-x', rutas: [] }, { ...defaults, vaciar: true }, WORLDS)).toMatchObject({
                backup: 'backup-x',
                vaciar: true,
                detener: true,
            });
            expect(buildRestoreRequest({ carpeta: 'Global', backup: 'stale', rutas: ['a'] }, defaults, WORLDS)).toMatchObject({
                backup: null,
                detener: false,
            });
        });

        it('returns null for an invalid destination or a copy without name', function () {
            expect(buildRestoreRequest({ carpeta: 'Global', backup: null, rutas: [] }, { ...defaults, destino: '../x' }, [])).toBeNull();
            expect(buildRestoreRequest({ carpeta: 'M-Backups', backup: null, rutas: [] }, defaults, [])).toBeNull();
        });
    });

    describe('exclusions', function () {
        it('parses one pattern per line', function () {
            expect(parseExclusions('logs/\n\n  cache/ \r\nlogs/\n')).toEqual(['logs/', 'cache/']);
        });

        it('validates count and length', function () {
            expect(validateExclusions(['logs/'])).toBeNull();
            expect(validateExclusions(Array.from({ length: 101 }, (_, i) => `p${i}`))).toEqual({ kind: 'too_many', max: 100 });
            expect(validateExclusions(['x'.repeat(257)])).toMatchObject({ kind: 'too_long', max: 256 });
        });

        it('toggles presets', function () {
            expect(togglePattern(['logs/'], 'cache/')).toEqual(['logs/', 'cache/']);
            expect(togglePattern(['logs/', 'cache/'], 'logs/')).toEqual(['cache/']);
        });
    });
});
