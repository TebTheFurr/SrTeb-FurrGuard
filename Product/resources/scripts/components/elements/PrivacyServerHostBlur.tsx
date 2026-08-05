import React from 'react';
import styled, { css } from 'styled-components/macro';
import { useStoreState } from '@/state/hooks';
import { ApplicationStore } from '@/state';

export const PrivacyBlurSurface = styled.span<{ $block?: boolean }>`
    display: ${(p) => (p.$block ? 'block' : 'inline-block')};
    width: ${(p) => (p.$block ? '100%' : 'auto')};
    max-width: 100%;
    min-width: 0;
    position: relative;
    border-radius: var(--border-radius, 6px);
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
    filter: blur(5px);
    cursor: default;
    transition:
        filter 0.2s ease-out,
        background 0.2s ease-out,
        -webkit-mask-image 0.2s ease-out,
        mask-image 0.2s ease-out;

    ${(p) =>
        p.$block
            ? css`
                  overflow: hidden;
                  -webkit-mask-image: linear-gradient(
                      to right,
                      transparent 0%,
                      #000 5%,
                      #000 95%,
                      transparent 100%
                  );
                  mask-image: linear-gradient(
                      to right,
                      transparent 0%,
                      #000 5%,
                      #000 95%,
                      transparent 100%
                  );
              `
            : css`
                  padding: 1px 6px;
                  background: color-mix(in srgb, var(--color-base, currentColor) 7%, transparent);
                  -webkit-mask-image: radial-gradient(
                      ellipse 115% 150% at 50% 50%,
                      #000 42%,
                      transparent 100%
                  );
                  mask-image: radial-gradient(
                      ellipse 115% 150% at 50% 50%,
                      #000 42%,
                      transparent 100%
                  );
              `}

    &:hover {
        filter: none;
        background: transparent;
        -webkit-mask-image: none;
        mask-image: none;
    }
`;

type Props = {
    when?: boolean;
    block?: boolean;
    children: React.ReactNode;
};

export default function PrivacyServerHostBlur({ when = true, block = false, children }: Props) {
    const globalPrivacy = useStoreState((state: ApplicationStore) => state.settings.data?.privacyBlurServerIp);
    const userPrivacy = useStoreState((state: ApplicationStore) => state.user.data?.privacyMode);
    const privacy = userPrivacy ?? globalPrivacy;

    if (!privacy || !when) {
        return <>{children}</>;
    }
    return <PrivacyBlurSurface $block={block}>{children}</PrivacyBlurSurface>;
}
