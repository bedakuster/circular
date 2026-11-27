import { makeAutoObservable } from 'mobx';
import {
    createDefaultDraggables,
    createDefaultDrawingParameters,
    createDefaultUiState,
    DraggablesMap,
    DrawingParameters,
    SavedCyclographState,
    UiState,
} from '../types';
import { extendLine } from '../simulator/CyclographSimulator';

export interface SimulatorApi {
    initialize(): void;
    updateParamsFromStore(redraw?: boolean): void;
    startRecording(): void;
    stopRecording(): void;
    start(): void;
    stop(): void;
    restart(): void;
    reset(): void;
    immediate(): void;
    last10Percents(): void;
    factoryReset(): void;
    resize(): void;
    isRenderedComplete(): boolean;
    ensurePatternRendered(): void;
    getCanvasDataUrl(): string;
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
    warning = '';
    simulator: SimulatorApi | null = null;
    savedStates: SavedCyclographState[] = [];
    savedStatesKey = 'cyclograph.savedStates.v1';

    constructor() {
        makeAutoObservable(this, {}, { autoBind: true });
        this.savedStates = this.readSavedStates();
    }

    private readSavedStates(): SavedCyclographState[] {
        const raw = localStorage.getItem(this.savedStatesKey);
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw) as unknown;
            return Array.isArray(parsed) ? parsed as SavedCyclographState[] : [];
        } catch {
            return [];
        }
    }

    private persistSavedStates(): void {
        localStorage.setItem(this.savedStatesKey, JSON.stringify(this.savedStates));
    }

    refreshSavedStates(): void {
        this.savedStates = this.readSavedStates();
    }

    saveCurrentState(name: string): SavedCyclographState {
        const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const state: SavedCyclographState = {
            id,
            name: name.trim() || `Cyclograph ${new Date().toLocaleString()}`,
            savedAt: new Date().toISOString(),
            drawingParameters: clone(this.drawingParameters),
            draggables: this.cloneDraggablesForPersistence(),
            ui: clone(this.ui),
            darkMode: this.darkMode,
            thumbnail: this.simulator?.getCanvasDataUrl() || '',
        };
        this.savedStates = [state, ...this.savedStates];
        this.persistSavedStates();
        return state;
    }

    private cloneDraggablesForPersistence(): DraggablesMap {
        const plain = JSON.parse(JSON.stringify(this.draggables)) as Record<string, Omit<DraggablesMap[string], 'showWhen'>>;
        const result = createDefaultDraggables();
        for (const key of Object.keys(result)) {
            if (plain[key]) {
                result[key] = {
                    ...result[key],
                    id: plain[key].id,
                    x: plain[key].x,
                    y: plain[key].y,
                    allowX: plain[key].allowX,
                    allowY: plain[key].allowY,
                    moveAlso: plain[key].moveAlso,
                };
            }
        }
        return result;
    }

    loadSavedState(id: string): void {
        const state = this.savedStates.find(item => item.id === id);
        if (!state) return;
        this.applySavedState(state);
    }

    applySavedState(state: SavedCyclographState): void {
        if (!state.drawingParameters || !state.draggables || !state.ui) return;

        const mergedDrawing = createDefaultDrawingParameters();
        Object.assign(mergedDrawing, state.drawingParameters);
        mergedDrawing.leftGear = { ...mergedDrawing.leftGear, ...state.drawingParameters.leftGear };
        mergedDrawing.rightGear = { ...mergedDrawing.rightGear, ...state.drawingParameters.rightGear };
        mergedDrawing.turntable = { ...mergedDrawing.turntable, ...state.drawingParameters.turntable };
        mergedDrawing.turntableCircularMovement = { ...mergedDrawing.turntableCircularMovement, ...state.drawingParameters.turntableCircularMovement };
        mergedDrawing.planetaryGear = { ...mergedDrawing.planetaryGear, ...state.drawingParameters.planetaryGear };
        mergedDrawing.leftGearPivotPoint = { ...mergedDrawing.leftGearPivotPoint, ...state.drawingParameters.leftGearPivotPoint };
        mergedDrawing.leftGearEllipsePoint = { ...mergedDrawing.leftGearEllipsePoint, ...state.drawingParameters.leftGearEllipsePoint };
        mergedDrawing.rightGearPivotPoint = { ...mergedDrawing.rightGearPivotPoint, ...state.drawingParameters.rightGearPivotPoint };
        mergedDrawing.rightGearEllipsePoint = { ...mergedDrawing.rightGearEllipsePoint, ...state.drawingParameters.rightGearEllipsePoint };
        mergedDrawing.simpleArm = { ...mergedDrawing.simpleArm, ...state.drawingParameters.simpleArm };
        mergedDrawing.claw = {
            leftArm: { ...createDefaultDrawingParameters().claw.leftArm, ...state.drawingParameters.claw?.leftArm },
            rightArm: { ...createDefaultDrawingParameters().claw.rightArm, ...state.drawingParameters.claw?.rightArm },
        };
        this.drawingParameters = mergedDrawing;

        const mergedDraggables = createDefaultDraggables();
        for (const key of Object.keys(mergedDraggables)) {
            const saved = state.draggables[key];
            if (saved) {
                mergedDraggables[key] = { ...mergedDraggables[key], ...saved };
            }
        }
        this.draggables = mergedDraggables;
        this.ui = { ...createDefaultUiState(), ...state.ui };
        this.darkMode = state.darkMode;
        this.storeSettings();
        this.simulator?.updateParamsFromStore(false);
        this.simulator?.reset();
        this.simulator?.immediate()
    }

    importSavedStates(items: unknown): number {
        const candidates: unknown[] = Array.isArray(items)
            ? items
            : typeof items === 'object' && items !== null && 'states' in items
                ? (items as { states: unknown }).states as unknown[]
                : [items];

        let imported = 0;
        for (const candidate of candidates) {
            if (!candidate || typeof candidate !== 'object') continue;
            const value = candidate as Partial<SavedCyclographState>;
            if (!value.drawingParameters || !value.draggables || !value.ui) continue;
            const state: SavedCyclographState = {
                id: value.id || (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${imported}`),
                name: value.name?.trim() || `Imported Cyclograph ${imported + 1}`,
                savedAt: value.savedAt || new Date().toISOString(),
                drawingParameters: value.drawingParameters,
                draggables: value.draggables,
                ui: value.ui,
                darkMode: Boolean(value.darkMode),
                thumbnail: value.thumbnail || '',
            };
            this.savedStates = [state, ...this.savedStates];
            imported++;
        }
        if (imported > 0) this.persistSavedStates();
        return imported;
    }

    deleteSavedState(id: string): void {
        this.savedStates = this.savedStates.filter(state => state.id !== id);
        this.persistSavedStates();
    }

    attachSimulator(simulator: SimulatorApi): void {
        this.simulator = simulator;
    }

    updateProgress(progressText: string, currentRounds: number, neededRounds: number, vertices: number, warning: string): void {
        this.progressText = progressText;
        this.currentRounds = currentRounds;
        this.neededRounds = neededRounds;
        this.vertices = vertices;
        this.warning = warning;
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
        this.ui.turntableCircularMovementEnabled = this.drawingParameters.turntableCircularMovement.enabled;
        this.ui.turntableCircularMovementTeeth = this.drawingParameters.turntableCircularMovement.teeth;
        this.ui.turntableCircularMovementRadiusX = this.drawingParameters.turntableCircularMovement.radiusX;
        this.ui.turntableCircularMovementRadiusY = this.drawingParameters.turntableCircularMovement.radiusY;
        this.ui.leftGearEllipseEnabled = this.drawingParameters.leftGearEllipsePoint.draggable;
        this.ui.rightGearEllipseEnabled = this.drawingParameters.rightGearEllipsePoint.draggable;
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
        this.drawingParameters.turntableCircularMovement.enabled = this.ui.turntableCircularMovementEnabled;
        this.drawingParameters.turntableCircularMovement.teeth = Math.max(1, Math.round(this.ui.turntableCircularMovementTeeth));
        this.drawingParameters.turntableCircularMovement.radiusX = this.ui.turntableCircularMovementRadiusX;
        this.drawingParameters.turntableCircularMovement.radiusY = this.ui.turntableCircularMovementRadiusY;
        this.drawingParameters.leftGearEllipsePoint.draggable = this.ui.leftGearEllipseEnabled;
        this.drawingParameters.rightGearEllipsePoint.draggable = this.ui.rightGearEllipseEnabled;
        this.drawingParameters.planetaryGear.enabled = this.ui.planetaryGearEnabled;
        this.drawingParameters.planetaryGear.innerGear = Math.round(this.ui.planetaryInnerGear);
        this.drawingParameters.planetaryGear.outerGear = Math.round(this.ui.planetaryOuterGear);
        this.drawingParameters.simpleArm.length = this.ui.rodLength;
        this.drawingParameters.simpleArm.x = this.ui.rodX;
        this.drawingParameters.simpleArm.angle = this.ui.rodAngle;

        this.draggables.leftGearPivotPoint.x = this.draggables.leftGear.x;
        this.draggables.leftGearPivotPoint.y = this.draggables.leftGear.y + this.ui.leftGearRadius;
        this.drawingParameters.leftGearPivotPoint.x = this.draggables.leftGearPivotPoint.x;
        this.drawingParameters.leftGearPivotPoint.y = this.draggables.leftGearPivotPoint.y;
        this.drawingParameters.leftGearEllipsePoint.x = this.draggables.leftGearEllipsePoint.x;
        this.drawingParameters.leftGearEllipsePoint.y = this.draggables.leftGearEllipsePoint.y;
        if (!this.drawingParameters.leftGearEllipsePoint.draggable) {
            const leftGearRadius = Math.abs(this.draggables.leftGearPivotPoint.y - this.draggables.leftGear.y);
            this.draggables.leftGearEllipsePoint.x = this.draggables.leftGear.x + leftGearRadius;
            this.draggables.leftGearEllipsePoint.y = this.draggables.leftGear.y;
            this.drawingParameters.leftGearEllipsePoint.x = this.draggables.leftGearEllipsePoint.x;
            this.drawingParameters.leftGearEllipsePoint.y = this.draggables.leftGearEllipsePoint.y;
        }

        this.draggables.rightGearPivotPoint.x = this.draggables.rightGear.x;
        this.draggables.rightGearPivotPoint.y = this.draggables.rightGear.y + this.ui.rightGearRadius;
        this.drawingParameters.rightGearPivotPoint.x = this.draggables.rightGearPivotPoint.x;
        this.drawingParameters.rightGearPivotPoint.y = this.draggables.rightGearPivotPoint.y;
        this.drawingParameters.rightGearEllipsePoint.x = this.draggables.rightGearEllipsePoint.x;
        this.drawingParameters.rightGearEllipsePoint.y = this.draggables.rightGearEllipsePoint.y;
        if (!this.drawingParameters.rightGearEllipsePoint.draggable) {
            const rightGearRadius = Math.abs(this.draggables.rightGearPivotPoint.y - this.draggables.rightGear.y);
            this.draggables.rightGearEllipsePoint.x = this.draggables.rightGear.x + rightGearRadius;
            this.draggables.rightGearEllipsePoint.y = this.draggables.rightGear.y;
            this.drawingParameters.rightGearEllipsePoint.x = this.draggables.rightGearEllipsePoint.x;
            this.drawingParameters.rightGearEllipsePoint.y = this.draggables.rightGearEllipsePoint.y;
        }

        const pivotPointAngle = Math.atan2(this.drawingParameters.rightGearPivotPoint.y - this.drawingParameters.leftGearPivotPoint.y, this.drawingParameters.rightGearPivotPoint.x - this.drawingParameters.leftGearPivotPoint.x);

        if (this.drawingParameters.anchor === 'Left') {
            const anglePoint = extendLine(this.drawingParameters.leftGearPivotPoint.x, this.drawingParameters.leftGearPivotPoint.y, pivotPointAngle, this.ui.rodX);
            const penPoint = extendLine(anglePoint.x, anglePoint.y, pivotPointAngle + this.drawingParameters.simpleArm.angle, this.ui.rodLength);
            this.draggables.simpleArmAnglePoint.x = anglePoint.x;
            this.draggables.simpleArmAnglePoint.y = anglePoint.y;

            this.draggables.simpleArmTipPoint.x = penPoint.x
            this.draggables.simpleArmTipPoint.y = penPoint.y

        } else if (this.drawingParameters.anchor === 'Right') {
            const anglePoint = extendLine(this.drawingParameters.rightGearPivotPoint.x, this.drawingParameters.rightGearPivotPoint.y, pivotPointAngle, - this.ui.rodX);
            const penPoint = extendLine(anglePoint.x, anglePoint.y, pivotPointAngle + this.drawingParameters.simpleArm.angle,this.ui.rodLength);
            this.draggables.simpleArmAnglePoint.x = anglePoint.x;
            this.draggables.simpleArmAnglePoint.y = anglePoint.y;

            this.draggables.simpleArmTipPoint.x = penPoint.x
            this.draggables.simpleArmTipPoint.y = penPoint.y
        }

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
            merged.turntableCircularMovement = { ...merged.turntableCircularMovement, ...parsed.drawingParameters.turntableCircularMovement };
            merged.planetaryGear = { ...merged.planetaryGear, ...parsed.drawingParameters.planetaryGear };
            merged.leftGearPivotPoint = { ...merged.leftGearPivotPoint, ...parsed.drawingParameters.leftGearPivotPoint };
            merged.leftGearEllipsePoint = { ...merged.leftGearEllipsePoint, ...parsed.drawingParameters.leftGearEllipsePoint };
            merged.rightGearPivotPoint = { ...merged.rightGearPivotPoint, ...parsed.drawingParameters.rightGearPivotPoint };
            merged.rightGearEllipsePoint = { ...merged.rightGearEllipsePoint, ...parsed.drawingParameters.rightGearEllipsePoint };
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
