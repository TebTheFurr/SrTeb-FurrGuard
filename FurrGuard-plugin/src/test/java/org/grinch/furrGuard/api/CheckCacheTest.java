package org.grinch.furrGuard.api;

import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class CheckCacheTest {

    private final AtomicLong now = new AtomicLong(1_000);
    private final CheckCache cache = new CheckCache(now::get);
    private final String key = CheckCache.key(UUID.randomUUID(), "Nick", "1.2.3.4");

    private static CheckResult result(String json) {
        return CheckResult.parse(JsonParser.parseString(json).getAsJsonObject()).orElseThrow();
    }

    @Test
    void expiresAfterTheTtl() {
        cache.put(key, result("{\"allowed\":true}"), Duration.ofNanos(500));

        assertNotNull(cache.get(key));
        now.addAndGet(500);
        assertNull(cache.get(key));
        assertEquals(0, cache.size());
    }

    @Test
    void neverStoresIncompleteDecisions() {
        cache.put(key, result("{\"allowed\":true,\"degraded\":true}"), Duration.ofMinutes(5));
        cache.put(key, result("{\"allowed\":false,\"reason\":\"ip_api_unavailable\"}"), Duration.ofMinutes(5));

        assertNull(cache.get(key));
    }

    @Test
    void sweepAndClearRemoveEntries() {
        cache.put("a", result("{\"allowed\":true}"), Duration.ofNanos(10));
        cache.put("b", result("{\"allowed\":false,\"reason\":\"vpn_detected\"}"), Duration.ofNanos(1_000));
        now.addAndGet(10);

        cache.sweep();
        assertEquals(1, cache.size());
        cache.clear();
        assertEquals(0, cache.size());
    }
}
