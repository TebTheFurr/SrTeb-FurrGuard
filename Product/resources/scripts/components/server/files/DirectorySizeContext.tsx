import React, { createContext, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { bytesToString } from '@/lib/formatters';
import { DirectorySizeMap, DirectorySizeState } from '@/plugins/useDirectorySizes';

const DirectorySizeContext = createContext<DirectorySizeMap>({});

export const DirectorySizeProvider: React.FC<{ value: DirectorySizeMap }> = ({ value, children }) => (
    <DirectorySizeContext.Provider value={value}>{children}</DirectorySizeContext.Provider>
);

export const useDirectorySize = (name: string): DirectorySizeState | undefined =>
    useContext(DirectorySizeContext)[name];

/**
 * Size cell for a folder. Falls back to the dash the file manager showed before
 * folder sizes existed whenever the number is unavailable, so a node running
 * stock Wings simply looks the way it always did.
 */
export const DirectorySizeLabel = ({ name }: { name: string }) => {
    const { t } = useTranslation('server');
    const state = useDirectorySize(name);

    if (state?.status === 'resolved') {
        return <>{bytesToString(state.size)}</>;
    }

    if (state?.status === 'loading') {
        return (
            <span style={{ opacity: 0.45 }} title={t('files.calculating_size', 'Calculating size...')}>
                ···
            </span>
        );
    }

    return <>—</>;
};
