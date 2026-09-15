package org.grinch.furrguard.common.json;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Lectura null-safe de respuestas JSON de la API. Ningun metodo lanza: si la clave falta, es
 * JSON {@code null} o tiene un tipo que no encaja, se devuelve el valor por defecto.
 */
public final class Json {

    private Json() {
    }

    /** Cadena de cualquier primitivo ({@code 5} → {@code "5"}); objetos, arrays y null → {@code def}. */
    public static String str(JsonObject obj, String key, String def) {
        JsonPrimitive value = primitive(obj, key);
        return value == null ? def : value.getAsString();
    }

    /** Acepta {@code true/false}, {@code 1/0} y las cadenas "true", "1", "yes", "on" (y sus negativos). */
    public static boolean bool(JsonObject obj, String key, boolean def) {
        JsonPrimitive value = primitive(obj, key);
        if (value == null) {
            return def;
        }
        if (value.isBoolean()) {
            return value.getAsBoolean();
        }
        return parseBool(value.getAsString(), def);
    }

    /** Numero o cadena numerica entera dentro del rango de {@code int}; si no, {@code def}. */
    public static int integer(JsonObject obj, String key, int def) {
        BigDecimal value = decimal(obj, key);
        try {
            return value == null ? def : value.intValueExact();
        } catch (ArithmeticException e) {
            return def;
        }
    }

    /** Numero o cadena numerica entera ({@code 3600}, {@code "3600"}, {@code 3600.0}); si no, {@code def}. */
    public static long longValue(JsonObject obj, String key, long def) {
        BigDecimal value = decimal(obj, key);
        try {
            return value == null ? def : value.longValueExact();
        } catch (ArithmeticException e) {
            return def;
        }
    }

    /** El objeto hijo, o un objeto vacio nuevo si falta o no es un objeto. */
    public static JsonObject obj(JsonObject obj, String key) {
        JsonElement value = element(obj, key);
        return value != null && value.isJsonObject() ? value.getAsJsonObject() : new JsonObject();
    }

    /** El array hijo, o un array vacio nuevo si falta o no es un array. */
    public static JsonArray arr(JsonObject obj, String key) {
        JsonElement value = element(obj, key);
        return value != null && value.isJsonArray() ? value.getAsJsonArray() : new JsonArray();
    }

    /**
     * Mapa clave → texto con los valores primitivos del objeto (para {@code get_messages} y
     * {@code get_settings}). Los null, objetos y arrays se omiten en vez de romper la carga entera.
     */
    public static Map<String, String> stringMap(JsonObject obj) {
        if (obj == null) {
            return Map.of();
        }
        Map<String, String> result = new LinkedHashMap<>();
        for (Map.Entry<String, JsonElement> entry : obj.entrySet()) {
            if (entry.getValue() != null && entry.getValue().isJsonPrimitive()) {
                result.put(entry.getKey(), entry.getValue().getAsString());
            }
        }
        return Collections.unmodifiableMap(result);
    }

    private static boolean parseBool(String raw, boolean def) {
        return switch (raw.trim().toLowerCase(Locale.ROOT)) {
            case "true", "1", "yes", "on" -> true;
            case "false", "0", "no", "off" -> false;
            default -> def;
        };
    }

    private static BigDecimal decimal(JsonObject obj, String key) {
        JsonPrimitive value = primitive(obj, key);
        if (value == null || value.isBoolean()) {
            return null;
        }
        try {
            return new BigDecimal(value.getAsString().trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static JsonElement element(JsonObject obj, String key) {
        return obj == null || key == null ? null : obj.get(key);
    }

    private static JsonPrimitive primitive(JsonObject obj, String key) {
        JsonElement value = element(obj, key);
        return value != null && value.isJsonPrimitive() ? value.getAsJsonPrimitive() : null;
    }
}
