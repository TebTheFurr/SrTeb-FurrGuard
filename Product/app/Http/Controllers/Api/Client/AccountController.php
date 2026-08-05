<?php

namespace Pterodactyl\Http\Controllers\Api\Client;

use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Auth\AuthManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Pterodactyl\Facades\Activity;
use Illuminate\Support\Facades\RateLimiter;
use Pterodactyl\Notifications\VerifyEmail;
use Pterodactyl\Services\Users\UserUpdateService;
use Pterodactyl\Transformers\Api\Client\AccountTransformer;
use Pterodactyl\Http\Requests\Api\Client\Account\UpdateAvatarRequest;
use Pterodactyl\Http\Requests\Api\Client\Account\UpdateEmailRequest;
use Pterodactyl\Http\Requests\Api\Client\Account\UpdatePasswordRequest;
use Pterodactyl\Traits\Helpers\AvailableLanguages;
use Pterodactyl\Models\ThemeSettings;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

class AccountController extends ClientApiController
{
    use AvailableLanguages;
    /**
     * The number of seconds that must elapse before the email change throttle resets.
     */
    private const EMAIL_UPDATE_THROTTLE = 60 * 60 * 24;

    private const EMAIL_VERIFICATION_RESEND_THROTTLE = 60;


    /**
     * AccountController constructor.
     */
    public function __construct(private AuthManager $manager, private UserUpdateService $updateService)
    {
        parent::__construct();
    }

    public function index(Request $request): array
    {
        return $this->fractal->item($request->user())
            ->transformWith($this->getTransformer(AccountTransformer::class))
            ->toArray();
    }

    /**
     * Update the authenticated user's email address.
     */
    public function updateEmail(UpdateEmailRequest $request): JsonResponse
    {
        $user = $request->user();
        // Only allow a user to change their email three times in the span
        // of 24 hours. This prevents malicious users from trying to find
        // existing accounts in the system by constantly changing their email.
        if (RateLimiter::tooManyAttempts($key = "user:update-email:{$user->uuid}", 3)) {
            throw new TooManyRequestsHttpException(message: 'Your email address has been changed too many times today. Please try again later.');
        }

        $original = $user->email;
        if (mb_strtolower($original) !== mb_strtolower($request->validated('email'))) {
            RateLimiter::hit($key, self::EMAIL_UPDATE_THROTTLE);

            $this->updateService->handle($user, $request->validated());

            Activity::event('user:account.email-changed')
                ->property(['old' => $original, 'new' => $request->validated('email')])
                ->log();
        }

        return new JsonResponse([], Response::HTTP_NO_CONTENT);
    }

    /**
     * Update the authenticated user's password. All existing sessions will be logged
     * out immediately.
     *
     * @throws \Throwable
     */
    public function updatePassword(UpdatePasswordRequest $request): JsonResponse
    {
        $user = Activity::event('user:account.password-changed')->transaction(function () use ($request) {
            return $this->updateService->handle($request->user(), $request->validated());
        });

        $guard = $this->manager->guard();
        // If you do not update the user in the session you'll end up working with a
        // cached copy of the user that does not include the updated password. Do this
        // to correctly store the new user details in the guard and allow the logout
        // other devices functionality to work.
        $guard->setUser($user);

        // This method doesn't exist in the stateless Sanctum world.
        if (method_exists($guard, 'logoutOtherDevices')) { // @phpstan-ignore function.alreadyNarrowedType
            $guard->logoutOtherDevices($request->input('password'));
        }

        return new JsonResponse([], Response::HTTP_NO_CONTENT);
    }

    public function updateAvatar(UpdateAvatarRequest $request): JsonResponse
    {
        $user = $request->user();
        $file = $request->file('avatar');
        $original = $user->avatar_path;
        $extension = strtolower((string) $file->getClientOriginalExtension());
        $filename = $user->uuid . '_' . Str::random(24) . ($extension ? '.' . $extension : '');
        $path = Storage::disk('public')->putFileAs('avatars', $file, $filename);

        if (!empty($original)) {
            Storage::disk('public')->delete($original);
        }

        $user = Activity::event('user:account.avatar-updated')->transaction(function () use ($user, $path) {
            return $this->updateService->handle($user, ['avatar_path' => $path]);
        });

        return new JsonResponse(['image' => $user->image]);
    }

    public function removeAvatar(Request $request): JsonResponse
    {
        $user = $request->user();
        $original = $user->avatar_path;

        if (!empty($original)) {
            Storage::disk('public')->delete($original);
        }

        $user = Activity::event('user:account.avatar-removed')->transaction(function () use ($user) {
            return $this->updateService->handle($user, ['avatar_path' => null]);
        });

        return new JsonResponse(['image' => $user->image]);
    }

    public function getLanguages(): JsonResponse
    {
        $allLanguages = $this->getAvailableLanguages();
        $enabledLanguages = ThemeSettings::getValue('components.enabled_languages');

        if ($enabledLanguages === null) {
            return new JsonResponse(['languages' => $allLanguages]);
        }

        $filtered = array_filter($allLanguages, function ($code) use ($enabledLanguages) {
            return in_array($code, $enabledLanguages);
        }, ARRAY_FILTER_USE_KEY);

        return new JsonResponse(['languages' => $filtered]);
    }

    public function updateLanguage(Request $request): JsonResponse
    {
        $allLanguages = $this->getAvailableLanguages();
        $enabledLanguages = ThemeSettings::getValue('components.enabled_languages');

        if ($enabledLanguages === null) {
            $availableLanguages = array_keys($allLanguages);
        } else {
            $availableLanguages = array_filter(array_keys($allLanguages), function ($code) use ($enabledLanguages) {
                return in_array($code, $enabledLanguages);
            });
        }

        $request->validate([
            'language' => ['required', 'string', 'in:' . implode(',', $availableLanguages)],
        ]);

        $original = $request->user()->language;
        $this->updateService->handle($request->user(), ['language' => $request->input('language')]);

        if ($original !== $request->input('language')) {
            Activity::event('user:account.language-changed')
                ->property(['old' => $original, 'new' => $request->input('language')])
                ->log();
        }

        return new JsonResponse(['language' => $request->input('language')]);
    }

    public function getThemePreference(Request $request): JsonResponse
    {
        $theme = $request->cookie('pterodactyl_theme', 'dark');
        return new JsonResponse(['theme' => $theme]);
    }

    public function updateThemePreference(Request $request): JsonResponse
    {
        $request->validate([
            'theme' => ['required', 'string', 'in:dark,light,system'],
        ]);

        $theme = $request->input('theme');
        $cookie = cookie('pterodactyl_theme', $theme, 60 * 24 * 365, '/', null, false, false);

        return (new JsonResponse(['theme' => $theme]))->withCookie($cookie);
    }

    public function updatePrivacyMode(Request $request): JsonResponse
    {
        $request->validate([
            'privacy_mode' => ['required', 'boolean'],
        ]);

        $user = $request->user();
        $original = $user->privacy_mode;
        $this->updateService->handle($user, ['privacy_mode' => $request->input('privacy_mode')]);

        if ($original !== $request->input('privacy_mode')) {
            Activity::event('user:account.privacy-changed')
                ->property(['old' => $original, 'new' => $request->input('privacy_mode')])
                ->log();
        }

        return new JsonResponse(['privacy_mode' => (bool) $request->input('privacy_mode')]);
    }

    public function resendVerificationEmail(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->email_verified_at) {
            throw new HttpException(Response::HTTP_UNPROCESSABLE_ENTITY, 'Your email address is already verified.');
        }

        $key = "user:resend-verification:{$user->uuid}";
        if (RateLimiter::tooManyAttempts($key, 1)) {
            throw new TooManyRequestsHttpException(
                RateLimiter::availableIn($key),
                'Please wait before requesting another verification email.'
            );
        }

        RateLimiter::hit($key, self::EMAIL_VERIFICATION_RESEND_THROTTLE);

        try {
            $user->notifyNow(new VerifyEmail());
        } catch (\Throwable $exception) {
            throw new HttpException(Response::HTTP_INTERNAL_SERVER_ERROR, 'Failed to send verification email. Please try again later.');
        }

        return new JsonResponse([
            'success' => true,
            'message' => 'A verification email has been sent.',
        ]);
    }
}
