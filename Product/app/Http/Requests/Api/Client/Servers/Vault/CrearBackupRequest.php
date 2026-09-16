<?php

declare(strict_types=1);

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Vault;

use Illuminate\Validation\Rule;

class CrearBackupRequest extends VaultRequest
{
    public function rules(): array
    {
        return [
            'alcance' => ['required', 'string', Rule::in(['completa', 'sin_mundos', 'mundos', 'rutas'])],
            'rutas' => ['required_if:alcance,rutas', 'array', 'max:1000'],
            'rutas.*' => ['required', 'string', 'max:' . self::MAX_PATH_LENGTH],
            'nota' => ['nullable', 'string', 'max:500'],
        ];
    }
}
