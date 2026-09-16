<?php

declare(strict_types=1);

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Vault;

use Illuminate\Validation\Rule;

class DescargarRequest extends VaultRequest
{
    public function rules(): array
    {
        return [
            'carpeta' => ['required', 'string', Rule::in(self::CARPETAS)],
            'ruta' => ['required', 'string', 'max:' . self::MAX_PATH_LENGTH],
        ];
    }
}
