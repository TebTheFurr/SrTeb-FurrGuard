package org.grinch.furrguard.common.json;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JsonTest {

    private static JsonObject json(String text) {
        return JsonParser.parseString(text).getAsJsonObject();
    }

    @Test
    void jsonNullAndMissingKeysReturnDefaults() {
        JsonObject body = json("{\"reason\": null, \"ban_id\": null, \"session\": null, \"list\": null}");

        assertEquals("def", Json.str(body, "reason", "def"));
        assertNull(Json.str(body, "ban_id", null));
        assertEquals("def", Json.str(body, "missing", "def"));
        assertTrue(Json.bool(body, "reason", true));
        assertEquals(7, Json.integer(body, "reason", 7));
        assertEquals(9L, Json.longValue(body, "missing", 9L));
        assertTrue(Json.obj(body, "session").entrySet().isEmpty());
        assertEquals(0, Json.arr(body, "list").size());
    }

    @Test
    void nullObjectOrKeyNeverThrows() {
        assertEquals("d", Json.str(null, "k", "d"));
        assertEquals("d", Json.str(new JsonObject(), null, "d"));
        assertTrue(Json.obj(null, "k").entrySet().isEmpty());
        assertTrue(Json.stringMap(null).isEmpty());
    }

    @Test
    void wrongTypesReturnDefaults() {
        JsonObject body = json("{\"ip_data\": [], \"allowed\": {\"x\": 1}, \"n\": \"abc\", \"f\": 1.5,"
                + " \"big\": 99999999999, \"flag\": true, \"arr\": {}}");

        assertTrue(Json.obj(body, "ip_data").entrySet().isEmpty(), "array donde se espera objeto");
        assertEquals(0, Json.arr(body, "arr").size(), "objeto donde se espera array");
        assertFalse(Json.bool(body, "allowed", false), "objeto donde se espera booleano");
        assertEquals("def", Json.str(body, "allowed", "def"));
        assertEquals(-1, Json.integer(body, "n", -1));
        assertEquals(-1, Json.integer(body, "f", -1), "decimal no entero");
        assertEquals(-1, Json.integer(body, "big", -1), "fuera de rango int");
        assertEquals(99999999999L, Json.longValue(body, "big", -1));
        assertEquals(-1, Json.longValue(body, "flag", -1), "booleano donde se espera numero");
    }

    @Test
    void lenientScalarConversions() {
        JsonObject body = json("{\"a\": 1, \"b\": \"0\", \"c\": \"true\", \"d\": \"yes\", \"e\": 2,"
                + " \"num\": \"3600\", \"dec\": 60.0, \"version\": 5}");

        assertTrue(Json.bool(body, "a", false));
        assertFalse(Json.bool(body, "b", true));
        assertTrue(Json.bool(body, "c", false));
        assertTrue(Json.bool(body, "d", false));
        assertFalse(Json.bool(body, "e", false), "2 no es un booleano: defecto");
        assertEquals(3600, Json.integer(body, "num", 0));
        assertEquals(60L, Json.longValue(body, "dec", 0));
        assertEquals("5", Json.str(body, "version", null));
    }

    @Test
    void stringMapSkipsNullsObjectsAndArrays() {
        JsonObject body = json("{\"server_name\": \"Tebby\", \"cache_version\": 3, \"notify\": true,"
                + " \"discord_url\": null, \"nested\": {}, \"list\": []}");

        Map<String, String> map = Json.stringMap(body);

        assertEquals(Map.of("server_name", "Tebby", "cache_version", "3", "notify", "true"), map);
    }
}
