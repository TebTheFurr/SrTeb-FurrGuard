package org.grinch.furrpermsModule.access;

import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

/**
 * Decisiones sin llamar a la API: autorizaciones en cache 30 s por nick (solo para el mismo UUID e IP)
 * y un enfriamiento de 5 s tras un intento denegado, para que insistir no martillee la API ni los logs.
 */
public final class AccessGate {

    public static final long GRANT_TTL_MILLIS = 30_000;
    public static final long COOLDOWN_MILLIS = 5_000;

    private final Map<String, Grant> grants = new ConcurrentHashMap<>();
    private final Map<UUID, Long> cooldowns = new ConcurrentHashMap<>();
    private final LongSupplier clock;

    public AccessGate(LongSupplier clock) {
        this.clock = clock;
    }

    /** {@link AccessDecision#COOLDOWN}, {@link AccessDecision#CACHED_GRANT} o {@code null} si hay que preguntar. */
    public AccessDecision cached(String nick, UUID uuid, String ip) {
        long now = clock.getAsLong();
        Long cooldownUntil = cooldowns.get(uuid);
        if (cooldownUntil != null && now < cooldownUntil) {
            return AccessDecision.COOLDOWN;
        }
        Grant grant = grants.get(key(nick));
        if (grant != null && now < grant.until() && grant.uuid().equals(uuid) && grant.ip().equals(ip)) {
            return AccessDecision.CACHED_GRANT;
        }
        return null;
    }

    /** Guarda lo que respondio la API: un "ok" se cachea; una denegacion anula la cache y enfria. */
    public void remember(String nick, UUID uuid, String ip, AccessDecision decision) {
        long now = clock.getAsLong();
        if (!decision.allowed()) {
            grants.remove(key(nick));
            cooldowns.put(uuid, now + COOLDOWN_MILLIS);
        } else if ("ok".equals(decision.reason())) {
            grants.put(key(nick), new Grant(uuid, ip, now + GRANT_TTL_MILLIS));
        }
    }

    /** Al desconectarse. */
    public void forget(String nick, UUID uuid) {
        grants.remove(key(nick));
        cooldowns.remove(uuid);
    }

    private static String key(String nick) {
        return nick.toLowerCase(Locale.ROOT);
    }

    private record Grant(UUID uuid, String ip, long until) {
    }
}
