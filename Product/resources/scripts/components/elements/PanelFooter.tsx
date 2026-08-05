import React, { useEffect } from 'react';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';

/**
 * Token replaced with the current year when the footer is rendered, so the
 * configured markup never needs an inline script to stay up to date.
 */
const YEAR_TOKEN = /\{year\}/g;

const STYLE_ELEMENT_ID = 'luna-footer-css';

const FALLBACK_HTML = `&copy; {year} <a rel="noopener nofollow noreferrer" href="https://pterodactyl.io" target="_blank">Pterodactyl Software</a>`;

export type FooterVariant = 'page' | 'auth';

export interface PanelFooterProps {
    /**
     * `page` is the footer under panel content, `auth` the compact variant used
     * on the login/registration screens. The value is exposed to the custom CSS
     * as a `data-variant` attribute.
     */
    variant?: FooterVariant;
    className?: string;
    style?: React.CSSProperties;
}

function renderYear(html: string): string {
    return html.replace(YEAR_TOKEN, String(new Date().getFullYear()));
}

/**
 * Injects the admin-provided footer CSS into a single <style> element in the
 * document head. Using textContent (never innerHTML) means the stylesheet can
 * never break out of the element it is written into.
 */
function useFooterStylesheet(css: string | undefined): void {
    useEffect(() => {
        const trimmed = (css ?? '').trim();
        const existing = document.getElementById(STYLE_ELEMENT_ID);

        if (trimmed === '') {
            existing?.remove();
            return;
        }

        const element = existing ?? document.createElement('style');

        if (!existing) {
            element.id = STYLE_ELEMENT_ID;
            document.head.appendChild(element);
        }

        if (element.textContent !== trimmed) {
            element.textContent = trimmed;
        }
    }, [css]);
}

function PanelFooter({ variant = 'page', className, style }: PanelFooterProps) {
    const copyrightText = useStoreState((state: ApplicationStore) => state.settings.data?.copyrightText);
    const footerCustomCss = useStoreState((state: ApplicationStore) => state.settings.data?.footerCustomCss);

    useFooterStylesheet(footerCustomCss);

    const html = renderYear((copyrightText ?? '').trim() || FALLBACK_HTML);

    return (
        <div
            className={className ? `luna-footer ${className}` : 'luna-footer'}
            data-variant={variant}
            style={style}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

export default PanelFooter;
