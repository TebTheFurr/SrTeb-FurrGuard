<?php

namespace Pterodactyl\Http\Requests\Api\Client\Account;

use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;
use Pterodactyl\Models\ThemeSettings;

class UpdateAvatarRequest extends ClientApiRequest
{
    public function rules(): array
    {
        $maxMb = (int) ThemeSettings::getValue('advanced.max_avatar_upload_file_size', 4);
        $maxMb = max(1, min(20, $maxMb));

        return [
            'avatar' => ['required', 'image', 'max:' . ($maxMb * 1024)],
        ];
    }
}
