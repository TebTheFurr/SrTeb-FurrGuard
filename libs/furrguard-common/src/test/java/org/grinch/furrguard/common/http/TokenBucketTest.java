package org.grinch.furrguard.common.http;

import org.junit.jupiter.api.Test;

import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TokenBucketTest {

    private static final long MS = TimeUnit.MILLISECONDS.toNanos(1);

    private static void assertNear(long expectedNanos, long actualNanos) {
        assertTrue(Math.abs(expectedNanos - actualNanos) <= 1, "esperado " + expectedNanos + ", fue " + actualNanos);
    }

    @Test
    void burstThenQueuedReservationsThenRefill() {
        AtomicLong clock = new AtomicLong(1_000 * MS);
        TokenBucket bucket = new TokenBucket(2, clock::get); // 2/s, rafaga de 2

        assertEquals(0, bucket.reserve(0));
        assertEquals(0, bucket.reserve(0));
        assertEquals(TokenBucket.UNAVAILABLE, bucket.reserve(100 * MS), "no reserva si no puede esperar");
        assertNear(500 * MS, bucket.reserve(Long.MAX_VALUE));
        assertNear(1_000 * MS, bucket.reserve(Long.MAX_VALUE)); // las reservas concurrentes hacen fila

        clock.addAndGet(10_000 * MS); // se rellena hasta la rafaga, no mas
        assertEquals(0, bucket.reserve(0));
        assertEquals(0, bucket.reserve(0));
        assertNear(500 * MS, bucket.reserve(Long.MAX_VALUE));
    }
}
