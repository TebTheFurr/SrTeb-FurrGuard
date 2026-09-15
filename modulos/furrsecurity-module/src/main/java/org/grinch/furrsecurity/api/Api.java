package org.grinch.furrsecurity.api;

import org.grinch.furrguard.common.http.ApiClient;
import org.grinch.furrguard.common.http.ApiResult;
import org.grinch.furrguard.common.http.ApiResult.Failure;
import org.grinch.furrguard.common.http.ApiResult.Kind;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Lo que el modulo usa de {@code api/furrsecurity.php}. Existe para probar la logica sin red; en
 * produccion es un {@link ApiClient}. Los futuros nunca completan con excepcion.
 */
public interface Api extends AutoCloseable {

    CompletableFuture<ApiResult> post(String action, Map<String, String> form);

    /** Acciones no idempotentes ({@code record_failed_attempt}, {@code player_disconnect}). */
    CompletableFuture<ApiResult> postOnce(String action, Map<String, String> form);

    @Override
    void close();

    /** Sin red: toda llamada falla con {@code NOT_CONFIGURED} (fallar en cerrado hasta tener cliente). */
    static Api unavailable(String reason) {
        CompletableFuture<ApiResult> failure = CompletableFuture.completedFuture(new Failure(Kind.NOT_CONFIGURED, 0, reason, 0));
        return new Api() {
            @Override
            public CompletableFuture<ApiResult> post(String action, Map<String, String> form) {
                return failure;
            }

            @Override
            public CompletableFuture<ApiResult> postOnce(String action, Map<String, String> form) {
                return failure;
            }

            @Override
            public void close() {
                // nada que liberar
            }
        };
    }

    static Api of(ApiClient client) {
        return new Api() {
            @Override
            public CompletableFuture<ApiResult> post(String action, Map<String, String> form) {
                return client.post(action, form);
            }

            @Override
            public CompletableFuture<ApiResult> postOnce(String action, Map<String, String> form) {
                return client.postOnce(action, form);
            }

            @Override
            public void close() {
                client.close();
            }
        };
    }
}
