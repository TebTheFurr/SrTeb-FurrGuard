package org.grinch.furrpermsModule.access;

import org.junit.jupiter.api.Test;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class AccessGateTest {

    private static final UUID BOB = UUID.randomUUID();
    private static final String IP = "203.0.113.7";

    private final AtomicLong now = new AtomicLong(1_000_000);
    private final AccessGate gate = new AccessGate(now::get);

    @Test
    void aGrantIsCachedForThirtySecondsForTheSameNick() {
        gate.remember("Bob", BOB, IP, new AccessDecision(true, "ok"));

        assertEquals(AccessDecision.CACHED_GRANT, gate.cached("bob", BOB, IP));
        now.addAndGet(AccessGate.GRANT_TTL_MILLIS - 1);
        assertEquals(AccessDecision.CACHED_GRANT, gate.cached("Bob", BOB, IP));
        now.addAndGet(1);
        assertNull(gate.cached("Bob", BOB, IP), "caducada: se vuelve a preguntar");
    }

    @Test
    void aCachedGrantNeverServesAnotherAccountOrIp() {
        gate.remember("Bob", BOB, IP, new AccessDecision(true, "ok"));

        assertNull(gate.cached("Bob", UUID.randomUUID(), IP), "mismo nick, otra cuenta (modo offline)");
        assertNull(gate.cached("Bob", BOB, "198.51.100.1"), "misma cuenta, otra IP");
    }

    @Test
    void aDenialStartsACooldownAndDropsTheCachedGrant() {
        gate.remember("Bob", BOB, IP, new AccessDecision(true, "ok"));
        gate.remember("Bob", BOB, IP, new AccessDecision(false, "needs_furrsecurity"));

        assertEquals(AccessDecision.COOLDOWN, gate.cached("Bob", BOB, IP));
        now.addAndGet(AccessGate.COOLDOWN_MILLIS);
        assertNull(gate.cached("Bob", BOB, IP));
    }

    @Test
    void onlyOkGrantsAreCached() {
        gate.remember("Bob", BOB, IP, new AccessDecision(true, "module_disabled"));

        assertNull(gate.cached("Bob", BOB, IP));
    }

    @Test
    void forgettingOnDisconnectClearsBoth() {
        gate.remember("Bob", BOB, IP, new AccessDecision(false, "not_whitelisted"));
        gate.forget("Bob", BOB);

        assertNull(gate.cached("Bob", BOB, IP));
    }
}
