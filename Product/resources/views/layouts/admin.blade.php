<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>{{ $siteConfiguration['name'] ?? 'Pterodactyl' }} - @yield('title')</title>
        <meta content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" name="viewport">
        <meta name="_token" content="{{ csrf_token() }}">

        @php
            $seoFavicon = $siteConfiguration['seo']['favicon'] ?? '';
            $pwaThemeColor = $siteConfiguration['seo']['pwa']['themeColor'] ?? '#0e4688';
        @endphp
        @if($seoFavicon)
            <link rel="icon" type="image/png" href="{{ $seoFavicon }}">
            <link rel="shortcut icon" href="{{ $seoFavicon }}">
            <link rel="apple-touch-icon" href="{{ $seoFavicon }}">
        @else
            <link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png">
            <link rel="icon" type="image/png" href="/favicons/favicon-32x32.png" sizes="32x32">
            <link rel="icon" type="image/png" href="/favicons/favicon-16x16.png" sizes="16x16">
            <link rel="shortcut icon" href="/favicons/favicon.ico">
        @endif
        <link rel="manifest" href="/favicons/manifest.json">
        <link rel="mask-icon" href="/favicons/safari-pinned-tab.svg" color="#bc6e3c">
        <meta name="msapplication-config" content="/favicons/browserconfig.xml">
        <meta name="theme-color" content="{{ $pwaThemeColor }}">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="mobile-web-app-capable" content="yes">

        @include('layouts.scripts')

        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="{{ $siteConfiguration['theme']['fontFamilyUrl'] ?? 'https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&display=swap' }}" rel="stylesheet">


        @section('scripts')
            {!! Theme::css('vendor/select2/select2.min.css?t={cache-version}') !!}
            {!! Theme::css('vendor/bootstrap/bootstrap.min.css?t={cache-version}') !!}
            {!! Theme::css('vendor/adminlte/admin.min.css?t={cache-version}') !!}
            {!! Theme::css('vendor/adminlte/colors/skin-blue.min.css?t={cache-version}') !!}
            {!! Theme::css('vendor/sweetalert/sweetalert.min.css?t={cache-version}') !!}
            {!! Theme::css('vendor/animate/animate.min.css?t={cache-version}') !!}
            {!! Theme::css('css/pterodactyl.css?t={cache-version}') !!}
            {!! Theme::css('css/admin/theme-overrides.css?t={cache-version}') !!}
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/ionicons/2.0.1/css/ionicons.min.css">

            <!--[if lt IE 9]>
            <script src="https://oss.maxcdn.com/html5shiv/3.7.3/html5shiv.min.js"></script>
            <script src="https://oss.maxcdn.com/respond/1.4.2/respond.min.js"></script>
            <![endif]-->
        @show
        @php
            $fontFamily = $siteConfiguration['theme']['fontFamily'] ?? 'Onest';
            $logoDark = $siteConfiguration['logoDark'] ?? ($siteConfiguration['logo'] ?? '');
            $logoLight = $siteConfiguration['logoLight'] ?? ($siteConfiguration['logo'] ?? '');
            $isFullAdmin = Auth::user() && Auth::user()->root_admin;
        @endphp
        <style>
            :root, [data-theme="dark"] {
                --color-primary: {{ $siteConfiguration['theme']['darkPrimary'] ?? 'hsl(229, 100%, 64%)' }};
                --color-secondary: {{ $siteConfiguration['theme']['darkSecondary'] ?? 'hsl(229, 96%, 59%)' }};
                --color-neutral: {{ $siteConfiguration['theme']['darkNeutral'] ?? 'hsl(0, 0%, 15%)' }};
                --color-base: {{ $siteConfiguration['theme']['darkBase'] ?? 'hsl(0, 0%, 100%)' }};
                --color-muted: {{ $siteConfiguration['theme']['darkMuted'] ?? 'hsl(220, 16%, 45%)' }};
                --color-inverted: {{ $siteConfiguration['theme']['darkInverted'] ?? 'hsl(220, 14%, 60%)' }};
                --color-background: {{ $siteConfiguration['theme']['darkBackground'] ?? 'hsl(240, 3%, 6%)' }};
                --color-background-secondary: {{ $siteConfiguration['theme']['darkBackgroundSecondary'] ?? 'hsl(240, 2%, 8%)' }};
                --border-radius: {{ $siteConfiguration['theme']['borderRadius'] ?? '8' }}px;
                --font-family: '{{ $fontFamily }}', sans-serif;
            }
            [data-theme="light"] {
                --color-primary: {{ $siteConfiguration['theme']['lightPrimary'] ?? 'hsl(229, 100%, 58%)' }};
                --color-secondary: {{ $siteConfiguration['theme']['lightSecondary'] ?? 'hsl(229, 96%, 54%)' }};
                --color-neutral: {{ $siteConfiguration['theme']['lightNeutral'] ?? 'hsl(220, 13%, 82%)' }};
                --color-base: {{ $siteConfiguration['theme']['lightBase'] ?? 'hsl(220, 15%, 12%)' }};
                --color-muted: {{ $siteConfiguration['theme']['lightMuted'] ?? 'hsl(220, 9%, 42%)' }};
                --color-inverted: {{ $siteConfiguration['theme']['lightInverted'] ?? 'hsl(220, 15%, 12%)' }};
                --color-background: {{ $siteConfiguration['theme']['lightBackground'] ?? 'hsl(220, 14%, 96%)' }};
                --color-background-secondary: {{ $siteConfiguration['theme']['lightBackgroundSecondary'] ?? 'hsl(220, 13%, 91%)' }};
            }
            .admin-panel-logo {
                display: flex !important;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            .admin-logo-image {
                display: none;
                max-height: 32px;
                width: auto;
                object-fit: contain;
            }
            .admin-panel-logo.has-custom-logo .admin-logo-text {
                display: none;
            }
            [data-theme="dark"] .admin-panel-logo.has-custom-logo .admin-logo-dark {
                display: block;
            }
            [data-theme="light"] .admin-panel-logo.has-custom-logo .admin-logo-light {
                display: block;
            }
        </style>
        {{-- Admin-authored footer CSS, shared with the client area. Sanitised in
             AssetComposer via FooterSanitizer before it reaches this template. --}}
        @if(!empty($siteConfiguration['footerCustomCss']))
            <style>{!! $siteConfiguration['footerCustomCss'] !!}</style>
        @endif
        <script>
            (function() {
                function getStoredTheme() {
                    try {
                        var stored = localStorage.getItem('pterodactyl_theme');
                        if (stored === 'dark' || stored === 'light' || stored === 'system') {
                            return stored;
                        }
                    } catch (e) {}
                    return 'dark';
                }
                function applyTheme() {
                    var preference = getStoredTheme();
                    var theme = preference;
                    if (preference === 'system') {
                        theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
                    }
                    document.documentElement.setAttribute('data-theme', theme);
                }
                applyTheme();
                window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function() {
                    if (getStoredTheme() === 'system') {
                        applyTheme();
                    }
                });
            })();
        </script>
    </head>
    <body
        class="hold-transition skin-blue fixed sidebar-mini"
        style="font-family: '{{ $fontFamily }}', sans-serif;"
    >
        <div class="wrapper">
            <header class="main-header">
                <a href="{{ route('index') }}" class="logo admin-panel-logo {{ ($logoDark || $logoLight) ? 'has-custom-logo' : '' }}">
                    <span class="admin-logo-text">{{ $siteConfiguration['name'] ?? 'Pterodactyl' }}</span>
                    @if($logoDark || $logoLight)
                        <img src="{{ $logoDark ?: $logoLight }}" alt="{{ $siteConfiguration['name'] ?? 'Pterodactyl' }}" class="admin-logo-image admin-logo-dark">
                        <img src="{{ $logoLight ?: $logoDark }}" alt="{{ $siteConfiguration['name'] ?? 'Pterodactyl' }}" class="admin-logo-image admin-logo-light">
                    @endif
                </a>
                <nav class="navbar navbar-static-top">
                    <a href="#" class="sidebar-toggle" data-toggle="push-menu" role="button">
                        <span class="sr-only">Toggle navigation</span>
                        <span class="icon-bar"></span>
                        <span class="icon-bar"></span>
                        <span class="icon-bar"></span>
                    </a>
                    <div class="navbar-custom-menu">
                        <ul class="nav navbar-nav">
                            <li class="user-menu">
                                <a href="{{ route('account') }}">
                                    <img src="https://www.gravatar.com/avatar/{{ md5(strtolower(Auth::user()->email)) }}?s=160" class="user-image" alt="User Image">
                                    <span class="hidden-xs">{{ Auth::user()->name_first }} {{ Auth::user()->name_last }}</span>
                                </a>
                            </li>
                            <li>
                                <li><a href="{{ route('index') }}" data-toggle="tooltip" data-placement="bottom" title="Exit Admin Control"><i class="fa fa-server"></i></a></li>
                            </li>
                            <li>
                                <li><a href="{{ route('auth.logout') }}" id="logoutButton" data-toggle="tooltip" data-placement="bottom" title="Logout"><i class="fa fa-sign-out"></i></a></li>
                            </li>
                        </ul>
                    </div>
                </nav>
            </header>
            <aside class="main-sidebar">
                <section class="sidebar">
                    <ul class="sidebar-menu">
                        <li class="header">BASIC ADMINISTRATION</li>
                        @if($isFullAdmin)
                            <li class="{{ Route::currentRouteName() !== 'admin.index' ?: 'active' }}">
                                <a href="{{ route('admin.index') }}">
                                    <i class="fa fa-home"></i> <span>Overview</span>
                                </a>
                            </li>
                        @endif
                        <li class="theme-editor-link {{ ! starts_with(Route::currentRouteName(), 'admin.settings.theme') ?: 'active' }}">
                            <a href="{{ route('admin.settings.theme')}}">
                                <i class="fa fa-paint-brush"></i> <span>Theme editor</span>
                            </a>
                        </li>
                        @if($isFullAdmin)
                            <li class="{{ ! starts_with(Route::currentRouteName(), 'admin.settings') ?: 'active' }}">
                                <a href="{{ route('admin.settings')}}">
                                    <i class="fa fa-wrench"></i> <span>Settings</span>
                                </a>
                            </li>
                            <li class="{{ ! starts_with(Route::currentRouteName(), 'admin.api') ?: 'active' }}">
                                <a href="{{ route('admin.api.index')}}">
                                    <i class="fa fa-gamepad"></i> <span>Application API</span>
                                </a>
                            </li>
                            <li class="header">MANAGEMENT</li>
                            <li class="{{ ! starts_with(Route::currentRouteName(), 'admin.databases') ?: 'active' }}">
                                <a href="{{ route('admin.databases') }}">
                                    <i class="fa fa-database"></i> <span>Databases</span>
                                </a>
                            </li>
                            <li class="{{ ! starts_with(Route::currentRouteName(), 'admin.locations') ?: 'active' }}">
                                <a href="{{ route('admin.locations') }}">
                                    <i class="fa fa-globe"></i> <span>Locations</span>
                                </a>
                            </li>
                            <li class="{{ ! starts_with(Route::currentRouteName(), 'admin.nodes') ?: 'active' }}">
                                <a href="{{ route('admin.nodes') }}">
                                    <i class="fa fa-sitemap"></i> <span>Nodes</span>
                                </a>
                            </li>
                            <li class="{{ ! starts_with(Route::currentRouteName(), 'admin.servers') ?: 'active' }}">
                                <a href="{{ route('admin.servers') }}">
                                    <i class="fa fa-server"></i> <span>Servers</span>
                                </a>
                            </li>
                            <li class="{{ ! starts_with(Route::currentRouteName(), 'admin.users') ?: 'active' }}">
                                <a href="{{ route('admin.users') }}">
                                    <i class="fa fa-users"></i> <span>Users</span>
                                </a>
                            </li>
                            <li class="header">SERVICE MANAGEMENT</li>
                            <li class="{{ ! starts_with(Route::currentRouteName(), 'admin.mounts') ?: 'active' }}">
                                <a href="{{ route('admin.mounts') }}">
                                    <i class="fa fa-magic"></i> <span>Mounts</span>
                                </a>
                            </li>
                            <li class="{{ ! starts_with(Route::currentRouteName(), 'admin.nests') ?: 'active' }}">
                                <a href="{{ route('admin.nests') }}">
                                    <i class="fa fa-th-large"></i> <span>Nests</span>
                                </a>
                            </li>
                        @endif
                    </ul>
                </section>
            </aside>
            <div class="content-wrapper">
                <section class="content-header">
                    @yield('content-header')
                </section>
                <section class="content">
                    <div class="row">
                        <div class="col-xs-12">
                            @if (count($errors) > 0)
                                <div class="alert alert-danger">
                                    There was an error validating the data provided.<br><br>
                                    <ul>
                                        @foreach ($errors->all() as $error)
                                            <li>{{ $error }}</li>
                                        @endforeach
                                    </ul>
                                </div>
                            @endif
                            @foreach (Alert::getMessages() as $type => $messages)
                                @foreach ($messages as $message)
                                    <div class="alert alert-{{ $type }} alert-dismissable" role="alert">
                                        {{ $message }}
                                    </div>
                                @endforeach
                            @endforeach
                        </div>
                    </div>
                    @yield('content')
                </section>
            </div>
            <footer class="main-footer">
                @if(!empty($siteConfiguration['copyrightText']))
                    {{-- Same markup and wrapper class as the client area, so the
                         admin-authored footer HTML/CSS renders identically here. --}}
                    <div class="luna-footer" data-variant="page">
                        {!! str_replace('{year}', date('Y'), $siteConfiguration['copyrightText']) !!}
                    </div>
                @endif
                <div class="admin-footer-meta">
                    <span>
                        <i class="fa fa-fw {{ $appIsGit ? 'fa-git-square' : 'fa-code-fork' }}"></i>{{ $appVersion }}
                    </span>
                    <span>
                        <i class="fa fa-fw fa-clock-o"></i>{{ round(microtime(true) - LARAVEL_START, 3) }}s
                    </span>
                </div>
            </footer>
        </div>
        @section('footer-scripts')
            <script src="/js/keyboard.polyfill.js" type="application/javascript"></script>
            <script>keyboardeventKeyPolyfill.polyfill();</script>

            {!! Theme::js('vendor/jquery/jquery.min.js?t={cache-version}') !!}
            {!! Theme::js('vendor/sweetalert/sweetalert.min.js?t={cache-version}') !!}
            {!! Theme::js('vendor/bootstrap/bootstrap.min.js?t={cache-version}') !!}
            {!! Theme::js('vendor/slimscroll/jquery.slimscroll.min.js?t={cache-version}') !!}
            {!! Theme::js('vendor/adminlte/app.min.js?t={cache-version}') !!}
            {!! Theme::js('vendor/bootstrap-notify/bootstrap-notify.min.js?t={cache-version}') !!}
            {!! Theme::js('vendor/select2/select2.full.min.js?t={cache-version}') !!}
            {!! Theme::js('js/admin/functions.js?t={cache-version}') !!}
            <script src="/js/autocomplete.js" type="application/javascript"></script>

            <script>
                $('#logoutButton').on('click', function (event) {
                    event.preventDefault();

                    swal({
                        title: 'Do you want to log out?',
                        type: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#d9534f',
                        cancelButtonColor: '#d33',
                        confirmButtonText: 'Log out'
                    }, function () {
                         $.ajax({
                            type: 'POST',
                            url: '{{ route("auth.logout") }}',
                            data: {
                                _token: '{{ csrf_token() }}'
                            },complete: function () {
                                window.location.href = '{{ route("auth.login") }}';
                            }
                    });
                });
            });
            </script>

            <script>
                $(function () {
                    $('[data-toggle="tooltip"]').tooltip();
                })
            </script>
            <script>
                if ('serviceWorker' in navigator && window.isSecureContext) {
                    window.addEventListener('load', function() {
                        navigator.serviceWorker.register('/sw.js').catch(function() {});
                    });
                }
            </script>
        @show
    </body>
</html>
