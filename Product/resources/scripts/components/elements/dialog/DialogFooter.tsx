import React, { useContext } from 'react';
import { DialogContext } from './';
import { useDeepCompareEffect } from '@/plugins/useDeepCompareEffect';

export default ({ children }: { children: React.ReactNode }) => {
    const { setFooter } = useContext(DialogContext);

    useDeepCompareEffect(() => {
        setFooter(
            <div 
                className={'px-6 py-3 flex items-center justify-end space-x-3'} 
                style={{ 
                    backgroundColor: 'var(--color-neutral)', 
                    borderBottomLeftRadius: 'var(--border-radius, 12px)',
                    borderBottomRightRadius: 'var(--border-radius, 12px)'
                }}
            >
                {children}
            </div>
        );
    }, [children]);

    return null;
};
