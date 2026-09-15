package org.grinch.furrguard.common.http;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.Flow;

/**
 * Lee el cuerpo como stream y corta la conexion en cuanto supera el limite, en lugar de
 * descargarlo entero (o una linea entera) y comprobar el tamano despues.
 */
final class LimitedBodySubscriber implements HttpResponse.BodySubscriber<byte[]> {

    static final class TooLargeException extends IOException {
        private static final long serialVersionUID = 1L;

        TooLargeException(int limit) {
            super("respuesta mayor de " + limit + " bytes");
        }
    }

    private final CompletableFuture<byte[]> body = new CompletableFuture<>();
    private final ByteArrayOutputStream buffer = new ByteArrayOutputStream();
    private final int limit;
    private Flow.Subscription subscription;

    LimitedBodySubscriber(int limit) {
        this.limit = limit;
    }

    @Override
    public CompletionStage<byte[]> getBody() {
        return body;
    }

    @Override
    public void onSubscribe(Flow.Subscription subscription) {
        this.subscription = subscription;
        subscription.request(Long.MAX_VALUE);
    }

    @Override
    public void onNext(List<ByteBuffer> items) {
        if (body.isDone()) {
            return;
        }
        for (ByteBuffer item : items) {
            if (item.remaining() > limit - buffer.size()) {
                subscription.cancel();
                body.completeExceptionally(new TooLargeException(limit));
                return;
            }
            byte[] chunk = new byte[item.remaining()];
            item.get(chunk);
            buffer.write(chunk, 0, chunk.length);
        }
    }

    @Override
    public void onError(Throwable error) {
        body.completeExceptionally(error);
    }

    @Override
    public void onComplete() {
        body.complete(buffer.toByteArray());
    }
}
