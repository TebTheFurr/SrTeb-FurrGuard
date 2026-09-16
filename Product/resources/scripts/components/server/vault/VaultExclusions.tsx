import React, { useEffect, useState } from 'react';
import useVaultTranslation from '@/components/server/vault/useVaultTranslation';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faFilter, faPlus } from '@fortawesome/free-solid-svg-icons';
import { updateVaultExclusions } from '@/api/server/vault';
import { Button } from '@/components/elements/button/index';
import { Textarea } from '@/components/elements/Input';
import Panel, { PanelBody, PanelHeader } from '@/components/elements/ui/Panel';
import useFlash from '@/plugins/useFlash';
import { VAULT_FLASH_KEY, useVault } from '@/components/server/vault/VaultContext';
import {
    EXCLUSION_PRESETS,
    MAX_EXCLUSION_LENGTH,
    MAX_EXCLUSIONS,
    parseExclusions,
    sameList,
    togglePattern,
    validateExclusions,
} from '@/components/server/vault/vaultRules';
import { ErrorText, FormLabel, HelpText, Stack } from '@/components/server/vault/vaultStyles';

const Presets = styled.div`
    ${tw`flex flex-wrap gap-2`};
`;

const Preset = styled.button<{ $active: boolean }>`
    ${tw`inline-flex items-center gap-2 px-2.5 py-1 text-xs font-mono transition-colors duration-150`};
    border-radius: 9999px;
    color: ${({ $active }) => ($active ? 'var(--color-base)' : 'var(--color-muted)')};
    background-color: ${({ $active }) =>
        $active ? 'color-mix(in srgb, var(--color-primary) 20%, transparent)' : 'var(--color-background)'};
    border: 1px solid ${({ $active }) => ($active ? 'var(--color-primary)' : 'var(--color-neutral)')};

    svg {
        font-size: 0.6rem;
    }

    &:hover {
        border-color: var(--color-primary);
        color: var(--color-base);
    }
`;

const Actions = styled.div`
    ${tw`flex flex-wrap items-center justify-end gap-2`};
`;

const VaultExclusions = () => {
    const { t } = useVaultTranslation();
    const { uuid, resumen, refresh, reportError } = useVault();
    const { addFlash, clearFlashes } = useFlash();
    const [text, setText] = useState(resumen.exclusiones.join('\n'));
    const [saving, setSaving] = useState(false);

    // Adopt the stored list when it changes elsewhere (admin tab, another user).
    const stored = resumen.exclusiones;
    useEffect(() => {
        setText(stored.join('\n'));
    }, [stored.join('\n')]);

    const patterns = parseExclusions(text);
    const problem = validateExclusions(patterns);
    const unchanged = sameList(patterns, stored);

    const problemText = !problem
        ? null
        : problem.kind === 'too_many'
        ? t('vault.exclusions.too_many', 'Usa como máximo {{max}} patrones.', { max: problem.max })
        : problem.kind === 'too_long'
        ? t('vault.exclusions.too_long', 'Cada patrón puede tener como máximo {{max}} caracteres.', { max: problem.max })
        : t('vault.exclusions.invalid', 'Un patrón contiene caracteres no permitidos.');

    const onToggle = (pattern: string) => setText(togglePattern(patterns, pattern).join('\n'));

    const save = () => {
        setSaving(true);
        clearFlashes(VAULT_FLASH_KEY);
        updateVaultExclusions(uuid, patterns)
            .then((saved) => {
                setText(saved.join('\n'));
                addFlash({
                    key: VAULT_FLASH_KEY,
                    type: 'success',
                    title: t('vault.title', 'Vault'),
                    message: t('vault.exclusions.saved', 'Exclusiones guardadas. Se aplican desde la próxima sincronización y copia.'),
                });
                refresh();
            })
            .catch(reportError)
            .then(() => setSaving(false));
    };

    return (
        <Panel>
            <PanelHeader
                icon={faFilter}
                title={t('vault.exclusions.title', 'Exclusiones')}
                hint={t('vault.exclusions.hint', 'Rutas que las sincronizaciones y copias omiten, con la sintaxis de un archivo .gitignore.')}
            />
            <PanelBody>
                <Stack css={tw`gap-3`}>
                    <div>
                        <FormLabel as={'span'}>{t('vault.exclusions.presets', 'Exclusiones habituales')}</FormLabel>
                        <Presets>
                            {EXCLUSION_PRESETS.map((preset) => {
                                const active = patterns.indexOf(preset) !== -1;

                                return (
                                    <Preset
                                        key={preset}
                                        type={'button'}
                                        $active={active}
                                        aria-pressed={active}
                                        onClick={() => onToggle(preset)}
                                    >
                                        <FontAwesomeIcon icon={active ? faCheck : faPlus} />
                                        {preset}
                                    </Preset>
                                );
                            })}
                        </Presets>
                    </div>
                    <div>
                        <FormLabel htmlFor={'vault-exclusions'}>{t('vault.exclusions.patterns', 'Patrones, uno por línea')}</FormLabel>
                        <Textarea
                            id={'vault-exclusions'}
                            rows={8}
                            value={text}
                            spellCheck={false}
                            hasError={!!problem}
                            onChange={(event) => setText(event.currentTarget.value)}
                            css={tw`font-mono`}
                        />
                        {problemText ? (
                            <ErrorText>{problemText}</ErrorText>
                        ) : (
                            <HelpText>
                                {t('vault.exclusions.count', '{{count}} de {{max}} patrones, de hasta {{length}} caracteres cada uno.', {
                                    count: patterns.length,
                                    max: MAX_EXCLUSIONS,
                                    length: MAX_EXCLUSION_LENGTH,
                                })}
                            </HelpText>
                        )}
                    </div>
                    <Actions>
                        <Button.Text onClick={() => setText(stored.join('\n'))} disabled={unchanged || saving}>
                            {t('vault.exclusions.reset', 'Descartar cambios')}
                        </Button.Text>
                        <Button onClick={save} disabled={unchanged || saving || !!problem}>
                            {t('vault.exclusions.save', 'Guardar exclusiones')}
                        </Button>
                    </Actions>
                </Stack>
            </PanelBody>
        </Panel>
    );
};

export default VaultExclusions;
