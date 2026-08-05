import React, { forwardRef, useEffect, useState } from 'react';
import { Form } from 'formik';
import styled from 'styled-components/macro';
import FlashMessageRender from '@/components/FlashMessageRender';
import tw from 'twin.macro';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';

type Props = React.DetailedHTMLProps<React.FormHTMLAttributes<HTMLFormElement>, HTMLFormElement> & {
    title?: string;
    subtitle?: string;
};

type AuthBackgroundProps = {
    $authBgImage?: string;
    $authOverlay?: number;
};

const resolveTheme = (): 'dark' | 'light' =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';

const useAuthBackground = (): { image?: string; overlay: number } => {
    const layout = useStoreState((state: ApplicationStore) => state.settings.data?.layout);
    const overlay = Number(layout?.authBackgroundOverlay ?? 55);

    return {
        image: layout?.authBackgroundImage || undefined,
        overlay: Math.max(0, Math.min(100, Number.isNaN(overlay) ? 55 : overlay)),
    };
};

const useActiveLogo = (): string | undefined => {
    const logo = useStoreState((state: ApplicationStore) => state.settings.data?.logo);
    const logoDark = useStoreState((state: ApplicationStore) => state.settings.data?.logoDark);
    const logoLight = useStoreState((state: ApplicationStore) => state.settings.data?.logoLight);
    const [effectiveTheme, setEffectiveTheme] = useState<'dark' | 'light'>(resolveTheme);

    useEffect(() => {
        const updateTheme = () => setEffectiveTheme(resolveTheme());
        updateTheme();
        const observer = new MutationObserver(updateTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        return () => observer.disconnect();
    }, []);

    return effectiveTheme === 'light'
        ? logoLight || logoDark || logo
        : logoDark || logoLight || logo;
};

const BrandName = styled.h1`
    ${tw`text-2xl font-bold`};
    color: var(--color-base);
    letter-spacing: -0.3px;
`;

const BrandLogo = styled.img`
    display: block;
    max-height: 48px;
    width: auto;
    margin: 0 auto;
    object-fit: contain;
`;

const Header = styled.div`
    ${tw`mb-6`};
`;

const Title = styled.h2`
    ${tw`text-xl font-semibold`};
    color: var(--color-base);
`;

const Subtitle = styled.p`
    ${tw`text-sm mt-1`};
    color: var(--color-muted);
`;

const Footer = styled.p`
    ${tw`text-center text-xs mt-6`};
    color: var(--color-inverted);

    a {
        color: var(--color-inverted);
        text-decoration: none;
        transition: color 0.15s ease;

        &:hover {
            color: var(--color-primary);
        }
    }
`;

const authBackgroundStyles = (props: AuthBackgroundProps) => props.$authBgImage ? `
    position: relative;
    background-image: url("${props.$authBgImage}");
    background-size: cover;
    background-position: center;
    background-attachment: fixed;

    &::before {
        content: '';
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, ${(props.$authOverlay ?? 55) / 100});
        pointer-events: none;
    }

    > * {
        position: relative;
        z-index: 1;
    }
` : '';

const CenteredWrapper = styled.div<AuthBackgroundProps>`
    ${tw`flex items-center justify-center p-6`};
    min-height: 100vh;
    background-color: var(--color-background);
    overflow: auto;
    ${authBackgroundStyles};
`;

const CenteredCard = styled.div`
    ${tw`w-full`};
    max-width: 420px;
`;

const CenteredBrand = styled.div`
    ${tw`text-center mb-8`};
`;

const CenteredFormBox = styled.div`
    ${tw`p-6 sm:p-8`};
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
`;

const SplitWrapper = styled.div<AuthBackgroundProps>`
    ${tw`flex`};
    min-height: 100vh;
    background-color: var(--color-background);
    ${authBackgroundStyles};
`;

const SplitLeftPanel = styled.div`
    ${tw`flex flex-col items-center justify-center p-8`};
    width: 50%;
    background-color: var(--color-background);

    @media (max-width: 768px) {
        width: 100%;
    }
`;

const SplitRightPanel = styled.div<{ $bgType?: string; $bgImage?: string; $gradientStart?: string; $gradientEnd?: string }>`
    width: 50%;
    position: relative;
    overflow: hidden;
    background: ${props => props.$bgType === 'gradient' 
        ? `linear-gradient(135deg, ${props.$gradientStart || 'var(--color-primary)'}, ${props.$gradientEnd || 'var(--color-background)'})`
        : 'var(--color-background-secondary)'};

    @media (max-width: 768px) {
        display: none;
    }

    ${props => props.$bgType !== 'gradient' && `
        &::before {
            content: '';
            position: absolute;
            inset: 0;
            background-image: url("${props.$bgImage || ''}");
            background-size: cover;
            background-position: center;
        }
    `}
`;

const SplitFormContainer = styled.div`
    ${tw`w-full`};
    max-width: 380px;
`;

const SplitBrand = styled.div`
    ${tw`mb-8`};
`;

const SplitFormBox = styled.div`
    ${tw`p-6 sm:p-8`};
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
`;

const MinimalWrapper = styled.div<AuthBackgroundProps>`
    ${tw`flex items-center justify-center p-6`};
    min-height: 100vh;
    background-color: var(--color-background);
    overflow: auto;
    ${authBackgroundStyles};
`;

const MinimalContainer = styled.div`
    ${tw`w-full`};
    max-width: 380px;
`;

const MinimalBrand = styled.div`
    ${tw`text-center mb-10`};
`;

const MinimalFormArea = styled.div`
    ${tw`px-2`};
`;

const SplitCardWrapper = styled.div<AuthBackgroundProps>`
    ${tw`flex items-center justify-center p-6`};
    min-height: 100vh;
    background-color: var(--color-background);
    overflow: auto;
    ${authBackgroundStyles};
`;

const WideCard = styled.div`
    ${tw`flex w-full overflow-hidden`};
    max-width: 900px;
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);

    @media (max-width: 768px) {
        flex-direction: column;
        max-width: 420px;
    }
`;

const WideCardLeft = styled.div`
    ${tw`flex flex-col justify-center p-8 sm:p-10`};
    width: 50%;

    @media (max-width: 768px) {
        width: 100%;
    }
`;

const WideCardRight = styled.div<{ $bgType?: string; $bgImage?: string; $gradientStart?: string; $gradientEnd?: string }>`
    width: 50%;
    position: relative;
    min-height: 400px;
    background: ${props => props.$bgType === 'gradient' 
        ? `linear-gradient(135deg, ${props.$gradientStart || 'var(--color-primary)'}, ${props.$gradientEnd || 'var(--color-background)'})`
        : 'var(--color-background-secondary)'};

    @media (max-width: 768px) {
        display: none;
    }

    ${props => props.$bgType !== 'gradient' && `
        &::before {
            content: '';
            position: absolute;
            inset: 0;
            background-image: url("${props.$bgImage || ''}");
            background-size: cover;
            background-position: center;
        }
    `}
`;

const WideCardBrand = styled.div`
    ${tw`mb-8`};
`;

const CenteredLayout = forwardRef<HTMLFormElement, Props>(({ title, subtitle, children, ...props }, ref) => {
    const name = useStoreState((state) => state.settings.data!.name);
    const activeLogo = useActiveLogo();
    const copyrightText = useStoreState((state: ApplicationStore) => state.settings.data?.copyrightText);
    const authBackground = useAuthBackground();

    return (
        <CenteredWrapper $authBgImage={authBackground.image} $authOverlay={authBackground.overlay}>
            <CenteredCard>
                <CenteredBrand>
                    {activeLogo ? <BrandLogo src={activeLogo} alt={name} /> : <BrandName>{name}</BrandName>}
                </CenteredBrand>
                <FlashMessageRender css={tw`mb-4`} />
                <Form {...props} ref={ref}>
                    <CenteredFormBox>
                        {(title || subtitle) && (
                            <Header>
                                {title && <Title>{title}</Title>}
                                {subtitle && <Subtitle>{subtitle}</Subtitle>}
                            </Header>
                        )}
                        {children}
                    </CenteredFormBox>
                </Form>
                <Footer dangerouslySetInnerHTML={{ __html: copyrightText || `&copy; ${new Date().getFullYear()} <a rel="noopener nofollow noreferrer" href="https://pterodactyl.io" target="_blank">Pterodactyl Software</a>` }} />
            </CenteredCard>
        </CenteredWrapper>
    );
});

const SplitLeftLayout = forwardRef<HTMLFormElement, Props>(({ title, subtitle, children, ...props }, ref) => {
    const name = useStoreState((state) => state.settings.data!.name);
    const activeLogo = useActiveLogo();
    const copyrightText = useStoreState((state: ApplicationStore) => state.settings.data?.copyrightText);
    const components = useStoreState((state: ApplicationStore) => state.settings.data?.components);
    const bgType = components?.loginPanelBgType ?? 'image';
    const bgImage = components?.loginPanelBgImage ?? 'https://static0.gamerantimages.com/wordpress/wp-content/uploads/2022/08/minecraft-4.jpg?q=50&fit=crop&w=1296&h=891&dpr=1.5';
    const gradientStart = components?.loginPanelGradientStart ?? 'hsl(229, 100%, 64%)';
    const gradientEnd = components?.loginPanelGradientEnd ?? 'hsl(240, 3%, 6%)';
    const authBackground = useAuthBackground();

    return (
        <SplitWrapper $authBgImage={authBackground.image} $authOverlay={authBackground.overlay}>
            <SplitLeftPanel>
                <SplitFormContainer>
                    <SplitBrand>
                        {activeLogo ? <BrandLogo src={activeLogo} alt={name} /> : <BrandName>{name}</BrandName>}
                    </SplitBrand>
                    <FlashMessageRender css={tw`mb-4`} />
                    <Form {...props} ref={ref}>
                        <SplitFormBox>
                            {(title || subtitle) && (
                                <Header>
                                    {title && <Title>{title}</Title>}
                                    {subtitle && <Subtitle>{subtitle}</Subtitle>}
                                </Header>
                            )}
                            {children}
                        </SplitFormBox>
                    </Form>
                    <Footer dangerouslySetInnerHTML={{ __html: copyrightText || `&copy; ${new Date().getFullYear()} <a rel="noopener nofollow noreferrer" href="https://pterodactyl.io" target="_blank">Pterodactyl Software</a>` }} />
                </SplitFormContainer>
            </SplitLeftPanel>
            <SplitRightPanel $bgType={bgType} $bgImage={bgImage} $gradientStart={gradientStart} $gradientEnd={gradientEnd} />
        </SplitWrapper>
    );
});

const MinimalLayout = forwardRef<HTMLFormElement, Props>(({ title, subtitle, children, ...props }, ref) => {
    const name = useStoreState((state) => state.settings.data!.name);
    const activeLogo = useActiveLogo();
    const copyrightText = useStoreState((state: ApplicationStore) => state.settings.data?.copyrightText);
    const authBackground = useAuthBackground();

    return (
        <MinimalWrapper $authBgImage={authBackground.image} $authOverlay={authBackground.overlay}>
            <MinimalContainer>
                <MinimalBrand>
                    {activeLogo ? <BrandLogo src={activeLogo} alt={name} /> : <BrandName>{name}</BrandName>}
                </MinimalBrand>
                <FlashMessageRender css={tw`mb-4`} />
                <Form {...props} ref={ref}>
                    <MinimalFormArea>
                        {(title || subtitle) && (
                            <Header>
                                {title && <Title>{title}</Title>}
                                {subtitle && <Subtitle>{subtitle}</Subtitle>}
                            </Header>
                        )}
                        {children}
                    </MinimalFormArea>
                </Form>
                <Footer dangerouslySetInnerHTML={{ __html: copyrightText || `&copy; ${new Date().getFullYear()} <a rel="noopener nofollow noreferrer" href="https://pterodactyl.io" target="_blank">Pterodactyl Software</a>` }} />
            </MinimalContainer>
        </MinimalWrapper>
    );
});

const SplitCardLayout = forwardRef<HTMLFormElement, Props>(({ title, subtitle, children, ...props }, ref) => {
    const name = useStoreState((state) => state.settings.data!.name);
    const activeLogo = useActiveLogo();
    const copyrightText = useStoreState((state: ApplicationStore) => state.settings.data?.copyrightText);
    const components = useStoreState((state: ApplicationStore) => state.settings.data?.components);
    const bgType = components?.loginPanelBgType ?? 'image';
    const bgImage = components?.loginPanelBgImage ?? 'https://static0.gamerantimages.com/wordpress/wp-content/uploads/2022/08/minecraft-4.jpg?q=50&fit=crop&w=1296&h=891&dpr=1.5';
    const gradientStart = components?.loginPanelGradientStart ?? 'hsl(229, 100%, 64%)';
    const gradientEnd = components?.loginPanelGradientEnd ?? 'hsl(240, 3%, 6%)';
    const authBackground = useAuthBackground();

    return (
        <SplitCardWrapper $authBgImage={authBackground.image} $authOverlay={authBackground.overlay}>
            <WideCard>
                <WideCardLeft>
                    <WideCardBrand>
                        {activeLogo ? <BrandLogo src={activeLogo} alt={name} /> : <BrandName>{name}</BrandName>}
                    </WideCardBrand>
                    <FlashMessageRender css={tw`mb-4`} />
                    <Form {...props} ref={ref}>
                        {(title || subtitle) && (
                            <Header>
                                {title && <Title>{title}</Title>}
                                {subtitle && <Subtitle>{subtitle}</Subtitle>}
                            </Header>
                        )}
                        {children}
                    </Form>
                    <Footer style={{ marginTop: '2rem' }} dangerouslySetInnerHTML={{ __html: copyrightText || `&copy; ${new Date().getFullYear()} <a rel="noopener nofollow noreferrer" href="https://pterodactyl.io" target="_blank">Pterodactyl Software</a>` }} />
                </WideCardLeft>
                <WideCardRight $bgType={bgType} $bgImage={bgImage} $gradientStart={gradientStart} $gradientEnd={gradientEnd} />
            </WideCard>
        </SplitCardWrapper>
    );
});

export default forwardRef<HTMLFormElement, Props>((props, ref) => {
    const loginPageVariant = useStoreState((state: ApplicationStore) => state.settings.data?.components?.loginPage ?? 'centered');

    switch (loginPageVariant) {
        case 'split_left':
            return <SplitLeftLayout {...props} ref={ref} />;
        case 'minimal':
            return <MinimalLayout {...props} ref={ref} />;
        case 'split_card':
            return <SplitCardLayout {...props} ref={ref} />;
        default:
            return <CenteredLayout {...props} ref={ref} />;
    }
});
