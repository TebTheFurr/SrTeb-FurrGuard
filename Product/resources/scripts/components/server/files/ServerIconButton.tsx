import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import { ServerContext } from '@/state/server';
import { useStoreState } from '@/state/hooks';
import useFileManagerSwr from '@/plugins/useFileManagerSwr';
import { useFlashKey } from '@/plugins/useFlash';
import getFileUploadUrl from '@/api/server/files/getFileUploadUrl';
import deleteFiles from '@/api/server/files/deleteFiles';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import Fade from '@/components/elements/Fade';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage, faWrench } from '@fortawesome/free-solid-svg-icons';
import tw from 'twin.macro';
import styled, { keyframes } from 'styled-components/macro';

const MenuItem = styled.button`
    ${tw`w-full flex items-center gap-3 text-left transition-all duration-100`};
    padding: 8px 10px;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 450;
    color: var(--color-muted);
    background: transparent;
    border: none;
    cursor: pointer;

    &:hover {
        background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
        color: var(--color-base);
    }

    &:active {
        transform: scale(0.98);
    }

    &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
`;

const MenuIcon = styled.span`
    ${tw`flex items-center justify-center flex-shrink-0`};
    width: 18px;
    height: 18px;
    font-size: 0.75rem;
    opacity: 0.7;
    color: var(--color-primary);
`;

const MenuLabel = styled.span`
    ${tw`flex-1`};
`;

const ToggleIcon = styled((props) => <span {...props} />)`
    ${tw`flex items-center justify-center flex-shrink-0`};
    width: 20px;
    height: 20px;
    color: var(--color-muted);
    transition: transform 0.15s ease;

    &[data-open="true"] {
        transform: rotate(180deg);
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

const Wrapper = styled.div`
    position: relative;
    display: inline-block;
`;

const DropdownAnchor = styled.div`
    position: absolute;
    left: 0;
    top: 100%;
    margin-top: 4px;
    z-index: 50;
`;

const DropdownPanel = styled.div`
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

const processImage = (file: File, size: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, size, size);
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Failed to convert canvas to PNG'));
                            return;
                        }
                        resolve(blob);
                    },
                    'image/png',
                    1.0
                );
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = reader.result as string;
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
};

export default () => {
    const fileInput = useRef<HTMLInputElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [processing, setProcessing] = useState(false);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('click', onDocClick);
        return () => document.removeEventListener('click', onDocClick);
    }, [open]);

    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { mutate } = useFileManagerSwr();
    const { clearAndAddHttpError } = useFlashKey('files');

    const eggId = ServerContext.useStoreState((state) => state.server.data!.eggId);
    const addonSettings = useStoreState((state) => state.settings.data?.addons?.serverIconChanger);
    const iconEnabled = addonSettings?.enabled ?? false;
    const outputFilename = addonSettings?.outputFilename ?? 'server-icon.png';
    const iconSize = addonSettings?.iconSize ?? 64;
    const allowedEggs = addonSettings?.allowedEggs ?? [];

    const eggAllowed = allowedEggs.length === 0 || allowedEggs.includes(eggId);
    const showIcon = iconEnabled && eggAllowed;

    if (!showIcon) return null;

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.currentTarget.files?.[0];
        if (!file) return;

        if (fileInput.current) {
            fileInput.current.value = '';
        }

        setProcessing(true);
        clearAndAddHttpError();

        try {
            const processedBlob = await processImage(file, iconSize);
            const processedFile = new File([processedBlob], outputFilename, { type: 'image/png' });
            const uploadUrl = await getFileUploadUrl(uuid);

            try {
                await deleteFiles(uuid, '/', [outputFilename]);
            } catch {
            }

            await axios.post(
                uploadUrl,
                { files: processedFile },
                {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    params: { directory: '/' },
                }
            );

            await mutate();
        } catch (error: any) {
            const msg = typeof error?.response?.data === 'string'
                ? error.response.data
                : error?.response?.data?.errors?.[0]?.detail
                ?? error?.response?.data?.message
                ?? error?.message
                ?? '';
            const isDiskSpace = /disk space|not enough.*space|space available/i.test(String(msg));
            if (isDiskSpace) {
                clearAndAddHttpError({
                    message: 'The server has run out of disk space or has hit its disk limit. Free up files on the server or ask your host to increase the server\'s disk limit in the panel (Server > Build).',
                });
            } else {
                clearAndAddHttpError(error);
            }
        } finally {
            setProcessing(false);
        }
    };

    return (
        <>
            <SpinnerOverlay visible={processing} fixed size={'large'} />
            <input
                type="file"
                ref={fileInput}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
            />
            <Wrapper ref={wrapperRef}>
                <MenuItem as="button" type="button" onClick={() => setOpen((v) => !v)}>
                    <ToggleIcon data-open={open || undefined}>
                        <FontAwesomeIcon icon={faWrench} style={{ fontSize: '20px' }} />
                    </ToggleIcon>
                </MenuItem>
                <DropdownAnchor>
                    <Fade timeout={150} in={open} unmountOnExit>
                        <DropdownPanel
                            onClick={(e) => {
                                e.stopPropagation();
                                setOpen(false);
                            }}
                        >
                            {showIcon && (
                                <MenuItem onClick={() => fileInput.current?.click()}>
                                    <MenuIcon style={{ fontSize: '18px' }}>
                                        <FontAwesomeIcon icon={faImage} />
                                    </MenuIcon>
                                    <MenuLabel>Change Server Icon</MenuLabel>
                                </MenuItem>
                            )}
                        </DropdownPanel>
                    </Fade>
                </DropdownAnchor>
            </Wrapper>
        </>
    );
};
