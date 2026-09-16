<?php

use Pterodactyl\Enum\VaultLimit;
use Illuminate\Support\Facades\Route;
use Pterodactyl\Http\Controllers\Base;
use Pterodactyl\Services\Vault\VaultDownloadTickets;
use Pterodactyl\Http\Middleware\RequireFurrGuardAccess;
use Pterodactyl\Http\Middleware\RequireTwoFactorAuthentication;

Route::get('/', [Base\IndexController::class, 'index'])->name('index')->fallback();
Route::get('/account', [Base\IndexController::class, 'index'])
    ->withoutMiddleware(RequireTwoFactorAuthentication::class)
    ->name('account');

Route::get('/locales/locale.json', Base\LocaleController::class)
    ->withoutMiddleware(['auth', RequireTwoFactorAuthentication::class])
    ->where('namespace', '.*');

/*
| Tebby Vault: Discord login bridge and streamed downloads. These must stay
| above the React catch-all route below.
*/
Route::prefix('/vault')->middleware('auth')->group(function () {
    Route::get('/login', [Base\VaultAuthController::class, 'login'])
        ->middleware(VaultLimit::Login->middleware())
        ->name('vault.login');
    Route::get('/callback', [Base\VaultAuthController::class, 'callback'])
        ->middleware(VaultLimit::Callback->middleware())
        ->name('vault.callback');
    Route::get('/descarga/{ticket}', [Base\VaultAuthController::class, 'descarga'])
        ->middleware(VaultLimit::Download->middleware())
        ->where('ticket', VaultDownloadTickets::TICKET_PATTERN)
        ->name('vault.descarga');
});

/*
| FurrGuard: Discord login bridge (FurrGuard docs/API.md §9.2). Same shape as the
| Vault one above; the page itself is the React route /furrguard.
*/
Route::prefix('/furrguard')->middleware(['auth', RequireFurrGuardAccess::class])->group(function () {
    Route::get('/login', [Base\FurrGuardAuthController::class, 'login'])
        ->middleware('throttle:10,1')
        ->name('furrguard.login');
    Route::get('/callback', [Base\FurrGuardAuthController::class, 'callback'])
        ->middleware('throttle:20,1')
        ->name('furrguard.callback');
});

Route::get('/{react}', [Base\IndexController::class, 'index'])
    ->where('react', '^(?!(\/)?(api|auth|admin|daemon)).+');
