<?php

declare(strict_types=1);

namespace Pterodactyl\Services\Vault;

use Illuminate\Http\Request;
use Pterodactyl\Models\User;

/**
 * Who a request to the vault is made for: the Discord session of the end user
 * (if any) plus the panel user and browser IP the vault records for auditing.
 */
final class VaultContext
{
    private const MAX_ACTOR_LENGTH = 120;

    public function __construct(
        public readonly ?string $sesion = null,
        public readonly ?string $actor = null,
        public readonly ?string $ip = null,
    ) {
    }

    /**
     * Requests made by the panel itself (scheduler, console commands).
     */
    public static function system(): self
    {
        return new self();
    }

    public static function forRequest(Request $request, ?string $sesion = null): self
    {
        $user = $request->user();
        $actor = $user instanceof User ? $user->id . ':' . $user->username : null;

        return new self($sesion, $actor, $request->ip());
    }

    /**
     * The optional X-Vault-* headers for this context.
     *
     * @return array<string, string>
     */
    public function headers(): array
    {
        $headers = [];

        if (!is_null($this->sesion) && $this->sesion !== '') {
            $headers['X-Vault-Sesion'] = $this->sesion;
        }

        $actor = is_null($this->actor) ? '' : self::headerSafe($this->actor, self::MAX_ACTOR_LENGTH);
        if ($actor !== '') {
            $headers['X-Vault-Actor'] = $actor;
        }

        if (!is_null($this->ip) && filter_var($this->ip, FILTER_VALIDATE_IP) !== false) {
            $headers['X-Vault-IP'] = $this->ip;
        }

        return $headers;
    }

    /**
     * Header values must be plain printable ASCII: anything else is replaced so
     * a strange username can neither break the request nor smuggle a header.
     */
    private static function headerSafe(string $value, int $maxLength): string
    {
        $clean = preg_replace('/[^\x20-\x7E]/', '?', $value) ?? '';

        return substr(trim($clean), 0, $maxLength);
    }
}
