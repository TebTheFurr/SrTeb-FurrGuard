import React, { useContext, useEffect, useRef, useState } from 'react';
import { Form, Formik, FormikHelpers } from 'formik';
import { object, string } from 'yup';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload } from '@fortawesome/free-solid-svg-icons';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { Button } from '@/components/elements/button/index';
import Field from '@/components/elements/Field';
import FlashMessageRender from '@/components/FlashMessageRender';
import asDialog from '@/hoc/asDialog';
import { Dialog, DialogWrapperContext } from '@/components/elements/dialog';
import { ServerContext } from '@/state/server';
import useFileManagerSwr from '@/plugins/useFileManagerSwr';
import pullFile from '@/api/server/files/pullFile';
import useFlash, { useFlashKey } from '@/plugins/useFlash';
import { WithClassname } from '@/components/types';

interface Values {
    url: string;
    fileName: string;
    directory: string;
}

interface ImportDialogProps {
    onImported: () => void;
}

const extractExtensionFromUrl = (resourceUrl: string): string => {
    try {
        const parsed = new URL(resourceUrl);
        const name = decodeURIComponent(parsed.pathname.split('/').pop() || '');
        const parts = name.split('.');
        if (parts.length < 2) {
            return '';
        }

        const extension = (parts.pop() || '').trim().toLowerCase();
        return /^[a-z0-9]{1,16}$/.test(extension) ? extension : '';
    } catch {
        return '';
    }
};

const schema = object().shape({
    url: string().required('A URL is required.').url('Please enter a valid URL.'),
    fileName: string()
        .required('A file name is required.')
        .matches(/^[^/\\]+$/, 'File name cannot include path separators.'),
    directory: string().required('A destination directory is required.'),
});

const ProgressTrack = styled.div`
    ${tw`mt-4 w-full`};
    height: 10px;
    border-radius: 9999px;
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    overflow: hidden;
`;

const ProgressFill = styled.div<{ $progress: number }>`
    height: 100%;
    width: ${(props) => `${props.$progress}%`};
    transition: width 250ms ease;
    background-color: var(--color-primary);
`;

const StatusText = styled.p`
    ${tw`mt-2 text-sm`};
    color: var(--color-muted);
`;

const ImportFromUrlDialog = asDialog({
    title: 'Import from URL',
})<ImportDialogProps>(({ onImported }) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const currentDirectory = ServerContext.useStoreState((state) => state.files.directory);
    const { mutate } = useFileManagerSwr();
    const { close } = useContext(DialogWrapperContext);
    const { clearAndAddHttpError } = useFlashKey('files:import-url-modal');
    const { addFlash } = useFlash();
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const progressTimer = useRef<NodeJS.Timeout | null>(null);
    const closeTimer = useRef<NodeJS.Timeout | null>(null);

    const stopProgressTimer = () => {
        if (progressTimer.current) {
            clearInterval(progressTimer.current);
            progressTimer.current = null;
        }
    };

    useEffect(() => {
        return () => {
            stopProgressTimer();
            if (closeTimer.current) {
                clearTimeout(closeTimer.current);
                closeTimer.current = null;
            }
            clearAndAddHttpError();
        };
    }, []);

    const submit = async ({ url, fileName, directory }: Values, { setSubmitting }: FormikHelpers<Values>) => {
        if (isImporting) {
            return;
        }

        clearAndAddHttpError();
        setSubmitting(true);
        setIsImporting(true);
        setStatus('Starting import...');
        setProgress(12);

        progressTimer.current = setInterval(() => {
            setProgress((current) => {
                if (current >= 92) {
                    return current;
                }

                return Math.min(92, current + Math.max(1, Math.floor((92 - current) / 7)));
            });
        }, 300);

        const cleanedFileName = fileName.trim().replace(/\.[^./\\]+$/, '');
        const detectedExtension = extractExtensionFromUrl(url.trim());
        const resolvedFileName = detectedExtension ? `${cleanedFileName}.${detectedExtension}` : cleanedFileName;
        const targetDirectory = directory.trim() || '/';

        try {
            setStatus('Downloading remote file...');
            await pullFile(uuid, {
                url: url.trim(),
                directory: targetDirectory,
                filename: resolvedFileName || undefined,
                useHeader: true,
                foreground: true,
            });

            stopProgressTimer();
            setProgress(100);
            setStatus('Import complete.');
            await mutate();

            addFlash({
                key: 'files',
                type: 'success',
                title: 'Import complete',
                message: `File imported to ${targetDirectory}.`,
            });
            onImported();

            closeTimer.current = setTimeout(() => {
                close();
            }, 450);
        } catch (error) {
            stopProgressTimer();
            setStatus('Import failed.');
            clearAndAddHttpError(error as Error);
            setSubmitting(false);
            setIsImporting(false);
            return;
        }

        setSubmitting(false);
        setIsImporting(false);
    };

    return (
        <Formik
            onSubmit={submit}
            validationSchema={schema}
            enableReinitialize
            initialValues={{
                url: '',
                fileName: '',
                directory: currentDirectory,
            }}
        >
            {({ submitForm, isSubmitting }) => (
                <>
                    <FlashMessageRender key={'files:import-url-modal'} />
                    <Form css={tw`m-0`}>
                        <Field autoFocus id={'url'} name={'url'} label={'Resource URL'} disabled={isImporting} />
                        <Field
                            id={'fileName'}
                            name={'fileName'}
                            label={'File name'}
                            description={'Enter file name without extension.'}
                            disabled={isImporting}
                        />
                        <Field id={'directory'} name={'directory'} label={'Location'} disabled={isImporting} />
                        {(isImporting || progress > 0) && (
                            <>
                                <ProgressTrack>
                                    <ProgressFill $progress={progress} />
                                </ProgressTrack>
                                <StatusText>{status || 'Working...'}</StatusText>
                            </>
                        )}
                    </Form>
                    <Dialog.Footer>
                        <Button.Text className={'w-full sm:w-auto'} onClick={close} disabled={isImporting}>
                            Cancel
                        </Button.Text>
                        <Button className={'w-full sm:w-auto'} onClick={submitForm} disabled={isSubmitting || isImporting}>
                            {isImporting ? 'Importing...' : 'Import'}
                        </Button>
                    </Dialog.Footer>
                </>
            )}
        </Formik>
    );
});

export default ({ className }: WithClassname) => {
    const [open, setOpen] = useState(false);

    return (
        <>
            <ImportFromUrlDialog open={open} onClose={setOpen.bind(this, false)} onImported={() => undefined} />
            <Button
                variant={Button.Variants.Secondary}
                shape={Button.Shapes.IconSquare}
                size={Button.Sizes.Small}
                onClick={setOpen.bind(this, true)}
                className={className}
                title={'Import from URL'}
                aria-label={'Import from URL'}
                style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    minWidth: '2.5rem',
                    minHeight: '2.5rem',
                    padding: 0,
                    backgroundColor: 'var(--color-background-secondary)',
                    border: '1px solid var(--color-neutral)',
                }}
            >
                <FontAwesomeIcon icon={faUpload} className="w-4 h-4" />
            </Button>
        </>
    );
};
