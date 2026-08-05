<?php

namespace Pterodactyl\Helpers;

/**
 * Sanitises the admin-authored footer HTML/CSS before it is handed to the
 * client application, which renders the HTML with dangerouslySetInnerHTML and
 * injects the CSS into a <style> element.
 *
 * The theme editor is an admin-only surface, but the footer is rendered for
 * every visitor, so an unsanitised value would be stored XSS reachable by any
 * account able to reach the "general" tab.
 */
class FooterSanitizer
{
    public const MAX_HTML_LENGTH = 65535;
    public const MAX_CSS_LENGTH = 65535;

    /**
     * Tags that are never useful in a footer and are removed together with
     * their contents.
     */
    private const BLOCKED_TAGS = 'script|iframe|object|embed|form|base|meta|link';

    public static function html(?string $html): string
    {
        $html = (string) $html;

        if (trim($html) === '') {
            return '';
        }

        $html = mb_substr($html, 0, self::MAX_HTML_LENGTH);

        // Drop blocked elements along with everything they wrap.
        $html = self::replace('#<\s*(' . self::BLOCKED_TAGS . ')\b[^>]*>.*?<\s*/\s*\1\s*>#is', '', $html);

        // Drop any remaining stray opening, closing or self-closing tags.
        $html = self::replace('#<\s*/?\s*(' . self::BLOCKED_TAGS . ')\b[^>]*>#i', '', $html);

        // Drop inline event handlers (onclick, onerror, onload, ...).
        $html = self::replace('#\son[a-z-]+\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s>]+)#i', '', $html);

        // Neutralise scripting URLs and data: documents. data:image/... is
        // intentionally preserved so inline logos keep working.
        $html = self::replace(
            '#\b(href|src|xlink:href|action|formaction)\s*=\s*(["\']?)\s*(?:(?:javascript|vbscript)\s*:|data\s*:\s*text\s*/\s*html)#i',
            '$1=$2#',
            $html
        );

        return trim($html);
    }

    public static function css(?string $css): string
    {
        $css = (string) $css;

        if (trim($css) === '') {
            return '';
        }

        $css = mb_substr($css, 0, self::MAX_CSS_LENGTH);

        // Prevent breaking out of the <style> element the CSS is injected into.
        $css = self::replace('#<\s*/?\s*(style|script)\b[^>]*>?#i', '', $css);

        // Legacy IE scripting vectors and scripting URLs inside url()/content.
        $css = self::replace('#expression\s*\(#i', '(', $css);
        $css = self::replace('#(javascript|vbscript)\s*:#i', '', $css);

        return trim($css);
    }

    private static function replace(string $pattern, string $replacement, string $subject): string
    {
        return preg_replace($pattern, $replacement, $subject) ?? '';
    }
}
