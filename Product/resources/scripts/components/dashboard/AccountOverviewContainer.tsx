import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useStoreState, useStoreActions, Actions, State } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import PageContentBlock from '@/components/elements/PageContentBlock';
import FlashMessageRender from '@/components/FlashMessageRender';
import PageHeader from '@/components/elements/ui/PageHeader';
import { useLocation, Link } from 'react-router-dom';
import MessageBox from '@/components/MessageBox';
import styled, { keyframes } from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { findIconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
    faShieldAlt,
    faEnvelope,
    faLock,
    faMobileAlt,
    faGlobe,
    faKey,
    faTrashAlt,
    faMoon,
    faSun,
    faDesktop,
    faCamera,
    faLink,
} from '@fortawesome/free-solid-svg-icons';
import { Form, Formik, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import Field from '@/components/elements/Field';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import { Button } from '@/components/elements/button/index';
import updateAccountPassword from '@/api/account/updateAccountPassword';
import updateAccountLanguage from '@/api/account/updateAccountLanguage';
import updatePrivacyMode from '@/api/account/updatePrivacyMode';
import getAvailableLanguages from '@/api/account/getAvailableLanguages';
import { ThemePreference, updateThemePreference, getStoredTheme } from '@/api/account/updateThemePreference';
import { httpErrorToHuman } from '@/api/http';
import SetupTOTPDialog from '@/components/dashboard/forms/SetupTOTPDialog';
import RecoveryTokensDialog from '@/components/dashboard/forms/RecoveryTokensDialog';
import DisableTOTPDialog from '@/components/dashboard/forms/DisableTOTPDialog';
import { useFlashKey } from '@/plugins/useFlash';
import { changeLanguage } from '@/i18n';
import Select from '@/components/elements/Select';
import getApiKeys, { ApiKey } from '@/api/account/getApiKeys';
import deleteApiKey from '@/api/account/deleteApiKey';
import { updateAccountAvatar, removeAccountAvatar } from '@/api/account/updateAccountAvatar';
import CreateApiKeyForm from '@/components/dashboard/forms/CreateApiKeyForm';
import { Dialog } from '@/components/elements/dialog';
import Code from '@/components/elements/Code';
import GreyRowBox from '@/components/elements/GreyRowBox';
import { useSSHKeys } from '@/api/account/ssh-keys';
import CreateSSHKeyForm from '@/components/dashboard/ssh/CreateSSHKeyForm';
import DeleteSSHKeyButton from '@/components/dashboard/ssh/DeleteSSHKeyButton';
import { ActivityLogFilters, useActivityLogs } from '@/api/account/activity';
import PaginationFooter from '@/components/elements/table/PaginationFooter';
import Spinner from '@/components/elements/Spinner';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import useLocationHash from '@/plugins/useLocationHash';
import Avatar from '@/components/Avatar';
import { format, isToday, isYesterday } from 'date-fns';
import Translate from '@/components/elements/Translate';
import { ActivityLog } from '@definitions/user';
import { getObjectKeys, isObject } from '@/lib/objects';
import ActivityLogMetaButton from '@/components/elements/activity/ActivityLogMetaButton';
import { XCircleIcon, TerminalIcon } from '@heroicons/react/solid';
import classNames from 'classnames';
import { styles as btnStyles } from '@/components/elements/button/index';
import OAuthManagementTab from '@/components/account/OAuthManagementTab';

import { CustomNavLink } from '@/state/settings';

type AccountTab = 'profile' | 'security' | 'oauth' | 'api' | 'ssh' | 'activity';

const ACCOUNT_TABS: AccountTab[] = ['profile', 'security', 'oauth', 'api', 'ssh', 'activity'];

const getTabFromLinkUrl = (url: string): AccountTab => {
    if (!url.startsWith('/account')) {
        return 'profile';
    }

    const hashIndex = url.indexOf('#');
    if (hashIndex === -1) {
        return 'profile';
    }

    const tabId = url.slice(hashIndex + 1);
    return ACCOUNT_TABS.includes(tabId as AccountTab) ? (tabId as AccountTab) : 'profile';
};

const isExternalLink = (url: string) => /^https?:\/\//i.test(url);

const getAccountPathFromUrl = (url: string): string | null => {
    if (url.startsWith('/account')) {
        return url;
    }

    if (!isExternalLink(url)) {
        return null;
    }

    try {
        const parsed = new URL(url, window.location.origin);
        if (parsed.origin !== window.location.origin) {
            return null;
        }
        if (!parsed.pathname.startsWith('/account')) {
            return null;
        }
        return `${parsed.pathname}${parsed.hash}`;
    } catch {
        return null;
    }
};

const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
`;

const Container = styled.div`
    ${tw`flex gap-8`};
    min-height: 500px;

    @media (max-width: 1024px) {
        ${tw`flex-col gap-6`};
    }
`;

const Sidebar = styled.div`
    width: 240px;
    flex-shrink: 0;

    @media (max-width: 1024px) {
        width: 100%;
    }
`;

const SidebarNav = styled.nav`
    ${tw`flex flex-col`};
    position: sticky;
    top: 24px;

    @media (max-width: 1024px) {
        ${tw`flex-row overflow-x-auto pb-2 gap-2`};
        position: static;
        scrollbar-width: thin;
        scrollbar-color: var(--color-neutral) transparent;
    }
`;

const NavButton = styled.button<{ $active: boolean }>`
    ${tw`flex items-center px-4 py-2 text-left transition-all duration-150 mb-1`};
    color: ${props => props.$active ? 'var(--color-base)' : 'color-mix(in srgb, var(--color-base) 70%, transparent)'};
    border-radius: 0 var(--border-radius, 8px) var(--border-radius, 8px) 0;
    border: 1px solid transparent;
    border-left: 4px solid transparent;
    background-color: ${props => props.$active ? 'color-mix(in srgb, var(--color-primary) 50%, transparent)' : 'transparent'};
    border-left-color: ${props => props.$active ? 'var(--color-primary)' : 'transparent'};
    white-space: nowrap;

    &:hover {
        background-color: var(--color-background-secondary);
        border-color: var(--color-neutral);
        border-left-color: var(--color-neutral);
        color: var(--color-base);
    }

    svg {
        ${tw`mr-3 w-5`};
    }

    @media (max-width: 1024px) {
        ${tw`flex-shrink-0 mb-0`};
        border-radius: var(--border-radius, 8px);
        border-left-width: 1px;
    }
`;

const MainContent = styled.div`
    flex: 1;
    min-width: 0;
`;

const SectionTitle = styled.h2`
    ${tw`text-xl font-semibold mb-2`};
    color: var(--color-base);
    animation: ${fadeIn} 0.3s ease-out;
`;

const SectionDescription = styled.p`
    ${tw`text-sm mb-6`};
    color: var(--color-muted);
    animation: ${fadeIn} 0.3s ease-out 0.05s backwards;
`;

const FormSection = styled.div`
    animation: ${fadeIn} 0.3s ease-out 0.1s backwards;
`;

const Card = styled.div`
    background: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    overflow: hidden;
`;

const CardHeader = styled.div`
    ${tw`px-5 py-4 flex items-center gap-3`};
    border-bottom: 1px solid var(--color-neutral);
`;

const CardBody = styled.div`
    ${tw`p-5`};
`;

const TimelineRow = styled.div`
    ${tw`flex`};
`;

const DateColumn = styled.div`
    ${tw`flex-shrink-0 pt-1 pr-6 text-right hidden sm:block`};
    width: 120px;
    color: var(--color-muted);
    font-size: 0.8rem;
`;

const TimelineColumn = styled.div`
    ${tw`hidden sm:block flex-shrink-0 relative self-stretch`};
    width: 24px;

    &::before {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        left: calc(50% - 5px);
        width: 2px;
        transform: translateX(-50%);
        background-color: var(--color-neutral);
    }
`;

const TimelineDot = styled.div`
    ${tw`w-3 h-3 rounded-full flex-shrink-0 relative`};
    z-index: 1;
    background-color: var(--color-primary);
    box-shadow: 0 0 0 4px var(--color-background);
`;

const ContentColumn = styled.div`
    ${tw`flex-1 pb-6 pl-0 sm:pl-4`};
`;

const ActivityItem = styled.div`
    ${tw`p-3 rounded-lg mb-2 last:mb-0`};
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
`;

const ActivityHeader = styled.div`
    ${tw`flex items-center justify-between gap-2`};
`;

const ActivityMeta = styled.div`
    ${tw`flex items-center gap-2 text-xs mt-1`};
    color: var(--color-inverted);
`;

const ThemeOptions = styled.div`
    ${tw`grid gap-3`};
    grid-template-columns: repeat(3, 1fr);
`;

const ThemeOption = styled.button<{ $active: boolean }>`
    ${tw`flex flex-col items-center justify-center p-4 transition-all duration-150`};
    background-color: ${props => props.$active ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'var(--color-background)'};
    border: 2px solid ${props => props.$active ? 'var(--color-primary)' : 'var(--color-neutral)'};
    border-radius: var(--border-radius, 8px);
    color: ${props => props.$active ? 'var(--color-primary)' : 'var(--color-muted)'};
    cursor: pointer;
    
    &:hover {
        border-color: ${props => props.$active ? 'var(--color-primary)' : 'var(--color-muted)'};
        background-color: ${props => props.$active ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'color-mix(in srgb, var(--color-neutral) 30%, transparent)'};
    }
    
    svg {
        ${tw`w-6 h-6 mb-2`};
    }
    
    span {
        ${tw`text-sm font-medium`};
        color: var(--color-base);
    }
`;

const AvatarRow = styled.div`
    ${tw`flex items-center gap-4 flex-wrap`};
`;

const AvatarPreview = styled.div`
    ${tw`w-20 h-20 rounded-full overflow-hidden flex-shrink-0`};
    border: 1px solid var(--color-neutral);
    background-color: var(--color-background);
`;

const AvatarImage = styled.img`
    ${tw`w-full h-full`};
    object-fit: cover;
`;

function wrapProperties(value: unknown): any {
    if (value === null || typeof value === 'string' || typeof value === 'number') {
        return `<strong>${String(value)}</strong>`;
    }
    if (isObject(value)) {
        return getObjectKeys(value).reduce((obj, key) => {
            if (key === 'count' || (typeof key === 'string' && key.endsWith('_count'))) {
                return { ...obj, [key]: value[key] };
            }
            return { ...obj, [key]: wrapProperties(value[key]) };
        }, {} as Record<string, unknown>);
    }
    if (Array.isArray(value)) {
        return value.map(wrapProperties);
    }
    return value;
}

export default () => {
    const { t } = useTranslation('account');
    
    const passwordSchema = Yup.object().shape({
        current: Yup.string().min(1).required(t('password.current_required')),
        password: Yup.string().min(8).required(),
        confirmPassword: Yup.string().test(
            'password',
            t('password.confirm_mismatch'),
            function (value) {
                return value === this.parent.password;
            }
        ),
    });

    const emailSchema = Yup.object().shape({
        email: Yup.string().email().required(),
        password: Yup.string().required(t('password.account_password_required')),
    });

    const { state } = useLocation<undefined | { twoFactorRedirect?: boolean }>();
    const [activeTab, setActiveTab] = useState<AccountTab>(() => {
        if (state?.twoFactorRedirect) {
            return 'security';
        }

        return getTabFromLinkUrl(window.location.pathname + window.location.hash);
    });

    const accountCustomLinks = useStoreState((state: ApplicationStore) => state.settings.data?.layout?.accountCustomLinks ?? []);

    const accountNavLinks = useMemo((): CustomNavLink[] => {
        if (accountCustomLinks.length > 0) {
            const links = accountCustomLinks.filter((link) => link.label && link.url);
            if (!links.some((link) => getTabFromLinkUrl(link.url || '') === 'oauth')) {
                const securityIndex = links.findIndex((link) => getTabFromLinkUrl(link.url || '') === 'security');
                links.splice(securityIndex === -1 ? 1 : securityIndex + 1, 0, { label: 'OAuth', icon: 'link', url: '/account#oauth' });
            }

            return links;
        }

        return [
            { label: t('profile'), icon: 'user', url: '/account' },
            { label: t('security'), icon: 'shield-alt', url: '/account#security' },
            { label: 'OAuth', icon: 'link', url: '/account#oauth' },
            { label: t('api.nav_title'), icon: 'lock', url: '/account#api' },
            { label: t('ssh_keys.nav_title'), icon: 'key', url: '/account#ssh' },
            { label: t('activity.nav_title'), icon: 'history', url: '/account#activity' },
        ];
    }, [accountCustomLinks, t]);
    
    const user = useStoreState((state: State<ApplicationStore>) => state.user.data);
    const updateEmail = useStoreActions((state: Actions<ApplicationStore>) => state.user.updateUserEmail);
    const updateUserData = useStoreActions((state: Actions<ApplicationStore>) => state.user.updateUserData);
    const { clearFlashes, addFlash } = useStoreActions((actions: Actions<ApplicationStore>) => actions.flashes);
    const { clearAndAddHttpError } = useFlashKey('account');
    
    const [tokens, setTokens] = useState<string[]>([]);
    const [totpVisible, setTotpVisible] = useState<'enable' | 'disable' | null>(null);
    const isEnabled = useStoreState((state: ApplicationStore) => state.user.data!.useTotp);
    
    const translationsEnabled = useStoreState((state: ApplicationStore) => state.settings.data?.components?.translationsEnabled !== false);
    const [languages, setLanguages] = useState<Record<string, string>>({});
    const [selectedLanguage, setSelectedLanguage] = useState(user?.language || 'en');
    const [languageLoading, setLanguageLoading] = useState(false);
    const [selectedTheme, setSelectedTheme] = useState<ThemePreference>(getStoredTheme());
    const isDemo = window.location.hostname === 'luna-ptero.buzz.dev';
    const avatarInputRef = useRef<HTMLInputElement | null>(null);
    const [avatarLoading, setAvatarLoading] = useState(false);
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [apiLoading, setApiLoading] = useState(true);
    const [deleteIdentifier, setDeleteIdentifier] = useState('');

    const { data: sshKeys, isValidating: sshValidating, error: sshError } = useSSHKeys({
        revalidateOnMount: true,
        revalidateOnFocus: false,
    });

    const { hash } = useLocationHash();
    const [activityFilters, setActivityFilters] = useState<ActivityLogFilters>({ page: 1, sorts: { timestamp: -1 } });
    const { data: activityData, isValidating: activityValidating, error: activityError } = useActivityLogs(activityFilters, {
        revalidateOnMount: true,
        revalidateOnFocus: false,
    });

    useEffect(() => {
        if (translationsEnabled) {
            getAvailableLanguages().then(setLanguages).catch(console.error);
        }
    }, [translationsEnabled]);

    useEffect(() => {
        getApiKeys()
            .then((keys) => setApiKeys(keys))
            .then(() => setApiLoading(false))
            .catch((error) => clearAndAddHttpError(error));
    }, []);

    useEffect(() => {
        clearAndAddHttpError(sshError);
    }, [sshError]);

    useEffect(() => {
        clearAndAddHttpError(activityError);
    }, [activityError]);

    useEffect(() => {
        setActivityFilters((value) => ({ ...value, filters: { ip: hash.ip, event: hash.event } }));
    }, [hash]);

    const handleLanguageChange = async (newLanguage: string) => {
        if (newLanguage === selectedLanguage) return;
        
        setLanguageLoading(true);
        clearFlashes('account:language');
        
        try {
            await updateAccountLanguage(newLanguage);
            await changeLanguage(newLanguage);
            setSelectedLanguage(newLanguage);
            updateUserData({ language: newLanguage });
            addFlash({
                type: 'success',
                key: 'account:language',
                message: t('language.updated'),
            });
        } catch (error) {
            addFlash({
                type: 'error',
                key: 'account:language',
                title: t('error'),
                message: httpErrorToHuman(error),
            });
        } finally {
            setLanguageLoading(false);
        }
    };

    const handleThemeChange = (newTheme: ThemePreference) => {
        if (newTheme === selectedTheme) return;
        
        updateThemePreference(newTheme);
        setSelectedTheme(newTheme);
        addFlash({
            type: 'success',
            key: 'account:theme',
            message: t('theme.updated'),
        });
    };

    const handlePrivacyModeChange = async (enabled: boolean) => {
        clearFlashes('account:privacy');
        
        try {
            await updatePrivacyMode(enabled);
            updateUserData({ privacyMode: enabled });
            addFlash({
                type: 'success',
                key: 'account:privacy',
                message: t('privacy_mode.updated'),
            });
        } catch (error) {
            addFlash({
                type: 'error',
                key: 'account:privacy',
                title: t('error'),
                message: httpErrorToHuman(error),
            });
        }
    };

    const onAvatarPickerOpen = () => {
        if (avatarLoading) return;
        avatarInputRef.current?.click();
    };

    const onAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';

        if (!file || avatarLoading) return;

        clearFlashes('account:avatar');
        setAvatarLoading(true);

        try {
            const response = await updateAccountAvatar(file);
            updateUserData({ image: response.image });
            addFlash({
                type: 'success',
                key: 'account:avatar',
                message: t('avatar.updated'),
            });
        } catch (error) {
            addFlash({
                type: 'error',
                key: 'account:avatar',
                title: t('error'),
                message: httpErrorToHuman(error),
            });
        } finally {
            setAvatarLoading(false);
        }
    };

    const onAvatarRemove = async () => {
        if (!user?.image || avatarLoading) return;

        clearFlashes('account:avatar');
        setAvatarLoading(true);

        try {
            const response = await removeAccountAvatar();
            updateUserData({ image: response.image });
            addFlash({
                type: 'success',
                key: 'account:avatar',
                message: t('avatar.removed'),
            });
        } catch (error) {
            addFlash({
                type: 'error',
                key: 'account:avatar',
                title: t('error'),
                message: httpErrorToHuman(error),
            });
        } finally {
            setAvatarLoading(false);
        }
    };

    const submitPassword = (values: { current: string; password: string; confirmPassword: string }, { setSubmitting }: FormikHelpers<any>) => {
        if (isDemo) return setSubmitting(false);
        clearFlashes('account:password');
        updateAccountPassword({ ...values })
            .then(() => {
                // @ts-expect-error this is valid
                window.location = '/auth/login';
            })
            .catch((error) =>
                addFlash({
                    key: 'account:password',
                    type: 'error',
                    title: t('error'),
                    message: httpErrorToHuman(error),
                })
            )
            .then(() => setSubmitting(false));
    };

    const submitEmail = (values: { email: string; password: string }, { resetForm, setSubmitting }: FormikHelpers<any>) => {
        clearFlashes('account:email');
        updateEmail({ ...values })
            .then(() =>
                addFlash({
                    type: 'success',
                    key: 'account:email',
                    message: t('email.updated'),
                })
            )
            .catch((error) =>
                addFlash({
                    type: 'error',
                    key: 'account:email',
                    title: t('error'),
                    message: httpErrorToHuman(error),
                })
            )
            .then(() => {
                resetForm();
                setSubmitting(false);
            });
    };

    const onTokens = (tokens: string[]) => {
        setTokens(tokens);
        setTotpVisible(null);
    };

    const doApiKeyDeletion = (identifier: string) => {
        setApiLoading(true);
        clearAndAddHttpError();
        deleteApiKey(identifier)
            .then(() => setApiKeys((s) => [...(s || []).filter((key) => key.identifier !== identifier)]))
            .catch((error) => clearAndAddHttpError(error))
            .then(() => {
                setApiLoading(false);
                setDeleteIdentifier('');
            });
    };

    const groupedByDay = useMemo(() => {
        if (!activityData?.items) return {};
        return activityData.items.reduce((groups, activity) => {
            const day = format(activity.timestamp, 'yyyy-MM-dd');
            if (!groups[day]) {
                groups[day] = [];
            }
            groups[day].push(activity);
            return groups;
        }, {} as Record<string, ActivityLog[]>);
    }, [activityData?.items]);

    const sortedDays = useMemo(() => {
        return Object.keys(groupedByDay).sort((a, b) => b.localeCompare(a));
    }, [groupedByDay]);

    const formatDayLabel = (d: Date): string => {
        if (isToday(d)) return t('activity.today');
        if (isYesterday(d)) return t('activity.yesterday');
        return format(d, 'MMM d, yyyy');
    };

    const { pathTo } = useLocationHash();
    const hasCustomAvatar = Boolean(user?.image && !user.image.includes('gravatar.com/avatar/'));

    const renderContent = () => {
        switch (activeTab) {
            case 'profile':
                return (
                    <>
                        <SectionTitle>{t('profile_settings')}</SectionTitle>
                        <SectionDescription>
                            {t('profile_description')}
                        </SectionDescription>
                        
                        <FormSection>
                            <Card className="mb-6">
                                <CardHeader>
                                    <FontAwesomeIcon icon={faCamera} style={{ color: 'var(--color-primary)' }} />
                                    <span className="font-medium" style={{ color: 'var(--color-base)' }}>
                                        {t('avatar.title')}
                                    </span>
                                </CardHeader>
                                <CardBody>
                                    <FlashMessageRender byKey={'account:avatar'} className="mb-4" />
                                    <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>
                                        {t('avatar.description')}
                                    </p>
                                    <AvatarRow>
                                        <AvatarPreview>
                                            {user?.image ? (
                                                <AvatarImage src={user.image} alt={user.username} />
                                            ) : (
                                                <Avatar.User />
                                            )}
                                        </AvatarPreview>
                                        <input
                                            ref={avatarInputRef}
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp,image/gif"
                                            onChange={onAvatarUpload}
                                            hidden
                                        />
                                        <div className="flex items-center gap-3">
                                            <Button type="button" disabled={avatarLoading} onClick={onAvatarPickerOpen}>
                                                {avatarLoading ? t('loading') : t('avatar.upload')}
                                            </Button>
                                            <Button.Danger type="button" disabled={avatarLoading || !hasCustomAvatar} onClick={onAvatarRemove}>
                                                {t('avatar.remove')}
                                            </Button.Danger>
                                        </div>
                                    </AvatarRow>
                                </CardBody>
                            </Card>

                            <Card className="mb-6">
                                <CardHeader>
                                    <FontAwesomeIcon icon={faEnvelope} style={{ color: 'var(--color-primary)' }} />
                                    <span className="font-medium" style={{ color: 'var(--color-base)' }}>
                                        {t('email.label')}
                                    </span>
                                </CardHeader>
                                <CardBody>
                                    <FlashMessageRender byKey={'account:email'} className="mb-4" />
                                    <Formik
                                        onSubmit={submitEmail}
                                        validationSchema={emailSchema}
                                        initialValues={{ email: user!.email, password: '' }}
                                    >
                                        {({ isSubmitting, isValid }) => (
                                            <>
                                                <SpinnerOverlay visible={isSubmitting} />
                                                <Form>
                                                    <div className="grid gap-4 md:grid-cols-2">
                                                        <Field id={'current_email'} type={'email'} name={'email'} label={t('email_field')} />
                                                        <Field id={'confirm_password'} type={'password'} name={'password'} label={t('confirm_password')} />
                                                    </div>
                                                    <div className="flex justify-end mt-5">
                                                        <Button disabled={isSubmitting || !isValid}>{t('update_email')}</Button>
                                                    </div>
                                                </Form>
                                            </>
                                        )}
                                    </Formik>
                                </CardBody>
                            </Card>

                            {translationsEnabled && Object.keys(languages).length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <FontAwesomeIcon icon={faGlobe} style={{ color: 'var(--color-primary)' }} />
                                        <span className="font-medium" style={{ color: 'var(--color-base)' }}>
                                            {t('language.title')}
                                        </span>
                                    </CardHeader>
                                    <CardBody>
                                        <FlashMessageRender byKey={'account:language'} className="mb-4" />
                                        <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>
                                            {t('language.description')}
                                        </p>
                                        <div style={{ position: 'relative' }}>
                                            <SpinnerOverlay visible={languageLoading} />
                                            <Select
                                                value={selectedLanguage}
                                                onChange={(e) => handleLanguageChange(e.target.value)}
                                                disabled={languageLoading}
                                            >
                                                {Object.entries(languages).map(([code, name]) => (
                                                    <option key={code} value={code}>
                                                        {name}
                                                    </option>
                                                ))}
                                            </Select>
                                        </div>
                                    </CardBody>
                                </Card>
                            )}

                            <Card className="mt-6">
                                <CardHeader>
                                    <FontAwesomeIcon icon={faMoon} style={{ color: 'var(--color-primary)' }} />
                                    <span className="font-medium" style={{ color: 'var(--color-base)' }}>
                                        {t('theme.title')}
                                    </span>
                                </CardHeader>
                                <CardBody>
                                    <FlashMessageRender byKey={'account:theme'} className="mb-4" />
                                    <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>
                                        {t('theme.description')}
                                    </p>
                                    <ThemeOptions>
                                        <ThemeOption
                                            $active={selectedTheme === 'dark'}
                                            onClick={() => handleThemeChange('dark')}
                                        >
                                            <FontAwesomeIcon icon={faMoon} />
                                            <span>{t('theme.dark')}</span>
                                        </ThemeOption>
                                        <ThemeOption
                                            $active={selectedTheme === 'light'}
                                            onClick={() => handleThemeChange('light')}
                                        >
                                            <FontAwesomeIcon icon={faSun} />
                                            <span>{t('theme.light')}</span>
                                        </ThemeOption>
                                        <ThemeOption
                                            $active={selectedTheme === 'system'}
                                            onClick={() => handleThemeChange('system')}
                                        >
                                            <FontAwesomeIcon icon={faDesktop} />
                                            <span>{t('theme.system')}</span>
                                        </ThemeOption>
                                    </ThemeOptions>
                                </CardBody>
                            </Card>
                        </FormSection>
                    </>
                );

            case 'security':
                return (
                    <>
                        <SectionTitle>{t('security_title')}</SectionTitle>
                        <SectionDescription>
                            {t('security_description')}
                        </SectionDescription>

                        {state?.twoFactorRedirect && (
                            <div className="mb-6">
                                <MessageBox title={t('two_factor.required_title')} type={'error'}>
                                    {t('two_factor.required_message')}
                                </MessageBox>
                            </div>
                        )}
                        
                        <FormSection>
                            <Card className="mb-6">
                                <CardHeader>
                                    <FontAwesomeIcon icon={faLock} style={{ color: 'var(--color-primary)' }} />
                                    <span className="font-medium" style={{ color: 'var(--color-base)' }}>
                                        {t('password.title')}
                                    </span>
                                </CardHeader>
                                <CardBody>
                                    <FlashMessageRender byKey={'account:password'} className="mb-4" />
                                    <Formik
                                        onSubmit={submitPassword}
                                        validationSchema={passwordSchema}
                                        initialValues={{ current: '', password: '', confirmPassword: '' }}
                                    >
                                        {({ isSubmitting, isValid }) => (
                                            <>
                                                <SpinnerOverlay visible={isSubmitting} />
                                                <Form>
                                                    <Field id={'current_password'} type={'password'} name={'current'} label={t('current_password')} disabled={isDemo} />
                                                    <div className="grid gap-4 md:grid-cols-2 mt-4">
                                                        <Field
                                                            id={'new_password'}
                                                            type={'password'}
                                                            name={'password'}
                                                            label={t('new_password')}
                                                            description={t('password.requirements')}
                                                            disabled={isDemo}
                                                        />
                                                        <Field
                                                            id={'confirm_new_password'}
                                                            type={'password'}
                                                            name={'confirmPassword'}
                                                            label={t('confirm_new_password')}
                                                            disabled={isDemo}
                                                        />
                                                    </div>
                                                    <div className="flex justify-end mt-5">
                                                        <Button disabled={isSubmitting || !isValid || isDemo}>{t('password.update_button')}</Button>
                                                    </div>
                                                </Form>
                                            </>
                                        )}
                                    </Formik>
                                </CardBody>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <FontAwesomeIcon icon={faMobileAlt} style={{ color: isEnabled ? '#22c55e' : 'var(--color-primary)' }} />
                                    <span className="font-medium" style={{ color: 'var(--color-base)' }}>
                                        {t('two_factor.title')}
                                    </span>
                                    {isEnabled && (
                                        <span 
                                            className="ml-auto text-xs font-medium px-2 py-1 rounded"
                                            style={{ 
                                                background: 'color-mix(in srgb, #22c55e 15%, transparent)',
                                                color: '#22c55e',
                                            }}
                                        >
                                            {t('enabled')}
                                        </span>
                                    )}
                                </CardHeader>
                                <CardBody>
                                    <SetupTOTPDialog open={totpVisible === 'enable'} onClose={() => setTotpVisible(null)} onTokens={onTokens} />
                                    <RecoveryTokensDialog tokens={tokens} open={tokens.length > 0} onClose={() => setTokens([])} />
                                    <DisableTOTPDialog open={totpVisible === 'disable'} onClose={() => setTotpVisible(null)} />
                                    <p className="text-sm mb-5" style={{ color: 'var(--color-muted)' }}>
                                        {t('two_factor.description')}
                                    </p>
                                    {isEnabled ? (
                                        <Button.Danger onClick={() => setTotpVisible('disable')}>
                                            {t('two_factor.disable_button')}
                                        </Button.Danger>
                                    ) : (
                                        <Button onClick={() => setTotpVisible('enable')}>
                                            {t('two_factor.enable_button')}
                                        </Button>
                                    )}
                                </CardBody>
                            </Card>

                            <Card className="mt-6">
                                <CardHeader>
                                    <FontAwesomeIcon icon={faShieldAlt} style={{ color: 'var(--color-primary)' }} />
                                    <span className="font-medium" style={{ color: 'var(--color-base)' }}>
                                        {t('privacy_mode.title')}
                                    </span>
                                </CardHeader>
                                <CardBody>
                                    <FlashMessageRender byKey={'account:privacy'} className="mb-4" />
                                    <p className="text-sm mb-5" style={{ color: 'var(--color-muted)' }}>
                                        {t('privacy_mode.description')}
                                    </p>
                                    <label className="flex items-center gap-3 cursor-pointer w-fit">
                                        <input
                                            type="checkbox"
                                            checked={user?.privacyMode || false}
                                            onChange={(e) => handlePrivacyModeChange(e.target.checked)}
                                            className="cursor-pointer"
                                            style={{
                                                width: '18px',
                                                height: '18px',
                                                accentColor: 'var(--color-primary)',
                                            }}
                                        />
                                        <span style={{ color: 'var(--color-base)' }}>
                                            {t('privacy_mode.enable_label')}
                                        </span>
                                    </label>
                                </CardBody>
                            </Card>
                        </FormSection>
                    </>
                );

            case 'oauth':
                return (
                    <>
                        <SectionTitle>{t('oauth_title')}</SectionTitle>
                        <SectionDescription>
                            Link external sign-in providers to this account or remove providers you no longer use.
                        </SectionDescription>

                        <FormSection>
                            <OAuthManagementTab />
                        </FormSection>
                    </>
                );

            case 'api':
                return (
                    <>
                        <SectionTitle>{t('api.title')}</SectionTitle>
                        <SectionDescription>{t('api.description')}</SectionDescription>
                        
                        <FormSection>
                            <div className="grid gap-6 lg:grid-cols-2">
                                <Card>
                                    <CardHeader>
                                        <FontAwesomeIcon icon={faKey} style={{ color: 'var(--color-primary)' }} />
                                        <span className="font-medium" style={{ color: 'var(--color-base)' }}>
                                            {t('api.create')}
                                        </span>
                                    </CardHeader>
                                    <CardBody>
                                        <CreateApiKeyForm onKeyCreated={(key) => setApiKeys((s) => [...s!, key])} />
                                    </CardBody>
                                </Card>
                                
                                <Card>
                                    <CardHeader>
                                        <FontAwesomeIcon icon={faKey} style={{ color: 'var(--color-primary)' }} />
                                        <span className="font-medium" style={{ color: 'var(--color-base)' }}>
                                            {t('api.keys_title')}
                                        </span>
                                    </CardHeader>
                                    <CardBody>
                                        <SpinnerOverlay visible={apiLoading} />
                                        <Dialog.Confirm
                                            title={t('api.delete')}
                                            confirm={t('api.delete_confirm')}
                                            open={!!deleteIdentifier}
                                            onClose={() => setDeleteIdentifier('')}
                                            onConfirmed={() => doApiKeyDeletion(deleteIdentifier)}
                                        >
                                            {t('api.delete_warning', { identifier: deleteIdentifier })}
                                        </Dialog.Confirm>
                                        {apiKeys.length === 0 ? (
                                            <p className="text-center text-sm" style={{ color: 'var(--color-muted)' }}>
                                                {apiLoading ? t('loading') : t('api.no_keys')}
                                            </p>
                                        ) : (
                                            apiKeys.map((key, index) => (
                                                <GreyRowBox
                                                    key={key.identifier}
                                                    css={[tw`flex items-center`, index > 0 && tw`mt-2`]}
                                                >
                                                    <FontAwesomeIcon icon={faKey} style={{ color: 'var(--color-muted)' }} />
                                                    <div css={tw`ml-4 flex-1 overflow-hidden`}>
                                                        <p css={tw`text-sm break-words`} style={{ color: 'var(--color-base)' }}>{key.description}</p>
                                                        <p css={tw`text-2xs uppercase`} style={{ color: 'var(--color-inverted)' }}>
                                                            {t('api.last_used')}:&nbsp;
                                                            {key.lastUsedAt ? format(key.lastUsedAt, 'MMM do, yyyy HH:mm') : t('api.never')}
                                                        </p>
                                                    </div>
                                                    <p css={tw`text-sm ml-4 hidden md:block`}>
                                                        <Code dark>{key.identifier}</Code>
                                                    </p>
                                                    <button css={tw`ml-4 p-2 text-sm`} onClick={() => setDeleteIdentifier(key.identifier)}>
                                                        <FontAwesomeIcon
                                                            icon={faTrashAlt}
                                                            css={tw`hover:text-red-400 transition-colors duration-150`}
                                                            style={{ color: 'var(--color-inverted)' }}
                                                        />
                                                    </button>
                                                </GreyRowBox>
                                            ))
                                        )}
                                    </CardBody>
                                </Card>
                            </div>
                        </FormSection>
                    </>
                );

            case 'ssh':
                return (
                    <>
                        <SectionTitle>{t('ssh_keys.title')}</SectionTitle>
                        <SectionDescription>{t('ssh_keys.description')}</SectionDescription>
                        
                        <FormSection>
                            <div className="grid gap-6 lg:grid-cols-2">
                                <Card>
                                    <CardHeader>
                                        <FontAwesomeIcon icon={faKey} style={{ color: 'var(--color-primary)' }} />
                                        <span className="font-medium" style={{ color: 'var(--color-base)' }}>
                                            {t('ssh_keys.add')}
                                        </span>
                                    </CardHeader>
                                    <CardBody>
                                        <CreateSSHKeyForm />
                                    </CardBody>
                                </Card>
                                
                                <Card>
                                    <CardHeader>
                                        <FontAwesomeIcon icon={faKey} style={{ color: 'var(--color-primary)' }} />
                                        <span className="font-medium" style={{ color: 'var(--color-base)' }}>
                                            {t('ssh_keys.title')}
                                        </span>
                                    </CardHeader>
                                    <CardBody>
                                        <SpinnerOverlay visible={!sshKeys && sshValidating} />
                                        {!sshKeys || !sshKeys.length ? (
                                            <p className="text-center text-sm" style={{ color: 'var(--color-muted)' }}>
                                                {!sshKeys ? t('loading') : t('ssh_keys.no_keys')}
                                            </p>
                                        ) : (
                                            sshKeys.map((key, index) => (
                                                <GreyRowBox
                                                    key={key.fingerprint}
                                                    css={[tw`flex space-x-4 items-center`, index > 0 && tw`mt-2`]}
                                                >
                                                    <FontAwesomeIcon icon={faKey} style={{ color: 'var(--color-muted)' }} />
                                                    <div css={tw`flex-1`}>
                                                        <p css={tw`text-sm break-words font-medium`} style={{ color: 'var(--color-base)' }}>{key.name}</p>
                                                        <p css={tw`text-xs mt-1 font-mono truncate`} style={{ color: 'var(--color-muted)' }}>SHA256:{key.fingerprint}</p>
                                                        <p css={tw`text-xs mt-1 uppercase`} style={{ color: 'var(--color-inverted)' }}>
                                                            {t('ssh_keys.added_on')}:&nbsp;
                                                            {format(key.createdAt, 'MMM do, yyyy HH:mm')}
                                                        </p>
                                                    </div>
                                                    <DeleteSSHKeyButton name={key.name} fingerprint={key.fingerprint} />
                                                </GreyRowBox>
                                            ))
                                        )}
                                    </CardBody>
                                </Card>
                            </div>
                        </FormSection>
                    </>
                );

            case 'activity':
                return (
                    <>
                        <SectionTitle>{t('activity.title')}</SectionTitle>
                        <SectionDescription>{t('activity.description')}</SectionDescription>
                        
                        {(activityFilters.filters?.event || activityFilters.filters?.ip) && (
                            <div className={'flex justify-end mb-4'}>
                                <Link
                                    to={'#'}
                                    className={classNames(btnStyles.button, btnStyles.text, 'w-full sm:w-auto')}
                                    onClick={() => setActivityFilters((value) => ({ ...value, filters: {} }))}
                                >
                                    {t('activity.clear_filters')} <XCircleIcon className={'w-4 h-4 ml-2'} />
                                </Link>
                            </div>
                        )}
                        
                        {!activityData && activityValidating ? (
                            <Spinner centered />
                        ) : !activityData?.items.length ? (
                            <div 
                                className="text-center py-12 rounded-lg"
                                style={{ 
                                    backgroundColor: 'var(--color-background-secondary)',
                                    border: '1px solid var(--color-neutral)',
                                    borderRadius: 'var(--border-radius, 8px)',
                                }}
                            >
                                <p className="text-sm" style={{ color: 'var(--color-inverted)' }}>
                                    {t('activity.no_logs')}
                                </p>
                            </div>
                        ) : (
                            <div>
                                {sortedDays.map((day) => (
                                    <TimelineRow key={day}>
                                        <DateColumn>
                                            {formatDayLabel(new Date(day))}
                                        </DateColumn>
                                        <TimelineColumn>
                                            <TimelineDot />
                                        </TimelineColumn>
                                        <ContentColumn>
                                            {groupedByDay[day].map((activity) => {
                                                const properties = wrapProperties(activity.properties);
                                                return (
                                                    <ActivityItem key={activity.id}>
                                                        <ActivityHeader>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-medium text-sm" style={{ color: 'var(--color-base)' }}>
                                                                    {t('activity.account')}
                                                                </span>
                                                                <Link
                                                                    to={`#${pathTo({ event: activity.event })}`}
                                                                    className="text-xs px-2 py-0.5 rounded"
                                                                    style={{ 
                                                                        backgroundColor: 'var(--color-background)',
                                                                        color: 'var(--color-primary)',
                                                                        border: '1px solid var(--color-neutral)',
                                                                    }}
                                                                >
                                                                    {activity.event.replace(/[:.]/g, ' ')}
                                                                </Link>
                                                                {activity.isApi && (
                                                                    <Tooltip placement="top" content={t('activity.using_api_key')}>
                                                                        <TerminalIcon className="w-4 h-4" style={{ color: 'var(--color-muted)' }} />
                                                                    </Tooltip>
                                                                )}
                                                            </div>
                                                            {activity.hasAdditionalMetadata && (
                                                                <ActivityLogMetaButton meta={activity.properties} />
                                                            )}
                                                        </ActivityHeader>
                                                        <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
                                                            <Translate ns="activity" values={properties} i18nKey={activity.event.replace(':', '.')} />
                                                        </p>
                                                        <ActivityMeta>
                                                            <Tooltip placement="top" content={format(activity.timestamp, 'MMM do, yyyy H:mm:ss')}>
                                                                <span>{format(activity.timestamp, 'h:mm a')}</span>
                                                            </Tooltip>
                                                            {activity.ip && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span>{isDemo ? '***.***.***.***' : activity.ip}</span>
                                                                </>
                                                            )}
                                                        </ActivityMeta>
                                                    </ActivityItem>
                                                );
                                            })}
                                        </ContentColumn>
                                    </TimelineRow>
                                ))}
                            </div>
                        )}
                        
                        {activityData && (
                            <PaginationFooter
                                pagination={activityData.pagination}
                                onPageSelect={(page) => setActivityFilters((value) => ({ ...value, page }))}
                            />
                        )}
                    </>
                );

            default:
                return null;
        }
    };

    if (!user) return null;

    return (
        <PageContentBlock title={t('title')}>
            <FlashMessageRender byKey={'account'} className="mb-6" />

            <PageHeader title={t('title')} description={t('subtitle')} />

            <Container>
                <Sidebar>
                    <SidebarNav>
                        {accountNavLinks.map((link, index) => {
                            const url = link.url || '/account';
                            const icon = findIconDefinition({ prefix: 'fas', iconName: link.icon as any }) || faLink;
                            const isHttp = isExternalLink(url);
                            const accountPath = getAccountPathFromUrl(url);
                            const openInNewTab =
                                typeof link.open_in_new_tab === 'boolean' ? link.open_in_new_tab : isHttp;

                            if (openInNewTab || (isHttp && !accountPath)) {
                                return (
                                    <NavButton
                                        key={`account-nav-${index}`}
                                        as="a"
                                        href={url}
                                        target={openInNewTab ? '_blank' : undefined}
                                        rel={openInNewTab ? 'noreferrer' : undefined}
                                        $active={false}
                                    >
                                        <FontAwesomeIcon icon={icon} />
                                        {link.label}
                                    </NavButton>
                                );
                            }

                            const tabPath = accountPath || url;
                            const tab = getTabFromLinkUrl(tabPath);

                            return (
                                <NavButton
                                    key={`account-nav-${index}`}
                                    $active={activeTab === tab}
                                    onClick={() => {
                                        setActiveTab(tab);
                                        window.history.replaceState(null, '', tabPath);
                                    }}
                                >
                                    <FontAwesomeIcon icon={icon} />
                                    {link.label}
                                </NavButton>
                            );
                        })}
                    </SidebarNav>
                </Sidebar>
                
                <MainContent>
                    {renderContent()}
                </MainContent>
            </Container>
        </PageContentBlock>
    );
};
