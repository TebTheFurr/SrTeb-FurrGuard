package org.grinch.furrguard.common.http;

import java.util.function.LongSupplier;

/**
 * Token bucket con reserva: cada permiso se reserva al pedirlo, asi que las llamadas concurrentes
 * quedan en fila con esperas crecientes en vez de salir todas a la vez al rellenarse el cubo.
 */
final class TokenBucket {

    static final long UNAVAILABLE = -1;

    private final double permitsPerNano;
    private final double capacity;
    private final LongSupplier nanoClock;
    private double tokens;
    private long lastRefill;

    /** Rafaga maxima = {@code permitsPerSecond} (minimo 1). */
    TokenBucket(double permitsPerSecond, LongSupplier nanoClock) {
        this.permitsPerNano = permitsPerSecond / 1_000_000_000d;
        this.capacity = Math.max(1, permitsPerSecond);
        this.nanoClock = nanoClock;
        this.tokens = capacity;
        this.lastRefill = nanoClock.getAsLong();
    }

    /**
     * Reserva un permiso y devuelve los nanosegundos que hay que esperar antes de usarlo (0 = ya).
     * Si la espera superaria {@code maxWaitNanos} no reserva nada y devuelve {@link #UNAVAILABLE}.
     */
    synchronized long reserve(long maxWaitNanos) {
        long now = nanoClock.getAsLong();
        tokens = Math.min(capacity, tokens + (now - lastRefill) * permitsPerNano);
        lastRefill = now;
        long waitNanos = tokens >= 1 ? 0 : (long) Math.ceil((1 - tokens) / permitsPerNano);
        if (waitNanos > maxWaitNanos) {
            return UNAVAILABLE;
        }
        tokens -= 1; // puede quedar en negativo: es la deuda que pagan las siguientes reservas
        return waitNanos;
    }
}
