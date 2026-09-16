/**
 * Pure helpers behind the live resource readouts on the server pages.
 *
 * Wings pushes a "stats" websocket event for every Docker stats frame (about
 * once a second while the server runs). These helpers turn those events into
 * timestamped readings and into the scrolling series drawn by the charts.
 */

export interface StatsSample {
    /** Epoch milliseconds at which the panel received the reading. */
    time: number;
    /** Absolute CPU usage, 100 = one core. */
    cpu: number;
    memory: number;
    disk: number;
    /** Cumulative bytes received since the container started. */
    rx: number;
    /** Cumulative bytes sent since the container started. */
    tx: number;
    uptime: number;
}

export interface NetworkRate {
    rx: number;
    tx: number;
}

export interface ChartPoint {
    x: number;
    y: number;
}

export interface StreamWindow {
    min: number;
    max: number;
}

export const DEFAULT_INTERVAL_MS = 1_000;
export const STREAM_SPAN_MS = 60_000;

/** Gaps shorter than this are too small to derive a rate or the stream cadence from. */
const MIN_INTERVAL_MS = 250;
const MAX_INTERVAL_MS = 5_000;
const INTERVAL_SMOOTHING = 0.3;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const toCount = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0);

/** Reads a Wings stats payload, or returns null when it is not a JSON object. */
export const parseStatsPayload = (payload: string, time: number): StatsSample | null => {
    let data: unknown;
    try {
        data = JSON.parse(payload);
    } catch (e) {
        return null;
    }

    if (!isRecord(data)) {
        return null;
    }

    const network = isRecord(data.network) ? data.network : {};

    return {
        time,
        cpu: toCount(data.cpu_absolute),
        memory: toCount(data.memory_bytes),
        disk: toCount(data.disk_bytes),
        rx: toCount(network.rx_bytes),
        tx: toCount(network.tx_bytes),
        uptime: toCount(data.uptime),
    };
};

/**
 * Milliseconds between two measurements. Wings advances `uptime` by each Docker
 * sampling interval, which is the true gap even when the events reach the
 * browser bunched up; arrival times are only the fallback.
 */
const measuredGap = (previous: StatsSample, current: StatsSample): number =>
    previous.uptime > 0 && current.uptime > 0 ? current.uptime - previous.uptime : current.time - previous.time;

/**
 * Transfer rate in bytes per second between two readings. Returns null when
 * there is nothing to compare against, when the reading repeats the previous
 * one or the container restarted, or when the gap is too small to divide by
 * without exaggerating. Counters going backwards count as no traffic.
 */
export const networkRate = (previous: StatsSample | null, current: StatsSample): NetworkRate | null => {
    const gap = previous ? measuredGap(previous, current) : 0;
    if (!previous || gap < MIN_INTERVAL_MS) {
        return null;
    }

    const seconds = gap / 1_000;
    const rate = (now: number, before: number): number => (now >= before ? (now - before) / seconds : 0);

    return { rx: rate(current.rx, previous.rx), tx: rate(current.tx, previous.tx) };
};

/** A "send stats" reply repeats the last Docker frame verbatim, uptime included. */
export const isRepeat = (previous: StatsSample | null, current: StatsSample): boolean =>
    previous !== null && current.uptime > 0 && current.uptime === previous.uptime;

/**
 * Appends a reading and drops those that scrolled out of view, keeping one
 * before `oldest` so the line still reaches the left edge of the chart. A
 * reading older than the last one means the clock moved back: start over.
 */
export const appendPoint = (points: readonly ChartPoint[], point: ChartPoint, oldest: number): ChartPoint[] => {
    const last = points[points.length - 1];
    if (last && point.x < last.x) {
        return [point];
    }

    const next = [...points, point];
    const firstVisible = next.findIndex((candidate) => candidate.x >= oldest);

    return firstVisible > 1 ? next.slice(firstVisible - 1) : next;
};

/** Smoothed time between readings, so the charts adapt to each node's cadence. */
export const nextInterval = (current: number, previousTime: number | null, time: number): number => {
    if (previousTime === null) {
        return current;
    }

    const gap = time - previousTime;
    if (gap < MIN_INTERVAL_MS) {
        return current;
    }

    return current + (Math.min(gap, MAX_INTERVAL_MS) - current) * INTERVAL_SMOOTHING;
};

/**
 * How far the charts trail real time. Drawing slightly in the past lets each
 * new reading slide in from the right edge instead of popping into view.
 */
export const streamDelay = (interval: number): number => Math.min(interval * 1.5, MAX_INTERVAL_MS);

/** Visible x range of a scrolling chart at `now`. */
export const streamWindow = (now: number, span: number, delay: number): StreamWindow => ({
    min: now - delay - span,
    max: now - delay,
});

export type AxisScale = 'binary' | 'decimal';

/** Floors that keep an idle chart readable: 1 KiB for byte charts, 1 % for percentages. */
const AXIS_FLOOR: Record<AxisScale, number> = { binary: 1024, decimal: 1 };
const DECIMAL_STEPS = [1, 2, 2.5, 5, 10];

/**
 * Smallest round number at or above `value`. Byte charts use powers of two so
 * that the middle tick (half of the maximum) is a round binary size as well.
 */
export const niceCeiling = (value: number, scale: AxisScale): number => {
    const target = Math.max(value, AXIS_FLOOR[scale]);
    if (scale === 'binary') {
        return Math.pow(2, Math.ceil(Math.log2(target)));
    }

    const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
    const step = DECIMAL_STEPS.find((candidate) => candidate * magnitude >= target) ?? 10;

    return step * magnitude;
};

/**
 * Top of a chart's y axis. With a limit the chart reads as "how full", and it
 * only grows when a reading overshoots the limit; without one it rounds up
 * from the highest reading of any series.
 */
export const axisMax = (series: readonly (readonly ChartPoint[])[], limit: number, scale: AxisScale): number => {
    const highest = series.reduce((top, points) => points.reduce((peak, point) => Math.max(peak, point.y), top), 0);

    return limit > 0 ? Math.max(limit, highest) : niceCeiling(highest, scale);
};

export interface LiveHistory {
    cpu: ChartPoint[];
    memory: ChartPoint[];
    /** Bytes per second received. */
    rx: ChartPoint[];
    /** Bytes per second sent. */
    tx: ChartPoint[];
    /** Smoothed milliseconds between readings. */
    cadence: number;
    /** Last reading folded in, the base for network rates and cadence. */
    last: StatsSample | null;
}

export const EMPTY_HISTORY: LiveHistory = {
    cpu: [],
    memory: [],
    rx: [],
    tx: [],
    cadence: DEFAULT_INTERVAL_MS,
    last: null,
};

/**
 * Folds a reading into the chart history, returning a new history. Several
 * components ask Wings for stats when the socket connects, so repeats of the
 * last frame are dropped instead of being plotted again later in time.
 */
export const foldSample = (history: LiveHistory, sample: StatsSample): LiveHistory => {
    const { last } = history;
    if (isRepeat(last, sample)) {
        return history;
    }

    const cadence = nextInterval(history.cadence, last ? last.time : null, sample.time);
    const oldest = sample.time - STREAM_SPAN_MS - streamDelay(cadence) - cadence;
    const rate = networkRate(last, sample);
    const at = (y: number): ChartPoint => ({ x: sample.time, y });

    return {
        cpu: appendPoint(history.cpu, at(sample.cpu), oldest),
        memory: appendPoint(history.memory, at(sample.memory), oldest),
        rx: rate ? appendPoint(history.rx, at(rate.rx), oldest) : history.rx,
        tx: rate ? appendPoint(history.tx, at(rate.tx), oldest) : history.tx,
        cadence,
        last: sample,
    };
};
