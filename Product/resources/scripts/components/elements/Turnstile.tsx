import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';

declare global {
    interface Window {
        turnstile?: {
            render: (container: HTMLElement, options: TurnstileOptions) => string;
            reset: (widgetId: string) => void;
            remove: (widgetId: string) => void;
            getResponse: (widgetId: string) => string | undefined;
            execute: (widgetId: string) => void;
        };
        onTurnstileLoad?: () => void;
    }
}

interface TurnstileOptions {
    sitekey: string;
    callback?: (token: string) => void;
    'expired-callback'?: () => void;
    'error-callback'?: () => void;
    theme?: 'light' | 'dark' | 'auto';
    size?: 'normal' | 'compact' | 'invisible';
    tabindex?: number;
    action?: string;
    cData?: string;
    appearance?: 'always' | 'execute' | 'interaction-only';
    execution?: 'render' | 'execute';
}

export interface TurnstileRef {
    reset: () => void;
    execute: () => Promise<string>;
    getResponse: () => string | undefined;
}

interface TurnstileProps {
    siteKey: string;
    onVerify: (token: string) => void;
    onExpire?: () => void;
    onError?: () => void;
    theme?: 'light' | 'dark' | 'auto';
    size?: 'normal' | 'compact' | 'invisible';
    action?: string;
}

let scriptLoaded = false;
let scriptLoading = false;
const loadCallbacks: (() => void)[] = [];

const loadTurnstileScript = (): Promise<void> => {
    return new Promise((resolve) => {
        if (scriptLoaded && window.turnstile) {
            resolve();
            return;
        }

        loadCallbacks.push(resolve);

        if (scriptLoading) {
            return;
        }

        scriptLoading = true;

        window.onTurnstileLoad = () => {
            scriptLoaded = true;
            scriptLoading = false;
            loadCallbacks.forEach((cb) => cb());
            loadCallbacks.length = 0;
        };

        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    });
};

const Turnstile = forwardRef<TurnstileRef, TurnstileProps>(
    ({ siteKey, onVerify, onExpire, onError, theme = 'dark', size = 'invisible', action }, ref) => {
        const containerRef = useRef<HTMLDivElement>(null);
        const widgetIdRef = useRef<string | null>(null);
        const pendingExecuteRef = useRef<{
            resolve: (token: string) => void;
            reject: (error: Error) => void;
        } | null>(null);
        const onVerifyRef = useRef(onVerify);
        const onExpireRef = useRef(onExpire);
        const onErrorRef = useRef(onError);
        onVerifyRef.current = onVerify;
        onExpireRef.current = onExpire;
        onErrorRef.current = onError;

        const handleCallback = useCallback((token: string) => {
            onVerifyRef.current(token);
            if (pendingExecuteRef.current) {
                pendingExecuteRef.current.resolve(token);
                pendingExecuteRef.current = null;
            }
        }, []);

        const handleExpire = useCallback(() => {
            onExpireRef.current?.();
        }, []);

        const handleError = useCallback(() => {
            onErrorRef.current?.();
            if (pendingExecuteRef.current) {
                pendingExecuteRef.current.reject(new Error('Turnstile verification failed'));
                pendingExecuteRef.current = null;
            }
        }, []);

        useEffect(() => {
            let mounted = true;

            if (!siteKey || siteKey === '_invalid_key') {
                return;
            }

            loadTurnstileScript().then(() => {
                if (!mounted || !containerRef.current || !window.turnstile) return;

                if (widgetIdRef.current) {
                    window.turnstile.remove(widgetIdRef.current);
                    widgetIdRef.current = null;
                }

                try {
                    widgetIdRef.current = window.turnstile.render(containerRef.current, {
                        sitekey: siteKey,
                        callback: handleCallback,
                        'expired-callback': handleExpire,
                        'error-callback': handleError,
                        theme,
                        size,
                        action,
                    });
                } catch (error) {
                    console.error('Failed to render Turnstile widget:', error);
                }
            });

            return () => {
                mounted = false;
                if (widgetIdRef.current && window.turnstile) {
                    try {
                        window.turnstile.remove(widgetIdRef.current);
                    } catch (error) {
                        console.error('Failed to remove Turnstile widget:', error);
                    }
                    widgetIdRef.current = null;
                }
            };
        }, [siteKey, theme, size, action]);

        useImperativeHandle(ref, () => ({
            reset: () => {
                if (widgetIdRef.current && window.turnstile) {
                    window.turnstile.reset(widgetIdRef.current);
                }
            },
            execute: () => {
                return new Promise((resolve, reject) => {
                    if (!containerRef.current || !window.turnstile || !siteKey || siteKey === '_invalid_key') {
                        reject(new Error('Turnstile widget not initialized'));
                        return;
                    }

                    if (widgetIdRef.current) {
                        const existingToken = window.turnstile.getResponse(widgetIdRef.current);
                        if (existingToken) {
                            resolve(existingToken);
                            return;
                        }
                    }

                    if (size === 'invisible') {
                        pendingExecuteRef.current = { resolve, reject };

                        if (widgetIdRef.current) {
                            try {
                                window.turnstile.execute(widgetIdRef.current);
                            } catch (error) {
                                console.error('Failed to execute widget:', error);
                                pendingExecuteRef.current = null;
                                reject(new Error('Failed to execute Turnstile challenge'));
                            }
                        } else {
                            pendingExecuteRef.current = null;
                            reject(new Error('Turnstile widget not rendered'));
                        }
                    } else {
                        const currentToken = widgetIdRef.current 
                            ? window.turnstile.getResponse(widgetIdRef.current) 
                            : null;
                        if (currentToken) {
                            resolve(currentToken);
                        } else {
                            reject(new Error('Turnstile verification not completed'));
                        }
                    }
                });
            },
            getResponse: () => {
                if (widgetIdRef.current && window.turnstile) {
                    return window.turnstile.getResponse(widgetIdRef.current);
                }
                return undefined;
            },
        }));

        if (!siteKey || siteKey === '_invalid_key') {
            return null;
        }

        return <div ref={containerRef} style={{ marginTop: '1rem' }} />;
    }
);

Turnstile.displayName = 'Turnstile';

export default Turnstile;
