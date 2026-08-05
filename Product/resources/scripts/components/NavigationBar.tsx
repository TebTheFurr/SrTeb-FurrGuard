import * as React from 'react';
import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCogs, faLayerGroup, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import SearchContainer from '@/components/dashboard/search/SearchContainer';
import tw from 'twin.macro';
import styled from 'styled-components/macro';
import http from '@/api/http';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import Avatar from '@/components/Avatar';

const NavigationWrapper = styled.div`
    background-color: var(--color-background-secondary);
    border-bottom: 1px solid var(--color-neutral);
`;

const RightNavigation = styled.div`
    & > a,
    & > button,
    & > .navigation-link {
        ${tw`flex items-center h-full no-underline px-6 cursor-pointer transition-all duration-150`};
        color: var(--color-muted);

        &:active,
        &:hover {
            color: var(--color-base);
            background-color: rgba(255, 255, 255, 0.05);
        }

        &:active,
        &:hover,
        &.active {
            box-shadow: inset 0 -2px var(--color-primary);
        }
    }
`;

export default () => {
    const name = useStoreState((state: ApplicationStore) => state.settings.data!.name);
    const logo = useStoreState((state: ApplicationStore) => state.settings.data?.logo);
    const logoDark = useStoreState((state: ApplicationStore) => state.settings.data?.logoDark);
    const logoLight = useStoreState((state: ApplicationStore) => state.settings.data?.logoLight);
    const rootAdmin = useStoreState((state: ApplicationStore) => state.user.data!.rootAdmin);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [effectiveTheme, setEffectiveTheme] = useState<'dark' | 'light'>(
        document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
    );
    const activeLogo = effectiveTheme === 'light'
        ? logoLight || logoDark || logo
        : logoDark || logoLight || logo;

    useEffect(() => {
        const updateTheme = () => {
            setEffectiveTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
        };
        updateTheme();
        const observer = new MutationObserver(updateTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        return () => observer.disconnect();
    }, []);

    const onTriggerLogout = () => {
        setIsLoggingOut(true);
        http.post('/auth/logout').finally(() => {
            // @ts-expect-error this is valid
            window.location = '/';
        });
    };

    return (
        <NavigationWrapper className={'w-full shadow-md overflow-x-auto'}>
            <SpinnerOverlay visible={isLoggingOut} />
            <div className={'mx-auto w-full flex items-center h-[3.5rem] max-w-[1200px]'}>
                <div id={'logo'} className={'flex-1'}>
                    <Link
                        to={'/'}
                        className={'text-2xl font-header font-medium px-4 no-underline transition-colors duration-150 flex items-center'}
                        style={{ color: 'var(--color-base)' }}
                    >
                        {activeLogo ? <img src={activeLogo} alt={name} style={{ maxHeight: '30px', width: 'auto' }} /> : name}
                    </Link>
                </div>
                <RightNavigation className={'flex h-full items-center justify-center'}>
                    <SearchContainer />
                    <Tooltip placement={'bottom'} content={'Dashboard'}>
                        <NavLink to={'/'} exact>
                            <FontAwesomeIcon icon={faLayerGroup} />
                        </NavLink>
                    </Tooltip>
                    {rootAdmin && (
                        <Tooltip placement={'bottom'} content={'Admin'}>
                            <a href={'/admin'} rel={'noreferrer'}>
                                <FontAwesomeIcon icon={faCogs} />
                            </a>
                        </Tooltip>
                    )}
                    <Tooltip placement={'bottom'} content={'Account Settings'}>
                        <NavLink to={'/account'}>
                            <span className={'flex items-center w-5 h-5'}>
                                <Avatar.User />
                            </span>
                        </NavLink>
                    </Tooltip>
                    <Tooltip placement={'bottom'} content={'Sign Out'}>
                        <button onClick={onTriggerLogout}>
                            <FontAwesomeIcon icon={faSignOutAlt} />
                        </button>
                    </Tooltip>
                </RightNavigation>
            </div>
        </NavigationWrapper>
    );
};
