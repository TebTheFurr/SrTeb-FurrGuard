package org.grinch.furrGuard.license;

import org.grinch.furrGuard.license.LicenseResponses.LicenseInfo;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

class LicenseFilesTest {

    @TempDir
    Path dir;

    @Test
    void hwidIsComputedOnceAndReused() throws IOException {
        AtomicInteger computed = new AtomicInteger();
        String first = LicenseFiles.loadOrCreateHwid(dir, () -> {
            computed.incrementAndGet();
            return LicenseFiles.sha256Hex("java 17");
        });
        // Otra version de Java daria otro hash: el archivo manda
        String second = LicenseFiles.loadOrCreateHwid(dir, () -> {
            computed.incrementAndGet();
            return LicenseFiles.sha256Hex("java 21");
        });

        assertEquals(first, second);
        assertEquals(1, computed.get());
    }

    @Test
    void corruptHwidFileIsRegenerated() throws IOException {
        Files.writeString(dir.resolve(LicenseFiles.HWID_FILE), "not-a-hash");

        String hwid = LicenseFiles.loadOrCreateHwid(dir, () -> LicenseFiles.sha256Hex("x"));

        assertEquals(LicenseFiles.sha256Hex("x"), hwid);
        assertEquals(hwid, Files.readString(dir.resolve(LicenseFiles.HWID_FILE)).strip());
    }

    @Test
    void keyAndStateRoundTripAndDeletion() throws IOException {
        LicenseInfo info = new LicenseInfo("FurrGuard", "grinch", "owner", 1, 3, false, "2027-01-01 00:00:00");
        LicenseFiles.writeKey(dir, "encrypted==", "i-1");
        LicenseFiles.writeState(dir, 12345L, info);

        assertEquals("encrypted==", LicenseFiles.readKey(dir));
        LicenseFiles.SavedState state = LicenseFiles.readState(dir);
        assertEquals(12345L, state.lastValidAt());
        assertEquals(info, state.license());

        LicenseFiles.deleteKeyAndState(dir);
        assertNull(LicenseFiles.readKey(dir));
        assertNull(LicenseFiles.readState(dir));
        assertFalse(Files.exists(dir.resolve(LicenseFiles.KEY_FILE + ".tmp")));
    }

    @Test
    void legacyKeyFileIsRead() throws IOException {
        Files.writeString(dir.resolve(LicenseFiles.KEY_FILE),
                "# FurrDownloads License Key\n# DO NOT modify this file\nkey=abc123\ninstance_id=i-9\n");

        assertEquals("abc123", LicenseFiles.readKey(dir));
    }

    @Test
    void corruptStateMeansNoGrace() throws IOException {
        Files.writeString(dir.resolve(LicenseFiles.STATE_FILE), "{\"last_valid_at\":\"soon\"}");
        assertNull(LicenseFiles.readState(dir));

        Files.writeString(dir.resolve(LicenseFiles.STATE_FILE), "garbage");
        assertNull(LicenseFiles.readState(dir));
    }
}
