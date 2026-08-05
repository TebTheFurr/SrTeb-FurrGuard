<?php

namespace Pterodactyl\Http\Controllers\Auth;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\ThemeSettings;
use Pterodactyl\Notifications\VerifyEmail;
use Pterodactyl\Services\Users\UserCreationService;
use Pterodactyl\Exceptions\DisplayException;

class RegisterController extends AbstractLoginController
{
    public function __construct(
        private UserCreationService $userCreationService,
    ) {
        parent::__construct();
    }

    public function register(Request $request): JsonResponse
    {
        if (!ThemeSettings::getValue('components.registration_enabled', true)) {
            throw new DisplayException('Registration is currently disabled.');
        }

        $request->validate([
            'email' => 'required|email|unique:users,email',
            'username' => 'required|string|min:3|max:255|unique:users,username|regex:/^[a-zA-Z0-9_.-]+$/',
            'name_first' => 'required|string|min:1|max:255',
            'name_last' => 'required|string|min:1|max:255',
            'password' => 'required|string|min:8|confirmed',
            'g-recaptcha-response' => 'sometimes|string',
        ], [
            'email.unique' => 'An account with this email address already exists.',
            'username.unique' => 'This username is already taken.',
            'username.regex' => 'Username can only contain letters, numbers, underscores, dots, and hyphens.',
            'password.min' => 'Password must be at least 8 characters.',
            'password.confirmed' => 'Password confirmation does not match.',
        ]);

        $user = $this->userCreationService->handle([
            'email' => $request->input('email'),
            'username' => $request->input('username'),
            'name_first' => $request->input('name_first'),
            'name_last' => $request->input('name_last'),
            'password' => $request->input('password'),
            'root_admin' => false,
        ]);

        if (class_exists(\Pterodactyl\Services\FreeServers\FreeServerService::class)) {
            try {
                \Pterodactyl\Services\FreeServers\FreeServerService::assignOffersToUser($user);
            } catch (\Exception $e) {
            }

            $requireEmail = (bool) ThemeSettings::getValue('addons.free_servers.settings.require_email_verified', false);
            if ($requireEmail) {
                try {
                    $user->notifyNow(new VerifyEmail());
                } catch (\Exception $e) {
                }
            }
        }

        return new JsonResponse([
            'data' => [
                'success' => true,
                'message' => 'Account created successfully. You can now log in.',
            ],
        ]);
    }
}
