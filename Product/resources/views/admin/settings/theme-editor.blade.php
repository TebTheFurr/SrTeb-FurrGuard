@extends('layouts.admin')
@include('partials/admin.settings.nav', ['activeTab' => 'theme'])

@section('title')
    Theme Editor
@endsection

@section('scripts')
    @parent
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/themes/pterodactyl/css/admin/theme-editor.css?v={{ time() }}">
@endsection

@section('content')
    @yield('settings::nav')
@endsection

@section('footer-scripts')
    @parent

    <template id="te-sidebar-template">
        @include('admin.settings.theme-editor.sidebar', ['tabs' => $tabs])
    </template>

    @include('admin.settings.theme-editor.icons')

    @include('admin.settings.theme-editor.components.options-panel')
    @include('admin.settings.theme-editor.components.fullpage-panel')
    @include('admin.settings.theme-editor.components.preview')
    @include('admin.settings.theme-editor.components.logo-upload')
    @include('admin.settings.theme-editor.components.file-upload')
    @include('admin.settings.theme-editor.components.color-card')
    @include('admin.settings.theme-editor.components.quick-action-item')
    @include('admin.settings.theme-editor.components.nav-category')
    @include('admin.settings.theme-editor.components.nav-link')
    @include('admin.settings.theme-editor.components.custom-link-item')
    @include('admin.settings.theme-editor.components.egg-item')

    @include('admin.settings.theme-editor.tabs.general')
    @include('admin.settings.theme-editor.tabs.theme')
    @include('admin.settings.theme-editor.tabs.layout')
    @include('admin.settings.theme-editor.tabs.links')
    @include('admin.settings.theme-editor.tabs.components')
    @include('admin.settings.theme-editor.tabs.announcements')
    @include('admin.settings.theme-editor.tabs.seo')
    @include('admin.settings.theme-editor.tabs.eggs')
    @include('admin.settings.theme-editor.tabs.advanced')
    @include('admin.settings.theme-editor.tabs.oauth')
    @include('admin.settings.theme-editor.tabs.templates')
    @include('admin.settings.theme-editor.tabs.addons')
    @include('admin.settings.theme-editor.tabs.addon-settings')
    @includeIf('admin.settings.theme-editor.tabs.import-eggs')
    @include('admin.settings.theme-editor.tabs.environment')
    @include('admin.settings.theme-editor.tabs.empty')

    <div class="theme-editor" id="themeEditor"></div>

    <div class="te-toast" id="toast"></div>
    <div class="te-loading" id="loading">
        <div class="te-loading-spinner"></div>
    </div>

    <div class="te-modal-overlay" id="confirmModal">
        <div class="te-modal">
            <div class="te-modal-header">
                <span class="te-modal-title" id="confirmModalTitle">Confirm</span>
            </div>
            <div class="te-modal-body">
                <p id="confirmModalMessage">Are you sure?</p>
            </div>
            <div class="te-modal-footer">
                <button class="te-btn te-btn-secondary" id="confirmModalCancel">Cancel</button>
                <button class="te-btn te-btn-danger" id="confirmModalConfirm">Confirm</button>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js"></script>
    <script src="/themes/pterodactyl/js/admin/theme-editor.js?v={{ time() }}"></script>
    <script>
        const themeEditorPayload = {
            config: {!! $configJson !!},
            defaults: {!! $defaultsJson !!},
            eggs: {!! $eggsJson !!},
            nests: {!! $nestsJson !!},
            locations: {!! $locationsJson !!},
            nodes: {!! $nodesJson !!},
            tabs: {!! json_encode($tabs) !!},
            fonts: {!! json_encode($fonts) !!},
            languages: {!! json_encode($languages) !!},
            addons: {!! json_encode($addons) !!},
            csrfToken: '{{ csrf_token() }}',
            routes: {
                settings: '{{ Auth::user()->root_admin ? route("admin.settings") : route("index") }}',
                theme: '{{ route("admin.settings.theme") }}',
                themeReset: '{{ route("admin.settings.theme.reset") }}',
                themeUpload: '{{ route("admin.settings.theme.upload") }}',
                themeExport: '{{ route("admin.settings.theme.export") }}',
                themeImport: '{{ route("admin.settings.theme.import") }}',
                environment: '{{ route("admin.settings.environment") }}',
                freeServers: '{{ \Route::has("admin.free-servers") ? route("admin.free-servers") : "" }}',
                freeServersIssue: '{{ \Route::has("admin.free-servers.issue") ? route("admin.free-servers.issue") : "" }}',
                freeServersClaims: '{{ \Route::has("admin.free-servers.claims") ? route("admin.free-servers.claims") : "" }}',
                freeServersEggVariables: '{{ \Route::has("admin.free-servers.egg-variables") ? "/admin/free-servers/egg-variables/" : "" }}',
                freeServersSearchUsers: '{{ \Route::has("admin.free-servers.search-users") ? route("admin.free-servers.search-users") : "" }}',
                massEggImporterCatalogue: '{{ \Route::has("admin.settings.theme.mass-egg-importer.catalogue") ? route("admin.settings.theme.mass-egg-importer.catalogue") : "" }}',
                massEggImporterInstall: '{{ \Route::has("admin.settings.theme.mass-egg-importer.install") ? route("admin.settings.theme.mass-egg-importer.install") : "" }}',
                massEggImporterImport: '{{ \Route::has("admin.settings.theme.mass-egg-importer.import") ? route("admin.settings.theme.mass-egg-importer.import") : "" }}',
                serverImporterForceCancelAll: '{{ \Route::has("admin.settings.theme.server-importer.force-cancel-all") ? route("admin.settings.theme.server-importer.force-cancel-all") : "" }}',
                oauthProviders: '{{ \Route::has("admin.settings.oauth-providers") ? route("admin.settings.oauth-providers") : "" }}',
                oauthProviderReorder: '{{ \Route::has("admin.settings.oauth-providers.reorder") ? route("admin.settings.oauth-providers.reorder") : "" }}',
                serverTemplates: '{{ \Route::has("admin.settings.server-templates") ? route("admin.settings.server-templates") : "" }}',
                serverTemplateReorder: '{{ \Route::has("admin.settings.server-templates.reorder") ? route("admin.settings.server-templates.reorder") : "" }}'
            }
        };

        if (window.ThemeEditor && typeof window.ThemeEditor.init === 'function') {
            window.ThemeEditor.init(themeEditorPayload);
        } else {
            window.addEventListener('load', function () {
                if (window.ThemeEditor && typeof window.ThemeEditor.init === 'function') {
                    window.ThemeEditor.init(themeEditorPayload);
                }
            });
        }
    </script>
@endsection
