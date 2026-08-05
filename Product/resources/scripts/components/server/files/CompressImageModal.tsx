import React from 'react';
import axios from 'axios';
import Modal, { RequiredModalProps } from '@/components/elements/Modal';
import { Form, Formik, FormikHelpers } from 'formik';
import Field from '@/components/elements/Field';
import { join } from 'pathe';
import { ServerContext } from '@/state/server';
import tw from 'twin.macro';
import Button from '@/components/elements/Button';
import useFileManagerSwr from '@/plugins/useFileManagerSwr';
import useFlash from '@/plugins/useFlash';
import getFileDownloadUrl from '@/api/server/files/getFileDownloadUrl';
import getFileUploadUrl from '@/api/server/files/getFileUploadUrl';
import deleteFiles from '@/api/server/files/deleteFiles';
import renameFiles from '@/api/server/files/renameFiles';
import { FileObject } from '@/api/server/files/loadDirectory';

interface FormikValues {
    targetSize: string;
}

type OwnProps = RequiredModalProps & { file: FileObject };

const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const parseTargetSize = (input: string): number | null => {
    const match = input.toLowerCase().trim().match(/^(\d+(?:\.\d+)?)\s*(kb|mb|b)?$/);
    if (!match) return null;

    const value = parseFloat(match[1]);
    const unit = match[2] || 'b';

    switch (unit) {
        case 'b': return value;
        case 'kb': return value * 1024;
        case 'mb': return value * 1024 * 1024;
        default: return value;
    }
};

const compressImageFromBlob = async (
    imageBlob: Blob,
    targetBytes: number
): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const blobUrl = URL.createObjectURL(imageBlob);
        const img = new Image();

        img.onload = () => {
            URL.revokeObjectURL(blobUrl);

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            const width = img.naturalWidth;
            const height = img.naturalHeight;

            const tryCompress = (quality: number, scale: number): Blob => {
                const scaledWidth = Math.max(1, Math.round(width * scale));
                const scaledHeight = Math.max(1, Math.round(height * scale));

                canvas.width = scaledWidth;
                canvas.height = scaledHeight;
                ctx.clearRect(0, 0, scaledWidth, scaledHeight);
                ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                const binaryString = atob(dataUrl.split(',')[1]);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                return new Blob([bytes], { type: 'image/jpeg' });
            };

            const fullSize = tryCompress(0.95, 1);
            if (fullSize.size <= targetBytes) {
                resolve(fullSize);
                return;
            }

            let lo = 0.05;
            let hi = 0.95;
            let bestBlob: Blob | null = null;

            for (let i = 0; i < 12; i++) {
                const mid = (lo + hi) / 2;
                const blob = tryCompress(mid, 1);
                if (blob.size <= targetBytes) {
                    bestBlob = blob;
                    lo = mid;
                } else {
                    hi = mid;
                }
            }

            if (bestBlob) {
                resolve(bestBlob);
                return;
            }

            lo = 0.1;
            hi = 1.0;
            bestBlob = null;

            for (let i = 0; i < 12; i++) {
                const mid = (lo + hi) / 2;
                const blob = tryCompress(0.15, mid);
                if (blob.size <= targetBytes) {
                    bestBlob = blob;
                    lo = mid;
                } else {
                    hi = mid;
                }
            }

            if (bestBlob) {
                resolve(bestBlob);
                return;
            }

            reject(new Error(`Cannot compress below ${formatFileSize(tryCompress(0.05, 0.1).size)}. Try a larger target size.`));
        };

        img.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            reject(new Error('Failed to load image'));
        };

        img.src = blobUrl;
    });
};

const getCompressedName = (originalName: string): string => {
    const dotIndex = originalName.lastIndexOf('.');
    if (dotIndex === -1) return `${originalName}.jpg`;
    const base = originalName.substring(0, dotIndex);
    const ext = originalName.substring(dotIndex + 1).toLowerCase();
    if (ext === 'jpg' || ext === 'jpeg') return originalName;
    return `${base}.jpg`;
};

const CompressImageModal = ({ file, ...props }: OwnProps) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { mutate } = useFileManagerSwr();
    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const directory = ServerContext.useStoreState((state) => state.files.directory);

    const submit = async (
        { targetSize }: FormikValues,
        { setSubmitting }: FormikHelpers<FormikValues>
    ) => {
        clearFlashes('files');

        const targetBytes = parseTargetSize(targetSize);
        if (!targetBytes || targetBytes < 100) {
            clearAndAddHttpError({ key: 'files', error: { message: 'Target size must be at least 100 bytes. Use formats like 500KB, 1MB, or 200000' } });
            setSubmitting(false);
            return;
        }

        try {
            const downloadUrl = await getFileDownloadUrl(uuid, join(directory, file.name));

            const response = await axios.get(downloadUrl, { responseType: 'blob' });
            const imageBlob = response.data as Blob;

            if (imageBlob.size <= targetBytes) {
                clearAndAddHttpError({ key: 'files', error: { message: `Image is already ${formatFileSize(imageBlob.size)}, which is under your target of ${formatFileSize(targetBytes)}.` } });
                setSubmitting(false);
                return;
            }

            const compressedBlob = await compressImageFromBlob(imageBlob, targetBytes);
            const finalName = getCompressedName(file.name);
            const tempName = `.compressed_${Date.now()}_${finalName}`;

            const uploadUrl = await getFileUploadUrl(uuid);
            const compressedFile = new File([compressedBlob], tempName, { type: 'image/jpeg' });

            await axios.post(
                uploadUrl,
                { files: compressedFile },
                {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    params: { directory },
                }
            );

            try {
                await deleteFiles(uuid, directory, [file.name]);
                await renameFiles(uuid, directory, [{ from: tempName, to: finalName }]);
            } catch (renameError: any) {
                try {
                    await renameFiles(uuid, directory, [{ from: tempName, to: finalName }]);
                } catch {
                    clearAndAddHttpError({
                        key: 'files',
                        error: { message: `Compressed file saved as "${tempName}" but failed to replace original. Please rename it manually.` },
                    });
                    setSubmitting(false);
                    await mutate();
                    return;
                }
            }

            await mutate();
            props.onDismissed();
        } catch (error: any) {
            clearAndAddHttpError({ key: 'files', error: error?.message ? { message: error.message } : error });
            setSubmitting(false);
        }
    };

    const defaultTarget = file.size > 1024 * 1024
        ? `${Math.max(1, Math.floor(file.size / 1024 / 1024 * 0.5))}MB`
        : `${Math.max(1, Math.floor(file.size / 1024 * 0.5))}KB`;

    const willChangeExtension = (() => {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        return ext !== 'jpg' && ext !== 'jpeg';
    })();

    return (
        <Formik onSubmit={submit} initialValues={{ targetSize: defaultTarget }}>
            {({ isSubmitting }) => (
                <Modal {...props} dismissable={!isSubmitting} showSpinnerOverlay={isSubmitting}>
                    <Form css={tw`m-0`}>
                        <h3 css={tw`text-lg font-medium mb-2`} style={{ color: 'var(--color-base)' }}>
                            Compress Image
                        </h3>
                        <p css={tw`text-sm mb-4`} style={{ color: 'var(--color-muted)' }}>
                            Current size: {formatFileSize(file.size)}
                            {willChangeExtension && (
                                <span css={tw`block mt-1`} style={{ color: '#eab308' }}>
                                    Output will be converted to JPEG ({getCompressedName(file.name)})
                                </span>
                            )}
                        </p>

                        <Field
                            type="text"
                            id="target_size"
                            name="targetSize"
                            label="Target Size"
                            description="e.g. 500KB, 1MB, or 200000 (bytes)"
                            autoFocus
                        />

                        <div css={tw`flex justify-end gap-3 mt-6`}>
                            <Button
                                type="button"
                                color="grey"
                                isSecondary
                                onClick={() => props.onDismissed()}
                            >
                                Cancel
                            </Button>
                            <Button type="submit">
                                Compress
                            </Button>
                        </div>
                    </Form>
                </Modal>
            )}
        </Formik>
    );
};

export default CompressImageModal;
