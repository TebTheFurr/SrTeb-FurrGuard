import {
    appendPoint,
    axisMax,
    DEFAULT_INTERVAL_MS,
    EMPTY_HISTORY,
    foldSample,
    networkRate,
    nextInterval,
    niceCeiling,
    parseStatsPayload,
    StatsSample,
    STREAM_SPAN_MS,
    streamDelay,
    streamWindow,
} from '@/components/server/console/liveStats';

const sample = (overrides: Partial<StatsSample> = {}): StatsSample => ({
    time: 1_000_000,
    cpu: 0,
    memory: 0,
    disk: 0,
    rx: 0,
    tx: 0,
    uptime: 0,
    ...overrides,
});

describe('@/components/server/console/liveStats.ts', function () {
    describe('parseStatsPayload()', function () {
        it('reads a Wings stats event', function () {
            const payload = JSON.stringify({
                memory_bytes: 1_320_702_976,
                memory_limit_bytes: 4_294_967_296,
                cpu_absolute: 12.345,
                network: { rx_bytes: 5_000, tx_bytes: 7_000 },
                uptime: 64_000,
                state: 'running',
                disk_bytes: 3_000_000_000,
            });

            expect(parseStatsPayload(payload, 42)).toEqual({
                time: 42,
                cpu: 12.345,
                memory: 1_320_702_976,
                disk: 3_000_000_000,
                rx: 5_000,
                tx: 7_000,
                uptime: 64_000,
            });
        });

        it('rejects payloads that are not a JSON object', function () {
            expect(parseStatsPayload('not json', 1)).toBeNull();
            expect(parseStatsPayload('null', 1)).toBeNull();
            expect(parseStatsPayload('[1, 2]', 1)).toBeNull();
        });

        it('treats missing or invalid numbers as zero', function () {
            const parsed = parseStatsPayload(JSON.stringify({ cpu_absolute: 'x', memory_bytes: -5 }), 7);

            expect(parsed).toEqual(sample({ time: 7 }));
        });
    });

    describe('networkRate()', function () {
        it('needs a previous reading', function () {
            expect(networkRate(null, sample())).toBeNull();
        });

        it('converts counter deltas into bytes per second', function () {
            const previous = sample({ time: 10_000, rx: 1_000, tx: 4_000 });
            const current = sample({ time: 12_000, rx: 3_000, tx: 5_000 });

            expect(networkRate(previous, current)).toEqual({ rx: 1_000, tx: 500 });
        });

        it('reports no traffic when counters reset after a restart', function () {
            const previous = sample({ time: 10_000, rx: 9_000, tx: 9_000 });
            const current = sample({ time: 11_000, rx: 100, tx: 9_500 });

            expect(networkRate(previous, current)).toEqual({ rx: 0, tx: 500 });
        });

        it('ignores readings that arrive in a burst, which would inflate the rate', function () {
            const previous = sample({ time: 10_000, rx: 0 });
            const current = sample({ time: 10_020, rx: 100 });

            expect(networkRate(previous, current)).toBeNull();
        });

        it('measures the interval with the uptime Wings reports, not the arrival time', function () {
            const previous = sample({ time: 10_000, uptime: 60_000, rx: 1_000 });
            const current = sample({ time: 10_300, uptime: 61_000, rx: 3_000 });

            expect(networkRate(previous, current)).toEqual({ rx: 2_000, tx: 0 });
        });

        it('has no rate for a repeated reading or after a restart', function () {
            const previous = sample({ time: 10_000, uptime: 60_000 });

            expect(networkRate(previous, sample({ time: 10_700, uptime: 60_000 }))).toBeNull();
            expect(networkRate(previous, sample({ time: 11_000, uptime: 1_000 }))).toBeNull();
        });
    });

    describe('appendPoint()', function () {
        it('adds the reading without touching the original list', function () {
            const points = [{ x: 1, y: 1 }];
            const next = appendPoint(points, { x: 2, y: 5 }, 0);

            expect(next).toEqual([
                { x: 1, y: 1 },
                { x: 2, y: 5 },
            ]);
            expect(points).toHaveLength(1);
        });

        it('drops readings that scrolled out, keeping one so the line reaches the edge', function () {
            const points = [1, 2, 3, 4].map((x) => ({ x, y: x }));

            expect(appendPoint(points, { x: 5, y: 5 }, 3.5).map((p) => p.x)).toEqual([3, 4, 5]);
        });

        it('starts over when the clock moves backwards', function () {
            const points = [{ x: 100, y: 1 }];

            expect(appendPoint(points, { x: 50, y: 2 }, 0)).toEqual([{ x: 50, y: 2 }]);
        });
    });

    describe('nextInterval()', function () {
        it('keeps the current estimate for the first reading', function () {
            expect(nextInterval(DEFAULT_INTERVAL_MS, null, 5_000)).toBe(DEFAULT_INTERVAL_MS);
        });

        it('moves towards the observed cadence', function () {
            const estimate = nextInterval(1_000, 10_000, 12_000);

            expect(estimate).toBeGreaterThan(1_000);
            expect(estimate).toBeLessThan(2_000);
        });

        it('ignores bursts and caps long pauses', function () {
            expect(nextInterval(1_000, 10_000, 10_010)).toBe(1_000);
            expect(nextInterval(1_000, 0, 600_000)).toBeLessThanOrEqual(5_000);
        });
    });

    describe('streamWindow()', function () {
        it('trails real time by the delay', function () {
            expect(streamWindow(100_000, 60_000, 1_500)).toEqual({ min: 38_500, max: 98_500 });
        });
    });

    describe('streamDelay()', function () {
        it('leaves room for the next reading to slide in', function () {
            expect(streamDelay(1_000)).toBeGreaterThan(1_000);
        });
    });

    describe('niceCeiling()', function () {
        it('rounds byte values up to a power of two, so half of it is round too', function () {
            expect(niceCeiling(700 * 1024, 'binary')).toBe(1024 * 1024);
            expect(niceCeiling(1024 * 1024, 'binary')).toBe(1024 * 1024);
            expect(niceCeiling(3.1 * 1024 ** 3, 'binary')).toBe(4 * 1024 ** 3);
        });

        it('rounds percentages up to 1, 2, 2.5 or 5 times a power of ten', function () {
            expect(niceCeiling(35, 'decimal')).toBe(50);
            expect(niceCeiling(12, 'decimal')).toBe(20);
            expect(niceCeiling(22, 'decimal')).toBe(25);
            expect(niceCeiling(100, 'decimal')).toBe(100);
            expect(niceCeiling(101, 'decimal')).toBe(200);
        });

        it('keeps a readable scale when everything is idle', function () {
            expect(niceCeiling(0, 'binary')).toBe(1024);
            expect(niceCeiling(0, 'decimal')).toBe(1);
        });
    });

    describe('axisMax()', function () {
        const series = [[{ x: 1, y: 10 }], [{ x: 1, y: 30 }]];

        it('pins the axis to the limit so the chart reads as how full the server is', function () {
            expect(axisMax(series, 200, 'decimal')).toBe(200);
        });

        it('grows past the limit when a reading overshoots it', function () {
            expect(axisMax(series, 25, 'decimal')).toBe(30);
        });

        it('rounds up from the highest reading of any series without a limit', function () {
            expect(axisMax(series, 0, 'decimal')).toBe(50);
            expect(axisMax([], 0, 'binary')).toBe(1024);
        });
    });

    describe('foldSample()', function () {
        it('charts CPU and memory from the first reading, network only once there is a rate', function () {
            const first = foldSample(EMPTY_HISTORY, sample({ time: 10_000, cpu: 5, memory: 100, rx: 1_000 }));

            expect(first.cpu).toEqual([{ x: 10_000, y: 5 }]);
            expect(first.memory).toEqual([{ x: 10_000, y: 100 }]);
            expect(first.rx).toEqual([]);
            expect(first.last?.time).toBe(10_000);

            const second = foldSample(first, sample({ time: 11_000, cpu: 7, memory: 120, rx: 3_000 }));

            expect(second.cpu.map((point) => point.y)).toEqual([5, 7]);
            expect(second.rx).toEqual([{ x: 11_000, y: 2_000 }]);
            expect(second.tx).toEqual([{ x: 11_000, y: 0 }]);
            expect(second.last?.time).toBe(11_000);
        });

        it('ignores a repeated reading, such as the reply to "send stats"', function () {
            const frame = foldSample(EMPTY_HISTORY, sample({ time: 10_000, uptime: 60_000, cpu: 5, rx: 1_000 }));
            const reply = foldSample(frame, sample({ time: 10_700, uptime: 60_000, cpu: 5, rx: 1_000 }));

            expect(reply).toBe(frame);
        });

        it('rates the first frame after a reply over the real sampling interval', function () {
            // The reply repeats a frame measured up to a second earlier, then the next frame lands shortly after.
            const reply = foldSample(EMPTY_HISTORY, sample({ time: 10_000, uptime: 60_000, rx: 1_000 }));
            const frame = foldSample(reply, sample({ time: 10_300, uptime: 61_000, rx: 3_000 }));

            expect(frame.rx).toEqual([{ x: 10_300, y: 2_000 }]);
        });

        it('forgets readings that fell out of the visible window', function () {
            const seconds = Array.from({ length: 300 }, (_, index) => index);
            const history = seconds.reduce(
                (current, second) => foldSample(current, sample({ time: second * 1_000 })),
                EMPTY_HISTORY
            );

            // One reading per second: the visible span, the trailing delay and a little margin.
            const visible = STREAM_SPAN_MS / 1_000;
            expect(history.cpu.length).toBeGreaterThanOrEqual(visible);
            expect(history.cpu.length).toBeLessThanOrEqual(visible + 5);
            expect(history.cpu[history.cpu.length - 1].x).toBe(299_000);
        });

        it('does not mutate the previous history', function () {
            const first = foldSample(EMPTY_HISTORY, sample({ time: 10_000 }));
            foldSample(first, sample({ time: 11_000 }));

            expect(first.cpu).toHaveLength(1);
            expect(EMPTY_HISTORY.cpu).toHaveLength(0);
        });
    });
});
