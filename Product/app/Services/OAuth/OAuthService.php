<?php

namespace Pterodactyl\Services\OAuth;

use Throwable;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Pterodactyl\Models\User;
use Illuminate\Http\RedirectResponse;
use Pterodactyl\Models\ThemeSettings;
use Pterodactyl\Models\OAuthProvider;
use Illuminate\Support\Facades\Http;
use Pterodactyl\Models\UserOAuthIdentity;
use Pterodactyl\Exceptions\DisplayException;
use Pterodactyl\Services\Users\UserCreationService;

class OAuthService
{
    public function __construct(
        private UserCreationService $userCreationService,
    ) {
    }

    public function redirectToProvider(Request $request, string $providerKey, string $mode = 'login'): RedirectResponse
    {
        $provider = $this->getEnabledProvider($providerKey);
        $state = Str::random(64);
        $states = $request->session()->get('oauth_states', []);

        $states[$state] = [
            'provider_id' => $provider->id,
            'mode' => $mode === 'link' ? 'link' : 'login',
            'user_id' => $request->user()?->id,
            'expires_at' => now()->addMinutes(10)->timestamp,
        ];

        $request->session()->put('oauth_states', $states);

        $query = [
            'client_id' => $provider->client_id,
            'redirect_uri' => $provider->callbackUrl(),
            'response_type' => 'code',
            'scope' => trim((string) $provider->presetValue('scopes', '')),
            'state' => $state,
        ];

        return redirect()->away($provider->presetValue('authorization_url') . '?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986));
    }

    public function handleProviderCallback(Request $request, string $providerKey): User
    {
        if ($request->filled('error')) {
            throw new DisplayException((string) $request->input('error_description', 'OAuth authorisation was cancelled or denied.'));
        }

        $state = (string) $request->input('state', '');
        $code = (string) $request->input('code', '');

        if ($state === '' || $code === '') {
            throw new DisplayException('The OAuth provider did not return the required callback data.');
        }

        $sessionState = $this->pullSessionState($request, $state);
        $provider = $this->getEnabledProvider($providerKey);

        if ((int) $sessionState['provider_id'] !== $provider->id) {
            throw new DisplayException('The OAuth session does not match this provider.');
        }

        $oauthUser = $this->getOAuthUser($provider, $code);
        $mode = $sessionState['mode'] ?? 'login';

        if ($mode === 'link') {
            $user = $request->user();
            if (!$user || (int) $sessionState['user_id'] !== $user->id) {
                throw new DisplayException('You must be logged in to link an OAuth provider.');
            }

            return $this->linkProviderToUser($user, $provider, $oauthUser);
        }

        return $this->findOrCreateUserFromOAuth($provider, $oauthUser);
    }

    public function linkProviderToUser(User $user, OAuthProvider $provider, array $oauthUser): User
    {
        $providerUserId = $this->extractRequiredValue($oauthUser, (string) $provider->presetValue('user_id_path', 'id'), 'OAuth provider user ID');
        $existingIdentity = UserOAuthIdentity::query()
            ->where('oauth_provider_id', $provider->id)
            ->where('provider_user_id', $providerUserId)
            ->first();

        if ($existingIdentity && (int) $existingIdentity->user_id !== $user->id) {
            throw new DisplayException('This OAuth account is already linked to another panel account.');
        }

        $userProviderIdentity = UserOAuthIdentity::query()
            ->where('oauth_provider_id', $provider->id)
            ->where('user_id', $user->id)
            ->first();

        if ($userProviderIdentity && $userProviderIdentity->provider_user_id !== $providerUserId) {
            throw new DisplayException('Your account is already linked to a different account from this OAuth provider.');
        }

        $identity = $existingIdentity ?: $userProviderIdentity ?: new UserOAuthIdentity();
        $identity->fill($this->identityData($user, $provider, $oauthUser, $providerUserId));
        $identity->save();

        $this->markEmailVerifiedWhenTrusted($user, $provider, $oauthUser);

        return $user->refresh();
    }

    public function findOrCreateUserFromOAuth(OAuthProvider $provider, array $oauthUser): User
    {
        $providerUserId = $this->extractRequiredValue($oauthUser, (string) $provider->presetValue('user_id_path', 'id'), 'OAuth provider user ID');
        $email = mb_strtolower($this->extractRequiredValue($oauthUser, (string) $provider->presetValue('user_email_path', 'email'), 'email address'));

        if (!$this->emailIsTrusted($provider, $oauthUser)) {
            throw new DisplayException('The OAuth provider did not confirm this email address.');
        }

        $identity = UserOAuthIdentity::query()
            ->where('oauth_provider_id', $provider->id)
            ->where('provider_user_id', $providerUserId)
            ->first();

        if ($identity) {
            $this->updateIdentity($identity, $provider, $oauthUser, $providerUserId);
            $this->markEmailVerifiedWhenTrusted($identity->user, $provider, $oauthUser);

            return $identity->user->refresh();
        }

        $user = User::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->first();

        if (!$user) {
            if (!ThemeSettings::getValue('components.registration_enabled', true)) {
                throw new DisplayException('No account is linked to this OAuth provider.');
            }

            $user = $this->createUserFromOAuth($provider, $oauthUser, $email);
        }

        $this->linkProviderToUser($user, $provider, $oauthUser);

        return $user->refresh();
    }

    public function unlinkProvider(User $user, int $identityId): void
    {
        $identity = UserOAuthIdentity::query()
            ->where('user_id', $user->id)
            ->where('id', $identityId)
            ->first();

        if (!$identity) {
            throw new DisplayException('That OAuth connection could not be found.');
        }

        if (empty($user->password) && $user->oauthIdentities()->count() <= 1) {
            throw new DisplayException('You cannot remove your last sign-in method.');
        }

        $identity->delete();
    }

    private function getEnabledProvider(string $providerKey): OAuthProvider
    {
        $provider = OAuthProvider::query()
            ->where('provider_key', $providerKey)
            ->where('enabled', true)
            ->first();

        if (!$provider) {
            throw new DisplayException('That OAuth provider is not available.');
        }

        return $provider;
    }

    private function pullSessionState(Request $request, string $state): array
    {
        $states = $request->session()->get('oauth_states', []);
        $sessionState = is_array($states) ? ($states[$state] ?? null) : null;

        if (!$sessionState || !is_array($sessionState)) {
            throw new DisplayException('The OAuth session has expired. Please try again.');
        }

        unset($states[$state]);
        $request->session()->put('oauth_states', $states);

        if ((int) ($sessionState['expires_at'] ?? 0) < now()->timestamp) {
            throw new DisplayException('The OAuth session has expired. Please try again.');
        }

        return $sessionState;
    }

    private function getOAuthUser(OAuthProvider $provider, string $code): array
    {
        try {
            $tokenResponse = Http::asForm()->acceptJson()->post($provider->presetValue('token_url'), [
                'grant_type' => 'authorization_code',
                'client_id' => $provider->client_id,
                'client_secret' => $provider->client_secret,
                'redirect_uri' => $provider->callbackUrl(),
                'code' => $code,
            ]);
        } catch (Throwable $exception) {
            throw new DisplayException('The OAuth token request failed.', $exception);
        }

        if (!$tokenResponse->successful()) {
            throw new DisplayException('The OAuth provider rejected the authorisation code.');
        }

        $token = $tokenResponse->json('access_token');
        if (!is_string($token) || $token === '') {
            throw new DisplayException('The OAuth provider did not return an access token.');
        }

        try {
            $userResponse = Http::withToken($token)->acceptJson()->get($provider->presetValue('user_url'));
        } catch (Throwable $exception) {
            throw new DisplayException('The OAuth profile request failed.', $exception);
        }

        if (!$userResponse->successful() || !is_array($userResponse->json())) {
            throw new DisplayException('The OAuth provider did not return a valid profile.');
        }

        return $userResponse->json();
    }

    private function createUserFromOAuth(OAuthProvider $provider, array $oauthUser, string $email): User
    {
        $name = $this->extractOptionalValue($oauthUser, (string) $provider->presetValue('user_name_path', '')) ?: Str::before($email, '@');
        $nameParts = preg_split('/\s+/', trim($name), 2);
        $firstName = $nameParts[0] ?? Str::before($email, '@');
        $lastName = $nameParts[1] ?? 'User';

        $user = $this->userCreationService->handle([
            'email' => $email,
            'username' => $this->uniqueUsername($email, $name),
            'name_first' => $firstName,
            'name_last' => $lastName,
            'root_admin' => false,
        ]);

        $this->assignFreeServerOffers($user);
        $this->markEmailVerifiedWhenTrusted($user, $provider, $oauthUser);

        return $user;
    }

    private function assignFreeServerOffers(User $user): void
    {
        if (!class_exists(\Pterodactyl\Services\FreeServers\FreeServerService::class)) {
            return;
        }

        try {
            \Pterodactyl\Services\FreeServers\FreeServerService::assignOffersToUser($user);
        } catch (Throwable) {
        }
    }

    private function updateIdentity(UserOAuthIdentity $identity, OAuthProvider $provider, array $oauthUser, string $providerUserId): void
    {
        $identity->fill($this->identityData($identity->user, $provider, $oauthUser, $providerUserId));
        $identity->save();
    }

    private function identityData(User $user, OAuthProvider $provider, array $oauthUser, string $providerUserId): array
    {
        return [
            'user_id' => $user->id,
            'oauth_provider_id' => $provider->id,
            'provider_user_id' => $providerUserId,
            'provider_email' => $this->extractOptionalValue($oauthUser, (string) $provider->presetValue('user_email_path', 'email')),
            'provider_name' => $this->extractOptionalValue($oauthUser, (string) $provider->presetValue('user_name_path', '')),
            'provider_avatar' => $this->providerAvatar($provider, $oauthUser),
        ];
    }

    private function markEmailVerifiedWhenTrusted(User $user, OAuthProvider $provider, array $oauthUser): void
    {
        if ($user->email_verified_at || !$this->emailIsTrusted($provider, $oauthUser)) {
            return;
        }

        $user->forceFill(['email_verified_at' => now()])->save();
    }

    private function emailIsTrusted(OAuthProvider $provider, array $oauthUser): bool
    {
        $path = trim((string) $provider->presetValue('user_email_verified_path', ''));
        if ($path === '') {
            return true;
        }

        $value = $this->extractOptionalValue($oauthUser, $path);

        return $value === 'true';
    }

    private function providerAvatar(OAuthProvider $provider, array $oauthUser): ?string
    {
        if ($provider->provider_type === 'discord') {
            $id = $this->extractOptionalValue($oauthUser, (string) $provider->presetValue('user_id_path', 'id'));
            $avatar = Arr::get($oauthUser, 'avatar');

            if ($id && is_string($avatar) && $avatar !== '') {
                $extension = str_starts_with($avatar, 'a_') ? 'gif' : 'png';

                return sprintf('https://cdn.discordapp.com/avatars/%s/%s.%s?size=128', $id, $avatar, $extension);
            }
        }

        return $this->extractOptionalValue($oauthUser, (string) $provider->presetValue('user_avatar_path', ''));
    }

    private function uniqueUsername(string $email, string $name): string
    {
        $source = trim($name) !== '' ? $name : Str::before($email, '@');
        $base = mb_strtolower((string) preg_replace('/[^a-zA-Z0-9_.-]/', '', $source));
        $base = trim($base, '._-');

        if (mb_strlen($base) < 3) {
            $base = 'user' . Str::lower(Str::random(6));
        }

        $base = mb_substr($base, 0, 180);
        $username = $base;
        $counter = 1;

        while (User::query()->where('username', $username)->exists()) {
            $suffix = (string) $counter;
            $username = mb_substr($base, 0, 191 - mb_strlen($suffix)) . $suffix;
            $counter++;
        }

        return $username;
    }

    private function extractRequiredValue(array $data, string $path, string $label): string
    {
        $value = $this->extractOptionalValue($data, $path);

        if ($value === null || trim($value) === '') {
            throw new DisplayException("The OAuth provider did not return a usable {$label}.");
        }

        return trim($value);
    }

    private function extractOptionalValue(array $data, string $paths): ?string
    {
        foreach (explode(',', $paths) as $path) {
            $path = trim($path);
            if ($path === '') {
                continue;
            }

            $value = Arr::get($data, $path);
            if (is_bool($value)) {
                return $value ? 'true' : 'false';
            }

            if (is_scalar($value) && trim((string) $value) !== '') {
                return trim((string) $value);
            }
        }

        return null;
    }
}
