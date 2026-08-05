import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export interface Panel {
    id: string;
    path: string;
    title: string;
}

interface PanelContextType {
    panels: Panel[];
    addPanel: (path: string, title: string) => void;
    removePanel: (id: string) => void;
    clearPanels: () => void;
    hasPanels: boolean;
}

const PanelContext = createContext<PanelContextType | null>(null);

const STORAGE_KEY = 'split_panels';

const isInPanel = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('_panel') === '1';
const normalizePath = (path: string) => path.replace(/\/+$/, '') || '/';

const loadPanelsFromStorage = (): Panel[] => {
    if (isInPanel()) return [];
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        }
    } catch (e) {}
    return [];
};

const savePanelsToStorage = (panels: Panel[]) => {
    if (isInPanel()) return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(panels));
    } catch (e) {}
};

let panelIdCounter = 0;

export const PanelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const inPanel = isInPanel();
    
    const [panels, setPanels] = useState<Panel[]>(() => {
        if (inPanel) return [];
        const stored = loadPanelsFromStorage();
        if (stored.length > 0) {
            const maxId = stored.reduce((max, p) => {
                const num = parseInt(p.id.replace('panel-', ''), 10);
                return isNaN(num) ? max : Math.max(max, num);
            }, 0);
            panelIdCounter = maxId;
        }
        return stored;
    });

    useEffect(() => {
        if (!inPanel) {
            savePanelsToStorage(panels);
        }
    }, [panels, inPanel]);

    const addPanel = useCallback((path: string, title: string) => {
        if (inPanel) return;
        setPanels((prev) => {
            if (prev.length >= 4) return prev;
            if (typeof window !== 'undefined' && normalizePath(path) === normalizePath(window.location.pathname)) return prev;
            if (prev.some((p) => p.path === path)) return prev;
            const id = `panel-${++panelIdCounter}`;
            return [...prev, { id, path, title }];
        });
    }, [inPanel]);

    const removePanel = useCallback((id: string) => {
        setPanels((prev) => prev.filter((p) => p.id !== id));
    }, []);

    const clearPanels = useCallback(() => {
        setPanels([]);
    }, []);

    return (
        <PanelContext.Provider value={{ panels, addPanel, removePanel, clearPanels, hasPanels: panels.length > 0 }}>
            {children}
        </PanelContext.Provider>
    );
};

export const usePanels = () => {
    const context = useContext(PanelContext);
    return context;
};
