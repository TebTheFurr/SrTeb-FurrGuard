import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface ConsoleSidebarContextType {
    isOpen: boolean;
    toggle: () => void;
    open: () => void;
    close: () => void;
}

const COOKIE_NAME = 'console_sidebar_open';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const getCookie = (name: string): string | null => {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
};

const setCookie = (name: string, value: string, maxAge: number) => {
    document.cookie = `${name}=${value};path=/;max-age=${maxAge};SameSite=Lax`;
};

const ConsoleSidebarContext = createContext<ConsoleSidebarContextType | null>(null);

export const ConsoleSidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(() => {
        if (typeof document !== 'undefined') {
            return getCookie(COOKIE_NAME) === 'true';
        }
        return false;
    });

    useEffect(() => {
        setCookie(COOKIE_NAME, isOpen ? 'true' : 'false', COOKIE_MAX_AGE);
    }, [isOpen]);

    const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);

    return (
        <ConsoleSidebarContext.Provider value={{ isOpen, toggle, open, close }}>
            {children}
        </ConsoleSidebarContext.Provider>
    );
};

export const useConsoleSidebar = () => {
    const context = useContext(ConsoleSidebarContext);
    if (!context) {
        throw new Error('useConsoleSidebar must be used within ConsoleSidebarProvider');
    }
    return context;
};
