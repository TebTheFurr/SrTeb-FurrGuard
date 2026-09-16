<?php

namespace Pterodactyl\Http\Requests\Admin;

use Pterodactyl\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Pterodactyl\Services\ThemeEditor\ThemeEditorAccessService;

class UserFormRequest extends AdminFormRequest
{
    /**
     * Rules to apply to requests for updating or creating a user
     * in the Admin CP.
     */
    public function rules(): array
    {
        $rules = Collection::make(
            User::getRulesForUpdate($this->route()->parameter('user'))
        )->only([
            'email',
            'username',
            'name_first',
            'name_last',
            'password',
            'language',
            'root_admin',
            'furrguard_access',
        ])->toArray();

        $rules['theme_editor_permissions'] = ['nullable', 'array'];
        $rules['theme_editor_permissions.*'] = ['string', Rule::in(ThemeEditorAccessService::tabIds())];

        return $rules;
    }

    public function normalize(?array $only = null): array
    {
        $data = parent::normalize($only);
        $data['theme_editor_permissions'] = ThemeEditorAccessService::normaliseTabIds($this->input('theme_editor_permissions', []));

        return $data;
    }
}
