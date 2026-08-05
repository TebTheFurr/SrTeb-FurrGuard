import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import tw from 'twin.macro';
import Button from '@/components/elements/Button';
import asModal from '@/hoc/asModal';
import ModalContext from '@/context/ModalContext';
import CopyOnClick from '@/components/elements/CopyOnClick';

interface Props {
    apiKey: string;
}

const ApiKeyModal = ({ apiKey }: Props) => {
    const { t } = useTranslation('account');
    const { dismiss } = useContext(ModalContext);

    return (
        <>
            <h3 css={tw`mb-6 text-2xl`} style={{ color: 'var(--color-base)' }}>{t('api.key_created')}</h3>
            <p css={tw`text-sm mb-6`} style={{ color: 'var(--color-muted)' }}>
                {t('api.key_created_message')}
            </p>
            <pre
                className="text-sm py-2 px-4 font-mono"
                style={{
                    backgroundColor: 'var(--color-background-secondary)',
                    border: '1px solid var(--color-neutral)',
                    borderRadius: 'var(--border-radius, 8px)',
                    color: 'var(--color-base)',
                }}
            >
                <CopyOnClick text={apiKey}>
                    <code css={tw`font-mono`}>{apiKey}</code>
                </CopyOnClick>
            </pre>
            <div css={tw`flex justify-end mt-6`}>
                <Button type={'button'} onClick={() => dismiss()}>
                    {t('api.close')}
                </Button>
            </div>
        </>
    );
};

ApiKeyModal.displayName = 'ApiKeyModal';

export default asModal<Props>({
    closeOnEscape: false,
    closeOnBackground: false,
})(ApiKeyModal);
