import { createFrameTicker, FrameScheduler } from '@/components/server/console/frameTicker';

/** A scheduler driven by hand, so frames only happen when the test says so. */
const manualScheduler = () => {
    let queued: ((timestamp: number) => void) | null = null;
    let cancelled = 0;

    const scheduler: FrameScheduler = {
        request: (callback) => {
            queued = callback;
            return 1;
        },
        cancel: () => {
            queued = null;
            cancelled++;
        },
    };

    return {
        scheduler,
        frame: (timestamp: number) => {
            const callback = queued;
            queued = null;
            callback?.(timestamp);
        },
        isQueued: () => queued !== null,
        cancelled: () => cancelled,
    };
};

describe('@/components/server/console/frameTicker.ts', function () {
    it('only requests frames while someone is listening', function () {
        const manual = manualScheduler();
        const ticker = createFrameTicker(manual.scheduler, () => 0, 30);

        expect(manual.isQueued()).toBe(false);

        const unsubscribe = ticker.subscribe(() => undefined);
        expect(manual.isQueued()).toBe(true);

        unsubscribe();
        expect(manual.isQueued()).toBe(false);
        expect(manual.cancelled()).toBe(1);
    });

    it('caps the frame rate', function () {
        const manual = manualScheduler();
        const ticker = createFrameTicker(manual.scheduler, () => 123, 30);
        const listener = jest.fn();

        ticker.subscribe(listener);
        manual.frame(1_000);
        manual.frame(1_016);
        manual.frame(1_034);

        expect(listener).toHaveBeenCalledTimes(2);
        expect(listener).toHaveBeenCalledWith(123);
    });

    it('drops a failing listener without starving the others', function () {
        const manual = manualScheduler();
        const ticker = createFrameTicker(manual.scheduler, () => 0, 30);
        const failing = jest.fn(() => {
            throw new Error('chart was destroyed');
        });
        const healthy = jest.fn();

        ticker.subscribe(failing);
        ticker.subscribe(healthy);

        expect(() => manual.frame(1_000)).toThrow('chart was destroyed');
        expect(healthy).toHaveBeenCalledTimes(1);
        expect(manual.isQueued()).toBe(true);

        manual.frame(2_000);
        expect(failing).toHaveBeenCalledTimes(1);
        expect(healthy).toHaveBeenCalledTimes(2);
    });
});
