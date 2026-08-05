/**
 * Given a valid six character HEX color code, converts it into its associated
 * RGBA value with a user controllable alpha channel.
 */
function hexToRgba(hex: string, alpha = 1): string {
    // noinspection RegExpSimplifiable
    if (!/#?([a-fA-F0-9]{2}){3}/.test(hex)) {
        return hex;
    }

    // noinspection RegExpSimplifiable
    const [r, g, b] = hex.match(/[a-fA-F0-9]{2}/g)!.map((v) => parseInt(v, 16));

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function colorWithAlpha(color: string, alpha = 1): string {
    color = color.trim();
    
    const hslMatch = color.match(/^hsl\(([^)]+)\)$/i);
    if (hslMatch) {
        return `hsla(${hslMatch[1]}, ${alpha})`;
    }
    
    const rgbMatch = color.match(/^rgb\(([^)]+)\)$/i);
    if (rgbMatch) {
        return `rgba(${rgbMatch[1]}, ${alpha})`;
    }
    
    if (color.startsWith('#')) {
        return hexToRgba(color, alpha);
    }
    
    return color;
}

export { hexToRgba, colorWithAlpha };
