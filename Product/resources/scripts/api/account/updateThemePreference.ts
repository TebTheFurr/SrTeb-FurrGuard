export type ThemePreference = 'dark' | 'light' | 'system';

const THEME_STORAGE_KEY = 'pterodactyl_theme';

export const saveThemePreference = (theme: ThemePreference): void => {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {
        console.warn('Failed to save theme preference to localStorage');
    }
};

export const updateThemePreference = async (theme: ThemePreference): Promise<void> => {
    saveThemePreference(theme);
    applyTheme(theme);
};

export const applyTheme = (theme: ThemePreference): void => {
    let effectiveTheme: 'dark' | 'light' = theme === 'system' 
        ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
        : theme;
    document.documentElement.setAttribute('data-theme', effectiveTheme);
};

export const getStoredTheme = (): ThemePreference => {
    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'dark' || stored === 'light' || stored === 'system') {
            return stored;
        }
    } catch (e) {
        console.warn('Failed to read theme preference from localStorage');
    }
    return 'dark';
};
