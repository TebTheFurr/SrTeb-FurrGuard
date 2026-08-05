import React, { useEffect, useRef, useState } from 'react';
import { Link, RouteComponentProps } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import login from '@/api/auth/login';
import LoginFormContainer from '@/components/auth/LoginFormContainer';
import { useStoreState } from 'easy-peasy';
import { Formik, FormikHelpers } from 'formik';
import { object, string } from 'yup';
import Field from '@/components/elements/Field';
import tw from 'twin.macro';
import Button from '@/components/elements/Button';
import Captcha, { CaptchaRef } from '@/components/elements/Captcha';
import useFlash from '@/plugins/useFlash';
import styled from 'styled-components/macro';
import { ApplicationStore } from '@/state';
import OAuthButtons from '@/components/auth/OAuthButtons';

interface Values {
    username: string;
    password: string;
}

const InputGroup = styled.div`
    ${tw`mb-5`};
`;

const PasswordHeader = styled.div`
    ${tw`flex items-center justify-between mb-2`};
`;

const Label = styled.label`
    ${tw`block text-xs uppercase tracking-wide`};
    color: var(--color-inverted);
    font-weight: 500;
`;

const ForgotLink = styled(Link)`
    ${tw`text-xs no-underline transition-colors duration-150`};
    color: var(--color-primary);

    &:hover {
        text-decoration: underline;
    }
`;

const SubmitButton = styled(Button)`
    ${tw`w-full mt-6`};
    height: 44px;
    padding: 0.7rem 1rem;
    font-weight: 600;
`;

const RegisterLink = styled(Link)`
    ${tw`inline-flex items-center justify-center w-full text-sm no-underline transition-colors duration-150 mt-4`};
    color: var(--color-muted);

    &:hover {
        color: var(--color-primary);
    }
`;

const CaptchaWrapper = styled.div`
    ${tw`mt-4 mb-6 flex justify-center`};
`;

const LoginContainer = ({ history }: RouteComponentProps) => {
    const { t } = useTranslation('auth');
    const captchaRef = useRef<CaptchaRef>(null);
    const [token, setToken] = useState('');

    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const captcha = useStoreState((state) => state.settings.data?.captcha ?? { enabled: false, provider: 'none', siteKey: '' });
    const registrationEnabled = useStoreState((state: ApplicationStore) => state.settings.data?.components?.registrationEnabled ?? true);

    useEffect(() => {
        clearFlashes();
    }, []);

    const onSubmit = (values: Values, { setSubmitting }: FormikHelpers<Values>) => {
        clearFlashes();

        if (captcha.enabled && !token) {
            setSubmitting(false);
            clearAndAddHttpError({ 
                error: new Error(t('captcha_required', 'Please complete the captcha verification'))
            });
            return;
        }

        login({ ...values, captchaToken: token })
            .then((response) => {
                if (response.complete) {
                    // @ts-expect-error this is valid
                    window.location = response.intended || '/';
                    return;
                }

                history.replace('/auth/login/checkpoint', { token: response.confirmationToken });
            })
            .catch((error) => {
                console.error(error);

                setToken('');
                if (captchaRef.current) captchaRef.current.reset();

                setSubmitting(false);
                clearAndAddHttpError({ error });
            });
    };

    const isPrefillDomain = typeof window !== 'undefined' && window.location.hostname === 'luna-ptero.buzz.dev';
    const initialValues: Values = {
        username: isPrefillDomain ? 'demo@buzz.dev' : '',
        password: isPrefillDomain ? 'testtesttest' : '',
    };

    return (
        <Formik
            onSubmit={onSubmit}
            initialValues={initialValues}
            validationSchema={object().shape({
                username: string().required(t('username_required')),
                password: string().required(t('password_required')),
            })}
        >
            {({ isSubmitting, setSubmitting }) => (
                <LoginFormContainer 
                    title={t('sign_in')} 
                    subtitle={t('sign_in_subtitle')}
                >
                    <InputGroup>
                        <Field 
                            type={'text'} 
                            label={t('email_or_username')} 
                            name={'username'} 
                            disabled={isSubmitting} 
                        />
                    </InputGroup>
                    
                    <div>
                        <PasswordHeader>
                            <Label>{t('strings:password')}</Label>
                            <ForgotLink to={'/auth/password'}>
                                {t('forgot_password.label')}
                            </ForgotLink>
                        </PasswordHeader>
                        <Field 
                            type={'password'} 
                            name={'password'} 
                            disabled={isSubmitting} 
                        />
                    </div>

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
                                    setToken('');
                                    if (captchaRef.current) captchaRef.current.reset();
                                }}
                                onError={() => {
                                    setToken('');
                                    setSubmitting(false);
                                }}
                            />
                        </CaptchaWrapper>
                    )}

                    <SubmitButton 
                        type={'submit'} 
                        size={'xlarge'} 
                        isLoading={isSubmitting} 
                        disabled={isSubmitting || (captcha.enabled && !token)}
                    >
                        {t('sign_in')}
                    </SubmitButton>

                    <OAuthButtons />

                    {registrationEnabled && (
                        <RegisterLink to={'/auth/register'}>
                            New user? Register
                        </RegisterLink>
                    )}
                </LoginFormContainer>
            )}
        </Formik>
    );
};

export default LoginContainer;
