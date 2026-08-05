<?php

use Illuminate\Support\Facades\Route;
use Pterodactyl\Http\Controllers\Admin;
use Pterodactyl\Http\Middleware\Admin\DemoSectionDisabled;
use Pterodactyl\Http\Middleware\Admin\Servers\ServerInstalled;

Route::get('/', [Admin\BaseController::class, 'index'])->name('admin.index');

/*
|--------------------------------------------------------------------------
| Location Controller Routes
|--------------------------------------------------------------------------
|
| Endpoint: /admin/api
|
*/
Route::group(['prefix' => 'api', 'middleware' => [DemoSectionDisabled::class]], function () {
    Route::get('/', [Admin\ApiController::class, 'index'])->name('admin.api.index');
    Route::get('/new', [Admin\ApiController::class, 'create'])->name('admin.api.new');

    Route::post('/new', [Admin\ApiController::class, 'store']);

    Route::delete('/revoke/{identifier}', [Admin\ApiController::class, 'delete'])->name('admin.api.delete');
});

/*
|--------------------------------------------------------------------------
| Location Controller Routes
|--------------------------------------------------------------------------
|
| Endpoint: /admin/locations
|
*/
Route::group(['prefix' => 'locations'], function () {
    Route::get('/', [Admin\LocationController::class, 'index'])->name('admin.locations');
    Route::get('/view/{location:id}', [Admin\LocationController::class, 'view'])->name('admin.locations.view');

    Route::post('/', [Admin\LocationController::class, 'create']);
    Route::patch('/view/{location:id}', [Admin\LocationController::class, 'update']);
});

/*
|--------------------------------------------------------------------------
| Database Controller Routes
|--------------------------------------------------------------------------
|
| Endpoint: /admin/databases
|
*/
Route::group(['prefix' => 'databases'], function () {
    Route::get('/', [Admin\DatabaseController::class, 'index'])->name('admin.databases');
    Route::get('/view/{host:id}', [Admin\DatabaseController::class, 'view'])->name('admin.databases.view');

    Route::post('/', [Admin\DatabaseController::class, 'create']);
    Route::patch('/view/{host:id}', [Admin\DatabaseController::class, 'update']);
    Route::delete('/view/{host:id}', [Admin\DatabaseController::class, 'delete']);
});

/*
|--------------------------------------------------------------------------
| Settings Controller Routes
|--------------------------------------------------------------------------
|
| Endpoint: /admin/settings
|
*/
Route::group(['prefix' => 'settings'], function () {
    Route::get('/', [Admin\Settings\IndexController::class, 'index'])->name('admin.settings');
    Route::get('/mail', [Admin\Settings\MailController::class, 'index'])->name('admin.settings.mail');
    Route::get('/advanced', [Admin\Settings\AdvancedController::class, 'index'])->name('admin.settings.advanced');
    Route::get('/theme', [Admin\Settings\ThemeController::class, 'index'])->name('admin.settings.theme');

    Route::post('/mail/test', [Admin\Settings\MailController::class, 'test'])->name('admin.settings.mail.test');

    Route::patch('/', [Admin\Settings\IndexController::class, 'update']);
    Route::patch('/mail', [Admin\Settings\MailController::class, 'update']);
    Route::patch('/advanced', [Admin\Settings\AdvancedController::class, 'update']);
    Route::patch('/theme', [Admin\Settings\ThemeController::class, 'update']);

    Route::group(['prefix' => 'theme'], function () {
        Route::get('/config', [Admin\Settings\ThemeController::class, 'getConfig'])->name('admin.settings.theme.config');
        Route::post('/reset', [Admin\Settings\ThemeController::class, 'reset'])->name('admin.settings.theme.reset');
        Route::post('/upload', [Admin\Settings\ThemeController::class, 'uploadImage'])->name('admin.settings.theme.upload');
        Route::delete('/image', [Admin\Settings\ThemeController::class, 'deleteImage'])->name('admin.settings.theme.delete-image');
        Route::get('/export', [Admin\Settings\ThemeController::class, 'exportConfig'])->name('admin.settings.theme.export');
        Route::post('/import', [Admin\Settings\ThemeController::class, 'importConfig'])->name('admin.settings.theme.import');
        Route::get('/mass-egg-importer/catalogue', [Admin\Settings\ThemeController::class, 'massEggImporterCatalogue'])->name('admin.settings.theme.mass-egg-importer.catalogue');
        Route::post('/mass-egg-importer/install', [Admin\Settings\ThemeController::class, 'installMassEgg'])->name('admin.settings.theme.mass-egg-importer.install');
        Route::post('/mass-egg-importer/import', [Admin\Settings\ThemeController::class, 'importMassEggs'])->name('admin.settings.theme.mass-egg-importer.import');
        Route::post('/server-importer/force-cancel-all', [Admin\Settings\ThemeController::class, 'forceCancelServerImports'])->name('admin.settings.theme.server-importer.force-cancel-all');
    });

    Route::group(['prefix' => 'oauth-providers'], function () {
        Route::get('/', [Admin\Settings\OAuthProviderController::class, 'index'])->name('admin.settings.oauth-providers');
        Route::post('/', [Admin\Settings\OAuthProviderController::class, 'store'])->name('admin.settings.oauth-providers.store');
        Route::patch('/{id}', [Admin\Settings\OAuthProviderController::class, 'update'])->name('admin.settings.oauth-providers.update')->where('id', '[0-9]+');
        Route::delete('/{id}', [Admin\Settings\OAuthProviderController::class, 'destroy'])->name('admin.settings.oauth-providers.delete')->where('id', '[0-9]+');
        Route::post('/reorder', [Admin\Settings\OAuthProviderController::class, 'reorder'])->name('admin.settings.oauth-providers.reorder');
    });

    Route::group(['prefix' => 'server-templates'], function () {
        Route::get('/', [Admin\Settings\ServerTemplateController::class, 'index'])->name('admin.settings.server-templates');
        Route::post('/', [Admin\Settings\ServerTemplateController::class, 'store'])->name('admin.settings.server-templates.store');
        Route::patch('/{id}', [Admin\Settings\ServerTemplateController::class, 'update'])->name('admin.settings.server-templates.update')->where('id', '[0-9]+');
        Route::delete('/{id}', [Admin\Settings\ServerTemplateController::class, 'destroy'])->name('admin.settings.server-templates.delete')->where('id', '[0-9]+');
        Route::post('/reorder', [Admin\Settings\ServerTemplateController::class, 'reorder'])->name('admin.settings.server-templates.reorder');
    });

    Route::group(['prefix' => 'announcements'], function () {
        Route::get('/', [Admin\Settings\AnnouncementController::class, 'index'])->name('admin.settings.announcements');
        Route::post('/', [Admin\Settings\AnnouncementController::class, 'store'])->name('admin.settings.announcements.store');
        Route::get('/{announcement}', [Admin\Settings\AnnouncementController::class, 'show'])->name('admin.settings.announcements.show');
        Route::patch('/{announcement}', [Admin\Settings\AnnouncementController::class, 'update'])->name('admin.settings.announcements.update');
        Route::delete('/{announcement}', [Admin\Settings\AnnouncementController::class, 'destroy'])->name('admin.settings.announcements.delete');
    });

    Route::group(['prefix' => 'environment'], function () {
        Route::get('/', [Admin\Settings\EnvironmentController::class, 'index'])->name('admin.settings.environment');
        Route::post('/', [Admin\Settings\EnvironmentController::class, 'store'])->name('admin.settings.environment.store');
        Route::patch('/', [Admin\Settings\EnvironmentController::class, 'update'])->name('admin.settings.environment.update');
        Route::delete('/', [Admin\Settings\EnvironmentController::class, 'destroy'])->name('admin.settings.environment.destroy');
    });
});

/*
|--------------------------------------------------------------------------
| User Controller Routes
|--------------------------------------------------------------------------
|
| Endpoint: /admin/users
|
*/
Route::group(['prefix' => 'users'], function () {
    Route::get('/', [Admin\UserController::class, 'index'])->name('admin.users');
    Route::get('/accounts.json', [Admin\UserController::class, 'json'])->name('admin.users.json');
    Route::get('/new', [Admin\UserController::class, 'create'])->name('admin.users.new');
    Route::get('/view/{user:id}', [Admin\UserController::class, 'view'])->name('admin.users.view');

    Route::post('/new', [Admin\UserController::class, 'store']);

    Route::patch('/view/{user:id}', [Admin\UserController::class, 'update']);
    Route::delete('/view/{user:id}', [Admin\UserController::class, 'delete'])->name('admin.users.delete');
});

/*
|--------------------------------------------------------------------------
| Server Controller Routes
|--------------------------------------------------------------------------
|
| Endpoint: /admin/servers
|
*/
Route::group(['prefix' => 'servers', 'middleware' => [DemoSectionDisabled::class]], function () {
    Route::get('/', [Admin\Servers\ServerController::class, 'index'])->name('admin.servers');
    Route::get('/new', [Admin\Servers\CreateServerController::class, 'index'])->name('admin.servers.new');
    Route::get('/view/{server:id}', [Admin\Servers\ServerViewController::class, 'index'])->name('admin.servers.view');
    Route::post('/clone/{server:id}', [Admin\Servers\ServerController::class, 'clone'])->name('admin.servers.clone');

    Route::group(['middleware' => [ServerInstalled::class]], function () {
        Route::get('/view/{server:id}/details', [Admin\Servers\ServerViewController::class, 'details'])->name('admin.servers.view.details');
        Route::get('/view/{server:id}/build', [Admin\Servers\ServerViewController::class, 'build'])->name('admin.servers.view.build');
        Route::get('/view/{server:id}/startup', [Admin\Servers\ServerViewController::class, 'startup'])->name('admin.servers.view.startup');
        Route::get('/view/{server:id}/database', [Admin\Servers\ServerViewController::class, 'database'])->name('admin.servers.view.database');
        Route::get('/view/{server:id}/mounts', [Admin\Servers\ServerViewController::class, 'mounts'])->name('admin.servers.view.mounts');
    });

    Route::get('/view/{server:id}/manage', [Admin\Servers\ServerViewController::class, 'manage'])->name('admin.servers.view.manage');
    Route::get('/view/{server:id}/delete', [Admin\Servers\ServerViewController::class, 'delete'])->name('admin.servers.view.delete');

    Route::post('/new', [Admin\Servers\CreateServerController::class, 'store']);
    Route::post('/view/{server:id}/build', [Admin\ServersController::class, 'updateBuild']);
    Route::post('/view/{server:id}/startup', [Admin\ServersController::class, 'saveStartup']);
    Route::post('/view/{server:id}/database', [Admin\ServersController::class, 'newDatabase']);
    Route::post('/view/{server:id}/mounts', [Admin\ServersController::class, 'addMount'])->name('admin.servers.view.mounts.store');
    Route::post('/view/{server:id}/manage/toggle', [Admin\ServersController::class, 'toggleInstall'])->name('admin.servers.view.manage.toggle');
    Route::post('/view/{server:id}/manage/suspension', [Admin\ServersController::class, 'manageSuspension'])->name('admin.servers.view.manage.suspension');
    Route::post('/view/{server:id}/manage/reinstall', [Admin\ServersController::class, 'reinstallServer'])->name('admin.servers.view.manage.reinstall');
    Route::post('/view/{server:id}/manage/transfer', [Admin\Servers\ServerTransferController::class, 'transfer'])->name('admin.servers.view.manage.transfer');
    Route::post('/view/{server:id}/delete', [Admin\ServersController::class, 'delete']);

    Route::patch('/view/{server:id}/details', [Admin\ServersController::class, 'setDetails']);
    Route::patch('/view/{server:id}/database', [Admin\ServersController::class, 'resetDatabasePassword']);

    Route::delete('/view/{server:id}/database/{database:id}/delete', [Admin\ServersController::class, 'deleteDatabase'])->name('admin.servers.view.database.delete');
    Route::delete('/view/{server:id}/mounts/{mount:id}', [Admin\ServersController::class, 'deleteMount'])
        ->name('admin.servers.view.mounts.delete');
});

/*
|--------------------------------------------------------------------------
| Node Controller Routes
|--------------------------------------------------------------------------
|
| Endpoint: /admin/nodes
|
*/
Route::group(['prefix' => 'nodes'], function () {
    Route::get('/', [Admin\Nodes\NodeController::class, 'index'])->name('admin.nodes');
    Route::get('/new', [Admin\NodesController::class, 'create'])->name('admin.nodes.new');
    Route::get('/view/{node:id}', [Admin\Nodes\NodeViewController::class, 'index'])->name('admin.nodes.view');
    Route::get('/view/{node:id}/settings', [Admin\Nodes\NodeViewController::class, 'settings'])->name('admin.nodes.view.settings');
    Route::get('/view/{node:id}/configuration', [Admin\Nodes\NodeViewController::class, 'configuration'])->name('admin.nodes.view.configuration');
    Route::get('/view/{node:id}/allocation', [Admin\Nodes\NodeViewController::class, 'allocations'])->name('admin.nodes.view.allocation');
    Route::get('/view/{node:id}/servers', [Admin\Nodes\NodeViewController::class, 'servers'])->name('admin.nodes.view.servers');
    Route::get('/view/{node:id}/system-information', Admin\Nodes\SystemInformationController::class);

    Route::post('/new', [Admin\NodesController::class, 'store']);
    Route::post('/view/{node:id}/allocation', [Admin\NodesController::class, 'createAllocation']);
    Route::post('/view/{node:id}/allocation/remove', [Admin\NodesController::class, 'allocationRemoveBlock'])->name('admin.nodes.view.allocation.removeBlock');
    Route::post('/view/{node:id}/allocation/alias', [Admin\NodesController::class, 'allocationSetAlias'])->name('admin.nodes.view.allocation.setAlias');
    Route::post('/view/{node:id}/settings/token', Admin\NodeAutoDeployController::class)->name('admin.nodes.view.configuration.token');

    Route::patch('/view/{node:id}/settings', [Admin\NodesController::class, 'updateSettings']);

    Route::delete('/view/{node:id}/delete', [Admin\NodesController::class, 'delete'])->name('admin.nodes.view.delete');
    Route::delete('/view/{node:id}/allocation/remove/{allocation:id}', [Admin\NodesController::class, 'allocationRemoveSingle'])->name('admin.nodes.view.allocation.removeSingle');
    Route::delete('/view/{node:id}/allocations', [Admin\NodesController::class, 'allocationRemoveMultiple'])->name('admin.nodes.view.allocation.removeMultiple');
});

/*
|--------------------------------------------------------------------------
| Mount Controller Routes
|--------------------------------------------------------------------------
|
| Endpoint: /admin/mounts
|
*/
Route::group(['prefix' => 'mounts'], function () {
    Route::get('/', [Admin\MountController::class, 'index'])->name('admin.mounts');
    Route::get('/view/{mount:id}', [Admin\MountController::class, 'view'])->name('admin.mounts.view');

    Route::post('/', [Admin\MountController::class, 'create']);
    Route::post('/{mount:id}/eggs', [Admin\MountController::class, 'addEggs'])->name('admin.mounts.eggs');
    Route::post('/{mount:id}/nodes', [Admin\MountController::class, 'addNodes'])->name('admin.mounts.nodes');

    Route::patch('/view/{mount:id}', [Admin\MountController::class, 'update']);

    Route::delete('/{mount:id}/eggs/{egg_id}', [Admin\MountController::class, 'deleteEgg']);
    Route::delete('/{mount:id}/nodes/{node_id}', [Admin\MountController::class, 'deleteNode']);
});

/*
|--------------------------------------------------------------------------
| Nest Controller Routes
|--------------------------------------------------------------------------
|
| Endpoint: /admin/nests
|
*/
Route::group(['prefix' => 'free-servers'], function () {
    Route::get('/', [Admin\FreeServers\FreeServerController::class, 'index'])->name('admin.free-servers');
    Route::post('/', [Admin\FreeServers\FreeServerController::class, 'store'])->name('admin.free-servers.store');
    Route::patch('/{id}', [Admin\FreeServers\FreeServerController::class, 'update'])->name('admin.free-servers.update');
    Route::delete('/{id}', [Admin\FreeServers\FreeServerController::class, 'delete'])->name('admin.free-servers.delete');
    Route::post('/issue', [Admin\FreeServers\FreeServerController::class, 'issue'])->name('admin.free-servers.issue');
    Route::get('/claims', [Admin\FreeServers\FreeServerController::class, 'claims'])->name('admin.free-servers.claims');
    Route::get('/egg-variables/{eggId}', [Admin\FreeServers\FreeServerController::class, 'eggVariables'])->name('admin.free-servers.egg-variables');
    Route::get('/search-users', [Admin\FreeServers\FreeServerController::class, 'searchUsers'])->name('admin.free-servers.search-users');
});

Route::group(['prefix' => 'nests'], function () {
    Route::get('/', [Admin\Nests\NestController::class, 'index'])->name('admin.nests');
    Route::get('/new', [Admin\Nests\NestController::class, 'create'])->name('admin.nests.new');
    Route::get('/view/{nest:id}', [Admin\Nests\NestController::class, 'view'])->name('admin.nests.view');
    Route::get('/egg/new', [Admin\Nests\EggController::class, 'create'])->name('admin.nests.egg.new');
    Route::get('/egg/{egg:id}', [Admin\Nests\EggController::class, 'view'])->name('admin.nests.egg.view');
    Route::get('/egg/{egg:id}/export', [Admin\Nests\EggShareController::class, 'export'])->name('admin.nests.egg.export');
    Route::get('/egg/{egg:id}/variables', [Admin\Nests\EggVariableController::class, 'view'])->name('admin.nests.egg.variables');
    Route::get('/egg/{egg:id}/scripts', [Admin\Nests\EggScriptController::class, 'index'])->name('admin.nests.egg.scripts');

    Route::post('/new', [Admin\Nests\NestController::class, 'store']);
    Route::post('/import', [Admin\Nests\EggShareController::class, 'import'])->name('admin.nests.egg.import');
    Route::post('/egg/new', [Admin\Nests\EggController::class, 'store']);
    Route::post('/egg/{egg:id}/variables', [Admin\Nests\EggVariableController::class, 'store']);

    Route::put('/egg/{egg:id}', [Admin\Nests\EggShareController::class, 'update']);

    Route::patch('/view/{nest:id}', [Admin\Nests\NestController::class, 'update']);
    Route::patch('/egg/{egg:id}', [Admin\Nests\EggController::class, 'update']);
    Route::patch('/egg/{egg:id}/scripts', [Admin\Nests\EggScriptController::class, 'update']);
    Route::patch('/egg/{egg:id}/variables/{variable:id}', [Admin\Nests\EggVariableController::class, 'update'])->name('admin.nests.egg.variables.edit');

    Route::delete('/view/{nest:id}', [Admin\Nests\NestController::class, 'destroy']);
    Route::delete('/egg/{egg:id}', [Admin\Nests\EggController::class, 'destroy']);
    Route::delete('/egg/{egg:id}/variables/{variable:id}', [Admin\Nests\EggVariableController::class, 'destroy']);
});
