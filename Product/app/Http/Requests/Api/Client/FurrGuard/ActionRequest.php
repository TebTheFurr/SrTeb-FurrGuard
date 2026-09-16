<?php

declare(strict_types=1);

namespace Pterodactyl\Http\Requests\Api\Client\FurrGuard;

use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

/**
 * `POST /api/client/furrguard/action`: one FurrGuard panel action and its
 * parameters. Values are validated by FurrGuard itself; here only the shape is.
 */
class ActionRequest extends ClientApiRequest
{
    public function rules(): array
    {
        return [
            'action' => ['required', 'string', 'regex:/^[a-z][a-z0-9_]{0,63}$/'],
            'params' => ['sometimes', 'array', 'max:64'],
        ];
    }
}
