package org.grinch.furrGuard.util;

import com.velocitypowered.api.network.ProtocolVersion;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.UnknownHostException;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PlayersTest {

    // Las etiquetas antiguas de 766-769 y 774 estaban desplazadas una version
    @ParameterizedTest
    @CsvSource({
            "766, 1.20.5-1.20.6",
            "767, 1.21-1.21.1",
            "768, 1.21.2-1.21.3",
            "769, 1.21.4",
            "774, 1.21.11",
            "765, 1.20.3-1.20.4",
            "47, 1.8-1.8.9"})
    void labelsComeFromVelocity(int protocol, String expected) {
        assertEquals(expected, Players.gameVersion(ProtocolVersion.getProtocolVersion(protocol)));
    }

    @Test
    void unknownProtocols() {
        assertEquals("Unknown", Players.gameVersion(ProtocolVersion.getProtocolVersion(99_999)));
        assertEquals("Unknown", Players.gameVersion(null));
    }

    @Test
    void ipDropsTheIpv6Scope() throws UnknownHostException {
        InetAddress linkLocal = InetAddress.getByName("fe80::1%1");

        assertEquals("fe80:0:0:0:0:0:0:1", Players.ip(new InetSocketAddress(linkLocal, 25565)));
        assertEquals("1.2.3.4", Players.ip(new InetSocketAddress(InetAddress.getByName("1.2.3.4"), 25565)));
    }
}
