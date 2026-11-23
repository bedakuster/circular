export type AnchorType = 'Left' | 'Right';
export type ArmType = 'Simple' | 'Claw' | 'SuperClaw';

export interface Point {
    x: number;
    y: number;
}

export interface GearSettings extends Point {
    teeth: number;
    reversed: boolean;
    draggable?: boolean;
}

export interface TurntableSettings extends Point {
    radius: number;
    teeth: number;
    reversed: boolean;
    disabled: boolean;
}

export interface PlanetaryGearSettings {
    innerGear: number;
    outerGear: number;
    radius: number;
    enabled: boolean;
}

export interface ClawArmSettings {
    lengthToIntersection: number;
    extensionLength: number;
    scissorLength: number;
}

export interface DrawingParameters {
    leftGear: GearSettings;
    rightGear: GearSettings;
    anchor: AnchorType;
    armType: ArmType;
    turntable: TurntableSettings;
    planetaryGear: PlanetaryGearSettings;
    stepSize: number;
    speed: number;
    leftGearPivotPoint: Point & { draggable: boolean };
    rightGearPivotPoint: Point & { draggable: boolean };
    rightGearEllipsePoint: Point & { draggable: boolean };
    simpleArm: { x: number; length: number; angle: number };
    claw: {
        leftArm: ClawArmSettings;
        rightArm: ClawArmSettings;
    };
}

export interface DraggablePoint extends Point {
    id: string;
    allowX?: boolean;
    allowY?: boolean;
    moveAlso?: string[];
    showWhen?: (settings: DrawingParameters) => boolean;
}

export type DraggablesMap = {
    [key: string]: DraggablePoint;
    leftGear: DraggablePoint;
    rightGear: DraggablePoint;
    leftGearPivotPoint: DraggablePoint;
    rightGearPivotPoint: DraggablePoint;
    rightGearEllipsePoint: DraggablePoint;
    simpleArmAnglePoint: DraggablePoint;
    simpleArmTipPoint: DraggablePoint;
    planetaryGearPivotPoint: DraggablePoint;
    clawIntersectionPoint: DraggablePoint;
    leftClawEnd: DraggablePoint;
    rightClawEnd: DraggablePoint;
    clawEndPoint: DraggablePoint;
};

export interface UiState {
    leftGear: number;
    rightGear: number;
    turntable: number;
    anchor: AnchorType;
    arm: ArmType;
    leftGearRadius: number;
    rightGearRadius: number;
    reverseRightGear: boolean;
    reverseLeftGear: boolean;
    reverseTurntable: boolean;
    disableTurntable: boolean;
    planetaryGearEnabled: boolean;
    planetaryInnerGear: number;
    planetaryOuterGear: number;
    rodLength: number;
    rodX: number;
    rodAngle: number;
    strokeSize: number;
    strokeColor: string;
    stepSize: number;
    speed: number;
    drawControls: boolean;
}

export interface SavedCyclographState {
    id: string;
    name: string;
    savedAt: string;
    drawingParameters: DrawingParameters;
    draggables: DraggablesMap;
    ui: UiState;
    darkMode: boolean;
    thumbnail: string;
}

export const createDefaultDraggables = (): DraggablesMap => ({
    leftGear: { id: 'leftGear', x: 100, y: 100, moveAlso: ['leftGearPivotPoint'] },
    rightGear: { id: 'rightGear', x: 900, y: 100, moveAlso: ['rightGearPivotPoint', 'rightGearEllipsePoint', 'planetaryGearPivotPoint'] },
    leftGearPivotPoint: { id: 'leftGearPivotPoint', x: 100, y: 200, allowX: false },
    rightGearPivotPoint: { id: 'rightGearPivotPoint', x: 900, y: 200, allowX: false, moveAlso: ['planetaryGearPivotPoint'] },
    rightGearEllipsePoint: { id: 'rightGearEllipsePoint', x: 1000, y: 100, allowY: false },
    simpleArmAnglePoint: { id: 'simpleArmAnglePoint', x: 500, y: 500, showWhen: settings => settings.armType === 'Simple' },
    simpleArmTipPoint: { id: 'simpleArmTipPoint', x: 500, y: 600, moveAlso: ['simpleArmAnglePoint'], showWhen: settings => settings.armType === 'Simple' },
    planetaryGearPivotPoint: { id: 'planetaryGearPivotPoint', x: 900, y: 300, allowX: false, showWhen: settings => settings.planetaryGear.enabled },
    clawIntersectionPoint: { id: 'clawIntersectionPoint', x: 500, y: 400, moveAlso: ['clawEndPoint', 'leftClawEnd', 'rightClawEnd'], showWhen: settings => settings.armType === 'Claw' || settings.armType === 'SuperClaw' },
    leftClawEnd: { id: 'leftClawEnd', x: 600, y: 600, showWhen: settings => settings.armType === 'SuperClaw' },
    rightClawEnd: { id: 'rightClawEnd', x: 400, y: 600, showWhen: settings => settings.armType === 'SuperClaw' },
    clawEndPoint: { id: 'clawEndPoint', x: 500, y: 600, showWhen: settings => settings.armType === 'SuperClaw' },
});

export const createDefaultDrawingParameters = (): DrawingParameters => ({
    leftGear: { x: 100, y: 100, teeth: 31, reversed: false, draggable: true },
    rightGear: { x: 900, y: 100, teeth: 40, reversed: false, draggable: true },
    anchor: 'Left',
    armType: 'Simple',
    turntable: { x: 500, y: 500, radius: 400, teeth: 60, reversed: false, disabled: false },
    planetaryGear: { innerGear: 12, outerGear: 29, radius: 100, enabled: false },
    stepSize: 0.005,
    speed: 1,
    leftGearPivotPoint: { draggable: true, x: 100, y: 200 },
    rightGearPivotPoint: { draggable: true, x: 900, y: 200 },
    rightGearEllipsePoint: { draggable: true, x: 1000, y: 100 },
    simpleArm: { x: 400, length: 400, angle: Math.PI / 2 },
    claw: {
        leftArm: { lengthToIntersection: 0, extensionLength: 0, scissorLength: 0 },
        rightArm: { lengthToIntersection: 0, extensionLength: 0, scissorLength: 0 },
    },
});

export const createDefaultUiState = (): UiState => ({
    leftGear: 31,
    rightGear: 40,
    turntable: 60,
    anchor: 'Left',
    arm: 'Simple',
    leftGearRadius: 100,
    rightGearRadius: 100,
    reverseRightGear: false,
    reverseLeftGear: false,
    reverseTurntable: false,
    disableTurntable: false,
    planetaryGearEnabled: false,
    planetaryInnerGear: 12,
    planetaryOuterGear: 29,
    rodLength: 400,
    rodX: 400,
    rodAngle: Math.PI / 2,
    strokeSize: 0.5,
    strokeColor: 'black',
    stepSize: 0.005,
    speed: 1,
    drawControls: true,
});
