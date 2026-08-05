import React, { useEffect, useRef, useState } from 'react';
import { Link, RouteComponentProps } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import register from '@/api/auth/register';
import LoginFormContainer from '@/components/auth/LoginFormContainer';
import { useStoreState } from 'easy-peasy';
import { Formik, FormikHelpers } from 'formik';
import { object, string, ref as yupRef } from 'yup';
import Field from '@/components/elements/Field';
import tw from 'twin.macro';
import Button from '@/components/elements/Button';
import Captcha, { CaptchaRef } from '@/components/elements/Captcha';
import useFlash from '@/plugins/useFlash';
import styled from 'styled-components/macro';
import { ApplicationStore } from '@/state';
import OAuthButtons from '@/components/auth/OAuthButtons';

interface Values {
    email: string;
    username: string;
    nameFirst: string;
    nameLast: string;
    password: string;
    passwordConfirmation: string;
}

const InputGroup = styled.div`
    ${tw`mb-5`};
`;

const NameRow = styled.div`
    ${tw`flex gap-4 mb-5`};

    > div {
        flex: 1;
    }
`;

const SubmitButton = styled(Button)`
    ${tw`w-full mt-6`};
    height: 44px;
    padding: 0.7rem 1rem;
    font-weight: 600;
`;

const BackLink = styled(Link)`
    ${tw`inline-flex items-center justify-center w-full text-sm no-underline transition-colors duration-150 mt-4`};
    color: var(--color-muted);

    &:hover {
        color: var(--color-primary);
    }
`;

const CaptchaWrapper = styled.div`
    ${tw`mb-6 flex justify-center`};
`;

const RegisterContainer = ({ history }: RouteComponentProps) => {
    const { t } = useTranslation('auth');
    const captchaRef = useRef<CaptchaRef>(null);
    const [token, setToken] = useState('');

    const { clearFlashes, clearAndAddHttpError, addFlash } = useFlash();
    const captcha = useStoreState((state) => state.settings.data?.captcha ?? { enabled: false, provider: 'none', siteKey: '' });
    const registrationEnabled = useStoreState((state: ApplicationStore) => state.settings.data?.components?.registrationEnabled ?? true);

    useEffect(() => {
        clearFlashes();
        
        if (!registrationEnabled) {
            history.replace('/auth/login');
        }
    }, [registrationEnabled]);

    const onSubmit = (values: Values, { setSubmitting, resetForm }: FormikHelpers<Values>) => {
        clearFlashes();

        if (captcha.enabled && !token) {
            setSubmitting(false);
            clearAndAddHttpError({
                error: new Error(t('captcha_required', 'Please complete the captcha verification'))
            });

            return;
        }

        register({ ...values, captchaToken: token })
            .then((response) => {
                resetForm();
                addFlash({ type: 'success', title: t('success', 'Success'), message: response.message });
            })
            .catch((error) => {
                console.error(error);
                setToken('');
                if (captchaRef.current) captchaRef.current.reset();
                setSubmitting(false);
                clearAndAddHttpError({ error });
            });
    };

    if (!registrationEnabled) {
        return null;
    }

    return (
        <Formik
            onSubmit={onSubmit}
            initialValues={{ email: '', username: '', nameFirst: '', nameLast: '', password: '', passwordConfirmation: '' }}
            validationSchema={object().shape({
                email: string()
                    .email(t('validation.email_valid', 'Please enter a valid email address'))
                    .required(t('validation.email_address_required', 'Email address is required')),
                username: string()
                    .min(3, t('validation.username_min', 'Username must be at least 3 characters'))
                    .max(255, t('validation.username_max', 'Username must be less than 255 characters'))
                    .matches(/^[a-zA-Z0-9_.-]+$/, t('validation.username_format', 'Username can only contain letters, numbers, underscores, dots, and hyphens'))
                    .required(t('validation.username_required', 'Username is required')),
                nameFirst: string()
                    .min(1, t('validation.first_name_required', 'First name is required'))
                    .max(255, t('validation.first_name_max', 'First name must be less than 255 characters'))
                    .required(t('validation.first_name_required', 'First name is required')),
                nameLast: string()
                    .min(1, t('validation.last_name_required', 'Last name is required'))
                    .max(255, t('validation.last_name_max', 'Last name must be less than 255 characters'))
                    .required(t('validation.last_name_required', 'Last name is required')),
                password: string()
                    .min(8, t('validation.password_min', 'Password must be at least 8 characters'))
                    .required(t('validation.password_required', 'Password is required')),
                passwordConfirmation: string()
                    .oneOf([yupRef('password')], t('validation.passwords_do_not_match', 'Passwords do not match'))
                    .required(t('validation.confirm_password_required', 'Please confirm your password')),
            })}
        >
            {({ isSubmitting, setSubmitting }) => (
                <LoginFormContainer
                    title={t('register.title', 'Create account')}
                    subtitle={t('register.subtitle', 'Enter your details to get started')}
                >
                    <InputGroup>
                        <Field
                            type={'email'}
                            label={t('email_address', 'Email Address')}
                            name={'email'}
                            disabled={isSubmitting}
                        />
                    </InputGroup>

                    <InputGroup>
                        <Field
                            type={'text'}
                            label={t('username', 'Username')}
                            name={'username'}
                            disabled={isSubmitting}
                        />
                    </InputGroup>

                    <NameRow>
                        <div>
                            <Field
                                type={'text'}
                                label={t('first_name', 'First Name')}
                                name={'nameFirst'}
                                disabled={isSubmitting}
                            />
                        </div>
                        <div>
                            <Field
                                type={'text'}
                                label={t('last_name', 'Last Name')}
                                name={'nameLast'}
                                disabled={isSubmitting}
                            />
                        </div>
                    </NameRow>

                    <InputGroup>
                        <Field
                            type={'password'}
                            label={t('password', 'Password')}
                            name={'password'}
                            disabled={isSubmitting}
                        />
                    </InputGroup>

                    <InputGroup>
                        <Field
                            type={'password'}
                            label={t('confirm_password', 'Confirm Password')}
                            name={'passwordConfirmation'}
                            disabled={isSubmitting}
                        />
                    </InputGroup>

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

                    <SubmitButton
                        type={'submit'}
                        size={'xlarge'}
                        isLoading={isSubmitting}
                        disabled={isSubmitting || (captcha.enabled && !token)}
                    >
                        {t('register.submit', 'Create Account')}
                    </SubmitButton>

                    <OAuthButtons label={'Sign up with'} />

                    <BackLink to={'/auth/login'}>
                        {t('register.sign_in', 'Already have an account? Sign in')}
                    </BackLink>
                </LoginFormContainer>
            )}
        </Formik>
    );
};

export default RegisterContainer;
