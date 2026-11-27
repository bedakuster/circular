import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { marked } from 'marked';
import { appStore } from './store/AppStore';
import { CyclographSimulator } from './simulator/CyclographSimulator';
import { StateManager } from './components/StateManager';

type SliderProps = {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
};

const SliderControl = ({ label, value, min, max, step = 1, onChange }: SliderProps): ReactElement => (
    <label className="control">
        <span>{label}</span>
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
        <input className="value" type="number" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
    </label>
);

export const App = observer((): ReactElement => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const simulatorRef = useRef<CyclographSimulator | null>(null);
    const [guideOpen, setGuideOpen] = useState(false);
    const [guideHtml, setGuideHtml] = useState('');
    const [guideError, setGuideError] = useState('');

    useEffect(() => {

        const resizeHandler = () => {
            if (!simulatorRef.current) return;
            simulatorRef.current.resize();
        };
        window.onresize = resizeHandler;

        if (!canvasRef.current) return;
        if (appStore.simulator) return;

        const simulator = new CyclographSimulator(appStore, canvasRef.current);
        simulator.initialize();
        simulatorRef.current = simulator;
        appStore.attachSimulator(simulator);


        return () => {
            window.onresize = null;
            simulator.stop();
        };
    }, []);

    useEffect(() => {
        if (!guideOpen || guideHtml || guideError) return;

        let active = true;
        const loadGuide = async (): Promise<void> => {
            try {
                const response = await fetch('guide.md');
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const markdown = await response.text();
                const rendered = await marked.parse(markdown);
                if (!active) return;
                setGuideHtml(rendered);
            } catch {
                if (!active) return;
                setGuideError('Could not load the guide.');
            }
        };

        void loadGuide();
        return () => {
            active = false;
        };
    }, [guideOpen, guideHtml, guideError]);

    const setNumeric = (key: keyof typeof appStore.ui, value: number, redraw = true): void => {
        appStore.setUiValue(key, value as never);
        simulatorRef.current?.updateParamsFromStore(redraw);
    };

    const setBoolean = (key: keyof typeof appStore.ui, value: boolean): void => {
        appStore.setUiValue(key, value as never);
        simulatorRef.current?.updateParamsFromStore();
    };

    const controlsClass = useMemo(() => (appStore.darkMode ? 'dark-mode' : ''), [appStore.darkMode]);

    return (
        <div className={controlsClass}>
            <div className="content">
                <div className="sidebar">
                    <StateManager />
                    <div className="panel">
                        <button
                            type="button"
                            onClick={() => {
                                appStore.setDarkMode(!appStore.darkMode);
                                simulatorRef.current?.updateParamsFromStore();
                                simulatorRef.current?.reset();
                            }}
                        >
                            {appStore.darkMode ? 'Light mode' : 'Dark mode'}
                        </button>
                        <button onClick={() => simulatorRef.current?.factoryReset()}>Factory Reset</button>
                        <button type="button" onClick={() => { setGuideError(''); setGuideOpen(true); }}>Guide</button>
                    </div>

                    <div className="panel">
                        <SliderControl label="Left" value={appStore.ui.leftGear} min={1} max={80} onChange={value => setNumeric('leftGear', value)} />
                        <SliderControl label="Right" value={appStore.ui.rightGear} min={1} max={120} onChange={value => setNumeric('rightGear', value)} />
                        <SliderControl label="Turntable" value={appStore.ui.turntable} min={1} max={180} onChange={value => setNumeric('turntable', value)} />


                        <SliderControl label="Left Radius" value={appStore.ui.leftGearRadius} min={0} max={500} step={0.1} onChange={value => setNumeric('leftGearRadius', value)} />
                        <SliderControl label="Right Radius" value={appStore.ui.rightGearRadius} min={0} max={500} step={0.1} onChange={value => setNumeric('rightGearRadius', value)} />

                        <label className="control checkbox"><span>Reverse Right</span><input type="checkbox" checked={appStore.ui.reverseRightGear} onChange={e => setBoolean('reverseRightGear', e.target.checked)} /></label>
                        <label className="control checkbox"><span>Reverse Left</span><input type="checkbox" checked={appStore.ui.reverseLeftGear} onChange={e => setBoolean('reverseLeftGear', e.target.checked)} /></label>
                        <label className="control checkbox"><span>Reverse Turntable</span><input type="checkbox" checked={appStore.ui.reverseTurntable} onChange={e => setBoolean('reverseTurntable', e.target.checked)} /></label>
                        <label className="control checkbox"><span>Disable Turntable</span><input type="checkbox" checked={appStore.ui.disableTurntable} onChange={e => setBoolean('disableTurntable', e.target.checked)} /></label>
                        <label className="control checkbox"><span>Turntable Circular Movement</span><input type="checkbox" checked={appStore.ui.turntableCircularMovementEnabled} onChange={e => setBoolean('turntableCircularMovementEnabled', e.target.checked)} /></label>
                        <SliderControl label="Circular Move Teeth" value={appStore.ui.turntableCircularMovementTeeth} min={1} max={300} onChange={value => setNumeric('turntableCircularMovementTeeth', value)} />
                        <SliderControl label="Circular Move Radius X" value={appStore.ui.turntableCircularMovementRadiusX} min={0} max={500} step={0.1} onChange={value => setNumeric('turntableCircularMovementRadiusX', value)} />
                        <SliderControl label="Circular Move Radius Y" value={appStore.ui.turntableCircularMovementRadiusY} min={0} max={500} step={0.1} onChange={value => setNumeric('turntableCircularMovementRadiusY', value)} />
                        <label className="control checkbox"><span>Left Gear Ellipse</span><input type="checkbox" checked={appStore.ui.leftGearEllipseEnabled} onChange={e => setBoolean('leftGearEllipseEnabled', e.target.checked)} /></label>
                        <label className="control checkbox"><span>Right Gear Ellipse</span><input type="checkbox" checked={appStore.ui.rightGearEllipseEnabled} onChange={e => setBoolean('rightGearEllipseEnabled', e.target.checked)} /></label>
                        <label className="control checkbox"><span>Enable Planetary Gear</span><input type="checkbox" checked={appStore.ui.planetaryGearEnabled} onChange={e => setBoolean('planetaryGearEnabled', e.target.checked)} /></label>
                        <SliderControl label="Planetary Inner Gear" value={appStore.ui.planetaryInnerGear} min={1} max={200} onChange={value => setNumeric('planetaryInnerGear', value)} />
                        <SliderControl label="Planetary Outer Gear" value={appStore.ui.planetaryOuterGear} min={1} max={200} onChange={value => setNumeric('planetaryOuterGear', value)} />
                    </div>

                    <div className="panel">
                        <label className="control">
                            <span>Arm</span>
                            <select value={appStore.ui.arm} onChange={e => { appStore.setUiValue('arm', e.target.value as never); simulatorRef.current?.updateParamsFromStore(); simulatorRef.current?.reset(); }}>
                                <option>Simple</option>
                                <option>Claw</option>
                                <option>SuperClaw</option>
                            </select>
                        </label>

                        {appStore.ui.arm === 'Simple' && <>
                            <label className="control">
                                <span>Anchor</span>
                                <select value={appStore.ui.anchor} onChange={e => { appStore.setUiValue('anchor', e.target.value as never); simulatorRef.current?.updateParamsFromStore(); }}>
                                    <option>Left</option>
                                    <option>Right</option>
                                </select>
                            </label>

                            <SliderControl label="Rod Len" value={appStore.ui.rodLength} min={-1000} max={1000} onChange={value => setNumeric('rodLength', value)} />
                            <SliderControl label="Rod X" value={appStore.ui.rodX} min={0} max={1000} onChange={value => setNumeric('rodX', value)} />
                            <SliderControl label="Rod Angle" value={appStore.ui.rodAngle * 180 / Math.PI} min={-360} max={360} step={0.1} onChange={value => setNumeric('rodAngle', value / 180 * Math.PI)} />
                        </>}
                    </div>

                    <div className="panel">
                        <SliderControl label="Stroke" value={appStore.ui.strokeSize} min={0.1} max={10} step={0.1} onChange={value => setNumeric('strokeSize', value, false)} />
                        <label className="control">
                            <span>Stroke Color</span>
                            <input type="color" value={appStore.ui.strokeColor} onChange={e => { appStore.setUiValue('strokeColor', e.target.value); simulatorRef.current?.updateParamsFromStore(); }} />
                        </label>
                        <label className="control">
                            <span>Background Color</span>
                            <input type="color" value={appStore.ui.bgColor} onChange={e => { appStore.setUiValue('bgColor', e.target.value); simulatorRef.current?.updateParamsFromStore(); }} />
                        </label>
                        <SliderControl label="Step" value={appStore.ui.stepSize} min={0.001} max={0.1} step={0.001} onChange={value => setNumeric('stepSize', value)} />

                    </div>

                    {/* <div className="panel"><button onClick={() => simulatorRef.current?.immediate()}>Immediate Result</button></div> */}

                </div>

                <div className="maincontent">
                    {appStore.warning &&
                        <div className="panel warning">{appStore.warning}</div>
                    }
                    <div className="canvas-container">
                        <div className="canvas-toolbar" role="toolbar" aria-label="Animation controls">
                            <button type="button" className="canvas-toolbar-button record" title="Start recording" aria-label="Start recording" onClick={() => simulatorRef.current?.startRecording()}>⏺</button>
                            <button type="button" className="canvas-toolbar-button" title="Stop recording" aria-label="Stop recording" onClick={() => simulatorRef.current?.stopRecording()}>⏹</button>
                            <button type="button" className="canvas-toolbar-button" title="Start animation" aria-label="Start animation" onClick={() => simulatorRef.current?.start()}>▶</button>
                            <button type="button" className="canvas-toolbar-button" title="Stop animation" aria-label="Stop animation" onClick={() => simulatorRef.current?.stop()}>⏸</button>
                            <button type="button" className="canvas-toolbar-button" title="Reset" aria-label="Reset" onClick={() => simulatorRef.current?.reset()}>↺</button>
                            <button type="button" className="canvas-toolbar-button" title="Restart animation" aria-label="Restart animation" onClick={() => simulatorRef.current?.restart()}>⟲</button>
                            <button type="button" className="canvas-toolbar-button" title="Play last 10%" aria-label="Play last ten percent" onClick={() => simulatorRef.current?.last10Percents()}>⏭</button>
                            <button type="button" className="canvas-toolbar-button" title="Refresh" aria-label="Refresh" onClick={() => simulatorRef.current?.immediate()}>🔄</button>

                        </div>

                        <div className="canvas-toolbar top-left">
                            <SliderControl label="Speed" value={appStore.ui.speed} min={1} max={20} onChange={value => setNumeric('speed', value, false)} />
                        </div>

                        <div className="canvas-toolbar top-right">

                            <label className="control">
                                <span>Controls</span>
                                <input type="checkbox" checked={appStore.ui.drawControls} onChange={e => setBoolean('drawControls', e.target.checked)} />
                            </label>
                        </div>
                        <div id="info-panel" className="canvas-info-panel">
                            {appStore.progressText}
                        </div>

                        <canvas height={900} width={1000} id="c" ref={canvasRef} />
                    </div>
                </div>
            </div>
            {guideOpen && (
                <div className="modal-backdrop" role="presentation" onMouseDown={() => setGuideOpen(false)}>
                    <div className="state-modal guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" onMouseDown={event => event.stopPropagation()}>
                        <h2 id="guide-title">Guide</h2>
                        {guideError && <p>{guideError}</p>}
                        {!guideError && !guideHtml && <p>Loading guide...</p>}
                        {!guideError && guideHtml && <div className="guide-content" dangerouslySetInnerHTML={{ __html: guideHtml }} />}
                        <div className="modal-actions">
                            <button type="button" onClick={() => setGuideOpen(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});
