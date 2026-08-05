import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolderPlus } from '@fortawesome/free-solid-svg-icons';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { createFolder } from '@/api/folders';
import { Dialog } from '@/components/elements/dialog';
import Input from '@/components/elements/Input';

interface Props {
    parentId?: number | null;
    onCreated: () => void;
}

const CreateButton = styled.button`
    ${tw`flex items-center justify-center p-4 rounded-lg transition-all duration-150 w-full`};
    background-color: transparent;
    border: 2px dashed var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    color: var(--color-muted);

    &:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
        background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
    }
`;

const ColorPicker = styled.input`
    ${tw`w-10 h-10 rounded-lg cursor-pointer`};
    border: 2px solid var(--color-neutral);
    padding: 2px;
    background-color: var(--color-background-secondary);

    &::-webkit-color-swatch-wrapper {
        padding: 0;
    }

    &::-webkit-color-swatch {
        border: none;
        border-radius: 6px;
    }
`;

const defaultColors = [
    '#4F46E5',
    '#7C3AED',
    '#EC4899',
    '#EF4444',
    '#F97316',
    '#EAB308',
    '#22C55E',
    '#06B6D4',
    '#3B82F6',
    '#6B7280',
];

export default ({ parentId, onCreated }: Props) => {
    const { t } = useTranslation('dashboard');
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [color, setColor] = useState(defaultColors[0]);

    const normaliseSlug = (value: string): string =>
        value
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

    const handleCreate = async () => {
        if (!name.trim()) return;

        try {
            await createFolder({
                name,
                slug: normaliseSlug(slug) || null,
                color,
                parent_id: parentId,
            });
            setIsOpen(false);
            setName('');
            setSlug('');
            setColor(defaultColors[0]);
            onCreated();
        } catch (error) {
            console.error('Failed to create folder:', error);
        }
    };

    return (
        <>
            <CreateButton onClick={() => setIsOpen(true)}>
                <FontAwesomeIcon icon={faFolderPlus} className="mr-2" />
                {t('folders.create')}
            </CreateButton>

            <Dialog.Confirm
                open={isOpen}
                title={parentId ? t('folders.create_subfolder') : t('folders.create')}
                confirm={t('folders.create_confirm')}
                onClose={() => setIsOpen(false)}
                onConfirmed={handleCreate}
            >
                <div className="space-y-4">
                    <div>
                        <label className="text-sm mb-2 block" style={{ color: 'var(--color-muted)' }}>
                            {t('folders.name')}
                        </label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t('folders.placeholder')}
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="text-sm mb-2 block" style={{ color: 'var(--color-muted)' }}>
                            Slug
                        </label>
                        <Input
                            value={slug}
                            onChange={(e) => setSlug(normaliseSlug(e.target.value))}
                            placeholder="folder-slug"
                        />
                    </div>
                    <div>
                        <label className="text-sm mb-2 block" style={{ color: 'var(--color-muted)' }}>
                            {t('folders.color')}
                        </label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {defaultColors.map((c) => (
                                <button
                                    key={c}
                                    onClick={() => setColor(c)}
                                    className="w-8 h-8 rounded-lg transition-all"
                                    style={{
                                        backgroundColor: c,
                                        border: color === c ? '3px solid var(--color-base)' : '3px solid transparent',
                                        transform: color === c ? 'scale(1.1)' : 'scale(1)',
                                    }}
                                />
                            ))}
                        </div>
                        <div className="flex items-center gap-3">
                            <ColorPicker
                                type="color"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                            />
                            <Input
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                placeholder="#000000"
                                className="flex-1"
                            />
                        </div>
                    </div>
                </div>
            </Dialog.Confirm>
        </>
    );
};
