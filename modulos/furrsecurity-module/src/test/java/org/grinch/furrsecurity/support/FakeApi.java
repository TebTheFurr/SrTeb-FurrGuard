package org.grinch.furrsecurity.support;

import com.google.gson.JsonParser;
import org.grinch.furrguard.common.http.ApiResult;
import org.grinch.furrguard.common.http.ApiResult.Failure;
import org.grinch.furrguard.common.http.ApiResult.Kind;
import org.grinch.furrguard.common.http.ApiResult.Success;
import org.grinch.furrsecurity.api.Api;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/** API programable: respuestas en cola por accion, una por defecto, o futuros que el test completa. */
public final class FakeApi implements Api {

    public record Call(String action, Map<String, String> form, boolean once) {
    }

    public final List<Call> calls = new ArrayList<>();
    private final List<String> events;
    private final Map<String, Deque<CompletableFuture<ApiResult>>> queued = new HashMap<>();
    private final Map<String, ApiResult> defaults = new HashMap<>();

    public FakeApi(List<String> events) {
        this.events = events;
    }

    public static Success ok(String json) {
        return new Success(200, JsonParser.parseString(json).getAsJsonObject());
    }

    public static Failure failure(Kind kind) {
        return new Failure(kind, 0, "simulado", kind == Kind.RATE_LIMITED ? 30_000 : 0);
    }

    /** Siguiente respuesta (una sola vez) para la accion. */
    public FakeApi reply(String action, ApiResult result) {
        queue(action).add(CompletableFuture.completedFuture(result));
        return this;
    }

    /** Respuesta cuando la cola de la accion esta vacia. Sin ella: fallo de red. */
    public FakeApi always(String action, ApiResult result) {
        defaults.put(action, result);
        return this;
    }

    /** La siguiente llamada queda pendiente hasta que el test complete el futuro. */
    public CompletableFuture<ApiResult> hold(String action) {
        CompletableFuture<ApiResult> future = new CompletableFuture<>();
        queue(action).add(future);
        return future;
    }

    public long count(String action) {
        return calls.stream().filter(call -> call.action().equals(action)).count();
    }

    public Call last(String action) {
        return calls.stream().filter(call -> call.action().equals(action)).reduce((a, b) -> b)
                .orElseThrow(() -> new AssertionError("no se llamo a " + action));
    }

    @Override
    public CompletableFuture<ApiResult> post(String action, Map<String, String> form) {
        return call(action, form, false);
    }

    @Override
    public CompletableFuture<ApiResult> postOnce(String action, Map<String, String> form) {
        return call(action, form, true);
    }

    @Override
    public void close() {
        // nada que liberar
    }

    private CompletableFuture<ApiResult> call(String action, Map<String, String> form, boolean once) {
        calls.add(new Call(action, Map.copyOf(form), once));
        events.add((once ? "api-once:" : "api:") + action);
        CompletableFuture<ApiResult> next = queue(action).poll();
        return next != null ? next
                : CompletableFuture.completedFuture(defaults.getOrDefault(action, failure(Kind.NETWORK)));
    }

    private Deque<CompletableFuture<ApiResult>> queue(String action) {
        return queued.computeIfAbsent(action, key -> new ArrayDeque<>());
    }
}
