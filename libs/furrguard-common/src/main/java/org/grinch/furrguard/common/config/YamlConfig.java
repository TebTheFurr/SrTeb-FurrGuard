package org.grinch.furrguard.common.config;

import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.nio.file.FileAlreadyExistsException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Configuracion YAML de solo lectura. Carga con {@link SafeConstructor} (sin tags de clases Java)
 * y <b>nunca lanza</b>: los errores vuelven en {@link LoadResult#error()} y los getters devuelven
 * el valor por defecto cuando la ruta falta o el tipo no encaja.
 *
 * <p>Rutas con puntos: {@code "lock.movement"} lee {@code lock: { movement: ... }}.
 */
public final class YamlConfig {

    private static final YamlConfig EMPTY = new YamlConfig(Map.of());

    private final Map<?, ?> root;

    private YamlConfig(Map<?, ?> root) {
        this.root = root;
    }

    /**
     * Resultado de una carga. Si {@code error} no es null, {@code config} esta vacia (todos los
     * getters devuelven su defecto); en una recarga puede preferirse conservar la configuracion anterior.
     */
    public record LoadResult(YamlConfig config, String error) {
        public boolean ok() {
            return error == null;
        }
    }

    public static YamlConfig empty() {
        return EMPTY;
    }

    /**
     * Si {@code file} no existe lo crea copiando el recurso {@code defaultsResource} de {@code loader}
     * (normalmente {@code getClass().getClassLoader()} del plugin) y despues lo carga.
     */
    public static LoadResult load(Path file, ClassLoader loader, String defaultsResource) {
        try {
            if (Files.notExists(file)) {
                try (InputStream defaults = loader.getResourceAsStream(defaultsResource)) {
                    if (defaults == null) {
                        return failure("no se encontro el recurso por defecto '" + defaultsResource + "'");
                    }
                    Path parent = file.toAbsolutePath().getParent();
                    if (parent != null) {
                        Files.createDirectories(parent);
                    }
                    Files.copy(defaults, file);
                }
            }
        } catch (FileAlreadyExistsException e) {
            // otro proceso lo creo a la vez: se carga el existente
        } catch (IOException | RuntimeException e) {
            return failure("no se pudo crear " + nameOf(file) + ": " + describe(e));
        }
        return load(file);
    }

    public static LoadResult load(Path file) {
        String name = nameOf(file);
        try (InputStream in = Files.newInputStream(file)) {
            // load(InputStream) detecta BOM y decodifica UTF-8/UTF-16 de forma estricta
            Object parsed = newYaml().load(in);
            if (parsed == null) {
                return new LoadResult(EMPTY, null);
            }
            if (!(parsed instanceof Map<?, ?> map)) {
                return failure("la raiz de " + name + " debe ser un mapa clave: valor");
            }
            return new LoadResult(new YamlConfig(map), null);
        } catch (IOException | RuntimeException e) {
            // RuntimeException cubre YAMLException (con linea y columna) y cualquier fallo del parser
            return failure("no se pudo leer " + name + ": " + describe(e));
        }
    }

    public String string(String path, String def) {
        Object value = get(path);
        return isScalar(value) ? String.valueOf(value) : def;
    }

    public int integer(String path, int def) {
        Long value = toLong(get(path));
        return value != null && value >= Integer.MIN_VALUE && value <= Integer.MAX_VALUE
                ? value.intValue() : def;
    }

    public long longValue(String path, long def) {
        Long value = toLong(get(path));
        return value != null ? value : def;
    }

    /** Booleano YAML, cadenas "true/false/yes/no/on/off" o numeros 1/0; si no, {@code def}. */
    public boolean bool(String path, boolean def) {
        Object value = get(path);
        if (value instanceof Boolean flag) {
            return flag;
        }
        if (!isScalar(value)) {
            return def;
        }
        return switch (String.valueOf(value).trim().toLowerCase(Locale.ROOT)) {
            case "true", "yes", "on", "1" -> true;
            case "false", "no", "off", "0" -> false;
            default -> def;
        };
    }

    /**
     * Lista YAML (cada escalar pasa a texto) o cadena CSV ({@code "op,lp"}). Los elementos nulos o
     * anidados se omiten. Si la ruta falta o es un mapa → {@code def}. Devuelve una lista inmutable.
     */
    public List<String> stringList(String path, List<String> def) {
        List<?> items = items(get(path));
        if (items == null) {
            return def;
        }
        List<String> result = new ArrayList<>();
        for (Object item : items) {
            if (isScalar(item)) {
                result.add(String.valueOf(item));
            }
        }
        return Collections.unmodifiableList(result);
    }

    /**
     * Como {@link #stringList} pero numerica: acepta Integer, Long, BigInteger, decimales enteros y
     * texto ({@code [3600, "60"]} o {@code "3600,60"}). Los elementos no numericos se omiten.
     */
    public List<Long> longList(String path, List<Long> def) {
        List<?> items = items(get(path));
        if (items == null) {
            return def;
        }
        List<Long> result = new ArrayList<>();
        for (Object item : items) {
            Long value = toLong(item);
            if (value != null) {
                result.add(value);
            }
        }
        return Collections.unmodifiableList(result);
    }

    private Object get(String path) {
        if (path == null || path.isEmpty()) {
            return null;
        }
        Object current = root;
        for (String part : path.split("\\.", -1)) {
            if (!(current instanceof Map<?, ?> map)) {
                return null;
            }
            current = map.get(part);
        }
        return current;
    }

    /** Lista tal cual, un escalar como CSV, o null si no es ninguno de los dos. */
    private static List<?> items(Object value) {
        if (value instanceof List<?> list) {
            return list;
        }
        if (!isScalar(value)) {
            return null;
        }
        List<String> parts = new ArrayList<>();
        for (String part : String.valueOf(value).split(",")) {
            if (!part.isBlank()) {
                parts.add(part.trim());
            }
        }
        return parts;
    }

    private static boolean isScalar(Object value) {
        return value instanceof String || value instanceof Number || value instanceof Boolean;
    }

    private static Long toLong(Object value) {
        if (value instanceof Integer || value instanceof Long || value instanceof Short || value instanceof Byte) {
            return ((Number) value).longValue();
        }
        if (value instanceof BigInteger big) {
            return big.bitLength() < 64 ? big.longValue() : null;
        }
        if (value instanceof Number || value instanceof String) {
            try {
                return new BigDecimal(String.valueOf(value).trim()).longValueExact();
            } catch (NumberFormatException | ArithmeticException e) {
                return null; // "abc", 1.5, NaN, fuera de rango
            }
        }
        return null;
    }

    private static Yaml newYaml() {
        LoaderOptions options = new LoaderOptions(); // limites de alias, anidamiento y tamano por defecto
        return new Yaml(new SafeConstructor(options));
    }

    private static LoadResult failure(String error) {
        return new LoadResult(EMPTY, error);
    }

    private static String nameOf(Path file) {
        return file == null || file.getFileName() == null ? String.valueOf(file) : file.getFileName().toString();
    }

    private static String describe(Exception e) {
        String message = e.getMessage();
        return message == null || message.isBlank() ? e.getClass().getSimpleName() : message.strip();
    }
}
