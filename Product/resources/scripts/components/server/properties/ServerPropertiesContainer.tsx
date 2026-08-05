import React, { useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import ContentContainer from '@/components/elements/ContentContainer';
import PageContentBlock from '@/components/elements/PageContentBlock';
import tw from 'twin.macro';
import { faQuestionCircle, faSave, faSearch, faFileCode } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import http from '@/api/http';
import useFlash from '@/plugins/useFlash';
import FlashMessageRender from '@/components/FlashMessageRender';
import Spinner from '@/components/elements/Spinner';
import Button from '@/components/elements/Button';
import { ApplicationStore } from '@/state';
import { useStoreState } from 'easy-peasy';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';

interface PropertyDefinition {
    key: string;
    label: string;
    type: 'text' | 'number' | 'boolean' | 'select';
    default: string;
    description: string;
    min?: number;
    max?: number;
    options?: Array<{ value: string; label: string }>;
}

interface ServerPropertiesData {
    properties: Record<string, string>;
    definitions: PropertyDefinition[];
    accessMode: {
        file: boolean;
        sidebar: boolean;
    };
}

const normaliseDefinitionList = (raw: unknown): PropertyDefinition[] => {
    if (raw == null) {
        return [];
    }
    if (typeof raw === 'string') {
        try {
            return normaliseDefinitionList(JSON.parse(raw));
        } catch {
            return [];
        }
    }
    if (Array.isArray(raw)) {
        return raw as PropertyDefinition[];
    }
    if (typeof raw === 'object') {
        return Object.values(raw as Record<string, PropertyDefinition>);
    }
    return [];
};

const extractServerPropertiesPayload = (body: unknown): Record<string, unknown> => {
    if (!body || typeof body !== 'object') {
        return {};
    }
    const o = body as Record<string, unknown>;
    if ('properties' in o || 'definitions' in o) {
        return o;
    }
    const attrs = o.attributes;
    if (attrs && typeof attrs === 'object' && ('properties' in attrs || 'definitions' in attrs)) {
        return attrs as Record<string, unknown>;
    }
    const inner = o.data;
    if (inner && typeof inner === 'object') {
        const d = inner as Record<string, unknown>;
        if ('properties' in d || 'definitions' in d) {
            return d;
        }
        const innerAttrs = d.attributes;
        if (innerAttrs && typeof innerAttrs === 'object' && ('properties' in innerAttrs || 'definitions' in innerAttrs)) {
            return innerAttrs as Record<string, unknown>;
        }
    }
    return o;
};

const cardStyle = {
    backgroundColor: 'var(--color-background-secondary)',
    border: '1px solid var(--color-neutral)',
    borderRadius: 'var(--border-radius, 12px)',
    padding: '1.5rem'
};

const searchInputStyle = {
    width: '100%',
    padding: '0.75rem 1rem 0.75rem 2.75rem',
    backgroundColor: 'var(--color-background)',
    border: '1px solid var(--color-neutral)',
    borderRadius: 'var(--border-radius, 10px)',
    fontSize: '0.875rem',
    color: 'var(--color-base)',
    outline: 'none',
    transition: 'border-color 150ms',
};

const propertySections: Array<{
    type: PropertyDefinition['type'];
    title: string;
}> = [
        { type: 'boolean', title: 'Options' },
        { type: 'text', title: 'Options' },
        { type: 'number', title: 'Options' },
        { type: 'select', title: 'Options' },
    ];

const PropertyInput: React.FC<{
    definition: PropertyDefinition;
    value: string;
    onChange: (value: string) => void;
}> = ({ definition, value, onChange }) => {
    const { t } = useTranslation('server');
    const [showTooltip, setShowTooltip] = useState(false);

    const inputStyle = {
        width: '100%',
        padding: '0.5rem 0.75rem',
        backgroundColor: 'var(--color-background-secondary)',
        border: '1px solid var(--color-neutral)',
        borderRadius: 'var(--border-radius, 8px)',
        fontSize: '0.875rem',
        color: 'var(--color-base)',
        outline: 'none',
        transition: 'border-color 150ms',
    };

    return (
        <div css={tw`mb-4`}>
            <label css={tw`flex items-center gap-2 mb-2 text-sm font-medium`} style={{ color: 'var(--color-base)' }}>
                <span>{definition.label}</span>
                <div css={tw`relative`} onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
                    <FontAwesomeIcon
                        icon={faQuestionCircle}
                        css={tw`cursor-help text-xs`}
                        style={{ color: 'var(--color-muted)' }}
                    />
                    {showTooltip && (
                        <div
                            css={tw`absolute left-0 top-full mt-1 w-64 p-3 shadow-lg text-xs z-50`}
                            style={{
                                backgroundColor: 'var(--color-background)',
                                border: '1px solid var(--color-neutral)',
                                borderRadius: 'var(--border-radius, 8px)',
                                color: 'var(--color-base)',
                            }}
                        >
                            {definition.description}
                        </div>
                    )}
                </div>
            </label>

            {definition.type === 'boolean' ? (
                <div css={tw`flex items-center`}>
                    <label css={tw`relative inline-flex items-center cursor-pointer`}>
                        <input
                            type="checkbox"
                            checked={value === 'true'}
                            onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
                            className="sr-only peer"
                        />
                        <div
                            className="peer w-11 h-6 rounded-full transition-colors after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"
                            style={{
                                backgroundColor: value === 'true' ? 'var(--color-primary)' : 'var(--color-neutral)',
                            }}
                        />
                    </label>
                    <span css={tw`ml-3 text-sm`} style={{ color: 'var(--color-muted)' }}>
                        {value === 'true' ? t('properties.enabled', 'Enabled') : t('properties.disabled', 'Disabled')}
                    </span>
                </div>
            ) : definition.type === 'select' ? (
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--color-neutral)'}
                >
                    {definition.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            ) : definition.type === 'number' ? (
                <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    min={definition.min}
                    max={definition.max}
                    style={inputStyle}
                    onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-neutral)'}
                />
            ) : (
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    style={inputStyle}
                    placeholder={definition.default}
                    onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-neutral)'}
                />
            )}
        </div>
    );
};

const ServerPropertiesContainer = () => {
    const { t } = useTranslation('server');
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const eggId = ServerContext.useStoreState((state) => state.server.data?.eggId);
    const addonSettings = useStoreState((state: ApplicationStore) => state.settings.data?.addons?.serverPropertiesEditor);
    const history = useHistory();

    const { clearFlashes, clearAndAddHttpError, addFlash } = useFlash();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState<ServerPropertiesData | null>(null);
    const [properties, setProperties] = useState<Record<string, string>>({});
    const [searchQuery, setSearchQuery] = useState('');

    const isEnabled = addonSettings?.enabled ?? false;
    const allowedEggs = addonSettings?.allowedEggs ?? [];
    const isEggAllowed = allowedEggs.length === 0 || (eggId && allowedEggs.includes(eggId));

    useEffect(() => {
        if (!isEnabled || !isEggAllowed) {
            setLoading(false);
            return;
        }

        clearFlashes('server:properties');
        http.get(`/api/client/servers/${uuid}/server-properties`)
            .then((response) => {
                const payload = extractServerPropertiesPayload(response.data);
                const definitionsRaw = payload.definitions ?? (payload as { property_definitions?: unknown }).property_definitions;
                setData({
                    properties: (payload.properties as Record<string, string>) ?? {},
                    definitions: normaliseDefinitionList(definitionsRaw),
                    accessMode: {
                        file: (payload.accessMode as { file?: boolean } | undefined)?.file ?? true,
                        sidebar: (payload.accessMode as { sidebar?: boolean } | undefined)?.sidebar ?? true,
                    },
                });
                setProperties((payload.properties as Record<string, string>) ?? {});
            })
            .catch((error) => clearAndAddHttpError({ key: 'server:properties', error }))
            .finally(() => setLoading(false));
    }, [uuid]);

    const handleSave = () => {
        clearFlashes('server:properties');
        setSaving(true);

        http.post(`/api/client/servers/${uuid}/server-properties`, { properties })
            .then(() => {
                addFlash({
                    key: 'server:properties',
                    type: 'success',
                    message: t('properties.success.updated', 'Server properties have been updated successfully.'),
                });
            })
            .catch((error) => clearAndAddHttpError({ key: 'server:properties', error }))
            .finally(() => setSaving(false));
    };

    if (!isEnabled) {
        return (
            <PageContentBlock title={t('navigation.properties', 'Server Properties')}>
                <ContentContainer>
                    <div css={tw`text-center py-12`}>
                        <p style={{ color: 'var(--color-muted)' }}>{t('properties.disabled_message', 'The Server Properties Editor addon is disabled.')}</p>
                    </div>
                </ContentContainer>
            </PageContentBlock>
        );
    }

    if (!isEggAllowed) {
        return (
            <PageContentBlock title={t('navigation.properties', 'Server Properties')}>
                <ContentContainer>
                    <div css={tw`text-center py-12`}>
                        <p style={{ color: 'var(--color-muted)' }}>
                            {t('properties.egg_not_allowed', 'This egg is not allowed to use the Server Properties Editor.')}
                        </p>
                    </div>
                </ContentContainer>
            </PageContentBlock>
        );
    }

    if (loading) {
        return (
            <PageContentBlock title={t('navigation.properties', 'Server Properties')}>
                <ContentContainer>
                    <Spinner size="large" centered />
                </ContentContainer>
            </PageContentBlock>
        );
    }

    if (!data) {
        return (
            <PageContentBlock title={t('navigation.properties', 'Server Properties')}>
                <ContentContainer>
                    <FlashMessageRender byKey="server:properties" css={tw`mb-4`} />
                    <div css={tw`text-center py-12`}>
                        <p style={{ color: 'var(--color-muted)' }}>{t('properties.errors.load', 'Failed to load server properties.')}</p>
                    </div>
                </ContentContainer>
            </PageContentBlock>
        );
    }

    const normalisedSearchQuery = searchQuery.trim().toLowerCase();

    const definitionsList = data.definitions ?? [];

    const definitionMatchesSearch = (definition: PropertyDefinition) => {
        if (!normalisedSearchQuery) {
            return true;
        }
        const searchableValues = [
            definition.label,
            definition.key,
            definition.description,
            definition.default,
            ...(definition.options?.map((option) => option.label) ?? []),
            ...(definition.options?.map((option) => option.value) ?? []),
        ];
        return searchableValues.some((value) =>
            String(value ?? '').toLowerCase().includes(normalisedSearchQuery)
        );
    };

    let groupedDefinitions: Array<{
        type: PropertyDefinition['type'];
        title: string;
        definitions: PropertyDefinition[];
    }> = propertySections
        .map((section) => ({
            ...section,
            definitions: definitionsList.filter((definition: PropertyDefinition) => {
                if (definition.type !== section.type) {
                    return false;
                }
                return definitionMatchesSearch(definition);
            }),
        }))
        .filter((section) => section.definitions.length > 0);

    if (groupedDefinitions.length === 0 && definitionsList.length > 0) {
        const filtered = definitionsList.filter((d: PropertyDefinition) => definitionMatchesSearch(d));
        if (filtered.length > 0) {
            groupedDefinitions = [{ type: 'text', title: t('properties.options', 'Options'), definitions: filtered }];
        }
    }

    return (
        <PageContentBlock title={t('navigation.properties', 'Server Properties')}>
            <ContentContainer>
                <div style={cardStyle}>
                    <FlashMessageRender byKey="server:properties" css={tw`mb-4`} />

                    <div css={tw`mb-6 flex justify-between items-center gap-4`}>
                        <div css={tw`text-sm`} style={{ color: 'var(--color-muted)' }}>
                            {t('properties.description', 'Update your server properties and save when you are ready.')}
                        </div>
                        <div css={tw`flex items-center gap-3`}>
                            <Button 
                                onClick={() => history.push(`/server/${id}/files/edit?view=file#/server.properties`)} 
                                isSecondary
                                css={tw`px-4 whitespace-nowrap`}
                            >
                                <FontAwesomeIcon icon={faFileCode} css={tw`mr-2`} />
                                {t('properties.switch_to_file_view', 'File View')}
                            </Button>
                            <Button onClick={handleSave} disabled={saving} css={tw`px-6 whitespace-nowrap`}>
                                <FontAwesomeIcon icon={faSave} css={tw`mr-2`} />
                                {saving ? t('properties.saving', 'Saving...') : t('properties.save_changes', 'Save Changes')}
                            </Button>
                        </div>
                    </div>

                    <div css={tw`mb-6`}>
                        <div css={tw`relative`}>
                            <FontAwesomeIcon
                                icon={faSearch}
                                css={tw`absolute`}
                                style={{
                                    left: '1rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--color-muted)',
                                    pointerEvents: 'none',
                                }}
                            />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('properties.search_placeholder', 'Search properties...')}
                                style={searchInputStyle}
                                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-neutral)'}
                            />
                        </div>
                    </div>

                    {groupedDefinitions.length > 0 ? (
                        groupedDefinitions.map((section, index) => (
                            <div
                                key={section.type}
                                css={index === 0 ? tw`` : tw`mt-6 pt-6`}
                                style={index === 0 ? undefined : { borderTop: '1px solid var(--color-neutral)' }}
                            >
                                <div css={tw`mb-4`}>
                                    <h2 css={tw`text-base font-semibold`} style={{ color: 'var(--color-base)' }}>
                                        {t('properties.options', section.title)}
                                    </h2>
                                </div>

                                <div css={tw`grid grid-cols-1 lg:grid-cols-2 gap-x-6`}>
                                    {section.definitions.map((def) => (
                                        <PropertyInput
                                            key={def.key}
                                            definition={def}
                                            value={properties[def.key] ?? def.default}
                                            onChange={(value) => setProperties({ ...properties, [def.key]: value })}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div
                            css={tw`py-10 text-center text-sm`}
                            style={{ color: 'var(--color-muted)', borderTop: '1px solid var(--color-neutral)' }}
                        >
                            {normalisedSearchQuery
                                ? t('properties.no_search_results', 'No properties match "{{query}}".', { query: searchQuery })
                                : t('properties.no_definitions', 'No property definitions are available.')}
                        </div>
                    )}

                    <div css={tw`mt-6 flex justify-end`}>
                        <Button onClick={handleSave} disabled={saving} css={tw`px-6`}>
                            <FontAwesomeIcon icon={faSave} css={tw`mr-2`} />
                            {saving ? t('properties.saving', 'Saving...') : t('properties.save_changes', 'Save Changes')}
                        </Button>
                    </div>
                </div>
            </ContentContainer>
        </PageContentBlock>
    );
};

export default ServerPropertiesContainer;
