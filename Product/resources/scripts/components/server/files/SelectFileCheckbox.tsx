import React from 'react';
import tw from 'twin.macro';
import { ServerContext } from '@/state/server';
import styled from 'styled-components/macro';
import Input from '@/components/elements/Input';

export const FileActionCheckbox = styled(Input)`
    && {
        background-color: transparent;
        border-color: var(--color-neutral);

        &:not(:checked) {
            &:hover {
                border-color: var(--color-primary);
            }
        }
        
        &:checked {
            background-color: var(--color-primary);
            border-color: var(--color-primary);
        }
    }
`;

export default ({ name, disabled = false }: { name: string; disabled?: boolean }) => {
    const isChecked = ServerContext.useStoreState((state) => state.files.selectedFiles.indexOf(name) >= 0);
    const appendSelectedFile = ServerContext.useStoreActions((actions) => actions.files.appendSelectedFile);
    const removeSelectedFile = ServerContext.useStoreActions((actions) => actions.files.removeSelectedFile);

    return (
        <label css={tw`flex-none px-4 py-2 self-center`} className={disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}>
            <FileActionCheckbox
                name={'selectedFiles'}
                value={name}
                checked={isChecked}
                type={'checkbox'}
                disabled={disabled}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    if (disabled) return;

                    if (e.currentTarget.checked) {
                        appendSelectedFile(name);
                    } else {
                        removeSelectedFile(name);
                    }
                }}
            />
        </label>
    );
};
