import React, { createRef } from 'react';
import styled, { keyframes } from 'styled-components/macro';
import tw from 'twin.macro';
import Fade from '@/components/elements/Fade';

interface Props {
    children: React.ReactNode;
    renderToggle: (onClick: (e: React.MouseEvent<any, MouseEvent>) => void) => React.ReactChild;
}

export const DropdownButtonRow = styled.button<{ danger?: boolean }>`
    ${tw`p-2 flex items-center rounded w-full`};
    color: var(--color-muted);
    transition: 100ms all ease;

    &:hover {
        ${(props) =>
            props.danger
                ? tw`text-red-100 bg-red-500`
                : `
            color: var(--color-base);
            background-color: var(--color-neutral);
        `};
    }
`;

const slideIn = keyframes`
    from {
        opacity: 0;
        transform: scale(0.95) translateY(-4px);
    }
    to {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
`;

const DropdownContainer = styled.div`
    ${tw`fixed z-50`};
    z-index: 9999;
    min-width: 200px;
    padding: 6px;
    background-color: color-mix(in srgb, var(--color-background-secondary) 95%, black);
    border: 1px solid color-mix(in srgb, var(--color-neutral) 60%, transparent);
    border-radius: 10px;
    box-shadow: 
        0 4px 24px rgba(0, 0, 0, 0.25),
        0 1px 3px rgba(0, 0, 0, 0.15),
        inset 0 1px 0 color-mix(in srgb, white 4%, transparent);
    backdrop-filter: blur(20px);
    animation: ${slideIn} 0.15s ease-out;
`;

interface State {
    posX: number;
    posY: number;
    visible: boolean;
}

class DropdownMenu extends React.PureComponent<Props, State> {
    menu = createRef<HTMLDivElement>();

    state: State = {
        posX: 0,
        posY: 0,
        visible: false,
    };

    componentWillUnmount() {
        this.removeListeners();
    }

    componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<State>) {
        const menu = this.menu.current;

        if (this.state.visible && !prevState.visible && menu) {
            document.addEventListener('click', this.windowListener);
            document.addEventListener('contextmenu', this.contextMenuListener);
            
            const menuWidth = menu.clientWidth;
            const menuHeight = menu.clientHeight;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            let left = this.state.posX - menuWidth;
            let top = this.state.posY;
            
            if (left < 0) {
                left = this.state.posX;
            }
            
            if (left + menuWidth > viewportWidth) {
                left = viewportWidth - menuWidth - 10;
            }
            
            if (top + menuHeight > viewportHeight) {
                top = viewportHeight - menuHeight - 10;
            }
            
            menu.style.left = `${Math.round(left)}px`;
            menu.style.top = `${Math.round(top)}px`;
        }

        if (!this.state.visible && prevState.visible) {
            this.removeListeners();
        }
    }

    removeListeners = () => {
        document.removeEventListener('click', this.windowListener);
        document.removeEventListener('contextmenu', this.contextMenuListener);
    };

    onClickHandler = (e: React.MouseEvent<any, MouseEvent>) => {
        e.preventDefault();
        this.triggerMenu(e.clientX, e.clientY);
    };

    contextMenuListener = () => this.setState({ visible: false });

    windowListener = (e: MouseEvent) => {
        const menu = this.menu.current;

        if (e.button === 2 || !this.state.visible || !menu) {
            return;
        }

        if (e.target === menu || menu.contains(e.target as Node)) {
            return;
        }

        if (e.target !== menu && !menu.contains(e.target as Node)) {
            this.setState({ visible: false });
        }
    };

    triggerMenu = (posX: number, posY?: number) =>
        this.setState((s) => ({
            posX: !s.visible ? posX : s.posX,
            posY: !s.visible && posY !== undefined ? posY : s.posY,
            visible: !s.visible,
        }));

    render() {
        return (
            <div>
                {this.props.renderToggle(this.onClickHandler)}
                <Fade timeout={150} in={this.state.visible} unmountOnExit>
                    <DropdownContainer
                        ref={this.menu}
                        onClick={(e) => {
                            e.stopPropagation();
                            this.setState({ visible: false });
                        }}
                    >
                        {this.props.children}
                    </DropdownContainer>
                </Fade>
            </div>
        );
    }
}

export default DropdownMenu;
