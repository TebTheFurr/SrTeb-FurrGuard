import React, { useState } from 'react';
import useVaultTranslation from '@/components/server/vault/useVaultTranslation';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleNotch, faTimes } from '@fortawesome/free-solid-svg-icons';
import { cancelVaultJob, EstadoTrabajo, FaseTrabajo, Trabajo } from '@/api/server/vault';
import { Button } from '@/components/elements/button/index';
import Panel, { PanelBody } from '@/components/elements/ui/Panel';
import { useVault } from '@/components/server/vault/VaultContext';
import { formatCount, jobProgressPercent, formatBytes } from '@/components/server/vault/vaultFormat';
import { HelpText, ProgressFill, ProgressTrack } from '@/components/server/vault/vaultStyles';

const Row = styled.div`
    ${tw`flex items-center gap-3 mb-3`};
`;

const Spin = styled.span`
    ${tw`flex-shrink-0`};
    color: var(--color-primary);
`;

const Text = styled.div`
    ${tw`flex-1 min-w-0`};
`;

const Title = styled.p`
    ${tw`text-sm font-medium truncate`};
    color: var(--color-base);
`;

const Detail = styled.p`
    ${tw`text-xs truncate`};
    color: var(--color-muted);
`;

interface Props {
    job: Trabajo;
    /** Polling is blocked by the server restore lock. */
    locked: boolean;
    /** Several polls in a row failed. */
    failing: boolean;
}

const VaultJobBar = ({ job, locked, failing }: Props) => {
    const { t, locale } = useVaultTranslation();
    const { uuid, canManage, startJob, reportError } = useVault();
    const [cancelling, setCancelling] = useState(false);

    const phases: Record<FaseTrabajo, string> = {
        consistencia: t('vault.job.phases.consistencia', 'Guardando los mundos'),
        manifiesto: t('vault.job.phases.manifiesto', 'Comparando archivos'),
        enviando: t('vault.job.phases.enviando', 'Enviando al Vault'),
        recibiendo: t('vault.job.phases.recibiendo', 'Escribiendo en el servidor'),
        vaciando: t('vault.job.phases.vaciando', 'Borrando archivos antiguos'),
        instantanea: t('vault.job.phases.instantanea', 'Creando la copia'),
        limpieza: t('vault.job.phases.limpieza', 'Limpiando'),
    };

    const states: Partial<Record<EstadoTrabajo, string>> = {
        en_cola: t('vault.job.states.en_cola', 'En cola'),
        despachado: t('vault.job.states.despachado', 'Iniciando'),
        en_curso: t('vault.job.states.en_curso', 'En curso'),
        procesando: t('vault.job.states.procesando', 'Procesando'),
    };

    const { progreso } = job;
    const percent = locked ? null : jobProgressPercent(progreso);
    const stage = (progreso.fase && phases[progreso.fase]) || states[job.estado] || job.estado;
    const counts = [
        progreso.archivos_total > 0
            ? t('vault.job.files', '{{done}} de {{total}} archivos', {
                  done: formatCount(progreso.archivos, locale),
                  total: formatCount(progreso.archivos_total, locale),
              })
            : null,
        progreso.bytes_total > 0 ? `${formatBytes(progreso.bytes, locale)} / ${formatBytes(progreso.bytes_total, locale)}` : null,
        percent !== null ? `${Math.floor(percent)}%` : null,
    ].filter(Boolean);

    const onCancel = () => {
        setCancelling(true);
        cancelVaultJob(uuid, job.id)
            .then(startJob)
            .catch(reportError)
            .then(() => setCancelling(false));
    };

    return (
        <Panel role={'status'} aria-live={'polite'}>
            <PanelBody>
                <Row>
                    <Spin>
                        <FontAwesomeIcon icon={faCircleNotch} spin />
                    </Spin>
                    <Text>
                        <Title>{job.resumen}</Title>
                        <Detail>{[stage, ...counts].join(' · ')}</Detail>
                    </Text>
                    {canManage && (
                        <Button.Text size={Button.Sizes.Small} onClick={onCancel} disabled={cancelling}>
                            <FontAwesomeIcon icon={faTimes} />
                            <span className={'ml-2'}>{t('vault.job.cancel', 'Cancelar')}</span>
                        </Button.Text>
                    )}
                </Row>
                <ProgressTrack>
                    <ProgressFill $percent={percent} />
                </ProgressTrack>
                {locked && (
                    <HelpText>
                        {t(
                            'vault.job.locked',
                            'El servidor está bloqueado mientras se restaura, así que ahora no se puede leer el progreso. Se actualizará cuando termine.'
                        )}
                    </HelpText>
                )}
                {failing && !locked && (
                    <HelpText>{t('vault.job.retrying', 'El Vault no responde. Reintentando…')}</HelpText>
                )}
            </PanelBody>
        </Panel>
    );
};

export default VaultJobBar;
