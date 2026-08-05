<?php

use Illuminate\Support\Facades\Route;
use Pterodactyl\Http\Controllers\Auth;

/*
|--------------------------------------------------------------------------
| Authentication Routes
|--------------------------------------------------------------------------
|
| Endpoint: /auth
|
*/

// These routes are defined so that we can continue to reference them programmatically.
// They all route to the same controller function which passes off to React.
Route::get('/login', [Auth\LoginController::class, 'index'])->name('auth.login');
Route::get('/register', [Auth\LoginController::class, 'index'])->name('auth.register');
Route::get('/password', [Auth\LoginController::class, 'index'])->name('auth.forgot-password');
Route::get('/password/reset/{token}', [Auth\LoginController::class, 'index'])->name('auth.reset');
Route::get('/oauth/providers', [Auth\OAuthController::class, 'providers'])->name('auth.oauth.providers');
Route::get('/oauth/{provider}', [Auth\OAuthController::class, 'redirect'])->name('auth.oauth.redirect');
Route::get('/oauth/{provider}/callback', [Auth\OAuthController::class, 'callback'])
    ->withoutMiddleware('guest')
    ->name('auth.oauth.callback');
Route::get('/oauth/{provider}/link', [Auth\OAuthController::class, 'link'])
    ->middleware('auth')
    ->withoutMiddleware('guest')
    ->name('auth.oauth.link');

// Apply a throttle to authentication action endpoints, in addition to the
// recaptcha endpoints to slow down manual attack spammers even more. 🤷‍
//
// @see \Pterodactyl\Providers\RouteServiceProvider
Route::middleware(['throttle:authentication'])->group(function () {
    Route::post('/login', [Auth\LoginController::class, 'login'])->middleware('turnstile');
    Route::post('/login/checkpoint', Auth\LoginCheckpointController::class)->name('auth.login-checkpoint');

    Route::post('/register', [Auth\RegisterController::class, 'register'])
        ->name('auth.post.register')
        ->middleware('turnstile');

    Route::post('/password', [Auth\ForgotPasswordController::class, 'sendResetLinkEmail'])
        ->name('auth.post.forgot-password')
        ->middleware('turnstile');
});

// Password reset routes. This endpoint is hit after going through
// the forgot password routes to acquire a token (or after an account
// is created).
Route::post('/password/reset', Auth\ResetPasswordController::class)->name('auth.reset-password');

Route::get('/verify-email/{id}/{hash}', [Auth\EmailVerificationController::class, 'verify'])
    ->name('auth.verify-email');

// Remove the guest middleware and apply the authenticated middleware to this endpoint,
// so it cannot be used unless you're already logged in.
Route::post('/logout', [Auth\LoginController::class, 'logout'])
    ->withoutMiddleware('guest')
    ->middleware('auth')
    ->name('auth.logout');

// Catch any other combinations of routes and pass them off to the React component.
Route::fallback([Auth\LoginController::class, 'index']);
