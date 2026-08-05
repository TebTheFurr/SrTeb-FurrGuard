import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import I18NextHttpBackend from 'i18next-http-backend';

const hash = module.hot ? Date.now().toString(16) : process.env.WEBPACK_BUILD_HASH;

interface WindowConfig {
    SiteConfiguration?: {
        components?: {
            translationsEnabled?: boolean;
            defaultLanguage?: string;
            enabledLanguages?: string[] | null;
        };
    };
    PterodactylUser?: {
        language?: string;
    };
}

const getInitialLanguage = (): string => {
    const win = window as WindowConfig;
    const settings = win.SiteConfiguration;
    const user = win.PterodactylUser;
    
    const translationsEnabled = settings?.components?.translationsEnabled !== false;
    
    if (!translationsEnabled) {
        return 'en';
    }
    
    const defaultLanguage = settings?.components?.defaultLanguage || 'en';
    const enabledLanguages = settings?.components?.enabledLanguages;
    
    const isLanguageEnabled = (lang: string): boolean => {
        if (!enabledLanguages) return true;
        return enabledLanguages.indexOf(lang) !== -1;
    };
    
    if (user?.language && isLanguageEnabled(user.language)) {
        return user.language;
    }
    
    return defaultLanguage;
};

const initialLanguage = getInitialLanguage();

i18n.use(I18NextHttpBackend)
    .use(initReactI18next)
    .init({
        debug: process.env.DEBUG === 'true',
        lng: initialLanguage,
        fallbackLng: 'en',
        keySeparator: '.',
        ns: ['strings', 'auth', 'activity', 'account', 'dashboard', 'server'],
        defaultNS: 'strings',
        preload: [initialLanguage],
        backend: {
            loadPath: '/locales/locale.json?locale={{lng}}&namespace={{ns}}&hash=' + hash,
        },
        interpolation: {
            escapeValue: false,
        },
        react: {
            useSuspense: true,
            bindI18n: 'languageChanged loaded',
            bindI18nStore: 'added removed',
        },
    });

export const changeLanguage = async (language: string): Promise<void> => {
    await i18n.changeLanguage(language);
};

export default i18n;
