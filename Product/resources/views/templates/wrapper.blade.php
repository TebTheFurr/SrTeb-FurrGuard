<!DOCTYPE html>
<html>
    <head>
        @php
            $seoIndexingEnabled = $siteConfiguration['seo']['indexingEnabled'] ?? false;
            $seoTitle = $siteConfiguration['seo']['metaTitle'] ?? '';
            $seoDescription = $siteConfiguration['seo']['metaDescription'] ?? '';
            $seoKeywords = $siteConfiguration['seo']['metaKeywords'] ?? '';
            $seoImage = $siteConfiguration['seo']['metaImage'] ?? '';
            $seoFavicon = $siteConfiguration['seo']['favicon'] ?? '';
            $pwaThemeColor = $siteConfiguration['seo']['pwa']['themeColor'] ?? '';
            $primaryColor = $siteConfiguration['theme']['darkPrimary'] ?? 'hsl(229, 100%, 64%)';
            $themeColor = $pwaThemeColor !== '' ? $pwaThemeColor : $primaryColor;
            $siteName = $siteConfiguration['name'] ?? 'Pterodactyl';
            $pageTitle = $seoTitle ?: $siteName;
        @endphp
        <title>{{ $pageTitle }}</title>

        @section('meta')
            <meta charset="utf-8">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <meta content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" name="viewport">
            <meta name="csrf-token" content="{{ csrf_token() }}">
            @if(!$seoIndexingEnabled)
                <meta name="robots" content="noindex, nofollow">
            @endif
            @if($seoDescription)
                <meta name="description" content="{{ $seoDescription }}">
            @endif
            @if($seoKeywords)
                <meta name="keywords" content="{{ $seoKeywords }}">
            @endif
            <meta property="og:type" content="website">
            <meta property="og:title" content="{{ $pageTitle }}">
            @if($seoDescription)
                <meta property="og:description" content="{{ $seoDescription }}">
            @endif
            @if($seoImage)
                <meta property="og:image" content="{{ $seoImage }}">
            @endif
            <meta name="twitter:card" content="summary_large_image">
            <meta name="twitter:title" content="{{ $pageTitle }}">
            @if($seoDescription)
                <meta name="twitter:description" content="{{ $seoDescription }}">
            @endif
            @if($seoImage)
                <meta name="twitter:image" content="{{ $seoImage }}">
            @endif
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link rel="preload" as="style" href="{{ $siteConfiguration['theme']['fontFamilyUrl'] ?? 'https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&display=swap' }}" onload="this.onload=null;this.rel='stylesheet'">
            <noscript>
                <link href="{{ $siteConfiguration['theme']['fontFamilyUrl'] ?? 'https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&display=swap' }}" rel="stylesheet">
            </noscript>
            @if($seoFavicon)
                <link rel="icon" type="image/png" href="{{ $seoFavicon }}">
                <link rel="shortcut icon" href="{{ $seoFavicon }}">
                <link rel="apple-touch-icon" href="{{ $seoFavicon }}">
            @else
                <link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png">
                <link rel="icon" type="image/png" href="/favicons/favicon-32x32.png" sizes="32x32">
                <link rel="icon" type="image/png" href="/favicons/favicon-16x16.png" sizes="16x16">
                <link rel="mask-icon" href="/favicons/safari-pinned-tab.svg" color="#bc6e3c">
                <link rel="shortcut icon" href="/favicons/favicon.ico">
            @endif
            <link rel="manifest" href="/favicons/manifest.json">
            <meta name="msapplication-config" content="/favicons/browserconfig.xml">
            <meta name="theme-color" content="{{ $themeColor }}">
            <meta name="apple-mobile-web-app-capable" content="yes">
            <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
            <meta name="mobile-web-app-capable" content="yes">
        @show

        @section('user-data')
            @if(!is_null(Auth::user()))
                <script>
                    window.PterodactylUser = {!! json_encode(Auth::user()->toVueObject()) !!};
                </script>
            @endif
            @if(!empty($siteConfiguration))
                <script>
                    window.SiteConfiguration = {!! json_encode($siteConfiguration) !!};
                </script>
            @endif
        @show

        @php
            $fontFamily = $siteConfiguration['theme']['fontFamily'] ?? 'Onest';
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
                --border-radius: {{ $siteConfiguration['theme']['borderRadius'] ?? '12' }}px;
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
            html, body, #app {
                background-color: var(--color-background) !important;
                color: var(--color-base) !important;
                font-family: var(--font-family) !important;
            }
        </style>
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

        @yield('assets')
        <link rel="preload" as="script" href="{{ $asset->url('main.js') }}" crossorigin="anonymous">

        @include('layouts.scripts')
    </head>
    <body>
        @section('content')
            @yield('above-container')
            @yield('container')
            @yield('below-container')
        @show
        @section('scripts')
            {!! $asset->js('main.js') !!}
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
