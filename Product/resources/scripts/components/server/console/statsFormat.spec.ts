import {
    formatBytes,
    formatClock,
    formatDay,
    formatExactBytes,
    formatNumber,
    formatPercent,
} from '@/components/server/console/statsFormat';

// Intl separates units with non-breaking spaces; compare against plain ones.
const NON_BREAKING_SPACES = new RegExp(`[${String.fromCharCode(0xa0, 0x202f)}]`, 'g');
const plain = (value: string): string => value.replace(NON_BREAKING_SPACES, ' ');

const MOMENT = Date.UTC(2026, 8, 14, 14, 32, 7);

describe('@/components/server/console/statsFormat.ts', function () {
    describe('formatNumber()', function () {
        it('uses the separators of the locale', function () {
            expect(formatNumber(1234.5, 'es', 2)).toBe('1234,50');
            expect(formatNumber(12345.5, 'es', 2)).toBe('12.345,50');
            expect(formatNumber(12345.5, 'en', 2)).toBe('12,345.50');
        });

        it('trims up to the maximum when a range is given', function () {
            expect(formatNumber(4, 'en', 0, 2)).toBe('4');
            expect(formatNumber(4.125, 'en', 0, 2)).toBe('4.13');
        });

        it('falls back to English for an unknown locale tag', function () {
            expect(formatNumber(1.5, 'not a locale!', 1)).toBe('1.5');
        });
    });

    describe('formatPercent()', function () {
        it('formats a 0..100 value as a percentage', function () {
            expect(plain(formatPercent(12.345, 'es', 2))).toBe('12,35 %');
            expect(formatPercent(12.345, 'en', 3)).toBe('12.345%');
            expect(formatPercent(200, 'en', 0, 2)).toBe('200%');
        });
    });

    describe('formatBytes()', function () {
        it.each([
            [0, '0 B'],
            [512, '512 B'],
            [1024, '1.00 KiB'],
            [1_320_702_976, '1.23 GiB'],
            [4_294_967_296, '4.00 GiB'],
            [1_099_511_627_776, '1.00 TiB'],
        ])('formats %d bytes as "%s"', function (input, output) {
            expect(formatBytes(input, 'en', 2)).toBe(output);
        });

        it('localises the decimal separator', function () {
            expect(formatBytes(1_320_702_976, 'es', 2)).toBe('1,23 GiB');
        });

        it('can trim decimals for fixed limits', function () {
            expect(formatBytes(4_294_967_296, 'es', 0, 2)).toBe('4 GiB');
            expect(formatBytes(1_610_612_736, 'es', 0, 2)).toBe('1,5 GiB');
        });

        it('never reports negative sizes', function () {
            expect(formatBytes(-10, 'en', 2)).toBe('0 B');
        });
    });

    describe('formatExactBytes()', function () {
        it('prints every byte with grouping', function () {
            expect(formatExactBytes(1_320_702_976, 'es')).toBe('1.320.702.976 bytes');
            expect(formatExactBytes(1_320_702_976.6, 'en')).toBe('1,320,702,977 bytes');
        });
    });

    describe('formatClock()', function () {
        it('includes hours, minutes and seconds', function () {
            expect(formatClock(MOMENT, 'es', 'UTC')).toBe('14:32:07');
            expect(plain(formatClock(MOMENT, 'en', 'UTC'))).toBe('02:32:07 PM');
        });
    });

    describe('formatDay()', function () {
        it('names the weekday and the date', function () {
            expect(formatDay(MOMENT, 'es', 'UTC')).toBe('lun, 14 sept 2026');
        });
    });
});
