import React, { useState } from 'react';
import { RouteComponentProps } from 'react-router';
import { Link } from 'react-router-dom';
import performPasswordReset from '@/api/auth/performPasswordReset';
import { httpErrorToHuman } from '@/api/http';
import LoginFormContainer from '@/components/auth/LoginFormContainer';
import { Actions, useStoreActions } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import { Formik, FormikHelpers } from 'formik';
import { object, ref, string } from 'yup';
import Field from '@/components/elements/Field';
import tw from 'twin.macro';
import Button from '@/components/elements/Button';
import styled from 'styled-components/macro';
import { useTranslation } from 'react-i18next';

interface Values {
    password: string;
    passwordConfirmation: string;
}

const InputGroup = styled.div`
    ${tw`mb-5`};
`;

const Label = styled.label`
    ${tw`block text-xs uppercase tracking-wide mb-2`};
    color: var(--color-inverted);
    font-weight: 500;
`;

const EmailDisplay = styled.div`
    ${tw`p-3 rounded-lg text-sm`};
    background: var(--color-background);
    border: 1px solid var(--color-neutral);
    color: var(--color-muted);
`;

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

export default ({ match, location }: RouteComponentProps<{ token: string }>) => {
    const { t } = useTranslation('auth');
    const [email, setEmail] = useState('');

    const { clearFlashes, addFlash } = useStoreActions((actions: Actions<ApplicationStore>) => actions.flashes);

    const parsed = new URLSearchParams(location.search);
    if (email.length === 0 && parsed.get('email')) {
        setEmail(parsed.get('email') || '');
    }

    const submit = ({ password, passwordConfirmation }: Values, { setSubmitting }: FormikHelpers<Values>) => {
        clearFlashes();
        performPasswordReset(email, { token: match.params.token, password, passwordConfirmation })
            .then(() => {
                // @ts-expect-error this is valid
                window.location = '/';
            })
            .catch((error) => {
                console.error(error);

                setSubmitting(false);
                addFlash({ type: 'error', title: t('error', 'Error'), message: httpErrorToHuman(error) });
            });
    };

    return (
        <Formik
            onSubmit={submit}
            initialValues={{
                password: '',
                passwordConfirmation: '',
            }}
            validationSchema={object().shape({
                password: string()
                    .required(t('validation.new_password_required', 'A new password is required.'))
                    .min(8, t('validation.new_password_min', 'Your new password should be at least 8 characters in length.')),
                passwordConfirmation: string()
                    .required(t('validation.password_mismatch', 'Your new password does not match.'))
                    // @ts-expect-error this is valid
                    .oneOf([ref('password'), null], t('validation.password_mismatch', 'Your new password does not match.')),
            })}
        >
            {({ isSubmitting }) => (
                <LoginFormContainer 
                    title={t('reset_password.title', 'Create new password')}
                    subtitle={t('reset_password.subtitle', 'Choose a strong password for your account')}
                >
                    <InputGroup>
                        <Label>{t('email', 'Email')}</Label>
                        <EmailDisplay>{email}</EmailDisplay>
                    </InputGroup>
                    
                    <InputGroup>
                        <Field
                            label={t('new_password', 'New Password')}
                            name={'password'}
                            type={'password'}
                            description={t('at_least_8_chars', 'At least 8 characters')}
                        />
                    </InputGroup>
                    
                    <Field 
                        label={t('confirm_password', 'Confirm Password')}
                        name={'passwordConfirmation'} 
                        type={'password'} 
                    />

                    <SubmitButton size={'xlarge'} type={'submit'} disabled={isSubmitting} isLoading={isSubmitting}>
                        {t('reset_password.button', 'Reset Password')}
                    </SubmitButton>

                    <BackLink to={'/auth/login'}>
                        {t('back_to_login', 'Back to login')}
                    </BackLink>
                </LoginFormContainer>
            )}
        </Formik>
    );
};
