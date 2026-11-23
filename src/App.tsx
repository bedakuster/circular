import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
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

    useEffect(() => {
        if (!canvasRef.current) return;
        if (appStore.simulator) return;
        
        const simulator = new CyclographSimulator(appStore, canvasRef.current);
        simulator.initialize();
        simulatorRef.current = simulator;
        appStore.attachSimulator(simulator);

        const resizeHandler = (): void => simulator.resize();
        window.addEventListener('resize', resizeHandler);
        return () => {
            window.removeEventListener('resize', resizeHandler);
            simulator.stop();
        };
    }, []);

    const setNumeric = (key: keyof typeof appStore.ui, value: number, resetOnChange = true): void => {
        appStore.setUiValue(key, value as never);
        simulatorRef.current?.updateParamsFromStore();
        if (resetOnChange) simulatorRef.current?.reset();
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
                        <SliderControl label="Left" value={appStore.ui.leftGear} min={1} max={80} onChange={value => setNumeric('leftGear', value)} />
                        <SliderControl label="Right" value={appStore.ui.rightGear} min={1} max={120} onChange={value => setNumeric('rightGear', value)} />
                        <SliderControl label="Turntable" value={appStore.ui.turntable} min={1} max={180} onChange={value => setNumeric('turntable', value)} />

                        <label className="control">
                            <span>Anchor</span>
                            <select value={appStore.ui.anchor} onChange={e => { appStore.setUiValue('anchor', e.target.value as never); simulatorRef.current?.updateParamsFromStore(); }}>
                                <option>Left</option>
                                <option>Right</option>
                            </select>
                        </label>

                        <SliderControl label="Left Radius" value={appStore.ui.leftGearRadius} min={0} max={500} step={0.1} onChange={value => setNumeric('leftGearRadius', value)} />
                        <SliderControl label="Right Radius" value={appStore.ui.rightGearRadius} min={0} max={500} step={0.1} onChange={value => setNumeric('rightGearRadius', value)} />

                        <label className="control checkbox"><span>Reverse Right</span><input type="checkbox" checked={appStore.ui.reverseRightGear} onChange={e => setBoolean('reverseRightGear', e.target.checked)} /></label>
                        <label className="control checkbox"><span>Reverse Left</span><input type="checkbox" checked={appStore.ui.reverseLeftGear} onChange={e => setBoolean('reverseLeftGear', e.target.checked)} /></label>
                        <label className="control checkbox"><span>Reverse Turntable</span><input type="checkbox" checked={appStore.ui.reverseTurntable} onChange={e => setBoolean('reverseTurntable', e.target.checked)} /></label>
                        <label className="control checkbox"><span>Disable Turntable</span><input type="checkbox" checked={appStore.ui.disableTurntable} onChange={e => setBoolean('disableTurntable', e.target.checked)} /></label>
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
                        <SliderControl label="Rod Len" value={appStore.ui.rodLength} min={-1000} max={1000} onChange={value => setNumeric('rodLength', value)} />
                        <SliderControl label="Rod X" value={appStore.ui.rodX} min={0} max={1000} onChange={value => setNumeric('rodX', value)} />
                        <SliderControl label="Rod Angle" value={appStore.ui.rodAngle} min={-1000} max={1000} step={0.001} onChange={value => setNumeric('rodAngle', value)} />
                    </div>

                    <div className="panel">
                        <SliderControl label="Stroke" value={appStore.ui.strokeSize} min={0.1} max={10} step={0.1} onChange={value => setNumeric('strokeSize', value, false)} />
                        <label className="control">
                            <span>Color</span>
                            <input type="text" value={appStore.ui.strokeColor} onChange={e => { appStore.setUiValue('strokeColor', e.target.value); simulatorRef.current?.updateParamsFromStore(); }} />
                        </label>
                        <SliderControl label="Step" value={appStore.ui.stepSize} min={0.001} max={0.1} step={0.001} onChange={value => setNumeric('stepSize', value)} />
                        <SliderControl label="Speed" value={appStore.ui.speed} min={1} max={20} onChange={value => setNumeric('speed', value, false)} />
                        <label className="control checkbox">
                            <span>Controls</span>
                            <input type="checkbox" checked={appStore.ui.drawControls} onChange={e => setBoolean('drawControls', e.target.checked)} />
                        </label>
                    </div>

                    <div className="panel"><button onClick={() => simulatorRef.current?.immediate()}>Immediate Result</button></div>
                    <div className="panel">
                        <button onClick={() => simulatorRef.current?.start()}>Start Animation</button>
                        <button onClick={() => simulatorRef.current?.stop()}>Stop Animation</button>
                        <button onClick={() => simulatorRef.current?.reset()}>Reset</button>
                        <button onClick={() => simulatorRef.current?.restart()}>Restart Animation</button>
                        <button onClick={() => simulatorRef.current?.last10Percents()}>Last 10%</button>
                    </div>
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
                    </div>
                </div>

                <div className="maincontent">
                    <div id="info-panel" className="panel">{appStore.progressText}</div>
                    <div className="canvas-container">
                        <canvas height={900} width={1000} id="c" ref={canvasRef} />
                    </div>
                </div>
            </div>
        </div>
    );
});
