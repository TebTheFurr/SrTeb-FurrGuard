<?php

declare(strict_types=1);

namespace Pterodactyl\Exceptions\Vault;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\RedirectResponse;
use Prologue\Alerts\AlertsMessageBag;
use Pterodactyl\Exceptions\DisplayException;

/**
 * An error answered by the Tebby Vault, or the failure to reach it at all.
 *
 * On API requests it renders in Pterodactyl's error format with the vault code
 * as `code` and the vault's (Spanish) message as `detail`, so the client can
 * branch on codes such as `sesion_panel`, `ocupado` or `sin_acceso`. Extra data
 * the vault attached to the error (e.g. the active job on `ocupado`) travels in
 * `meta.datos`.
 */
class VaultException extends DisplayException
{
    public const SIN_CONEXION = 'sin_conexion';
    public const SESION_PANEL = 'sesion_panel';
    public const SIN_ACCESO = 'sin_acceso';
    public const NO_CONFIGURADO = 'no_configurado';
    public const DESPACHO = 'despacho';

    public function __construct(
        private int $status,
        private string $codigo,
        string $mensaje,
        private array $datos = [],
        private ?string $ref = null,
        ?\Throwable $previous = null,
    ) {
        parent::__construct($mensaje, $previous, $status >= 500 ? self::LEVEL_ERROR : self::LEVEL_WARNING);
    }

    /**
     * The vault could not be reached (DNS, TLS, timeout, proxy error...). The
     * message is deliberately generic: the details only go to the log.
     */
    public static function sinConexion(?\Throwable $previous = null): self
    {
        return new self(503, self::SIN_CONEXION, 'No se pudo conectar con el Vault', [], null, $previous);
    }

    public static function noConfigurado(): self
    {
        return new self(503, self::NO_CONFIGURADO, 'La integración con el Vault no está configurada');
    }

    public function getStatusCode(): int
    {
        return $this->status;
    }

    public function getCodigo(): string
    {
        return $this->codigo;
    }

    public function getDatos(): array
    {
        return $this->datos;
    }

    public function getRef(): ?string
    {
        return $this->ref;
    }

    public function is(string $codigo): bool
    {
        return $this->codigo === $codigo;
    }

    /**
     * Returns a copy of this error carrying different extra data.
     */
    public function withDatos(array $datos): self
    {
        return new self($this->status, $this->codigo, $this->getMessage(), $datos, $this->ref, $this->getPrevious());
    }

    /**
     * Pterodactyl's JSON error structure for this error.
     */
    public function toErrorArray(): array
    {
        $error = [
            'code' => $this->codigo,
            'status' => (string) $this->status,
            'detail' => $this->getMessage(),
        ];

        $meta = array_filter([
            'datos' => $this->datos === [] ? null : $this->datos,
            'ref' => $this->ref,
        ], fn ($value) => !is_null($value));

        if ($meta !== []) {
            $error['meta'] = $meta;
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
     * Client errors from the vault (expired session, no access, busy server...)
     * are part of normal operation and connection failures are already logged
     * with their context by the VaultClient, so only unexpected server-side
     * errors produce a log line here.
     */
    public function report()
    {
        if ($this->status < 500 || $this->codigo === self::SIN_CONEXION) {
            return null;
        }

        Log::warning('Tebby Vault request failed.', [
            'codigo' => $this->codigo,
            'status' => $this->status,
            'ref' => $this->ref,
        ]);

        return null;
    }
}
