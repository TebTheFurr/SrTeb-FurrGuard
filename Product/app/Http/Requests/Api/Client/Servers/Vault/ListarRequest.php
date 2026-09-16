<?php

declare(strict_types=1);

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Vault;

use Illuminate\Validation\Rule;

class ListarRequest extends VaultRequest
{
    public function rules(): array
    {
        return [
            'carpeta' => ['nullable', 'string', Rule::in(self::CARPETAS)],
            'ruta' => ['nullable', 'string', 'max:' . self::MAX_PATH_LENGTH],
            'cursor' => ['nullable', 'string', 'max:512'],
            'limite' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ];
    }
}
