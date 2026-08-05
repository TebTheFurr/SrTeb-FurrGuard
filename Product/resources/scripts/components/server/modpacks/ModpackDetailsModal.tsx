import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCubes, faDownload, faCalendar, faExternalLinkAlt, faSpinner } from '@fortawesome/free-solid-svg-icons';
import Modal from '@/components/elements/Modal';
import Button from '@/components/elements/Button';
import { getModpackDetails } from '@/api/server/modpacks';
import { ServerContext } from '@/state/server';
import styles from './modpacks.module.css';

const formatDownloads = (count) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
};

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const escapeHtml = (value) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const parseInlineMarkdown = (value) => value
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>');

const markdownToHtml = (markdown) => {
    const escaped = escapeHtml(markdown).replace(/\r\n/g, '\n');
    const lines = escaped.split('\n');
    const parts = [];
    let inCodeBlock = false;
    let inList = false;
    let paragraphLines = [];

    const flushParagraph = () => {
        if (!paragraphLines.length) {
            return;
        }

        parts.push(`<p>${parseInlineMarkdown(paragraphLines.join('<br />'))}</p>`);
        paragraphLines = [];
    };

    const closeList = () => {
        if (!inList) {
            return;
        }

        parts.push('</ul>');
        inList = false;
    };

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('```')) {
            flushParagraph();
            closeList();
            if (inCodeBlock) {
                parts.push('</code></pre>');
                inCodeBlock = false;
            } else {
                parts.push('<pre><code>');
                inCodeBlock = true;
            }
            continue;
        }

        if (inCodeBlock) {
            parts.push(`${line}\n`);
            continue;
        }

        if (!trimmed) {
            flushParagraph();
            closeList();
            continue;
        }

        const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (heading) {
            flushParagraph();
            closeList();
            const level = heading[1].length;
            parts.push(`<h${level}>${parseInlineMarkdown(heading[2])}</h${level}>`);
            continue;
        }

        const listItem = trimmed.match(/^[-*]\s+(.+)$/);
        if (listItem) {
            flushParagraph();
            if (!inList) {
                parts.push('<ul>');
                inList = true;
            }
            parts.push(`<li>${parseInlineMarkdown(listItem[1])}</li>`);
            continue;
        }

        closeList();
        paragraphLines.push(trimmed);
    }

    flushParagraph();
    closeList();

    if (inCodeBlock) {
        parts.push('</code></pre>');
    }

    return parts.join('');
};

const renderBody = (body) => {
    if (!body) {
        return '';
    }

    if (/<[a-z][\s\S]*>/i.test(body)) {
        return body;
    }

    return markdownToHtml(body);
};

const ModpackDetailsModal = ({ modpack, visible, onDismissed, onInstall }) => {
    const { t } = useTranslation('server');
    const uuid = ServerContext.useStoreState((state) => state.server.data.uuid);
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!visible || !modpack) {
            setDetails(null);
            return;
        }

        setLoading(true);
        getModpackDetails(uuid, modpack.platform, modpack.id)
            .then((data) => setDetails(data))
            .catch(() => setDetails(null))
            .finally(() => setLoading(false));
    }, [visible, modpack, uuid]);

    if (!modpack) return null;

    return (
        <Modal visible={visible} onDismissed={onDismissed}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    {modpack.iconUrl ? (
                        <img src={modpack.iconUrl} alt={modpack.name} className={styles.modalModpackIcon} />
                    ) : (
                        <div className={styles.modpackIconPlaceholder} style={{ width: 48, height: 48 }}>
                            <FontAwesomeIcon icon={faCubes} />
                        </div>
                    )}
                    <div className={styles.modalModpackInfo}>
                        <h3>{modpack.name}</h3>
                        <p>{t('modpacks.details.by', 'by')} {modpack.author}</p>
                    </div>
                </div>

                {loading ? (
                    <div className={styles.loadingContainer} style={{ padding: '24px' }}>
                        <FontAwesomeIcon icon={faSpinner} spin size="2x" style={{ color: 'var(--color-muted)' }} />
                    </div>
                ) : details ? (
                    <>
                        <div className={styles.detailsMeta}>
                            <div className={styles.detailsMetaItem}>
                                <span className={styles.detailsMetaLabel}>{t('modpacks.details.downloads', 'Downloads')}</span>
                                <span className={styles.detailsMetaValue}>
                                    <FontAwesomeIcon icon={faDownload} style={{ marginRight: 4 }} />
                                    {formatDownloads(details.downloads || 0)}
                                </span>
                            </div>
                            {details.lastUpdated && (
                                <div className={styles.detailsMetaItem}>
                                    <span className={styles.detailsMetaLabel}>{t('modpacks.details.updated', 'Updated')}</span>
                                    <span className={styles.detailsMetaValue}>
                                        <FontAwesomeIcon icon={faCalendar} style={{ marginRight: 4 }} />
                                        {formatDate(details.lastUpdated)}
                                    </span>
                                </div>
                            )}
                            {details.loaders && details.loaders.length > 0 && (
                                <div className={styles.detailsMetaItem}>
                                    <span className={styles.detailsMetaLabel}>{t('modpacks.details.loaders', 'Loaders')}</span>
                                    <span className={styles.detailsMetaValue}>
                                        {details.loaders.join(', ')}
                                    </span>
                                </div>
                            )}
                            {details.license && (
                                <div className={styles.detailsMetaItem}>
                                    <span className={styles.detailsMetaLabel}>{t('modpacks.details.licence', 'Licence')}</span>
                                    <span className={styles.detailsMetaValue}>{details.license}</span>
                                </div>
                            )}
                        </div>

                        {details.body && (
                            <div
                                className={styles.detailsBody}
                                dangerouslySetInnerHTML={{ __html: renderBody(details.body) }}
                            />
                        )}

                        {details.gallery && details.gallery.length > 0 && (
                            <div className={styles.detailsGallery}>
                                {details.gallery.map((img, i) => (
                                    <a key={i} href={img.url} target="_blank" rel="noopener noreferrer">
                                        <img src={img.url} alt={img.title || t('modpacks.details.screenshot', 'Screenshot {{number}}', { number: i + 1 })} />
                                    </a>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <p className={styles.modpackDescription}>{modpack.description}</p>
                )}

                <div className={styles.modalActions}>
                    {details?.externalUrl && (
                        <a
                            href={details.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ marginRight: 'auto' }}
                        >
                            <Button isSecondary>
                                <FontAwesomeIcon icon={faExternalLinkAlt} style={{ marginRight: 6 }} />
                                {t('modpacks.details.view_page', 'View Page')}
                            </Button>
                        </a>
                    )}
                    <Button isSecondary onClick={onDismissed}>
                        {t('modpacks.details.close', 'Close')}
                    </Button>
                    <Button onClick={() => { onDismissed(); onInstall(modpack); }}>
                        {t('modpacks.details.install', 'Install')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default ModpackDetailsModal;
