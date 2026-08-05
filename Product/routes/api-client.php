<?php

use Pterodactyl\Enum\ResourceLimit;
use Illuminate\Support\Facades\Route;
use Pterodactyl\Http\Controllers\Api\Client;
use Pterodactyl\Http\Middleware\Activity\ServerSubject;
use Pterodactyl\Http\Middleware\Activity\AccountSubject;
use Pterodactyl\Http\Middleware\RequireTwoFactorAuthentication;
use Pterodactyl\Http\Middleware\Api\Client\Server\ResourceBelongsToServer;
use Pterodactyl\Http\Middleware\Api\Client\Server\AuthenticateServerAccess;

/*
|--------------------------------------------------------------------------
| Client Control API
|--------------------------------------------------------------------------
|
| Endpoint: /api/client
|
*/
Route::get('/', [Client\ClientController::class, 'index'])->name('api:client.index');
Route::get('/permissions', [Client\ClientController::class, 'permissions']);
Route::get('/oauth/providers', [Client\OAuthProviderController::class, 'index']);
Route::get('/announcements', [Client\AnnouncementController::class, 'index']);

Route::prefix('/folders')->group(function () {
    Route::get('/', [Client\ServerFolderController::class, 'index']);
    Route::post('/', [Client\ServerFolderController::class, 'store']);
    Route::post('/reorder', [Client\ServerFolderController::class, 'reorder']);
    Route::get('/{folder}', [Client\ServerFolderController::class, 'show'])->where('folder', '[0-9]+');
    Route::put('/{folder}', [Client\ServerFolderController::class, 'update'])->where('folder', '[0-9]+');
    Route::delete('/{folder}', [Client\ServerFolderController::class, 'destroy'])->where('folder', '[0-9]+');
    Route::post('/{folder}/servers', [Client\ServerFolderController::class, 'addServer'])->where('folder', '[0-9]+');
    Route::delete('/{folder}/servers/{serverId}', [Client\ServerFolderController::class, 'removeServer'])->where(['folder' => '[0-9]+', 'serverId' => '[0-9]+']);
});

Route::prefix('/account')->middleware(AccountSubject::class)->group(function () {
    Route::prefix('/')->withoutMiddleware(RequireTwoFactorAuthentication::class)->group(function () {
        Route::get('/', [Client\AccountController::class, 'index'])->name('api:client.account');
        Route::get('/two-factor', [Client\TwoFactorController::class, 'index']);
        Route::post('/two-factor', [Client\TwoFactorController::class, 'store']);
        Route::post('/two-factor/disable', [Client\TwoFactorController::class, 'delete']);
    });

    Route::put('/email', [Client\AccountController::class, 'updateEmail'])->name('api:client.account.update-email');
    Route::post('/email/resend-verification', [Client\AccountController::class, 'resendVerificationEmail'])->name('api:client.account.resend-verification');
    Route::put('/password', [Client\AccountController::class, 'updatePassword'])->name('api:client.account.update-password');
    Route::post('/avatar', [Client\AccountController::class, 'updateAvatar'])->name('api:client.account.update-avatar');
    Route::delete('/avatar', [Client\AccountController::class, 'removeAvatar'])->name('api:client.account.remove-avatar');
    Route::get('/languages', [Client\AccountController::class, 'getLanguages'])->name('api:client.account.languages');
    Route::put('/language', [Client\AccountController::class, 'updateLanguage'])->name('api:client.account.update-language');
    Route::get('/theme', [Client\AccountController::class, 'getThemePreference'])->name('api:client.account.theme');
    Route::put('/theme', [Client\AccountController::class, 'updateThemePreference'])->name('api:client.account.update-theme');
    Route::put('/privacy-mode', [Client\AccountController::class, 'updatePrivacyMode'])->name('api:client.account.update-privacy-mode');
    Route::get('/oauth/identities', [Client\OAuthProviderController::class, 'identities']);
    Route::delete('/oauth/identities/{id}', [Client\OAuthProviderController::class, 'unlink'])->where('id', '[0-9]+');

    Route::get('/activity', Client\ActivityLogController::class)->name('api:client.account.activity');

    Route::get('/api-keys', [Client\ApiKeyController::class, 'index']);
    Route::post('/api-keys', [Client\ApiKeyController::class, 'store']);
    Route::delete('/api-keys/{identifier}', [Client\ApiKeyController::class, 'delete']);

    Route::prefix('/ssh-keys')->group(function () {
        Route::get('/', [Client\SSHKeyController::class, 'index']);
        Route::post('/', [Client\SSHKeyController::class, 'store']);
        Route::post('/remove', [Client\SSHKeyController::class, 'delete']);
    });

    Route::prefix('/free-servers')->group(function () {
        Route::get('/', [Client\FreeServerClaimController::class, 'index']);
        Route::post('/{claimId}/claim', [Client\FreeServerClaimController::class, 'claim'])->where('claimId', '[0-9]+');
    });
});

/*
|--------------------------------------------------------------------------
| Client Control API
|--------------------------------------------------------------------------
|
| Endpoint: /api/client/servers/{server}
|
*/
Route::group([
    'prefix' => '/servers/{server}',
    'middleware' => [
        ServerSubject::class,
        AuthenticateServerAccess::class,
        ResourceBelongsToServer::class,
    ],
], function () {
    Route::get('/', [Client\Servers\ServerController::class, 'index'])->name('api:client:server.view');
    Route::middleware([ResourceLimit::Websocket->middleware()])
        ->get('/websocket', Client\Servers\WebsocketController::class)
        ->name('api:client:server.ws');
    Route::get('/resources', Client\Servers\ResourceUtilizationController::class)->name('api:client:server.resources');
    Route::get('/activity', Client\Servers\ActivityLogController::class)->name('api:client:server.activity');
    Route::get('/billing', [Client\BillingController::class, 'show'])->name('api:client:server.billing');

    Route::post('/command', [Client\Servers\CommandController::class, 'index']);
    Route::post('/power', [Client\Servers\PowerController::class, 'index']);

    Route::group(['prefix' => '/command-history'], function () {
        Route::get('/', [Client\Servers\CommandHistoryController::class, 'index']);
        Route::post('/', [Client\Servers\CommandHistoryController::class, 'store']);
        Route::delete('/clear', [Client\Servers\CommandHistoryController::class, 'clear']);
        Route::delete('/{historyId}', [Client\Servers\CommandHistoryController::class, 'destroy'])->where('historyId', '[0-9]+');
    });

    Route::group(['prefix' => '/databases'], function () {
        Route::get('/', [Client\Servers\DatabaseController::class, 'index']);
        Route::middleware([ResourceLimit::Database->middleware()])
            ->post('/', [Client\Servers\DatabaseController::class, 'store']);
        Route::post('/{database}/rotate-password', [Client\Servers\DatabaseController::class, 'rotatePassword']);
        Route::delete('/{database}', [Client\Servers\DatabaseController::class, 'delete']);
    });

    Route::group(['prefix' => '/files'], function () {
        Route::get('/list', [Client\Servers\FileController::class, 'directory']);
        Route::get('/contents', [Client\Servers\FileController::class, 'contents']);
        Route::get('/download', [Client\Servers\FileController::class, 'download']);
        Route::put('/rename', [Client\Servers\FileController::class, 'rename']);
        Route::post('/copy', [Client\Servers\FileController::class, 'copy']);
        Route::post('/write', [Client\Servers\FileController::class, 'write']);
        Route::post('/compress', [Client\Servers\FileController::class, 'compress']);
        Route::post('/decompress', [Client\Servers\FileController::class, 'decompress']);
        Route::post('/delete', [Client\Servers\FileController::class, 'delete']);
        Route::post('/create-folder', [Client\Servers\FileController::class, 'create']);
        Route::post('/chmod', [Client\Servers\FileController::class, 'chmod']);
        Route::middleware([ResourceLimit::FilePull->middleware()])
            ->post('/pull', [Client\Servers\FileController::class, 'pull']);
        Route::get('/upload', Client\Servers\FileUploadController::class);
    });

    Route::group(['prefix' => '/schedules'], function () {
        Route::get('/', [Client\Servers\ScheduleController::class, 'index']);
        Route::middleware([ResourceLimit::Schedule->middleware()])
            ->post('/', [Client\Servers\ScheduleController::class, 'store']);
        Route::get('/{schedule}', [Client\Servers\ScheduleController::class, 'view']);
        Route::post('/{schedule}', [Client\Servers\ScheduleController::class, 'update']);
        Route::post('/{schedule}/execute', [Client\Servers\ScheduleController::class, 'execute']);
        Route::delete('/{schedule}', [Client\Servers\ScheduleController::class, 'delete']);

        Route::post('/{schedule}/tasks', [Client\Servers\ScheduleTaskController::class, 'store']);
        Route::post('/{schedule}/tasks/{task}', [Client\Servers\ScheduleTaskController::class, 'update']);
        Route::delete('/{schedule}/tasks/{task}', [Client\Servers\ScheduleTaskController::class, 'delete']);
    });

    Route::group(['prefix' => '/network'], function () {
        Route::get('/allocations', [Client\Servers\NetworkAllocationController::class, 'index']);
        Route::middleware([ResourceLimit::Allocation->middleware()])
            ->post('/allocations', [Client\Servers\NetworkAllocationController::class, 'store']);
        Route::post('/allocations/{allocation}', [Client\Servers\NetworkAllocationController::class, 'update']);
        Route::post('/allocations/{allocation}/primary', [Client\Servers\NetworkAllocationController::class, 'setPrimary']);
        Route::delete('/allocations/{allocation}', [Client\Servers\NetworkAllocationController::class, 'delete']);
    });

    Route::group(['prefix' => '/users'], function () {
        Route::get('/', [Client\Servers\SubuserController::class, 'index']);
        Route::middleware([ResourceLimit::Subuser->middleware()])
            ->post('/', [Client\Servers\SubuserController::class, 'store']);
        Route::get('/{user}', [Client\Servers\SubuserController::class, 'view']);
        Route::post('/{user}', [Client\Servers\SubuserController::class, 'update']);
        Route::delete('/{user}', [Client\Servers\SubuserController::class, 'delete']);
    });

    Route::group(['prefix' => '/backups'], function () {
        Route::get('/', [Client\Servers\BackupController::class, 'index']);
        Route::post('/', [Client\Servers\BackupController::class, 'store']);
        Route::get('/{backup}', [Client\Servers\BackupController::class, 'view']);
        Route::get('/{backup}/download', [Client\Servers\BackupController::class, 'download']);
        Route::post('/{backup}/lock', [Client\Servers\BackupController::class, 'toggleLock']);
        Route::middleware([ResourceLimit::Backup->middleware()])
            ->post('/{backup}/restore', [Client\Servers\BackupController::class, 'restore']);
        Route::delete('/{backup}', [Client\Servers\BackupController::class, 'delete']);
    });

    Route::group(['prefix' => '/startup'], function () {
        Route::get('/', [Client\Servers\StartupController::class, 'index']);
        Route::put('/', [Client\Servers\StartupController::class, 'updateCommand']);
        Route::put('/variable', [Client\Servers\StartupController::class, 'update']);
    });

    Route::group(['prefix' => '/settings'], function () {
        Route::post('/rename', [Client\Servers\SettingsController::class, 'rename']);
        Route::post('/reinstall', [Client\Servers\SettingsController::class, 'reinstall']);
        Route::put('/docker-image', [Client\Servers\SettingsController::class, 'dockerImage']);
    });

    Route::group(['prefix' => '/macros'], function () {
        Route::get('/', [Client\Servers\MacroController::class, 'index']);
        Route::post('/', [Client\Servers\MacroController::class, 'store']);
        Route::put('/{macroId}', [Client\Servers\MacroController::class, 'update'])->where('macroId', '[0-9]+');
        Route::delete('/{macroId}', [Client\Servers\MacroController::class, 'destroy'])->where('macroId', '[0-9]+');
    });

    Route::group(['prefix' => '/plugins'], function () {
        Route::get('/status', [Client\Servers\PluginController::class, 'status']);
        Route::get('/search', [Client\Servers\PluginController::class, 'search'])
            ->withoutMiddleware('throttle:api.client');
        Route::get('/versions', [Client\Servers\PluginController::class, 'versions'])
            ->withoutMiddleware('throttle:api.client');
        Route::get('/minecraft-versions', [Client\Servers\PluginController::class, 'minecraftVersions'])
            ->withoutMiddleware('throttle:api.client');
    });

    Route::group(['prefix' => '/mods'], function () {
        Route::get('/status', [Client\Servers\ModController::class, 'status']);
        Route::get('/search', [Client\Servers\ModController::class, 'search'])
            ->withoutMiddleware('throttle:api.client');
        Route::get('/versions', [Client\Servers\ModController::class, 'versions'])
            ->withoutMiddleware('throttle:api.client');
        Route::get('/game-versions', [Client\Servers\ModController::class, 'gameVersions'])
            ->withoutMiddleware('throttle:api.client');
        Route::get('/minecraft-versions', [Client\Servers\ModController::class, 'minecraftVersions'])
            ->withoutMiddleware('throttle:api.client');
        Route::get('/categories', [Client\Servers\ModController::class, 'categories'])
            ->withoutMiddleware('throttle:api.client');
    });

    Route::group(['prefix' => '/modpacks'], function () {
        Route::get('/status', [Client\Servers\ModpackController::class, 'status']);
        Route::get('/search', [Client\Servers\ModpackController::class, 'search'])
            ->withoutMiddleware('throttle:api.client');
        Route::get('/versions', [Client\Servers\ModpackController::class, 'versions'])
            ->withoutMiddleware('throttle:api.client');
        Route::get('/download-url', [Client\Servers\ModpackController::class, 'downloadUrl'])
            ->withoutMiddleware('throttle:api.client');
        Route::get('/details', [Client\Servers\ModpackController::class, 'details'])
            ->withoutMiddleware('throttle:api.client');
        Route::get('/minecraft-versions', [Client\Servers\ModpackController::class, 'minecraftVersions'])
            ->withoutMiddleware('throttle:api.client');
        Route::get('/installer-url', [Client\Servers\ModpackController::class, 'installerUrl'])
            ->withoutMiddleware('throttle:api.client');
        Route::get('/server-jar-url', [Client\Servers\ModpackController::class, 'serverJarUrl'])
            ->withoutMiddleware('throttle:api.client');
        Route::post('/install-server-jar', [Client\Servers\ModpackController::class, 'installServerJar'])
            ->withoutMiddleware('throttle:api.client');
        Route::post('/fix-permissions', [Client\Servers\ModpackController::class, 'fixPermissions'])
            ->withoutMiddleware('throttle:api.client');
        Route::post('/switch-egg', [Client\Servers\ModpackController::class, 'switchEgg']);
        Route::get('/java-compatibility', [Client\Servers\ModpackController::class, 'javaCompatibility'])
            ->withoutMiddleware('throttle:api.client');
    });

    Route::group(['prefix' => '/minecraft-versions'], function () {
        Route::get('/status', [Client\Servers\MinecraftVersionController::class, 'status']);
        Route::get('/forks', [Client\Servers\MinecraftVersionController::class, 'forks'])
            ->withoutMiddleware('throttle:api.client');
        Route::get('/versions', [Client\Servers\MinecraftVersionController::class, 'versions'])
            ->withoutMiddleware('throttle:api.client');
        Route::get('/builds', [Client\Servers\MinecraftVersionController::class, 'builds'])
            ->withoutMiddleware('throttle:api.client');
        Route::post('/switch', [Client\Servers\MinecraftVersionController::class, 'switch']);
    });

    Route::group(['prefix' => '/egg'], function () {
        Route::get('/available', [Client\Servers\EggChangeController::class, 'status']);
        Route::post('/change', [Client\Servers\EggChangeController::class, 'change']);
    });

    Route::group(['prefix' => '/subdomains'], function () {
        Route::get('/', [Client\Servers\SubdomainController::class, 'status']);
        Route::post('/', [Client\Servers\SubdomainController::class, 'create']);
        Route::get('/check', [Client\Servers\SubdomainController::class, 'check']);
        Route::delete('/{subdomain}', [Client\Servers\SubdomainController::class, 'delete'])->where('subdomain', '[0-9]+');
    });

    Route::group(['prefix' => '/reverse-proxies'], function () {
        Route::get('/', [Client\Servers\ReverseProxyController::class, 'index']);
        Route::post('/', [Client\Servers\ReverseProxyController::class, 'create']);
        Route::get('/check-domain', [Client\Servers\ReverseProxyController::class, 'checkDomain']);
        Route::post('/{proxy}/confirm-dns', [Client\Servers\ReverseProxyController::class, 'confirmDns'])->where('proxy', '[0-9]+');
        Route::delete('/{proxy}', [Client\Servers\ReverseProxyController::class, 'delete'])->where('proxy', '[0-9]+');
    });

    Route::group(['prefix' => '/server-properties'], function () {
        Route::get('/', [Client\Servers\ServerPropertiesController::class, 'index']);
        Route::post('/', [Client\Servers\ServerPropertiesController::class, 'update']);
    }); 

    Route::group(['prefix' => '/environment-variables'], function () {
        Route::get('/', [Client\Servers\EnvironmentVariablesController::class, 'index']);
        Route::post('/', [Client\Servers\EnvironmentVariablesController::class, 'update']);
        Route::delete('/', [Client\Servers\EnvironmentVariablesController::class, 'destroy']);
    });

    Route::group(['prefix' => '/server-import'], function () {
        Route::get('/', [Client\Servers\ServerImportController::class, 'status']);
        Route::post('/test', [Client\Servers\ServerImportController::class, 'test'])
            ->withoutMiddleware('throttle:api.client');
        Route::post('/browse', [Client\Servers\ServerImportController::class, 'browse'])
            ->withoutMiddleware('throttle:api.client');
        Route::post('/start', [Client\Servers\ServerImportController::class, 'start']);
        Route::post('/step', [Client\Servers\ServerImportController::class, 'step'])
            ->withoutMiddleware('throttle:api.client');
        Route::post('/cancel', [Client\Servers\ServerImportController::class, 'cancel']);
        Route::post('/reset', [Client\Servers\ServerImportController::class, 'reset']);
    });

    if (class_exists(\Pterodactyl\Services\ServerSplitter\ServerSplitterService::class)) {
        Route::group(['prefix' => '/splits'], function () {
            Route::get('/', [Client\Servers\ServerSplitController::class, 'index']);
            Route::post('/', [Client\Servers\ServerSplitController::class, 'store']);
            Route::delete('/{splitServerId}', [Client\Servers\ServerSplitController::class, 'delete'])->where('splitServerId', '[0-9]+');
        });
    }
});
