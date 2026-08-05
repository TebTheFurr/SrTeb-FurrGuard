import React from 'react';
import { useTranslation } from 'react-i18next';
import { ServerContext } from '@/state/server';
import { Form, Formik, FormikHelpers, useFormikContext } from 'formik';
import { Actions, useStoreActions } from 'easy-peasy';
import renameServer from '@/api/server/renameServer';
import Field from '@/components/elements/Field';
import { object, string } from 'yup';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import { ApplicationStore } from '@/state';
import { httpErrorToHuman } from '@/api/http';
import { Button } from '@/components/elements/button/index';
import tw from 'twin.macro';
import styled from 'styled-components/macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen } from '@fortawesome/free-solid-svg-icons';

interface Values {
    name: string;
    description: string;
    ipAlias: string;
}

const Card = styled.div`
    background: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    overflow: hidden;
`;

const CardHeader = styled.div`
    ${tw`px-5 py-4 flex items-center gap-3`};
    border-bottom: 1px solid var(--color-neutral);
`;

const CardBody = styled.div`
    ${tw`p-5`};
    position: relative;
`;

const FormGrid = styled.div`
    ${tw`grid gap-5`};
    grid-template-columns: 1fr;

    @media (min-width: 768px) {
        grid-template-columns: 1fr 1fr;
    }
`;

const InputGroup = styled.div`
    ${tw`flex flex-col`};
`;

const CardFooter = styled.div`
    ${tw`px-5 py-4 flex items-center justify-end`};
    background: color-mix(in srgb, var(--color-neutral) 30%, transparent);
    border-top: 1px solid var(--color-neutral);
`;

const RenameServerBox = () => {
    const { t } = useTranslation('server');
    const { isSubmitting } = useFormikContext<Values>();

    return (
        <Form>
            <Card>
                <CardHeader>
                    <FontAwesomeIcon icon={faPen} style={{ color: 'var(--color-primary)' }} />
                    <span className="font-medium" style={{ color: 'var(--color-base)' }}>
                        {t('settings.rename.title')}
                    </span>
                </CardHeader>
                <CardBody>
                    <SpinnerOverlay visible={isSubmitting} />
                    <FormGrid>
                        <InputGroup>
                            <Field 
                                id={'name'} 
                                name={'name'} 
                                label={t('settings.rename.server_name')} 
                                type={'text'} 
                            />
                        </InputGroup>
                        <InputGroup>
                            <Field 
                                id={'description'} 
                                name={'description'} 
                                label={t('settings.rename.description')} 
                                type={'text'} 
                            />
                        </InputGroup>
                    </FormGrid>
                    <div css={tw`mt-5`}>
                        <Field 
                            id={'ipAlias'} 
                            name={'ipAlias'} 
                            label={'IP Alias'} 
                            type={'text'}
                            description={'Optional display name for your server IP (e.g., play.minecraftserver.net)'}
                        />
                    </div>
                </CardBody>
                <CardFooter>
                    <Button type={'submit'} disabled={isSubmitting}>
                        {t('settings.rename.save')}
                    </Button>
                </CardFooter>
            </Card>
        </Form>
    );
};

export default () => {
    const server = ServerContext.useStoreState((state) => state.server.data!);
    const setServer = ServerContext.useStoreActions((actions) => actions.server.setServer);
    const { addError, clearFlashes } = useStoreActions((actions: Actions<ApplicationStore>) => actions.flashes);

    const primaryAllocation = server.allocations.find((a) => a.isDefault) ?? server.allocations[0];

    const submit = ({ name, description, ipAlias }: Values, { setSubmitting }: FormikHelpers<Values>) => {
        clearFlashes('settings');
        renameServer(server.uuid, name, description, ipAlias)
            .then(() => {
                const updatedAllocations = server.allocations.map((a) =>
                    a.isDefault ? { ...a, alias: ipAlias || null } : a
                );
                setServer({ ...server, name, description, allocations: updatedAllocations });
            })
            .catch((error) => {
                console.error(error);
                addError({ key: 'settings', message: httpErrorToHuman(error) });
            })
            .then(() => setSubmitting(false));
    };

    return (
        <Formik
            onSubmit={submit}
            initialValues={{
                name: server.name,
                description: server.description,
                ipAlias: primaryAllocation?.alias || '',
            }}
            validationSchema={object().shape({
                name: string().required().min(1),
                description: string().nullable(),
                ipAlias: string().nullable(),
            })}
        >
            <RenameServerBox />
        </Formik>
    );
};
