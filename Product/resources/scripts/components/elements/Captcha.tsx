import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

export type CaptchaProvider = 'cloudflare_turnstile' | 'google_recaptcha' | 'hcaptcha';

export interface CaptchaRef {
    reset: () => void;
    execute: () => Promise<string>;
    getResponse: () => string | undefined;
}

interface CaptchaProps {
    provider: CaptchaProvider;
    siteKey: string;
    onVerify: (token: string) => void;
    onExpire?: () => void;
    onError?: () => void;
    theme?: 'light' | 'dark' | 'auto';
    size?: 'normal' | 'compact' | 'invisible';
}

interface CaptchaApi {
    render: (container: HTMLElement, options: Record<string, unknown>) => string;
    reset: (widgetId?: string) => void;
    remove?: (widgetId: string) => void;
    getResponse: (widgetId?: string) => string | undefined;
    execute?: (widgetId?: string) => void;
}

interface CaptchaDefinition {
    globalKey: string;
    callbackName: string;
    scriptUrl: string;
    buildOptions: (
        siteKey: string,
        callbacks: {
            onVerify: (token: string) => void;
            onExpire: () => void;
            onError: () => void;
        },
        theme: 'light' | 'dark' | 'auto',
        size: 'normal' | 'compact' | 'invisible',
    ) => Record<string, unknown>;
}

const definitions: Record<CaptchaProvider, CaptchaDefinition> = {
    cloudflare_turnstile: {
        globalKey: 'turnstile',
        callbackName: 'onLunaTurnstileLoad',
        scriptUrl: 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onLunaTurnstileLoad&render=explicit',
        buildOptions: (siteKey, callbacks, theme, size) => ({
            sitekey: siteKey,
            callback: callbacks.onVerify,
            'expired-callback': callbacks.onExpire,
            'error-callback': callbacks.onError,
            theme,
            size,
        }),
    },
    google_recaptcha: {
        globalKey: 'grecaptcha',
        callbackName: 'onLunaRecaptchaLoad',
        scriptUrl: 'https://www.google.com/recaptcha/api.js?onload=onLunaRecaptchaLoad&render=explicit',
        buildOptions: (siteKey, callbacks, theme, size) => ({
            sitekey: siteKey,
            callback: callbacks.onVerify,
            'expired-callback': callbacks.onExpire,
            'error-callback': callbacks.onError,
            theme: theme === 'auto' ? 'dark' : theme,
            size,
        }),
    },
    hcaptcha: {
        globalKey: 'hcaptcha',
        callbackName: 'onLunaHCaptchaLoad',
        scriptUrl: 'https://js.hcaptcha.com/1/api.js?onload=onLunaHCaptchaLoad&render=explicit',
        buildOptions: (siteKey, callbacks, theme, size) => ({
            sitekey: siteKey,
            callback: callbacks.onVerify,
            'expired-callback': callbacks.onExpire,
            'error-callback': callbacks.onError,
            theme: theme === 'auto' ? 'dark' : theme,
            size,
        }),
    },
};

const scriptStates: Partial<Record<CaptchaProvider, { loaded: boolean; loading: boolean; callbacks: Array<() => void> }>> = {};

const getCaptchaApi = (provider: CaptchaProvider): CaptchaApi | undefined => {
    return (window as unknown as Record<string, CaptchaApi | undefined>)[definitions[provider].globalKey];
};

const loadCaptchaScript = (provider: CaptchaProvider): Promise<void> => {
    return new Promise((resolve) => {
        const definition = definitions[provider];
        const existingApi = getCaptchaApi(provider);

        if (existingApi) {
            resolve();
            return;
        }

        const state = scriptStates[provider] || { loaded: false, loading: false, callbacks: [] };
        scriptStates[provider] = state;

        state.callbacks.push(resolve);

        if (state.loaded || state.loading) {
            return;
        }

        state.loading = true;

        (window as unknown as Record<string, () => void>)[definition.callbackName] = () => {
            state.loaded = true;
            state.loading = false;
            state.callbacks.forEach((callback) => callback());
            state.callbacks.length = 0;
        };

        const script = document.createElement('script');
        script.src = definition.scriptUrl;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    });
};

const Captcha = forwardRef<CaptchaRef, CaptchaProps>(
    ({ provider, siteKey, onVerify, onExpire, onError, theme = 'dark', size = 'normal' }, ref) => {
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

        const handleVerify = useCallback((token: string) => {
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
                pendingExecuteRef.current.reject(new Error('Captcha verification failed'));
                pendingExecuteRef.current = null;
            }
        }, []);

        useEffect(() => {
            let mounted = true;

            if (!siteKey || siteKey === '_invalid_key') {
                return;
            }

            loadCaptchaScript(provider).then(() => {
                const api = getCaptchaApi(provider);
                if (!mounted || !containerRef.current || !api) return;

                if (widgetIdRef.current) {
                    if (api.remove) {
                        api.remove(widgetIdRef.current);
                    } else {
                        api.reset(widgetIdRef.current);
                    }
                    widgetIdRef.current = null;
                }

                try {
                    widgetIdRef.current = api.render(
                        containerRef.current,
                        definitions[provider].buildOptions(
                            siteKey,
                            {
                                onVerify: handleVerify,
                                onExpire: handleExpire,
                                onError: handleError,
                            },
                            theme,
                            size,
                        ),
                    );
                } catch (error) {
                    handleError();
                }
            });

            return () => {
                mounted = false;
                const api = getCaptchaApi(provider);
                if (widgetIdRef.current && api) {
                    if (api.remove) {
                        api.remove(widgetIdRef.current);
                    } else {
                        api.reset(widgetIdRef.current);
                    }
                    widgetIdRef.current = null;
                }
            };
        }, [provider, siteKey, theme, size, handleVerify, handleExpire, handleError]);

        useImperativeHandle(ref, () => ({
            reset: () => {
                const api = getCaptchaApi(provider);
                if (widgetIdRef.current && api) {
                    api.reset(widgetIdRef.current);
                }
            },
            execute: () => {
                return new Promise((resolve, reject) => {
                    const api = getCaptchaApi(provider);
                    if (!containerRef.current || !api || !siteKey || siteKey === '_invalid_key') {
                        reject(new Error('Captcha widget not initialised'));
                        return;
                    }

                    if (widgetIdRef.current) {
                        const existingToken = api.getResponse(widgetIdRef.current);
                        if (existingToken) {
                            resolve(existingToken);
                            return;
                        }
                    }

                    if (size === 'invisible' && api.execute) {
                        pendingExecuteRef.current = { resolve, reject };
                        api.execute(widgetIdRef.current || undefined);
                        return;
                    }

                    reject(new Error('Captcha verification is required'));
                });
            },
            getResponse: () => {
                const api = getCaptchaApi(provider);
                if (widgetIdRef.current && api) {
                    return api.getResponse(widgetIdRef.current);
                }
                return undefined;
            },
        }));

        if (!siteKey || siteKey === '_invalid_key') {
            return null;
        }

        return <div ref={containerRef} />;
    },
);

Captcha.displayName = 'Captcha';

export default Captcha;
