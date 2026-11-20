import { makeAutoObservable } from 'mobx';
import {
    createDefaultDraggables,
    createDefaultDrawingParameters,
    createDefaultUiState,
    DraggablesMap,
    DrawingParameters,
    UiState,
} from '../types';

export interface SimulatorApi {
    initialize(): void;
    updateParamsFromStore(redraw?: boolean): void;
    start(): void;
    stop(): void;
    restart(): void;
    reset(): void;
    immediate(): void;
    last10Percents(): void;
    factoryReset(): void;
    resize(): void;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class AppStore {
    drawingParameters: DrawingParameters = createDefaultDrawingParameters();
    draggables: DraggablesMap = createDefaultDraggables();
    ui: UiState = createDefaultUiState();
    darkMode = true;
    progressText = '';
    currentRounds = 0;
    neededRounds = 0;
    vertices = 0;
    simulator: SimulatorApi | null = null;

    constructor() {
        makeAutoObservable(this, {}, { autoBind: true });
    }

    attachSimulator(simulator: SimulatorApi): void {
        this.simulator = simulator;
    }

    updateProgress(progressText: string, currentRounds: number, neededRounds: number, vertices: number): void {
        this.progressText = progressText;
        this.currentRounds = currentRounds;
        this.neededRounds = neededRounds;
        this.vertices = vertices;
    }

    setUiValue<K extends keyof UiState>(key: K, value: UiState[K]): void {
        this.ui[key] = value;
    }

    setDarkMode(darkMode: boolean): void {
        this.darkMode = darkMode;
    }

    syncUiFromCurrentState(): void {
        this.ui.leftGear = this.drawingParameters.leftGear.teeth;
        this.ui.rightGear = this.drawingParameters.rightGear.teeth;
        this.ui.turntable = this.drawingParameters.turntable.teeth;
        this.ui.anchor = this.drawingParameters.anchor;
        this.ui.arm = this.drawingParameters.armType;
        this.ui.leftGearRadius = this.draggables.leftGearPivotPoint.y - this.draggables.leftGear.y;
        this.ui.rightGearRadius = this.draggables.rightGearPivotPoint.y - this.draggables.rightGear.y;
        this.ui.reverseRightGear = this.drawingParameters.rightGear.reversed;
        this.ui.reverseLeftGear = this.drawingParameters.leftGear.reversed;
        this.ui.reverseTurntable = this.drawingParameters.turntable.reversed;
        this.ui.disableTurntable = this.drawingParameters.turntable.disabled;
        this.ui.planetaryGearEnabled = this.drawingParameters.planetaryGear.enabled;
        this.ui.planetaryInnerGear = this.drawingParameters.planetaryGear.innerGear;
        this.ui.planetaryOuterGear = this.drawingParameters.planetaryGear.outerGear;
        this.ui.rodLength = this.drawingParameters.simpleArm.length;
        this.ui.rodX = this.drawingParameters.simpleArm.x;
        this.ui.rodAngle = this.drawingParameters.simpleArm.angle;
    }

    applyUiToDrawingParameters(): void {
        this.drawingParameters.leftGear.teeth = Math.round(this.ui.leftGear);
        this.drawingParameters.rightGear.teeth = Math.round(this.ui.rightGear);
        this.drawingParameters.turntable.teeth = Math.round(this.ui.turntable);
        this.drawingParameters.anchor = this.ui.anchor;
        this.drawingParameters.armType = this.ui.arm;
        this.drawingParameters.leftGear.reversed = this.ui.reverseLeftGear;
        this.drawingParameters.rightGear.reversed = this.ui.reverseRightGear;
        this.drawingParameters.turntable.reversed = this.ui.reverseTurntable;
        this.drawingParameters.turntable.disabled = this.ui.disableTurntable;
        this.drawingParameters.planetaryGear.enabled = this.ui.planetaryGearEnabled;
        this.drawingParameters.planetaryGear.innerGear = Math.round(this.ui.planetaryInnerGear);
        this.drawingParameters.planetaryGear.outerGear = Math.round(this.ui.planetaryOuterGear);
        this.drawingParameters.simpleArm.length = this.ui.rodLength;
        this.drawingParameters.simpleArm.x = this.ui.rodX;
        this.drawingParameters.simpleArm.angle = this.ui.rodAngle;

        this.draggables.leftGearPivotPoint.x = this.draggables.leftGear.x;
        this.draggables.leftGearPivotPoint.y = this.draggables.leftGear.y + this.ui.leftGearRadius;
        this.draggables.rightGearPivotPoint.x = this.draggables.rightGear.x;
        this.draggables.rightGearPivotPoint.y = this.draggables.rightGear.y + this.ui.rightGearRadius;

        if (this.drawingParameters.planetaryGear.enabled) {
            this.drawingParameters.leftGearPivotPoint.x = this.drawingParameters.leftGear.x;
            this.drawingParameters.leftGearPivotPoint.y = this.drawingParameters.leftGear.y;
        }
    }

    loadSettings(): void {
        const savedSettings = localStorage.getItem('settings');
        if (!savedSettings) {
            this.setDarkMode(true);
            return;
        }

        const parsed = JSON.parse(savedSettings) as {
            drawingParameters?: DrawingParameters;
            draggables?: Record<string, { x: number; y: number }>;
            darkMode?: boolean;
            stroke?: number;
            color?: string;
            step?: number;
            speed?: number;
            drawControls?: boolean;
        };

        if (parsed.drawingParameters) {
            const merged = createDefaultDrawingParameters();
            Object.assign(merged, parsed.drawingParameters);
            merged.leftGear = { ...merged.leftGear, ...parsed.drawingParameters.leftGear };
            merged.rightGear = { ...merged.rightGear, ...parsed.drawingParameters.rightGear };
            merged.turntable = { ...merged.turntable, ...parsed.drawingParameters.turntable };
            merged.planetaryGear = { ...merged.planetaryGear, ...parsed.drawingParameters.planetaryGear };
            merged.leftGearPivotPoint = { ...merged.leftGearPivotPoint, ...parsed.drawingParameters.leftGearPivotPoint };
            merged.rightGearPivotPoint = { ...merged.rightGearPivotPoint, ...parsed.drawingParameters.rightGearPivotPoint };
            merged.simpleArm = { ...merged.simpleArm, ...parsed.drawingParameters.simpleArm };
            this.drawingParameters = merged;
        }

        const nextDraggables = createDefaultDraggables();
        if (parsed.draggables) {
            for (const key of Object.keys(nextDraggables)) {
                const loaded = parsed.draggables[key];
                if (loaded && Number.isFinite(loaded.x) && Number.isFinite(loaded.y)) {
                    nextDraggables[key].x = loaded.x;
                    nextDraggables[key].y = loaded.y;
                }
            }
        }
        this.draggables = nextDraggables;

        this.darkMode = Boolean(parsed.darkMode);
        if (typeof parsed.stroke === 'number') this.ui.strokeSize = parsed.stroke;
        if (typeof parsed.color === 'string') this.ui.strokeColor = parsed.color;
        if (typeof parsed.step === 'number') this.ui.stepSize = parsed.step;
        if (typeof parsed.speed === 'number') this.ui.speed = parsed.speed;
        this.ui.drawControls = Boolean(parsed.drawControls);

        this.syncUiFromCurrentState();
    }

    storeSettings(): void {
        const settings = {
            drawingParameters: this.drawingParameters,
            draggables: this.draggables,
            darkMode: this.darkMode,
            stroke: this.ui.strokeSize,
            color: this.ui.strokeColor,
            step: this.ui.stepSize,
            speed: this.ui.speed,
            drawControls: this.ui.drawControls,
        };

        localStorage.setItem('settings', JSON.stringify(settings));
    }

    resetToDefaults(): void {
        this.drawingParameters = createDefaultDrawingParameters();
        this.draggables = createDefaultDraggables();
        this.ui = createDefaultUiState();
        this.darkMode = true;
    }

    cloneDraggables(): DraggablesMap {
        const cloned = clone(this.draggables);
        const defaults = createDefaultDraggables();
        for (const key of Object.keys(cloned)) {
            cloned[key].showWhen = defaults[key].showWhen;
            cloned[key].moveAlso = defaults[key].moveAlso;
            cloned[key].allowX = defaults[key].allowX;
            cloned[key].allowY = defaults[key].allowY;
            cloned[key].id = defaults[key].id;
        }
        return cloned;
    }
}

export const appStore = new AppStore();
