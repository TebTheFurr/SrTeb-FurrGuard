<?php

declare(strict_types=1);

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Vault;

use Illuminate\Validation\Rule;

class ZipRequest extends VaultRequest
{
    public function rules(): array
    {
        return [
            'carpeta' => ['required', 'string', Rule::in(self::CARPETAS)],
            'ruta' => ['nullable', 'string', 'max:' . self::MAX_PATH_LENGTH],
            'nombres' => ['sometimes', 'array', 'max:1000'],
            'nombres.*' => ['required', 'string', 'max:1024'],
        ];
    }
}
