package org.grinch.furrguard.common.log;

import java.util.Objects;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

/**
 * Logger minimo comun a Velocity (SLF4J) y Paper (JUL), sin depender de ninguno.
 *
 * <pre>{@code
 * // Velocity (org.slf4j.Logger)
 * PluginLogger log = PluginLogger.of(slf4j::info, slf4j::warn, slf4j::error);
 * // Paper (java.util.logging.Logger)
 * PluginLogger log = PluginLogger.of(jul::info, jul::warning, (m, t) -> jul.log(Level.SEVERE, m, t));
 * }</pre>
 */
public interface PluginLogger {

    void info(String message);

    void warn(String message);

    /** {@code error} puede ser {@code null}. */
    void error(String message, Throwable error);

    default void error(String message) {
        error(message, null);
    }

    static PluginLogger of(Consumer<String> info, Consumer<String> warn, BiConsumer<String, Throwable> error) {
        Objects.requireNonNull(info, "info");
        Objects.requireNonNull(warn, "warn");
        Objects.requireNonNull(error, "error");
        return new PluginLogger() {
            @Override
            public void info(String message) {
                info.accept(message);
            }

            @Override
            public void warn(String message) {
                warn.accept(message);
            }

            @Override
            public void error(String message, Throwable throwable) {
                error.accept(message, throwable);
            }
        };
    }
}
