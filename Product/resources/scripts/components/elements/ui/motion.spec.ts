import { easeOutCubic, tweenValue } from '@/components/elements/ui/motion';

describe('@/components/elements/ui/motion.ts', function () {
    describe('easeOutCubic()', function () {
        it('starts at 0 and lands on 1', function () {
            expect(easeOutCubic(0)).toBe(0);
            expect(easeOutCubic(1)).toBe(1);
        });

        it('decelerates, covering most of the distance early', function () {
            expect(easeOutCubic(0.5)).toBeCloseTo(0.875);
        });

        it('clamps progress outside of 0..1', function () {
            expect(easeOutCubic(-1)).toBe(0);
            expect(easeOutCubic(3)).toBe(1);
        });
    });

    describe('tweenValue()', function () {
        it('begins at the starting value', function () {
            expect(tweenValue(10, 20, 0, 900)).toBe(10);
        });

        it('ends exactly on the target once the duration has passed', function () {
            expect(tweenValue(10, 20, 900, 900)).toBe(20);
            expect(tweenValue(10, 20, 5000, 900)).toBe(20);
        });

        it('follows the easing curve in between', function () {
            expect(tweenValue(10, 20, 450, 900)).toBeCloseTo(18.75);
        });

        it('animates downwards too', function () {
            expect(tweenValue(20, 10, 450, 900)).toBeCloseTo(11.25);
        });

        it('jumps straight to the target without a duration', function () {
            expect(tweenValue(10, 20, 0, 0)).toBe(20);
        });
    });
});
