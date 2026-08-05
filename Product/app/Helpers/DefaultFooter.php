<?php

namespace Pterodactyl\Helpers;

/**
 * Default footer markup and styling shipped with the theme.
 *
 * The HTML is rendered inside a `.luna-footer` wrapper by the client
 * application, so every selector in the stylesheet is scoped to that class.
 * Colours reference the panel theme variables (--color-background,
 * --color-base, --color-neutral, ...) so the footer follows whichever palette
 * and light/dark mode the admin has configured in the theme editor.
 *
 * The literal token {year} is substituted with the current year at render
 * time, which avoids needing an inline script in the footer markup.
 */
class DefaultFooter
{
    public const YEAR_TOKEN = '{year}';

    private const LOGO_DATA_URI = 'data:image/png;base64,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';

    /**
     * Default footer HTML, rendered inside the `.luna-footer` wrapper.
     */
    public static function html(): string
    {
        $logo = self::LOGO_DATA_URI;
        $year = self::YEAR_TOKEN;

        return <<<HTML
<div class="foot-top">
    <div class="foot-brand">
        <img class="logo" alt="" aria-hidden="true" src="{$logo}">
        <div class="foot-title">Consola <span class="foot-sep">|</span> <b>Tebby Services S.L.</b></div>
    </div>
    <div class="foot-links">
        <a class="btn-x" href="https://x.com/SrTeb_" target="_blank" rel="noopener noreferrer" aria-label="Síguenos en X">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 1.6h3.4l-7.5 8.5L23.6 22h-6.9l-5.4-7-6.2 7H1.7l8-9.1L.9 1.6h7l4.9 6.4zm-1.2 18.3h1.9L6.9 3.6H4.8z"/></svg>
            @SrTeb_
        </a>
        <span class="eu">
            <svg viewBox="0 0 36 36" aria-hidden="true">
                <circle cx="18" cy="18" r="17" fill="#003399"/>
                <g fill="#FFCC00"><polygon points="18.00,6.95 18.46,8.37 19.95,8.37 18.74,9.24 19.20,10.66 18.00,9.78 16.80,10.66 17.26,9.24 16.05,8.37 17.54,8.37"/><polygon points="22.50,8.16 22.96,9.57 24.45,9.57 23.24,10.45 23.70,11.86 22.50,10.99 21.30,11.86 21.76,10.45 20.55,9.57 22.04,9.57"/><polygon points="25.79,11.45 26.25,12.87 27.74,12.87 26.54,13.74 27.00,15.16 25.79,14.28 24.59,15.16 25.05,13.74 23.84,12.87 25.33,12.87"/><polygon points="27.00,15.95 27.46,17.37 28.95,17.37 27.74,18.24 28.20,19.66 27.00,18.78 25.80,19.66 26.26,18.24 25.05,17.37 26.54,17.37"/><polygon points="25.79,20.45 26.25,21.87 27.74,21.87 26.54,22.74 27.00,24.16 25.79,23.28 24.59,24.16 25.05,22.74 23.84,21.87 25.33,21.87"/><polygon points="22.50,23.74 22.96,25.16 24.45,25.16 23.24,26.04 23.70,27.45 22.50,26.58 21.30,27.45 21.76,26.04 20.55,25.16 22.04,25.16"/><polygon points="18.00,24.95 18.46,26.37 19.95,26.37 18.74,27.24 19.20,28.66 18.00,27.78 16.80,28.66 17.26,27.24 16.05,26.37 17.54,26.37"/><polygon points="13.50,23.74 13.96,25.16 15.45,25.16 14.24,26.04 14.70,27.45 13.50,26.58 12.30,27.45 12.76,26.04 11.55,25.16 13.04,25.16"/><polygon points="10.21,20.45 10.67,21.87 12.16,21.87 10.95,22.74 11.41,24.16 10.21,23.28 9.00,24.16 9.46,22.74 8.26,21.87 9.75,21.87"/><polygon points="9.00,15.95 9.46,17.37 10.95,17.37 9.74,18.24 10.20,19.66 9.00,18.78 7.80,19.66 8.26,18.24 7.05,17.37 8.54,17.37"/><polygon points="10.21,11.45 10.67,12.87 12.16,12.87 10.95,13.74 11.41,15.16 10.21,14.28 9.00,15.16 9.46,13.74 8.26,12.87 9.75,12.87"/><polygon points="13.50,8.16 13.96,9.57 15.45,9.57 14.24,10.45 14.70,11.86 13.50,10.99 12.30,11.86 12.76,10.45 11.55,9.57 13.04,9.57"/></g>
            </svg>
            <span class="txt"><span class="l1">Hosted in Europe</span></span>
        </span>
    </div>
</div>
<div class="foot-bottom">
    <span>&copy; {$year} Tebby Services S.L.</span>
    <span><a href="https://tebby.lgbt" target="_blank" rel="noopener noreferrer">tebby.lgbt</a></span>
</div>
HTML;
    }

    /**
     * Default footer CSS. Every rule is scoped to `.luna-footer` and pulls its
     * colours from the panel theme variables so it follows the active palette.
     */
    public static function css(): string
    {
        return <<<'CSS'
/* Todos los selectores van dentro de .luna-footer y usan las variables del
   panel, por lo que el pie sigue automáticamente la paleta y el modo
   claro/oscuro configurados en el editor de temas. */
.luna-footer {
    width: 100%;
    font-size: 15px;
    line-height: 1.6;
    letter-spacing: -0.006em;
    color: var(--color-base);
}

.luna-footer a { color: inherit; text-decoration: none; }
.luna-footer :focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; border-radius: 2px; }

.luna-footer .foot-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 28px;
    flex-wrap: wrap;
}

.luna-footer .foot-brand { display: flex; align-items: center; gap: 13px; min-width: 0; }
.luna-footer .foot-brand .logo { height: 36px; width: auto; opacity: 0.92; }

.luna-footer .foot-title {
    font-size: 14px;
    font-weight: 500;
    letter-spacing: -0.014em;
    color: var(--color-muted);
}
.luna-footer .foot-title b { color: var(--color-base); font-weight: 600; }
.luna-footer .foot-sep { color: var(--color-inverted); opacity: 0.7; }

.luna-footer .foot-links { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.luna-footer .btn-x {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 6px);
    font-size: 12.5px;
    color: var(--color-muted);
    transition: color 0.18s, border-color 0.18s, background 0.18s;
}
.luna-footer .btn-x:hover {
    color: var(--color-base);
    border-color: var(--color-inverted);
    background: var(--color-background-secondary);
}
.luna-footer .btn-x svg { width: 13px; height: 13px; flex: none; }

.luna-footer .eu {
    display: inline-flex;
    align-items: center;
    gap: 11px;
    padding: 9px 15px 9px 11px;
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 6px);
    background: var(--color-background-secondary);
}
.luna-footer .eu svg { width: 26px; height: 26px; flex: none; }
.luna-footer .eu .txt { line-height: 1.2; display: flex; align-items: center; }
.luna-footer .eu .l1 {
    font-size: 11.5px;
    font-weight: 600;
    color: var(--color-muted);
    letter-spacing: -0.008em;
}
.luna-footer .eu .l2 {
    font-size: 9.5px;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: var(--color-inverted);
}

.luna-footer .foot-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    margin-top: 26px;
    padding-top: 20px;
    border-top: 1px solid var(--color-neutral);
    font-size: 12px;
    color: var(--color-inverted);
}
.luna-footer .foot-bottom a { transition: color 0.16s; }
.luna-footer .foot-bottom a:hover { color: var(--color-muted); }

/* Pie dentro del panel */
.luna-footer[data-variant="page"] {
    padding-top: 34px;
    border-top: 1px solid var(--color-neutral);
}

/* Pie en las pantallas de login: apilado y más compacto */
.luna-footer[data-variant="auth"] {
    margin-top: 28px;
    padding-top: 22px;
    border-top: 1px solid var(--color-neutral);
    font-size: 13px;
}
.luna-footer[data-variant="auth"] .foot-top {
    flex-direction: column;
    align-items: center;
    gap: 14px;
    text-align: center;
}
.luna-footer[data-variant="auth"] .foot-links { justify-content: center; }
.luna-footer[data-variant="auth"] .foot-bottom {
    flex-direction: column;
    justify-content: center;
    gap: 6px;
    margin-top: 16px;
    padding-top: 14px;
    text-align: center;
}

@media (max-width: 640px) {
    .luna-footer .foot-top { flex-direction: column; align-items: flex-start; gap: 16px; }
    .luna-footer .foot-bottom { flex-direction: column; align-items: flex-start; gap: 6px; }
}
CSS;
    }
}
