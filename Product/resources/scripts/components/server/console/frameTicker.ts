/**
 * One shared animation loop for the live charts.
 *
 * Every chart scrolls in the same frame, the loop only runs while a visible
 * chart is subscribed, and it is capped so high refresh rate screens don't
 * redraw three canvases 144 times a second for a line that moves a fraction of
 * a pixel. Browsers pause animation frames in background tabs, so hidden pages
 * cost nothing.
 */

export interface FrameScheduler {
    request: (callback: (timestamp: number) => void) => number;
    cancel: (handle: number) => void;
}

export type FrameListener = (now: number) => void;

export interface FrameTicker {
    subscribe: (listener: FrameListener) => () => void;
}

/** A 60 second window moves well under a pixel per frame at this rate, so more frames would only cost CPU. */
export const LIVE_CHART_FPS = 20;

/** Frame timestamps jitter; without some slack a 60 Hz screen would skip every other eligible frame. */
const FRAME_SLACK_MS = 2;

export const createFrameTicker = (scheduler: FrameScheduler, clock: () => number, fps: number): FrameTicker => {
    const listeners = new Set<FrameListener>();
    const minGap = 1_000 / fps - FRAME_SLACK_MS;
    let handle: number | null = null;
    let lastTick = -Infinity;

    const stop = () => {
        if (handle !== null) {
            scheduler.cancel(handle);
            handle = null;
        }
    };

    const loop = (timestamp: number) => {
        // Queue the next frame before running listeners so a failure never stops the loop.
        handle = scheduler.request(loop);
        if (timestamp - lastTick < minGap) {
            return;
        }

        lastTick = timestamp;
        const now = clock();
        const failures: unknown[] = [];

        listeners.forEach((listener) => {
            try {
                listener(now);
            } catch (error) {
                // A listener that throws once will throw every frame; drop it instead of flooding the console.
                listeners.delete(listener);
                failures.push(error);
            }
        });

        if (listeners.size === 0) {
            stop();
        }
        if (failures.length > 0) {
            throw failures[0];
        }
    };

    return {
        subscribe: (listener) => {
            listeners.add(listener);
            if (handle === null) {
                handle = scheduler.request(loop);
            }

            return () => {
                listeners.delete(listener);
                if (listeners.size === 0) {
                    stop();
                }
            };
        },
    };
};

let browserTicker: FrameTicker | null = null;

/** Subscribes to the page-wide ticker, created on first use. */
export const subscribeFrame = (listener: FrameListener): (() => void) => {
    if (!browserTicker) {
        browserTicker = createFrameTicker(
            {
                request: (callback) => window.requestAnimationFrame(callback),
                cancel: (frame) => window.cancelAnimationFrame(frame),
            },
            () => Date.now(),
            LIVE_CHART_FPS
        );
    }

    return browserTicker.subscribe(listener);
};
