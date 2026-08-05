import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSync } from '@fortawesome/free-solid-svg-icons';
import { usePanels, Panel } from '@/state/panels';
import './PanelContainer.css';

interface PanelContainerProps {
    children: React.ReactNode;
}

const IframePanel: React.FC<{ panel: Panel; onClose: () => void }> = ({ panel, onClose }) => {
    const [loading, setLoading] = useState(true);
    const iframeSrc = `${panel.path}?_panel=1`;

    return (
        <div className="panelItem">
            <div className="panelHeader">
                <span className="panelTitle">{panel.title}</span>
                <div className="panelHeaderActions">
                    <button 
                        className="panelHeaderButton" 
                        onClick={() => {
                            const iframe = document.querySelector(`iframe[data-panel-id="${panel.id}"]`) as HTMLIFrameElement;
                            if (iframe) {
                                setLoading(true);
                                iframe.src = iframe.src;
                            }
                        }}
                        title="Refresh"
                    >
                        <FontAwesomeIcon icon={faSync} />
                    </button>
                    <button className="panelCloseButton" onClick={onClose} title="Close">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>
            </div>
            <div className="panelIframeContainer">
                {loading && (
                    <div className="panelLoading">
                        <FontAwesomeIcon icon={faSync} spin />
                    </div>
                )}
                <iframe
                    data-panel-id={panel.id}
                    src={iframeSrc}
                    className="panelIframe"
                    onLoad={() => setLoading(false)}
                />
            </div>
        </div>
    );
};

const PanelContainer: React.FC<PanelContainerProps> = ({ children }) => {
    const panelContext = usePanels();

    if (!panelContext || !panelContext.hasPanels) {
        return <>{children}</>;
    }

    const { panels, removePanel } = panelContext;

    return (
        <div className="splitPanelLayout">
            <div className="panelItem mainPanel">
                <div className="panelContent">
                    <div className="mainPanelScrollArea">{children}</div>
                </div>
            </div>
            {panels.map((panel) => (
                <IframePanel
                    key={panel.id}
                    panel={panel}
                    onClose={() => removePanel(panel.id)}
                />
            ))}
        </div>
    );
};

export default PanelContainer;
