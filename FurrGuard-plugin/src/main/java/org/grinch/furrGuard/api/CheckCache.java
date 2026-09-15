package org.grinch.furrGuard.api;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

/** Respuestas correctas de {@code check_player} por jugador e IP, con caducidad y tope de tamano. */
public final class CheckCache {

    static final int MAX_ENTRIES = 10_000;

    private record Entry(CheckResult result, long expiresAtNanos) {
    }

    private final Map<String, Entry> entries = new ConcurrentHashMap<>();
    private final LongSupplier nanoClock;

    public CheckCache() {
        this(System::nanoTime);
    }

    CheckCache(LongSupplier nanoClock) {
        this.nanoClock = nanoClock;
    }

    public static String key(UUID uuid, String nick, String ip) {
        return uuid + "|" + nick + "|" + ip;
    }

    /** null si no hay entrada o ya caduco. */
    public CheckResult get(String key) {
        Entry entry = entries.get(key);
        if (entry == null) {
            return null;
        }
        if (entry.expiresAtNanos - nanoClock.getAsLong() <= 0) {
            entries.remove(key, entry);
            return null;
        }
        return entry.result;
    }

    /** Ignora decisiones no cacheables ({@link CheckResult#cacheable()}). */
    public void put(String key, CheckResult result, Duration ttl) {
        if (!result.cacheable() || ttl.isNegative() || ttl.isZero()) {
            return;
        }
        if (entries.size() >= MAX_ENTRIES) {
            sweep();
            if (entries.size() >= MAX_ENTRIES) {
                return; // ponytail: sin desalojo LRU; con 10k entradas vivas solo se deja de cachear
            }
        }
        entries.put(key, new Entry(result, nanoClock.getAsLong() + ttl.toNanos()));
    }

    public void sweep() {
        long now = nanoClock.getAsLong();
        entries.values().removeIf(entry -> entry.expiresAtNanos - now <= 0);
    }

    public void clear() {
        entries.clear();
    }

    public int size() {
        return entries.size();
    }
}
