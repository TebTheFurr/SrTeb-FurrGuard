import React, { useState } from 'react';
import { Link, RouteComponentProps } from 'react-router-dom';
import loginCheckpoint from '@/api/auth/loginCheckpoint';
import LoginFormContainer from '@/components/auth/LoginFormContainer';
import { ActionCreator } from 'easy-peasy';
import { StaticContext } from 'react-router';
import { useFormikContext, withFormik } from 'formik';
import useFlash from '@/plugins/useFlash';
import { FlashStore } from '@/state/flashes';
import Field from '@/components/elements/Field';
import tw from 'twin.macro';
import Button from '@/components/elements/Button';
import styled from 'styled-components/macro';
import { useTranslation } from 'react-i18next';

interface Values {
    code: string;
    recoveryCode: '';
}

type OwnProps = RouteComponentProps<Record<string, string | undefined>, StaticContext, { token?: string }>;

type Props = OwnProps & {
    clearAndAddHttpError: ActionCreator<FlashStore['clearAndAddHttpError']['payload']>;
};

const ToggleButton = styled.button`
    ${tw`text-sm transition-colors duration-150`};
    color: var(--color-muted);
    background: none;
    border: none;
    cursor: pointer;

    &:hover {
        color: var(--color-primary);
    }
`;

const BackLink = styled(Link)`
    ${tw`text-sm no-underline transition-colors duration-150`};
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

const ActionsWrapper = styled.div`
    ${tw`flex flex-col items-center gap-3 mt-4`};
`;

const LoginCheckpointContainer = () => {
    const { t } = useTranslation('auth');
    const { isSubmitting, setFieldValue } = useFormikContext<Values>();
    const [isMissingDevice, setIsMissingDevice] = useState(false);

    return (
        <LoginFormContainer 
            title={t('two_factor.title', 'Two-factor authentication')}
            subtitle={isMissingDevice
                ? t('two_factor.recovery_subtitle', 'Enter a recovery code')
                : t('two_factor.authenticator_subtitle', 'Enter the code from your authenticator app')
            }
        >
            <Field
                name={isMissingDevice ? 'recoveryCode' : 'code'}
                label={isMissingDevice ? t('two_factor.recovery_code', 'Recovery Code') : t('two_factor.authentication_code', 'Authentication Code')}
                type={'text'}
                autoComplete={'one-time-code'}
                autoFocus
            />
            
            <SubmitButton size={'xlarge'} type={'submit'} disabled={isSubmitting} isLoading={isSubmitting}>
                {t('two_factor.verify', 'Verify')}
            </SubmitButton>

            <ActionsWrapper>
                <ToggleButton
                    type="button"
                    onClick={() => {
                        setFieldValue('code', '');
                        setFieldValue('recoveryCode', '');
                        setIsMissingDevice((s) => !s);
                    }}
                >
                    {!isMissingDevice ? t('two_factor.lost_device', 'Lost your device?') : t('two_factor.have_device', 'Have your device?')}
                </ToggleButton>

                <BackLink to={'/auth/login'}>
                    {t('back_to_login', 'Back to login')}
                </BackLink>
            </ActionsWrapper>
        </LoginFormContainer>
    );
};

const EnhancedForm = withFormik<Props, Values>({
    handleSubmit: ({ code, recoveryCode }, { setSubmitting, props: { clearAndAddHttpError, location } }) => {
        loginCheckpoint(location.state?.token || '', code, recoveryCode)
            .then((response) => {
                if (response.complete) {
                    // @ts-expect-error this is valid
                    window.location = response.intended || '/';
                    return;
                }

                setSubmitting(false);
            })
            .catch((error) => {
                console.error(error);
                setSubmitting(false);
                clearAndAddHttpError({ error });
            });
    },

    mapPropsToValues: () => ({
        code: '',
        recoveryCode: '',
    }),
})(LoginCheckpointContainer);

export default ({ history, location, ...props }: OwnProps) => {
    const { clearAndAddHttpError } = useFlash();

    if (!location.state?.token) {
        history.replace('/auth/login');

        return null;
    }

    return (
        <EnhancedForm clearAndAddHttpError={clearAndAddHttpError} history={history} location={location} {...props} />
    );
};
