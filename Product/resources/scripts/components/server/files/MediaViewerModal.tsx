import React, { useState, useEffect } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faTimes, 
    faChevronLeft,
    faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { ServerContext } from '@/state/server';
import getFileDownloadUrl from '@/api/server/files/getFileDownloadUrl';
import Spinner from '@/components/elements/Spinner';
import { bytesToString } from '@/lib/formatters';

interface MediaViewerModalProps {
    visible: boolean;
    filePath: string;
    fileName: string;
    fileSize?: number;
    onDismissed: () => void;
    onPrevious?: () => void;
    onNext?: () => void;
    hasPrevious?: boolean;
    hasNext?: boolean;
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];

const getMediaType = (filename: string): 'image' | 'video' | 'audio' | null => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (IMAGE_EXTENSIONS.indexOf(ext) !== -1) return 'image';
    if (VIDEO_EXTENSIONS.indexOf(ext) !== -1) return 'video';
    if (AUDIO_EXTENSIONS.indexOf(ext) !== -1) return 'audio';
    return null;
};

export const isMediaFile = (filename: string): boolean => {
    return getMediaType(filename) !== null;
};

const Overlay = styled.div`
    ${tw`fixed inset-0 z-50 flex items-center justify-center`};
    background-color: rgba(0, 0, 0, 0.9);
`;

const Container = styled.div`
    ${tw`relative w-full h-full flex flex-col`};
`;

const Header = styled.div`
    ${tw`flex items-center justify-between px-6 py-4`};
    background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 10;
`;

const FileInfo = styled.div`
    ${tw`flex flex-col`};
`;

const FileName = styled.h2`
    ${tw`text-lg font-semibold`};
    color: white;
`;

const FileMeta = styled.span`
    ${tw`text-sm`};
    color: rgba(255, 255, 255, 0.6);
`;

const HeaderActions = styled.div`
    ${tw`flex items-center gap-2`};
`;

const IconButton = styled.button`
    ${tw`p-3 rounded-lg transition-all duration-150`};
    color: rgba(255, 255, 255, 0.8);
    background: rgba(255, 255, 255, 0.1);

    &:hover {
        background: rgba(255, 255, 255, 0.2);
        color: white;
    }
`;

const MediaContainer = styled.div`
    ${tw`flex-1 flex items-center justify-center p-4`};
    overflow: hidden;
`;

const MediaImage = styled.img`
    max-width: 90%;
    max-height: 85vh;
    object-fit: contain;
    border-radius: 0.5rem;
`;

const MediaVideo = styled.video`
    max-width: 90%;
    max-height: 85vh;
    border-radius: 0.5rem;
`;

const MediaAudio = styled.div`
    ${tw`flex flex-col items-center gap-6 p-8 rounded-lg`};
    background: rgba(255, 255, 255, 0.1);

    audio {
        width: 400px;
        max-width: 90vw;
    }
`;

const AudioIcon = styled.div`
    ${tw`text-6xl`};
    color: var(--color-primary);
`;

const NavButton = styled.button`
    ${tw`absolute top-1/2 -translate-y-1/2 p-4 rounded-full transition-all duration-150 z-10`};
    color: rgba(255, 255, 255, 0.8);
    background: rgba(0, 0, 0, 0.5);

    &:hover:not(:disabled) {
        background: rgba(0, 0, 0, 0.8);
        color: white;
    }

    &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }
`;

const PrevButton = styled(NavButton)`
    left: 1rem;
`;

const NextButton = styled(NavButton)`
    right: 1rem;
`;

const LoadingOverlay = styled.div`
    ${tw`flex items-center justify-center`};
    color: white;
`;

const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
    visible,
    filePath,
    fileName,
    fileSize,
    onDismissed,
    onPrevious,
    onNext,
    hasPrevious,
    hasNext,
}) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const [mediaUrl, setMediaUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const mediaType = getMediaType(fileName);

    useEffect(() => {
        if (!visible || !filePath) return;
        
        setLoading(true);
        setMediaUrl(null);
        
        getFileDownloadUrl(uuid, filePath)
            .then((url) => {
                setMediaUrl(url);
            })
            .catch((error) => {
                console.error('Failed to load media:', error);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [visible, filePath, uuid]);

    useEffect(() => {
        if (!visible) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onDismissed();
            } else if (e.key === 'ArrowLeft' && hasPrevious && onPrevious) {
                onPrevious();
            } else if (e.key === 'ArrowRight' && hasNext && onNext) {
                onNext();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [visible, hasPrevious, hasNext, onPrevious, onNext, onDismissed]);

    if (!visible) return null;

    return (
        <Overlay onClick={onDismissed}>
            <Container onClick={(e) => e.stopPropagation()}>
                <Header>
                    <FileInfo>
                        <FileName>{fileName}</FileName>
                        {fileSize !== undefined && (
                            <FileMeta>{bytesToString(fileSize)}</FileMeta>
                        )}
                    </FileInfo>
                    <HeaderActions>
                        <IconButton onClick={onDismissed} title="Close">
                            <FontAwesomeIcon icon={faTimes} />
                        </IconButton>
                    </HeaderActions>
                </Header>

                {onPrevious && (
                    <PrevButton onClick={onPrevious} disabled={!hasPrevious} title="Previous">
                        <FontAwesomeIcon icon={faChevronLeft} size="lg" />
                    </PrevButton>
                )}

                {onNext && (
                    <NextButton onClick={onNext} disabled={!hasNext} title="Next">
                        <FontAwesomeIcon icon={faChevronRight} size="lg" />
                    </NextButton>
                )}

                <MediaContainer onClick={onDismissed}>
                    {loading ? (
                        <LoadingOverlay>
                            <Spinner size="large" />
                        </LoadingOverlay>
                    ) : mediaUrl ? (
                        <>
                            {mediaType === 'image' && (
                                <MediaImage 
                                    src={mediaUrl} 
                                    alt={fileName} 
                                    onClick={(e) => e.stopPropagation()}
                                />
                            )}
                            {mediaType === 'video' && (
                                <MediaVideo 
                                    src={mediaUrl} 
                                    controls 
                                    autoPlay
                                    onClick={(e) => e.stopPropagation()}
                                />
                            )}
                            {mediaType === 'audio' && (
                                <MediaAudio onClick={(e) => e.stopPropagation()}>
                                    <AudioIcon>🎵</AudioIcon>
                                    <FileName>{fileName}</FileName>
                                    <audio src={mediaUrl} controls autoPlay />
                                </MediaAudio>
                            )}
                        </>
                    ) : (
                        <div style={{ color: 'white' }}>Failed to load media</div>
                    )}
                </MediaContainer>
            </Container>
        </Overlay>
    );
};

export default MediaViewerModal;
