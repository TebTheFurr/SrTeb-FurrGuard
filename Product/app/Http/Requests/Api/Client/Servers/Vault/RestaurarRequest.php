<?php

declare(strict_types=1);

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Vault;

use Illuminate\Validation\Rule;

class RestaurarRequest extends VaultRequest
{
    public function rules(): array
    {
        return [
            'carpeta' => ['required', 'string', Rule::in(self::CARPETAS)],
            'backup' => ['nullable', 'string', 'max:255', Rule::requiredIf(fn () => in_array($this->input('carpeta'), self::CARPETAS_BACKUP, true))],
            'rutas' => ['sometimes', 'array', 'max:1000'],
            'rutas.*' => ['required', 'string', 'max:' . self::MAX_PATH_LENGTH],
            'destino' => ['sometimes', 'nullable', 'string', 'max:' . self::MAX_PATH_LENGTH],
            'detener' => ['sometimes', 'boolean'],
            'vaciar' => ['sometimes', 'boolean'],
            'encender' => ['sometimes', 'boolean'],
        ];
    }
}
