package org.grinch.furrGuard.util;

import com.velocitypowered.api.network.ProtocolVersion;

import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.util.List;

public final class Players {

    private Players() {
    }

    /** IP sin ambito IPv6 ({@code %eth0}); el servidor la normaliza (docs/API.md §0). */
    public static String ip(InetSocketAddress address) {
        InetAddress inet = address.getAddress();
        String ip = inet != null ? inet.getHostAddress() : address.getHostString();
        int scope = ip.indexOf('%');
        return scope >= 0 ? ip.substring(0, scope) : ip;
    }

    /** "1.21.2-1.21.3", "1.21.4"... a partir de las versiones que Velocity asocia al protocolo. */
    public static String gameVersion(ProtocolVersion version) {
        List<String> names = version == null ? List.of() : version.getVersionsSupportedBy();
        if (names.isEmpty()) {
            return "Unknown";
        }
        String first = names.get(0);
        String last = names.get(names.size() - 1);
        return first.equals(last) ? first : first + "-" + last;
    }
}
