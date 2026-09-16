<?php

declare(strict_types=1);

namespace Pterodactyl\Exceptions\FurrGuard;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\RedirectResponse;
use Prologue\Alerts\AlertsMessageBag;
use Pterodactyl\Exceptions\DisplayException;

/**
 * An error answered by FurrGuard, or the failure to reach it at all.
 *
 * On API requests it renders in Pterodactyl's error format with the FurrGuard
 * code as `code` and its (Spanish) message as `detail`, so the page can branch
 * on codes such as `session_expired`, `no_access` or `validation`. Extra data
 * (the `field` of a validation error, the Discord name on `no_access`) travels
 * in `meta`.
 */
class FurrGuardException extends DisplayException
{
    public const UNREACHABLE = 'unreachable';
    public const NOT_CONFIGURED = 'not_configured';
    public const NO_ACCESS = 'no_access';

    /** Codes FurrGuard answers with 401 when the token no longer identifies a session. */
    public const SESSION_CODES = ['unauthorized', 'session_expired', 'access_revoked'];

    public function __construct(
        private int $status,
        private string $slug,
        string $message,
        private array $meta = [],
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, $previous, $status >= 500 ? self::LEVEL_ERROR : self::LEVEL_WARNING);
    }

    /**
     * FurrGuard could not be reached (DNS, TLS, timeout, proxy error...). The
     * message is deliberately generic: the details only go to the log.
     */
    public static function unreachable(?\Throwable $previous = null): self
    {
        return new self(503, self::UNREACHABLE, 'No se pudo conectar con FurrGuard', [], $previous);
    }

    public static function notConfigured(): self
    {
        return new self(503, self::NOT_CONFIGURED, 'La integración con FurrGuard no está configurada');
    }

    public function getStatusCode(): int
    {
        return $this->status;
    }

    public function getSlug(): string
    {
        return $this->slug;
    }

    public function getMeta(): array
    {
        return $this->meta;
    }

    public function is(string $code): bool
    {
        return $this->slug === $code;
    }

    /**
     * The FurrGuard session behind the request is gone: the page must show the
     * Discord sign-in again.
     */
    public function isSessionError(): bool
    {
        return $this->status === 401 && in_array($this->slug, self::SESSION_CODES, true);
    }

    /**
     * Pterodactyl's JSON error structure for this error.
     */
    public function toErrorArray(): array
    {
        $error = [
            'code' => $this->slug,
            'status' => (string) $this->status,
            'detail' => $this->getMessage(),
        ];

        if ($this->meta !== []) {
            $error['meta'] = $this->meta;
        }

        return ['errors' => [$error]];
    }

    public function render(Request $request): JsonResponse|RedirectResponse
    {
        if ($request->expectsJson()) {
            return new JsonResponse($this->toErrorArray(), $this->status);
        }

        app(AlertsMessageBag::class)->danger($this->getMessage())->flash();

        return redirect()->back()->withInput();
    }

    /**
     * Client errors (expired session, validation, duplicates...) are normal
     * operation and connection failures are already logged with their context
     * by the client, so only unexpected server-side errors produce a log line.
     */
    public function report()
    {
        if ($this->status < 500 || $this->slug === self::UNREACHABLE) {
            return null;
        }

        Log::warning('FurrGuard request failed.', ['code' => $this->slug, 'status' => $this->status]);

        return null;
    }
}
