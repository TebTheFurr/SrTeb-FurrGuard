<?php

namespace Pterodactyl\Http\Requests\Admin\Settings;

use Pterodactyl\Http\Requests\Admin\AdminFormRequest;

class ThemeSettingsFormRequest extends AdminFormRequest
{
    public function rules(): array
    {
        return [
            'theme:dark-primary' => 'required|string|max:100',
            'theme:dark-secondary' => 'required|string|max:100',
            'theme:dark-neutral' => 'required|string|max:100',
            'theme:dark-base' => 'required|string|max:100',
            'theme:dark-muted' => 'required|string|max:100',
            'theme:dark-inverted' => 'required|string|max:100',
            'theme:dark-background' => 'required|string|max:100',
            'theme:dark-background-secondary' => 'required|string|max:100',
            'theme:border-radius' => 'required|numeric|min:0|max:50',
        ];
    }

    public function attributes(): array
    {
        return [
            'theme:dark-primary' => 'Primary Brand Colour',
            'theme:dark-secondary' => 'Secondary Brand Colour',
            'theme:dark-neutral' => 'Neutral Colour',
            'theme:dark-base' => 'Base Text Colour',
            'theme:dark-muted' => 'Muted Text Colour',
            'theme:dark-inverted' => 'Inverted Text Colour',
            'theme:dark-background' => 'Background Colour',
            'theme:dark-background-secondary' => 'Secondary Background Colour',
            'theme:border-radius' => 'Border Radius',
        ];
    }
}
