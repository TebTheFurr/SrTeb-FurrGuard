import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import requestPasswordResetEmail from '@/api/auth/requestPasswordResetEmail';
import { httpErrorToHuman } from '@/api/http';
import LoginFormContainer from '@/components/auth/LoginFormContainer';
import { useStoreState } from 'easy-peasy';
import Field from '@/components/elements/Field';
import { Formik, FormikHelpers } from 'formik';
import { object, string } from 'yup';
import tw from 'twin.macro';
import Button from '@/components/elements/Button';
import Captcha, { CaptchaRef } from '@/components/elements/Captcha';
import useFlash from '@/plugins/useFlash';
import styled from 'styled-components/macro';
import { useTranslation } from 'react-i18next';

interface Values {
    email: string;
}

const BackLink = styled(Link)`
    ${tw`inline-flex items-center justify-center w-full text-sm no-underline transition-colors duration-150 mt-4`};
    color: var(--color-muted);

    &:hover {
        color: var(--color-primary);
    }
`;

const SubmitButton = styled(Button)`
    ${tw`w-full mt-6`};
    padding: 0.7rem 1rem;
    font-weight: 600;
`;

const CaptchaWrapper = styled.div`
    ${tw`mb-6 flex justify-center`};
`;

export default () => {
    const { t } = useTranslation('auth');
    const captchaRef = useRef<CaptchaRef>(null);
    const [token, setToken] = useState('');

    const { clearFlashes, addFlash } = useFlash();
    const captcha = useStoreState((state) => state.settings.data?.captcha ?? { enabled: false, provider: 'none', siteKey: '' });

    useEffect(() => {
        clearFlashes();
    }, []);

    const handleSubmission = ({ email }: Values, { setSubmitting, resetForm }: FormikHelpers<Values>) => {
        clearFlashes();

        if (captcha.enabled && !token) {
            addFlash({ type: 'error', title: t('error', 'Error'), message: t('captcha_required', 'Please complete the captcha verification.') });
            setSubmitting(false);
            return;
        }

        requestPasswordResetEmail(email, token)
            .then((response) => {
                resetForm();
                addFlash({ type: 'success', title: t('success', 'Success'), message: response });
            })
            .catch((error) => {
                console.error(error);
                addFlash({ type: 'error', title: t('error', 'Error'), message: httpErrorToHuman(error) });
            })
            .then(() => {
                setToken('');
                if (captchaRef.current) captchaRef.current.reset();

                setSubmitting(false);
            });
    };

    return (
        <Formik
            onSubmit={handleSubmission}
            initialValues={{ email: '' }}
            validationSchema={object().shape({
                email: string()
                    .email(t('validation.email_required', 'A valid email address must be provided to continue.'))
                    .required(t('validation.email_required', 'A valid email address must be provided to continue.')),
            })}
        >
            {({ isSubmitting, setSubmitting }) => (
                <LoginFormContainer 
                    title={t('forgot_password.title', 'Reset password')}
                    subtitle={t('forgot_password.subtitle', "We'll send you a link to reset your password")}
                >
                    <Field
                        label={t('email_address', 'Email Address')}
                        name={'email'}
                        type={'email'}
                    />
                    
                    {captcha.enabled && captcha.provider !== 'none' && (
                        <CaptchaWrapper>
                            <Captcha
                                ref={captchaRef}
                                provider={captcha.provider}
                                siteKey={captcha.siteKey || '_invalid_key'}
                                size="normal"
                                theme="auto"
                                onVerify={(response) => {
                                    setToken(response);
                                }}
                                onExpire={() => {
                                    setSubmitting(false);
                                    setToken('');
                                }}
                                onError={() => {
                                    setSubmitting(false);
                                    setToken('');
                                }}
                            />
                        </CaptchaWrapper>
                    )}

                    <SubmitButton type={'submit'} size={'xlarge'} disabled={isSubmitting || (captcha.enabled && !token)} isLoading={isSubmitting}>
                        {t('forgot_password.send_reset_link', 'Send Reset Link')}
                    </SubmitButton>

                    <BackLink to={'/auth/login'}>
                        {t('back_to_login', 'Back to login')}
                    </BackLink>
                </LoginFormContainer>
            )}
        </Formik>
    );
};
