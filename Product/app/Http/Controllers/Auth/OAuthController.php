<?php

namespace Pterodactyl\Http\Controllers\Auth;

use Illuminate\Http\Request;
use Illuminate\Auth\AuthManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Event;
use Pterodactyl\Events\Auth\DirectLogin;
use Illuminate\Http\RedirectResponse;
use Prologue\Alerts\AlertsMessageBag;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Services\OAuth\OAuthService;
use Pterodactyl\Services\OAuth\OAuthProviderManager;
use Pterodactyl\Exceptions\DisplayException;

class OAuthController extends Controller
{
    public function __construct(
        private OAuthService $oauthService,
        private OAuthProviderManager $providerManager,
        private AuthManager $auth,
    ) {
    }

    public function providers(): JsonResponse
    {
        return new JsonResponse([
            'data' => $this->providerManager->getEnabledProviders(),
        ]);
    }

    public function redirect(Request $request, string $provider): RedirectResponse
    {
        return $this->oauthService->redirectToProvider($request, $provider);
    }

    public function link(Request $request, string $provider): RedirectResponse
    {
        return $this->oauthService->redirectToProvider($request, $provider, 'link');
    }

    public function callback(Request $request, string $provider): RedirectResponse
    {
        try {
            $user = $this->oauthService->handleProviderCallback($request, $provider);
        } catch (DisplayException $exception) {
            app(AlertsMessageBag::class)->danger($exception->getMessage())->flash();

            return redirect()->route('auth.login');
        }

        $request->session()->regenerate();
        $this->auth->guard()->login($user, true);
        Event::dispatch(new DirectLogin($user, true));

        return redirect()->intended('/');
    }
}
