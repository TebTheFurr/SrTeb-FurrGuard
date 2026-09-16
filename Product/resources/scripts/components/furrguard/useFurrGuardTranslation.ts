import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';

/**
 * Like the Vault, FurrGuard is a Tebby tool and its page is always shown in Spanish,
 * whatever language the panel resolves for the user. Keys live under `furrguard.*` of
 * the `dashboard` catalogue (resources/lang/{es,en}/dashboard.php); every call carries
 * its Spanish default, so a missing key never shows up as a bare key.
 */
export const FURRGUARD_LOCALE = 'es';

const useFurrGuardTranslation = (): { t: TFunction; locale: string } => {
    // Subscribing keeps the component re-rendering when the catalogues load.
    const { i18n } = useTranslation('dashboard');
    const t = useMemo(() => i18n.getFixedT(FURRGUARD_LOCALE, 'dashboard'), [i18n]);

    return { t, locale: FURRGUARD_LOCALE };
};

export default useFurrGuardTranslation;
