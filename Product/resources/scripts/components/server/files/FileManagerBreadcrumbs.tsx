import React, { useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import { NavLink, useLocation } from 'react-router-dom';
import { encodePathSegments, hashToPath } from '@/helpers';
import tw from 'twin.macro';
import styled from 'styled-components/macro';

interface Props {
    renderLeft?: JSX.Element;
    withinFileEditor?: boolean;
    isNewFile?: boolean;
    className?: string;
}

const BreadcrumbLink = styled(NavLink)`
    ${tw`px-1 no-underline transition-colors duration-150`};
    color: var(--color-base);

    &:hover {
        color: var(--color-primary);
    }
`;

export default ({ renderLeft, withinFileEditor, isNewFile, className }: Props) => {
    const [file, setFile] = useState<string | null>(null);
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const directory = ServerContext.useStoreState((state) => state.files.directory);
    const { hash } = useLocation();

    useEffect(() => {
        const path = hashToPath(hash);

        if (withinFileEditor && !isNewFile) {
            const name = path.split('/').pop() || null;
            setFile(name);
        }
    }, [withinFileEditor, isNewFile, hash]);

    const breadcrumbs = (): { name: string; path?: string }[] =>
        directory
            .split('/')
            .filter((directory) => !!directory)
            .map((directory, index, dirs) => {
                if (!withinFileEditor && index === dirs.length - 1) {
                    return { name: directory };
                }

                return { name: directory, path: `/${dirs.slice(0, index + 1).join('/')}` };
            });

    return (
        <div 
            className={`flex flex-grow-0 items-center text-sm overflow-x-hidden py-3 px-4 rounded-lg min-w-0 ${className || ''}`}
            style={{ 
                backgroundColor: 'var(--color-background-secondary)',
                border: '1px solid var(--color-neutral)',
                borderRadius: 'var(--border-radius, 8px)',
                color: 'var(--color-muted)'
            }}
        >
            {renderLeft}
            <span style={{ color: 'var(--color-inverted)' }}>/</span>
            <span className="px-1" style={{ color: 'var(--color-inverted)' }}>home</span>
            <span style={{ color: 'var(--color-inverted)' }}>/</span>
            <BreadcrumbLink to={`/server/${id}/files`}>
                container
            </BreadcrumbLink>
            <span style={{ color: 'var(--color-inverted)' }}>/</span>
            {breadcrumbs().map((crumb, index) =>
                crumb.path ? (
                    <React.Fragment key={index}>
                        <BreadcrumbLink to={`/server/${id}/files#${encodePathSegments(crumb.path)}`}>
                            {crumb.name}
                        </BreadcrumbLink>
                        <span style={{ color: 'var(--color-inverted)' }}>/</span>
                    </React.Fragment>
                ) : (
                    <span key={index} className="px-1" style={{ color: 'var(--color-muted)' }}>
                        {crumb.name}
                    </span>
                )
            )}
            {file && (
                <React.Fragment>
                    <span className="px-1" style={{ color: 'var(--color-muted)' }}>{file}</span>
                </React.Fragment>
            )}
        </div>
    );
};
