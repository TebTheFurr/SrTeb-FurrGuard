package org.grinch.furrGuard.license;

import com.google.gson.JsonObject;
import org.grinch.furrGuard.license.LicenseResponses.LicenseInfo;
import org.grinch.furrguard.common.json.Json;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.function.Supplier;
import java.util.regex.Pattern;

/** Archivos de licencia del directorio de datos: {@code key}, {@code hwid} y {@code license-state.json}. */
final class LicenseFiles {

    static final String KEY_FILE = "key";
    static final String HWID_FILE = "hwid";
    static final String STATE_FILE = "license-state.json";
    private static final Pattern HWID = Pattern.compile("[0-9a-f]{64}");

    /** Ultima verificacion correcta: base del periodo de gracia. */
    record SavedState(long lastValidAt, LicenseInfo license) {
    }

    private LicenseFiles() {
    }

    /** El HWID se calcula una sola vez: actualizar Java o el sistema ya no invalida la licencia. */
    static String loadOrCreateHwid(Path directory, Supplier<String> compute) throws IOException {
        Path file = directory.resolve(HWID_FILE);
        if (Files.isRegularFile(file)) {
            String stored = Files.readString(file, StandardCharsets.UTF_8).strip();
            if (HWID.matcher(stored).matches()) {
                return stored;
            }
        }
        String hwid = compute.get();
        writeAtomically(file, hwid + "\n");
        return hwid;
    }

    /** null si no hay archivo o no tiene linea {@code key=}. */
    static String readKey(Path directory) throws IOException {
        Path file = directory.resolve(KEY_FILE);
        if (!Files.isRegularFile(file)) {
            return null;
        }
        for (String line : Files.readAllLines(file, StandardCharsets.UTF_8)) {
            if (line.startsWith("key=") && !line.substring(4).isBlank()) {
                return line.substring(4).strip();
            }
        }
        return null;
    }

    static void writeKey(Path directory, String encryptedKey, String instanceId) throws IOException {
        writeAtomically(directory.resolve(KEY_FILE), "# FurrDownloads License Key\n# DO NOT modify this file\n"
                + "key=" + encryptedKey + "\n"
                + "instance_id=" + (instanceId == null ? "" : instanceId) + "\n");
    }

    // ponytail: estado sin firmar; quien edite el archivo y bloquee el servidor de licencias alarga la
    // gracia. Firmarlo solo sirve si el jar no se puede parchear (va ofuscado, no protegido).
    static void writeState(Path directory, long lastValidAt, LicenseInfo license) throws IOException {
        JsonObject json = new JsonObject();
        json.addProperty("last_valid_at", lastValidAt);
        json.add("license", license.toJson());
        writeAtomically(directory.resolve(STATE_FILE), json + "\n");
    }

    /** null si falta o esta corrupto. */
    static SavedState readState(Path directory) {
        try {
            Path file = directory.resolve(STATE_FILE);
            if (!Files.isRegularFile(file)) {
                return null;
            }
            JsonObject json = LicenseResponses.parseObject(Files.readString(file, StandardCharsets.UTF_8));
            long lastValidAt = json == null ? -1 : Json.longValue(json, "last_valid_at", -1);
            return lastValidAt > 0 ? new SavedState(lastValidAt, LicenseInfo.parse(Json.obj(json, "license"))) : null;
        } catch (IOException | RuntimeException e) {
            return null;
        }
    }

    static void deleteKeyAndState(Path directory) throws IOException {
        Files.deleteIfExists(directory.resolve(KEY_FILE));
        Files.deleteIfExists(directory.resolve(STATE_FILE));
    }

    static String sha256Hex(String data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(data.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible", e); // obligatorio en toda JVM
        }
    }

    /** Un corte a mitad de escritura no deja el archivo key a medias. */
    private static void writeAtomically(Path file, String content) throws IOException {
        Files.createDirectories(file.toAbsolutePath().getParent());
        Path temp = file.resolveSibling(file.getFileName() + ".tmp");
        Files.writeString(temp, content, StandardCharsets.UTF_8);
        try {
            Files.move(temp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException e) {
            Files.move(temp, file, StandardCopyOption.REPLACE_EXISTING);
        }
    }
}
