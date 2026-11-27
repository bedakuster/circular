import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useState } from 'react';
import type { DragEvent as ReactDragEvent, ReactElement } from 'react';
import { appStore } from '../store/AppStore';
import type { SavedCyclographState } from '../types';
import presetsData from '../presets.json';

type LoadTab = 'saved' | 'presets';

export const StateManager = observer((): ReactElement => {
    const [saveOpen, setSaveOpen] = useState(false);
    const [loadOpen, setLoadOpen] = useState(false);
    const [loadTab, setLoadTab] = useState<LoadTab>('saved');
    const [name, setName] = useState('');
    const [dropActive, setDropActive] = useState(false);
    const [status, setStatus] = useState('');
    const presets = useMemo(() => {
        const parsed = presetsData as { states?: SavedCyclographState[] };
        return Array.isArray(parsed.states) ? parsed.states : [];
    }, []);

    useEffect(() => {
        appStore.refreshSavedStates();

        const preventBrowserDrop = (event: DragEvent): void => {
            event.preventDefault();
        };
        window.addEventListener('dragover', preventBrowserDrop);
        window.addEventListener('drop', preventBrowserDrop);
        return () => {
            window.removeEventListener('dragover', preventBrowserDrop);
            window.removeEventListener('drop', preventBrowserDrop);
        };
    }, []);

    const save = (): void => {
        const simulator = appStore.simulator;
        simulator?.ensurePatternRendered();
        appStore.saveCurrentState(name);
        setSaveOpen(false);
        setName('');
        setStatus('Configuration saved.');
    };

    const downloadStates = (): void => {
        appStore.refreshSavedStates();
        const payload = JSON.stringify({ states: appStore.savedStates }, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'cyclograph-states.json';
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const importFile = async (file: File): Promise<void> => {
        try {
            const parsed = JSON.parse(await file.text()) as unknown;
            const imported = appStore.importSavedStates(parsed);
            setStatus(imported > 0 ? `Imported ${imported} configuration${imported === 1 ? '' : 's'}.` : 'No valid configurations found.');
        } catch {
            setStatus('Could not read that JSON file.');
        }
    };

    const onDrop = (event: ReactDragEvent<HTMLDivElement>): void => {
        event.preventDefault();
        setDropActive(false);
        const files = Array.from(event.dataTransfer.files).filter(file => file.name.toLowerCase().endsWith('.json'));
        void Promise.all(files.map(importFile));
    };

    return (
        <>
            <div
                className={`panel state-manager-panel${dropActive ? ' drop-active' : ''}`}
                onDragEnter={event => { event.preventDefault(); setDropActive(true); }}
                onDragOver={event => event.preventDefault()}
                onDragLeave={event => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropActive(false);
                }}
                onDrop={onDrop}
            >
                <button type="button" onClick={() => setSaveOpen(true)}>Save</button>
                <button type="button" onClick={() => { setLoadTab('saved'); setLoadOpen(true); }}>Load/Presets</button>
                {/* <button type="button" onClick={downloadStates} disabled={appStore.savedStates.length === 0}>Download JSON</button> */}
            </div>

            {saveOpen && (
                <div className="modal-backdrop" role="presentation" onMouseDown={() => setSaveOpen(false)}>
                    <div className="state-modal" role="dialog" aria-modal="true" aria-labelledby="save-title" onMouseDown={event => event.stopPropagation()}>
                        <h2 id="save-title">Save configuration</h2>
                        <label className="modal-name">
                            <span>Name</span>
                            <input autoFocus value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') save(); }} />
                        </label>
                        <div className="modal-actions">
                            <button type="button" onClick={() => setSaveOpen(false)}>Cancel</button>
                            <button type="button" onClick={save}>Save</button>
                        </div>
                    </div>
                </div>
            )}

            {loadOpen && (
                <div className="modal-backdrop" role="presentation" onMouseDown={() => setLoadOpen(false)}>
                    <div className="state-modal state-load-modal" role="dialog" aria-modal="true" aria-labelledby="load-title" onMouseDown={event => event.stopPropagation()}>
                        <h2 id="load-title">Load configuration</h2>
                        <div className="state-load-tabs" role="tablist" aria-label="Load source">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={loadTab === 'saved'}
                                className={loadTab === 'saved' ? 'state-load-tab active' : 'state-load-tab'}
                                onClick={() => setLoadTab('saved')}
                            >
                                Saved
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={loadTab === 'presets'}
                                className={loadTab === 'presets' ? 'state-load-tab active' : 'state-load-tab'}
                                onClick={() => setLoadTab('presets')}
                            >
                                Presets
                            </button>
                        </div>

                        {loadTab === 'saved' && (
                            appStore.savedStates.length === 0 ? (
                                <p>No saved configurations yet.</p>
                            ) : (
                                <div className="state-grid">
                                    {appStore.savedStates.map(state => (
                                        <div className="state-card" key={state.id}>
                                            {state.thumbnail
                                                ? <img src={state.thumbnail} alt="" />
                                                : <div className="state-thumbnail-placeholder">No thumbnail</div>}
                                            <strong>{state.name}</strong>
                                            <span>{new Date(state.savedAt).toLocaleString()}</span>
                                            <div className="state-card-actions">
                                                <button type="button" onClick={() => { appStore.loadSavedState(state.id); setLoadOpen(false); }}>Load</button>
                                                <button type="button" className="delete-button" onClick={() => appStore.deleteSavedState(state.id)}>Delete</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {loadTab === 'presets' && (
                            presets.length === 0 ? (
                                <p>No presets available.</p>
                            ) : (
                                <div className="state-grid">
                                    {presets.map(state => (
                                        <div className="state-card" key={state.id}>
                                            {state.thumbnail
                                                ? <img src={state.thumbnail} alt="" />
                                                : <div className="state-thumbnail-placeholder">No thumbnail</div>}
                                            <strong>{state.name}</strong>
                                            <span>{new Date(state.savedAt).toLocaleString()}</span>
                                            <div className="state-card-actions">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        appStore.applySavedState(state);
                                                        setStatus(`Preset "${state.name}" loaded.`);
                                                        setLoadOpen(false);
                                                    }}
                                                >
                                                    Use preset
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                        <div className="modal-actions">
                            <button type="button" onClick={() => setLoadOpen(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
});
