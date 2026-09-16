<?php

declare(strict_types=1);

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Vault;

class ExclusionesRequest extends VaultRequest
{
    public function rules(): array
    {
        return [
            'exclusiones' => ['present', 'array', 'max:100'],
            'exclusiones.*' => ['required', 'string', 'min:1', 'max:256', 'not_regex:/[\n\r\x00]/'],
        ];
    }
}
