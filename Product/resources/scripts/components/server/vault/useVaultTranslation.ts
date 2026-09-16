import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';

/**
 * Tebby is a Spanish company: the Vault section is always shown in Spanish,
 * whatever language the panel resolves for the user. Keys are looked up in the
 * `es` catalogue first, then in the fallback one (whose `vault` block is also
 * Spanish), and finally the Spanish default written next to each key.
 */
export const VAULT_LOCALE = 'es';

const useVaultTranslation = (): { t: TFunction; locale: string } => {
    // Subscribing keeps the component re-rendering when the catalogues load.
    const { i18n } = useTranslation('server');
    const t = useMemo(() => i18n.getFixedT(VAULT_LOCALE, 'server'), [i18n]);

    return { t, locale: VAULT_LOCALE };
};

export default useVaultTranslation;
