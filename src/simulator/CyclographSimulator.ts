import { AppStore } from '../store/AppStore';
import { DraggablePoint, Point } from '../types';

type DrawPoint = Point & { keep: boolean; i: number };

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const keepEveryNthPoint = 2;

const calculateDistance = (x1: number, y1: number, x2: number, y2: number): number =>
    Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

const triangleHeight = (a: number, b: number, c: number): number => {
    const s = (a + b + c) / 2;
    const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
    return (2 * area) / c;
};

export const extendLine = (x: number, y: number, angle: number, length: number): Point => ({
    x: x + length * Math.cos(angle),
    y: y + length * Math.sin(angle),
});

const rotatePointAroundPivot = (point: Point, pivotX: number, pivotY: number, rounds: number): Point => {
    const angle = -rounds * Math.PI * 2;
    const dx = point.x - pivotX;
    const dy = point.y - pivotY;
    return {
        x: pivotX + dx * Math.cos(angle) - dy * Math.sin(angle),
        y: pivotY + dx * Math.sin(angle) + dy * Math.cos(angle),
    };
};

const lineIntersection = (x1: Point, x2: Point, p1: Point, p2: Point): Point | null => {
    const dx = x2.x - x1.x;
    const dy = x2.y - x1.y;
    const ex = p2.x - p1.x;
    const ey = p2.y - p1.y;
    const denominator = dx * ey - dy * ex;
    if (denominator === 0) return null;

    const t = ((p1.x - x1.x) * ey - (p1.y - x1.y) * ex) / denominator;
    return {
        x: x1.x + t * dx,
        y: x1.y + t * dy,
    };
};

const clawPoint = (
    primeDotCurrentX: number,
    primeDotCurrentY: number,
    normDotCurrentX: number,
    normDotCurrentY: number,
    primeLength: number,
    normLength: number,
): Point & { l1Angle: number; l2Angle: number } => {
    const pointDistance = calculateDistance(primeDotCurrentX, primeDotCurrentY, normDotCurrentX, normDotCurrentY);
    const height = triangleHeight(primeLength, normLength, pointDistance);
    const primeClawAngle = Math.asin(height / primeLength);
    const normClawAngle = Math.asin(height / normLength);
    const lineAngle = Math.atan2(normDotCurrentY - primeDotCurrentY, normDotCurrentX - primeDotCurrentX);
    const l1Angle = lineAngle + primeClawAngle;
    const l2Angle = lineAngle + Math.PI - normClawAngle;

    return {
        x: primeDotCurrentX + primeLength * Math.cos(l1Angle),
        y: primeDotCurrentY + primeLength * Math.sin(l1Angle),
        l1Angle,
        l2Angle,
    };
};

export class CyclographSimulator {
    private readonly store: AppStore;
    private readonly canvas: HTMLCanvasElement;
    private readonly context: CanvasRenderingContext2D;
    private animationHandle: number | null = null;
    private isStopped = true;
    private neededRounds = 0;
    private currentRounds = 0;
    private points: DrawPoint[] = [];
    private realPointCount = 0;
    private pixelRatio = window.devicePixelRatio || 1;
    private immediateFastPathTargetRounds = 0;

    private isDragging = false;
    private dragStartPosition: Point = { x: 0, y: 0 };
    private currentTransformedCursor: Point | null = null;
    private currentZoom = 1;
    private pinchState: { distance: number; midpoint: Point } | null = null;
    private clickedControl: DraggablePoint | null = null;

    constructor(store: AppStore, canvas: HTMLCanvasElement) {
        this.store = store;
        this.canvas = canvas;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Canvas rendering context is not available.');
        }
        this.context = context;
        this.context.imageSmoothingEnabled = false;
    }

    initialize(): void {
        this.store.loadSettings();
        this.store.ui.leftGear = this.nearestPrime(this.store.ui.leftGear);
        this.store.ui.planetaryOuterGear = this.nearestPrime(this.store.ui.planetaryOuterGear);
        this.updateParamsFromStore(false);
        this.resize();
        this.bindCanvasInteractions();
        this.calculatePoint(0, false, true);
    }

    isRenderedComplete(): boolean {
        return this.currentRounds >= this.neededRounds;
    }

    getCanvasDataUrl(): string {
        return this.canvas.toDataURL('image/png');
    }

    ensurePatternRendered(): void {
        this.calculateNeededRounds();
        if (!this.isRenderedComplete()) {
            this.immediate();
        }
    }

    private isDarkMode(): boolean {
        return this.store.darkMode;
    }

    private getCanvasBackgroundColor(): string {
        return this.isDarkMode() ? '#0d1117' : 'white';
    }

    private getStrokeColor(): string {
        const chosenColor = this.store.ui.strokeColor.trim();
        if (!chosenColor) return this.isDarkMode() ? '#edf3ff' : 'black';
        if (chosenColor === 'white' && !this.isDarkMode()) return 'black';
        return chosenColor === 'black' && this.isDarkMode() ? '#edf3ff' : chosenColor;
    }

    private getControlColor(): string {
        return this.isDarkMode() ? '#3586f8' : '#003c91';
    }

    private getControlThickness(): number {
        return 1;
    }

    private getControlEffectColor(): string {
        return this.isDarkMode() ? 'rgba(107, 188, 255, 0.65)' : 'rgba(0, 60, 145, 0.35)';
    }

    private getTouchableEffectColor(): string {
        return this.isDarkMode() ? 'rgba(107, 188, 255, 0.75)' : 'rgba(0, 23, 71, 0.4)';
    }

    private getControlEffectBlur(): number {
        return this.isDarkMode() ? 10 : 8;
    }

    private getTouchableEffectBlur(): number {
        return this.isDarkMode() ? 12 : 10;
    }

    private applyCanvasEffect(effectColor: string, blur: number): void {
        // this.context.shadowColor = effectColor;
        // this.context.shadowBlur = blur;
        // this.context.shadowOffsetX = 0;
        // this.context.shadowOffsetY = this.isDarkMode() ? 0 : 1;
    }

    private getTouchableColor(): string {
        return this.isDarkMode() ? '#6bbcff' : '#001747';
    }

    private getTouchableThickness(): number {
        return 2;
    }

    private drawInfo(): void {
        const progress = this.neededRounds === 0 ? 0 : (this.currentRounds / this.neededRounds) * 100;
        const message = `Progress: ${progress.toFixed(2)}% | Rounds: ${this.currentRounds.toFixed(3)} / ${this.neededRounds} | Vertices: ${this.points.length} | GCD: ${gcd(this.store.drawingParameters.turntable.teeth, this.store.drawingParameters.rightGear.teeth)} | Factor: ${this.store.drawingParameters.turntable.teeth / gcd(this.store.drawingParameters.turntable.teeth, this.store.drawingParameters.rightGear.teeth)}`;
        const warning = this.neededRounds > 230 ? 'Needed rounds exceeds 230. Make sure Turntable and Right have a great common divisor > 2.' : '';
        this.store.updateProgress(message, this.currentRounds, this.neededRounds, this.points.length, warning);
    }

    private drawPattern(): void {
        this.context.beginPath();
        for (let i = 0; i < this.points.length; i++) {
            const p = this.points[i];
            if (i === 0) this.context.moveTo(p.x, p.y);
            else this.context.lineTo(p.x, p.y);
            this.context.lineTo(p.x, p.y);
        }
        this.context.strokeStyle = this.getStrokeColor();
        this.context.lineWidth = this.store.ui.strokeSize;
        this.context.stroke();
    }

    private getEasedStepSize(baseStepSize: number, rounds: number, speed: number): number {
        const remainingRounds = this.neededRounds - rounds;
        const safeSpeed = Math.max(speed, 1);
        if (remainingRounds <= 0) return baseStepSize;

        const minFactor = 0.15;
        const easeInWindow = 1;
        const easeOutWindow = 1;
        let easeInFactor = 1;
        let easeOutFactor = 1;

        if (rounds < easeInWindow) {
            const normalizedProgress = Math.max(0, rounds) / easeInWindow;
            easeInFactor = minFactor + (1 - minFactor) * normalizedProgress * normalizedProgress;
        }
        if (remainingRounds < easeOutWindow) {
            const normalizedRemaining = Math.max(0, remainingRounds) / easeOutWindow;
            easeOutFactor = minFactor + (1 - minFactor) * normalizedRemaining * normalizedRemaining;
        }

        const easedFactor = Math.min(easeInFactor, easeOutFactor);
        const easedStepSize = baseStepSize * easedFactor;
        const maxStepToFinish = remainingRounds / safeSpeed;
        return Math.min(easedStepSize, maxStepToFinish);
    }

    private calculatePoint(rounds: number, skipDraw = false, drawExactlyOnce = false, skipVertexAddition = false, immediate = false): boolean | void {
        const drawingParameters = this.store.drawingParameters;
        const draggables = this.store.draggables;
        const immediateFastPathActive = immediate && skipDraw && !drawExactlyOnce && !skipVertexAddition;

        if (!immediateFastPathActive) {
            this.drawInfo();
        }

        const leftGearRounds = (drawingParameters.turntable.teeth / drawingParameters.leftGear.teeth) * rounds * (drawingParameters.leftGear.reversed ? -1 : 1);
        const rightGearRounds = (drawingParameters.turntable.teeth / drawingParameters.rightGear.teeth) * rounds * (drawingParameters.rightGear.reversed ? -1 : 1);
        const leftGearYRadius = Math.abs(draggables.leftGearPivotPoint.y - drawingParameters.leftGear.y);
        const leftGearXRadius = drawingParameters.leftGearEllipsePoint.draggable
            ? Math.abs(draggables.leftGearEllipsePoint.x - drawingParameters.leftGear.x)
            : leftGearYRadius;
        const rightGearYRadius = Math.abs(draggables.rightGearPivotPoint.y - drawingParameters.rightGear.y);
        const rightGearXRadius = drawingParameters.rightGearEllipsePoint.draggable
            ? Math.abs(draggables.rightGearEllipsePoint.x - drawingParameters.rightGear.x)
            : rightGearYRadius;
        const leftGearYFactor = Math.cos(leftGearRounds * 2 * Math.PI);
        const leftGearXFactor = Math.sin(leftGearRounds * 2 * Math.PI);
        const rightGearYFactor = Math.cos(rightGearRounds * 2 * Math.PI);
        const rightGearXFactor = Math.sin(rightGearRounds * 2 * Math.PI);
        const turntableYFactor = Math.cos(rounds * 2 * Math.PI * (drawingParameters.turntable.disabled ? 0 : drawingParameters.turntable.reversed ? -1 : 1));
        const turntableXFactor = Math.sin(rounds * 2 * Math.PI * (drawingParameters.turntable.disabled ? 0 : drawingParameters.turntable.reversed ? -1 : 1));

        const turntableCircularMovement = drawingParameters.turntableCircularMovement;
        const turntableCircularMovementTeeth = Math.max(1, turntableCircularMovement.teeth);
        const turntableCircularMovementRadiusX = turntableCircularMovement.enabled ? turntableCircularMovement.radiusX : 0;
        const turntableCircularMovementRadiusY = turntableCircularMovement.enabled ? turntableCircularMovement.radiusY : 0;
        const turntableCircularMovementRounds = (drawingParameters.turntable.teeth / turntableCircularMovementTeeth) * rounds;
        const previousTurntableCircularMovementRounds = (drawingParameters.turntable.teeth / turntableCircularMovementTeeth) * this.currentRounds;
        const turntableCircularMovementX = Math.cos(turntableCircularMovementRounds * 2 * Math.PI);
        const turntableCircularMovementY = Math.sin(turntableCircularMovementRounds * 2 * Math.PI);
        const previousTurntableCircularMovementX = Math.cos(previousTurntableCircularMovementRounds * 2 * Math.PI);
        const previousTurntableCircularMovementY = Math.sin(previousTurntableCircularMovementRounds * 2 * Math.PI);


        // const turntableCenterX = drawingParameters.turntable.x;
        // const turntableCenterY = drawingParameters.turntable.y;

        const previousTurntableCenterX = drawingParameters.turntable.x + previousTurntableCircularMovementX * turntableCircularMovementRadiusX;
        const previousTurntableCenterY = drawingParameters.turntable.y + previousTurntableCircularMovementY * turntableCircularMovementRadiusY;
        const turntableCenterX = drawingParameters.turntable.x + turntableCircularMovementX * turntableCircularMovementRadiusX;
        const turntableCenterY = drawingParameters.turntable.y + turntableCircularMovementY * turntableCircularMovementRadiusY;
        const turntableTranslationX = turntableCenterX - previousTurntableCenterX;
        const turntableTranslationY = turntableCenterY - previousTurntableCenterY;


        if (!skipDraw) {
            this.applyCanvasEffect('', 0);
            this.context.fillStyle = this.getCanvasBackgroundColor();
            this.context.fillRect(-10000, -10000, this.canvas.width * 100, this.canvas.height * 100);
        }

        if (!immediateFastPathActive) {
            this.points = this.points.filter(p => p.keep || p.i > this.realPointCount - 100);

            for (let p of this.points) {
                if (!drawingParameters.turntable.disabled) {
                    let rotatedPoint = rotatePointAroundPivot(
                        p,
                        previousTurntableCenterX,
                        previousTurntableCenterY,
                        (rounds - this.currentRounds) * (drawingParameters.turntable.reversed ? -1 : 1),
                    );
                    p.x = rotatedPoint.x;
                    p.y = rotatedPoint.y;
                }

                if (turntableTranslationX !== 0 || turntableTranslationY !== 0) {
                    p.x += turntableTranslationX;
                    p.y += turntableTranslationY;
                }
            }

            // if (!drawingParameters.turntable.disabled) {

            // }
        }

        if (!skipDraw) {
            this.applyCanvasEffect('', 0)
            this.drawPattern();
        }
        const leftGearPivotX = drawingParameters.leftGear.x + leftGearXFactor * leftGearXRadius;
        const leftGearPivotY = drawingParameters.leftGear.y + leftGearYFactor * leftGearYRadius;
        drawingParameters.leftGearPivotPoint.x = leftGearPivotX;
        drawingParameters.leftGearPivotPoint.y = leftGearPivotY;
        drawingParameters.leftGearEllipsePoint.x = drawingParameters.leftGear.x + leftGearXRadius;
        drawingParameters.leftGearEllipsePoint.y = drawingParameters.leftGear.y;

        let rightGearPivotX = drawingParameters.rightGear.x + rightGearXFactor * rightGearXRadius;
        let rightGearPivotY = drawingParameters.rightGear.y + rightGearYFactor * rightGearYRadius;
        drawingParameters.rightGearPivotPoint.x = rightGearPivotX;
        drawingParameters.rightGearPivotPoint.y = rightGearPivotY;
        drawingParameters.rightGearEllipsePoint.x = drawingParameters.rightGear.x + rightGearXRadius;
        drawingParameters.rightGearEllipsePoint.y = drawingParameters.rightGear.y;

        const turntableCurrentX = turntableCenterX + turntableXFactor * drawingParameters.turntable.radius;
        const turntableCurrentY = turntableCenterY + turntableYFactor * drawingParameters.turntable.radius;

        const drawControls = this.store.ui.drawControls;

        if (drawingParameters.planetaryGear.enabled) {
            const planetaryOuterGearStartX = rightGearPivotX;
            const planetaryOuterGearStartY = rightGearPivotY;
            const planetaryOuterRounds = (rightGearRounds * (drawingParameters.planetaryGear.innerGear + drawingParameters.planetaryGear.outerGear)) / drawingParameters.planetaryGear.outerGear;
            const planetaryOuterGearMovX = Math.sin(planetaryOuterRounds * 2 * Math.PI);
            const planetaryOuterGearMovY = Math.cos(planetaryOuterRounds * 2 * Math.PI);
            const planetaryOuterGearPivotX = planetaryOuterGearStartX + planetaryOuterGearMovX * drawingParameters.planetaryGear.radius;
            const planetaryOuterGearPivotY = planetaryOuterGearStartY + planetaryOuterGearMovY * drawingParameters.planetaryGear.radius;

            rightGearPivotX = planetaryOuterGearPivotX;
            rightGearPivotY = planetaryOuterGearPivotY;

            if (drawControls) {
                this.context.fillStyle = this.getControlColor();
                this.context.strokeStyle = this.getControlColor();
                this.context.lineWidth = this.getControlThickness();
                this.applyCanvasEffect(this.getControlEffectColor(), this.getControlEffectBlur());
                this.context.beginPath();
                this.context.arc(planetaryOuterGearPivotX, planetaryOuterGearPivotY, 2, 0, 2 * Math.PI);
                this.context.fill();
                this.context.beginPath();
                this.context.arc(planetaryOuterGearStartX, planetaryOuterGearStartY, drawingParameters.planetaryGear.radius, 0, 2 * Math.PI);
                this.context.stroke();
            }
        }

        let targetPointX = 0;
        let targetPointY = 0;

        const maxPossiblePivotDistance =
            calculateDistance(drawingParameters.leftGear.x, drawingParameters.leftGear.y, drawingParameters.rightGear.x, drawingParameters.rightGear.y) +
            (draggables.leftGearPivotPoint.y - drawingParameters.leftGear.y) +
            (draggables.rightGearPivotPoint.y - drawingParameters.rightGear.y);

        const leftClawLengthToIntersection = drawingParameters.claw.leftArm.lengthToIntersection;
        const rightClawLengthToIntersection = drawingParameters.claw.rightArm.lengthToIntersection;
        const clawTarget = clawPoint(leftGearPivotX, leftGearPivotY, rightGearPivotX, rightGearPivotY, leftClawLengthToIntersection, rightClawLengthToIntersection);
        if (drawingParameters.armType === 'Claw') {
            targetPointX = clawTarget.x;
            targetPointY = clawTarget.y;
        }

        const leftClawExtensionLength = drawingParameters.claw.leftArm.extensionLength;
        const rightClawExtensionLength = drawingParameters.claw.rightArm.extensionLength;
        const extendedLeftClaw = extendLine(clawTarget.x, clawTarget.y, clawTarget.l1Angle, leftClawExtensionLength);
        const extendedRightClaw = extendLine(clawTarget.x, clawTarget.y, clawTarget.l2Angle, rightClawExtensionLength);
        const superClawTarget = clawPoint(extendedRightClaw.x, extendedRightClaw.y, extendedLeftClaw.x, extendedLeftClaw.y, drawingParameters.claw.rightArm.scissorLength, drawingParameters.claw.leftArm.scissorLength);
        if (drawingParameters.armType === 'SuperClaw') {
            targetPointX = superClawTarget.x;
            targetPointY = superClawTarget.y;
        }

        const pivotPointAngle = Math.atan2(rightGearPivotY - leftGearPivotY, rightGearPivotX - leftGearPivotX);
        let armOriginX = leftGearPivotX;
        let armOriginY = leftGearPivotY;
        let armExtensionFactor = 1;
        if (drawingParameters.anchor === 'Right') {
            armOriginX = rightGearPivotX;
            armOriginY = rightGearPivotY;
            armExtensionFactor = -1;
        }

        const midpoint = extendLine(armOriginX, armOriginY, pivotPointAngle, drawingParameters.simpleArm.x * armExtensionFactor);
        const targetPoint = extendLine(midpoint.x, midpoint.y, drawingParameters.simpleArm.angle + pivotPointAngle, drawingParameters.simpleArm.length);
        if (drawingParameters.armType === 'Simple') {
            targetPointX = targetPoint.x;
            targetPointY = targetPoint.y;
        }

        if (!skipDraw && drawControls && this.isStopped) {
            this.context.fillStyle = 'green';
            this.applyCanvasEffect(this.getTouchableEffectColor(), this.getTouchableEffectBlur());
            for (const key of Object.keys(draggables)) {
                if (draggables[key].showWhen && !draggables[key].showWhen?.(drawingParameters)) continue;
                this.context.strokeStyle = this.getTouchableColor();
                this.context.lineWidth = this.getTouchableThickness();
                this.context.beginPath();
                this.context.arc(draggables[key].x, draggables[key].y, 20, 0, 2 * Math.PI);
                this.context.stroke();
            }
        }

        if (!skipDraw && drawControls) {
            this.context.fillStyle = this.getControlColor();
            this.context.lineWidth = this.getControlThickness();
            this.context.font = '12px Arial';
            this.applyCanvasEffect(this.getControlEffectColor(), this.getControlEffectBlur());
            this.context.fillText(drawingParameters.leftGear.teeth.toString(), drawingParameters.leftGear.x, drawingParameters.leftGear.y);
            this.context.fillText(drawingParameters.rightGear.teeth.toString(), drawingParameters.rightGear.x, drawingParameters.rightGear.y);
            this.context.fillText(drawingParameters.turntable.teeth.toString(), drawingParameters.turntable.x, drawingParameters.turntable.y - drawingParameters.turntable.radius - 20);
            this.context.lineWidth = this.getControlThickness();
            this.context.strokeStyle = this.getControlColor();
            this.context.fillStyle = this.getControlColor();

            this.context.beginPath();
            this.context.ellipse(drawingParameters.leftGear.x, drawingParameters.leftGear.y, leftGearXRadius, leftGearYRadius, 0, 0, 2 * Math.PI);
            this.context.stroke();
            this.context.beginPath();
            this.context.arc(leftGearPivotX, leftGearPivotY, 2, 0, 2 * Math.PI);
            this.context.fill();

            this.context.beginPath();
            this.context.ellipse(drawingParameters.rightGear.x, drawingParameters.rightGear.y, rightGearXRadius, rightGearYRadius, 0, 0, 2 * Math.PI);
            this.context.stroke();
            this.context.beginPath();
            this.context.arc(rightGearPivotX, rightGearPivotY, 2, 0, 2 * Math.PI);
            this.context.fill();

            this.context.beginPath();
            this.context.arc(drawingParameters.anchor === 'Right' ? rightGearPivotX : leftGearPivotX, drawingParameters.anchor === 'Right' ? rightGearPivotY : leftGearPivotY, 8, 0, 2 * Math.PI);
            this.context.stroke();

            this.context.beginPath();
            this.context.arc(turntableCenterX, turntableCenterY, drawingParameters.turntable.radius, 0, 2 * Math.PI);
            this.context.stroke();

            this.context.beginPath();
            this.context.arc(turntableCenterX, turntableCenterY, 2, 0, 2 * Math.PI);
            this.context.fill();
            this.context.beginPath();
            this.context.arc(turntableCurrentX, turntableCurrentY, 2, 0, 2 * Math.PI);
            this.context.fill();

            this.context.beginPath();
            this.context.moveTo(leftGearPivotX, leftGearPivotY);
            this.context.lineTo(rightGearPivotX, rightGearPivotY);
            this.context.stroke();

            if (drawingParameters.armType === 'SuperClaw') {
                if (leftClawLengthToIntersection + rightClawLengthToIntersection < maxPossiblePivotDistance) this.context.strokeStyle = 'red';
                this.context.beginPath();
                this.context.moveTo(leftGearPivotX, leftGearPivotY);
                this.context.lineTo(extendedLeftClaw.x, extendedLeftClaw.y);
                this.context.lineTo(targetPointX, targetPointY);
                this.context.stroke();

                this.context.beginPath();
                this.context.moveTo(rightGearPivotX, rightGearPivotY);
                this.context.lineTo(extendedRightClaw.x, extendedRightClaw.y);
                this.context.lineTo(targetPointX, targetPointY);
                this.context.stroke();
                this.context.strokeStyle = this.getStrokeColor();
            } else if (drawingParameters.armType === 'Claw') {
                if (leftClawLengthToIntersection + rightClawLengthToIntersection < maxPossiblePivotDistance) this.context.strokeStyle = 'red';
                this.context.beginPath();
                this.context.moveTo(leftGearPivotX, leftGearPivotY);
                this.context.lineTo(targetPointX, targetPointY);
                this.context.stroke();
                this.context.beginPath();
                this.context.moveTo(rightGearPivotX, rightGearPivotY);
                this.context.lineTo(targetPointX, targetPointY);
                this.context.stroke();
                this.context.strokeStyle = this.getStrokeColor();
            } else {
                this.context.beginPath();
                this.context.arc(midpoint.x, midpoint.y, 2, 0, 2 * Math.PI);
                this.context.fill();
                this.context.beginPath();
                this.context.moveTo(midpoint.x, midpoint.y);
                this.context.lineTo(targetPointX, targetPointY);
                this.context.stroke();
            }
        }

        if ((!skipDraw && rounds < this.neededRounds) || drawControls) {
            if (drawControls) {
                this.context.fillStyle = this.getControlColor();
                this.applyCanvasEffect(this.getControlEffectColor(), this.getControlEffectBlur());
                this.context.beginPath();
                this.context.arc(targetPointX, targetPointY, 2, 0, 2 * Math.PI);
                this.context.fill();
            } else {
                this.context.fillStyle = this.getStrokeColor();
                this.context.beginPath();
                this.context.arc(targetPointX, targetPointY, 2, 0, 2 * Math.PI);
                this.context.fill();
            }
        }

        if (!drawExactlyOnce) {
            if (!skipVertexAddition) {
                if (immediateFastPathActive) {
                    const targetTurntableCircularMovementRounds = (drawingParameters.turntable.teeth / turntableCircularMovementTeeth) * this.immediateFastPathTargetRounds;
                    const targetTurntableCircularMovementX = Math.cos(targetTurntableCircularMovementRounds * 2 * Math.PI);
                    const targetTurntableCircularMovementY = Math.sin(targetTurntableCircularMovementRounds * 2 * Math.PI);
                    const targetTurntableCenterX = drawingParameters.turntable.x + targetTurntableCircularMovementX * turntableCircularMovementRadiusX;
                    const targetTurntableCenterY = drawingParameters.turntable.y + targetTurntableCircularMovementY * turntableCircularMovementRadiusY;

                    if (!drawingParameters.turntable.disabled) {
                        const finalTurntableRotation = (this.immediateFastPathTargetRounds - rounds) * (drawingParameters.turntable.reversed ? -1 : 1);
                        const projectedTargetPoint = rotatePointAroundPivot(
                            { x: targetPointX, y: targetPointY },
                            turntableCenterX,
                            turntableCenterY,
                            finalTurntableRotation,
                        );
                        targetPointX = projectedTargetPoint.x;
                        targetPointY = projectedTargetPoint.y;
                    }

                    targetPointX += targetTurntableCenterX - turntableCenterX;
                    targetPointY += targetTurntableCenterY - turntableCenterY;
                }
                this.points.push({ keep: true, i: this.realPointCount, x: targetPointX, y: targetPointY });
                this.realPointCount++;
                if (this.realPointCount % keepEveryNthPoint !== 0) {
                    this.points[this.points.length - 1].keep = false;
                }
            }
            this.currentRounds = rounds;
        }

        if (rounds > this.neededRounds) {
            this.stop();
            return false;
        }

        if (skipDraw || drawExactlyOnce) return;

        const baseStepSize = this.store.ui.stepSize;
        const speed = this.store.ui.speed;
        const stepSize = this.getEasedStepSize(baseStepSize, this.currentRounds, speed);
        for (let i = 0; i < speed - 1; i++) {
            const shouldContinue = this.calculatePoint(rounds + stepSize * (i + 1), true);
            if (this.currentRounds >= this.neededRounds || shouldContinue === false) {
                this.calculatePoint(this.currentRounds, false, true);
                return;
            }
        }

        this.animationHandle = window.requestAnimationFrame(() => this.calculatePoint(this.currentRounds + stepSize));
    }

    private calculateNeededRounds(): void {
        const drawingParameters = this.store.drawingParameters;


        if (drawingParameters.planetaryGear.enabled) {
            this.neededRounds =
                (Math.min(drawingParameters.turntable.teeth, drawingParameters.rightGear.teeth) /
                    gcd(drawingParameters.turntable.teeth, drawingParameters.rightGear.teeth)) *
                drawingParameters.planetaryGear.outerGear / gcd(drawingParameters.turntable.teeth, drawingParameters.planetaryGear.outerGear);
        } else {
            this.neededRounds =
                (Math.min(drawingParameters.turntable.teeth, drawingParameters.rightGear.teeth) /
                    gcd(drawingParameters.turntable.teeth, drawingParameters.rightGear.teeth)) *
                drawingParameters.leftGear.teeth / gcd(drawingParameters.turntable.teeth, drawingParameters.leftGear.teeth);
        
        }
        if (drawingParameters.turntable.disabled) {
            this.neededRounds = (drawingParameters.rightGear.teeth / drawingParameters.turntable.teeth) * drawingParameters.leftGear.teeth;

            
        }
        this.store.neededRounds = this.neededRounds;
    }

    private updateDrawingSettingsFromDraggables(): void {
        const drawingParameters = this.store.drawingParameters;
        const draggables = this.store.draggables;

        draggables.leftGearEllipsePoint.y = draggables.leftGear.y;
        draggables.rightGearEllipsePoint.y = draggables.rightGear.y;
        drawingParameters.leftGear.x = draggables.leftGear.x;
        drawingParameters.leftGear.y = draggables.leftGear.y;
        drawingParameters.rightGear.x = draggables.rightGear.x;
        drawingParameters.rightGear.y = draggables.rightGear.y;
        drawingParameters.leftGearPivotPoint.x = draggables.leftGearPivotPoint.x;
        drawingParameters.leftGearPivotPoint.y = draggables.leftGearPivotPoint.y;
        drawingParameters.leftGearEllipsePoint.x = draggables.leftGearEllipsePoint.x;
        drawingParameters.leftGearEllipsePoint.y = draggables.leftGearEllipsePoint.y;

        if (!drawingParameters.leftGearEllipsePoint.draggable) {
            const leftGearRadius = Math.abs(draggables.leftGearPivotPoint.y - draggables.leftGear.y);
            draggables.leftGearEllipsePoint.x = draggables.leftGear.x + leftGearRadius;
            draggables.leftGearEllipsePoint.y = draggables.leftGear.y;
            drawingParameters.leftGearEllipsePoint.x = draggables.leftGearEllipsePoint.x;
            drawingParameters.leftGearEllipsePoint.y = draggables.leftGearEllipsePoint.y;
        }
        drawingParameters.rightGearPivotPoint.x = draggables.rightGearPivotPoint.x;
        drawingParameters.rightGearPivotPoint.y = draggables.rightGearPivotPoint.y;
        drawingParameters.rightGearEllipsePoint.x = draggables.rightGearEllipsePoint.x;
        drawingParameters.rightGearEllipsePoint.y = draggables.rightGearEllipsePoint.y;

        if (!drawingParameters.rightGearEllipsePoint.draggable) {
            const rightGearRadius = Math.abs(draggables.rightGearPivotPoint.y - draggables.rightGear.y);
            draggables.rightGearEllipsePoint.x = draggables.rightGear.x + rightGearRadius;
            draggables.rightGearEllipsePoint.y = draggables.rightGear.y;
            drawingParameters.rightGearEllipsePoint.x = draggables.rightGearEllipsePoint.x;
            drawingParameters.rightGearEllipsePoint.y = draggables.rightGearEllipsePoint.y;
        }
        drawingParameters.planetaryGear.radius = draggables.planetaryGearPivotPoint.y - draggables.rightGearPivotPoint.y;

        let rightGearPivotPointX = draggables.rightGearPivotPoint.x;
        let rightGearPivotPointY = draggables.rightGearPivotPoint.y;

        if (drawingParameters.planetaryGear.enabled) {
            rightGearPivotPointX = draggables.planetaryGearPivotPoint.x;
            rightGearPivotPointY = draggables.planetaryGearPivotPoint.y;

            draggables.leftGearPivotPoint.x = draggables.leftGear.x;
            draggables.leftGearPivotPoint.y = draggables.leftGear.y;
            draggables.leftGearEllipsePoint.x = draggables.leftGear.x;
            draggables.leftGearEllipsePoint.y = draggables.leftGear.y;

            drawingParameters.leftGearPivotPoint.x = draggables.leftGear.x;
            drawingParameters.leftGearPivotPoint.y = draggables.leftGear.y;
            drawingParameters.leftGearEllipsePoint.x = draggables.leftGear.x;
            drawingParameters.leftGearEllipsePoint.y = draggables.leftGear.y;
        }

        const pivotPointAngle = Math.atan2(rightGearPivotPointY - draggables.leftGearPivotPoint.y, rightGearPivotPointX - draggables.leftGearPivotPoint.x);
        const intersection = lineIntersection(draggables.simpleArmTipPoint, draggables.simpleArmAnglePoint, draggables.leftGearPivotPoint, { x: rightGearPivotPointX, y: rightGearPivotPointY });

        if (intersection) {
            const leftArmX = calculateDistance(intersection.x, intersection.y, draggables.leftGearPivotPoint.x, draggables.leftGearPivotPoint.y);
            const rightArmX = calculateDistance(intersection.x, intersection.y, rightGearPivotPointX, rightGearPivotPointY);
            const armLength = calculateDistance(intersection.x, intersection.y, draggables.simpleArmTipPoint.x, draggables.simpleArmTipPoint.y);
            const angle2 = Math.atan2(intersection.y - draggables.simpleArmTipPoint.y, intersection.x - draggables.simpleArmTipPoint.x);

            if (drawingParameters.anchor === 'Left') {
                drawingParameters.simpleArm.x = leftArmX;
            } else {
                drawingParameters.simpleArm.x = rightArmX;
            }
            drawingParameters.simpleArm.length = armLength;
            drawingParameters.simpleArm.angle = angle2 - pivotPointAngle + Math.PI;

            draggables.simpleArmAnglePoint.x = intersection.x;
            draggables.simpleArmAnglePoint.y = intersection.y;
        }

        const leftGearPivotX = draggables.leftGearPivotPoint.x;
        const leftGearPivotY = draggables.leftGearPivotPoint.y;
        let rightGearPivotX = draggables.rightGearPivotPoint.x;
        let rightGearPivotY = draggables.rightGearPivotPoint.y;
        if (drawingParameters.planetaryGear.enabled) {
            rightGearPivotX = draggables.planetaryGearPivotPoint.x;
            rightGearPivotY = draggables.planetaryGearPivotPoint.y;
        }

        const leftClawLengthToIntersection = calculateDistance(leftGearPivotX, leftGearPivotY, draggables.clawIntersectionPoint.x, draggables.clawIntersectionPoint.y);
        const rightClawLengthToIntersection = calculateDistance(rightGearPivotX, rightGearPivotY, draggables.clawIntersectionPoint.x, draggables.clawIntersectionPoint.y);
        drawingParameters.claw.leftArm.lengthToIntersection = Math.min(2000, leftClawLengthToIntersection);
        drawingParameters.claw.rightArm.lengthToIntersection = Math.min(2000, rightClawLengthToIntersection);

        const clawTarget = clawPoint(leftGearPivotX, leftGearPivotY, rightGearPivotX, rightGearPivotY, leftClawLengthToIntersection, rightClawLengthToIntersection);
        const leftClawExtensionLength = calculateDistance(draggables.clawIntersectionPoint.x, draggables.clawIntersectionPoint.y, draggables.leftClawEnd.x, draggables.leftClawEnd.y);
        const rightClawExtensionLength = calculateDistance(draggables.clawIntersectionPoint.x, draggables.clawIntersectionPoint.y, draggables.rightClawEnd.x, draggables.rightClawEnd.y);
        drawingParameters.claw.leftArm.extensionLength = Math.min(2000, leftClawExtensionLength);
        drawingParameters.claw.rightArm.extensionLength = Math.min(2000, rightClawExtensionLength);

        const leftArmExtension = extendLine(clawTarget.x, clawTarget.y, clawTarget.l1Angle, leftClawExtensionLength);
        const rightArmExtension = extendLine(clawTarget.x, clawTarget.y, clawTarget.l2Angle, rightClawExtensionLength);

        draggables.leftClawEnd.x = leftArmExtension.x;
        draggables.leftClawEnd.y = leftArmExtension.y;

        draggables.rightClawEnd.x = rightArmExtension.x;
        draggables.rightClawEnd.y = rightArmExtension.y;

        drawingParameters.claw.leftArm.scissorLength = Math.min(2000, calculateDistance(leftArmExtension.x, leftArmExtension.y, draggables.clawEndPoint.x, draggables.clawEndPoint.y));
        drawingParameters.claw.rightArm.scissorLength = Math.min(2000, calculateDistance(rightArmExtension.x, rightArmExtension.y, draggables.clawEndPoint.x, draggables.clawEndPoint.y));

        this.store.syncUiFromCurrentState();
        this.immediate(true, 0.015)
    }


    updateParamsFromStore(redraw = true): void {
        this.store.applyUiToDrawingParameters();
        // this.updateDrawingSettingsFromDraggables();
        this.store.storeSettings();
        // if (redraw && !this.animationHandle) {
        //     this.calculatePoint(this.currentRounds, false, true);
        // }
        this.calculateNeededRounds();
        this.drawInfo()
        if (redraw && this.isStopped) {
            this.immediate(true, 0.015);
        }
    }

    private validateNeededRounds(askToEnforce = false): boolean {
        if (this.neededRounds >= 230) {
            if (askToEnforce) {
                return window.confirm('Needed rounds exceeds 230, this can take very long...');
            } else {
                return false;
            }
        }
        return true;
    }

    reset(): void {
        this.stop();
        this.calculateNeededRounds();
        this.currentRounds = 0;
        this.points = [];
        this.realPointCount = 0;
        this.drawInfo();
        this.calculatePoint(0, false, true);
    }

    last10Percents(): void {
        this.stop();
        this.calculateNeededRounds();
        if (!this.validateNeededRounds()) return;
        this.drawInfo();
        this.currentRounds = 0;
        this.points = [];
        this.realPointCount = 0;


        const stepSize = this.store.ui.stepSize;
        const perc90 = Math.floor(this.neededRounds * 0.9);
        let targetSum = 0
        for (let i = 0; i < perc90; i += stepSize) {
            targetSum += stepSize;
        }

        this.immediateFastPathTargetRounds = perc90;

        for (let i = 0; i < perc90 - stepSize; i += stepSize) {
            this.calculatePoint(i, true, false, false, true);
        }
        this.currentRounds = perc90

        this.isStopped = true;
        this.start();
    }

    immediate(isPreview = false, overrideStepSize?: number): void {
        this.stop();
        this.calculateNeededRounds();
        if (!this.validateNeededRounds(!isPreview)) return;
        this.drawInfo();
        this.currentRounds = 0;
        this.realPointCount = 0;
        this.points = [];
        const stepSize = overrideStepSize ?? this.store.ui.stepSize;
        this.immediateFastPathTargetRounds = this.neededRounds;
        for (let i = 0; i <= this.neededRounds; i += stepSize) {
            this.calculatePoint(i, true, false, false, true);
        }
        this.points = this.points.filter(p => p.keep || p.i > this.realPointCount - 100);
        this.currentRounds = this.neededRounds;
        this.drawInfo();
        this.calculatePoint(0, false, true);
    }

    restart(): void {
        if (this.animationHandle) {
            window.cancelAnimationFrame(this.animationHandle);
        }
        this.calculateNeededRounds();
        if (!this.validateNeededRounds()) return;
        this.currentRounds = 0;
        this.points = [];
        this.realPointCount = 0;
        this.isStopped = false;
        this.animationHandle = window.requestAnimationFrame(() => this.calculatePoint(this.currentRounds));
    }

    start(): void {
        if (!this.isStopped) {
            this.restart();
            return;
        }
        if (this.currentRounds >= this.neededRounds) {
            this.restart();
            return;
        }
        this.isStopped = false;
        this.animationHandle = window.requestAnimationFrame(() => this.calculatePoint(this.currentRounds));
    }

    stop(): void {
        if (this.animationHandle) {
            window.cancelAnimationFrame(this.animationHandle);
            this.animationHandle = null;
            this.isStopped = true;
            this.calculatePoint(this.currentRounds, false, true);
        }
        this.drawInfo();
    }

    factoryReset(): void {
        localStorage.removeItem('settings');
        this.store.resetToDefaults();
        this.store.loadSettings();
        this.updateParamsFromStore(false);
        this.reset();
    }

    resize(): void {
        const canvasContainer = this.canvas.closest('.canvas-container') as HTMLElement | null;
        let width = canvasContainer ? canvasContainer.clientWidth : document.documentElement.clientWidth;
        let height = canvasContainer ? canvasContainer.clientHeight : document.documentElement.clientHeight;
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        width = Math.round(width * this.pixelRatio);
        height = Math.round(height * this.pixelRatio);

        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
            this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
            if (!this.animationHandle) {
                this.calculatePoint(0, false, true);
            }
        }
    }

    private isDraggableVisible(draggable: DraggablePoint): boolean {
        return !draggable.showWhen || draggable.showWhen(this.store.drawingParameters);
    }

    private getCanvasPointFromTouch(touch: Touch): Point {
        const rect = this.canvas.getBoundingClientRect();
        const logicalWidth = this.canvas.width / this.pixelRatio;
        const logicalHeight = this.canvas.height / this.pixelRatio;
        return {
            x: ((touch.clientX - rect.left) * logicalWidth) / rect.width,
            y: ((touch.clientY - rect.top) * logicalHeight) / rect.height,
        };
    }

    private getMouseCanvasPoint(event: { offsetX?: number; offsetY?: number; clientX?: number; clientY?: number }): Point {
        const rect = this.canvas.getBoundingClientRect();
        const logicalWidth = this.canvas.width / this.pixelRatio;
        const logicalHeight = this.canvas.height / this.pixelRatio;
        const offsetX = event.offsetX ?? (event.clientX ?? 0) - rect.left;
        const offsetY = event.offsetY ?? (event.clientY ?? 0) - rect.top;
        return {
            x: (offsetX * logicalWidth) / rect.width,
            y: (offsetY * logicalHeight) / rect.height,
        };
    }

    private getTransformedPoint(x: number, y: number): Point {
        const originalPoint = new DOMPoint(x * this.pixelRatio, y * this.pixelRatio);
        const transformed = this.context.getTransform().invertSelf().transformPoint(originalPoint);
        return { x: transformed.x, y: transformed.y };
    }

    private zoomAt(point: Point, zoom: number): void {
        const nextZoom = Math.min(10, Math.max(0.05, this.currentZoom * zoom));
        const appliedZoom = nextZoom / this.currentZoom;
        const transformedPoint = this.getTransformedPoint(point.x, point.y);
        this.context.translate(transformedPoint.x, transformedPoint.y);
        this.context.scale(appliedZoom, appliedZoom);
        this.context.translate(-transformedPoint.x, -transformedPoint.y);
        this.currentZoom = nextZoom;
    }

    private bindCanvasInteractions(): void {
        const onMouseDown = (event: MouseEvent | { offsetX: number; offsetY: number }): void => {
            this.isDragging = true;
            const canvasPoint = this.getMouseCanvasPoint(event);
            this.dragStartPosition = this.getTransformedPoint(canvasPoint.x, canvasPoint.y);

            if (this.isStopped && this.store.ui.drawControls) {

                let minDistance = Number.POSITIVE_INFINITY;
                let minDistanceControl: DraggablePoint | null = null;

                for (const key of Object.keys(this.store.draggables)) {
                    const draggable = this.store.draggables[key];
                    if (!this.isDraggableVisible(draggable)) continue;
                    const distance = Math.sqrt((this.dragStartPosition.x - draggable.x) ** 2 + (this.dragStartPosition.y - draggable.y) ** 2);
                    if (distance < minDistance) {
                        minDistance = distance;
                        minDistanceControl = draggable;
                    }
                }

                if (minDistanceControl && minDistance < 50) {
                    this.clickedControl = minDistanceControl;
                    this.reset();
                }
            }

        };

        const onMouseMove = (event: MouseEvent | { offsetX: number; offsetY: number }): void => {
            const canvasPoint = this.getMouseCanvasPoint(event);
            this.currentTransformedCursor = this.getTransformedPoint(canvasPoint.x, canvasPoint.y);
            if (this.isDragging) {
                if (this.clickedControl) {
                    const movedX = this.currentTransformedCursor.x - this.dragStartPosition.x;
                    const movedY = this.currentTransformedCursor.y - this.dragStartPosition.y;
                    if (this.clickedControl.allowX !== false) this.clickedControl.x += movedX;
                    if (this.clickedControl.allowY !== false) this.clickedControl.y += movedY;
                    if (this.clickedControl.moveAlso) {
                        for (const key of this.clickedControl.moveAlso) {
                            const related = this.store.draggables[key];
                            if (!related) continue;
                            if (this.clickedControl.allowX !== false) related.x += movedX;
                            if (this.clickedControl.allowY !== false) related.y += movedY;
                        }
                    }
                    this.dragStartPosition = this.getTransformedPoint(canvasPoint.x, canvasPoint.y);
                    this.updateDrawingSettingsFromDraggables();
                    this.store.storeSettings();
                    // this.calculatePoint(this.currentRounds, false, true);
                } else {
                    this.context.translate(this.currentTransformedCursor.x - this.dragStartPosition.x, this.currentTransformedCursor.y - this.dragStartPosition.y);
                    this.calculatePoint(this.currentRounds, false, true);
                }
            }
        };

        const onMouseUp = (): void => {
            this.isDragging = false;
            this.clickedControl = null;
            if (this.isStopped && this.store.ui.drawControls)
                this.immediate(true)
        };

        const onWheel = (event: WheelEvent): void => {
            const zoom = event.deltaY < 0 ? 1.1 : 0.9;
            this.zoomAt(this.getMouseCanvasPoint(event), zoom);
            this.calculatePoint(this.currentRounds, false, true);
            event.preventDefault();
        };

        const getPinchState = (touches: TouchList): { distance: number; midpoint: Point } => {
            const firstPoint = this.getCanvasPointFromTouch(touches[0]);
            const secondPoint = this.getCanvasPointFromTouch(touches[1]);
            return {
                distance: Math.hypot(secondPoint.x - firstPoint.x, secondPoint.y - firstPoint.y),
                midpoint: {
                    x: (firstPoint.x + secondPoint.x) / 2,
                    y: (firstPoint.y + secondPoint.y) / 2,
                },
            };
        };

        this.canvas.addEventListener('mousedown', onMouseDown);
        this.canvas.addEventListener('mousemove', onMouseMove);
        this.canvas.addEventListener('mouseup', onMouseUp);
        this.canvas.addEventListener('wheel', onWheel);
        this.canvas.style.touchAction = 'none';

        this.canvas.addEventListener(
            'touchstart',
            evt => {
                evt.preventDefault();
                if (evt.touches.length === 2) {
                    this.isDragging = false;
                    this.clickedControl = null;
                    this.pinchState = getPinchState(evt.touches);
                } else if (evt.touches.length === 1) {
                    const point = this.getCanvasPointFromTouch(evt.touches[0]);
                    this.pinchState = null;
                    onMouseDown({ offsetX: point.x, offsetY: point.y });
                }
            },
            { passive: false },
        );

        this.canvas.addEventListener(
            'touchmove',
            evt => {
                evt.preventDefault();
                if (evt.touches.length === 2) {
                    const nextPinchState = getPinchState(evt.touches);
                    if (this.pinchState && this.pinchState.distance > 0) {
                        const zoom = nextPinchState.distance / this.pinchState.distance;
                        this.zoomAt(nextPinchState.midpoint, zoom);
                        const midpointDelta = {
                            x: nextPinchState.midpoint.x - this.pinchState.midpoint.x,
                            y: nextPinchState.midpoint.y - this.pinchState.midpoint.y,
                        };
                        this.context.translate(midpointDelta.x, midpointDelta.y);
                        this.calculatePoint(this.currentRounds, false, true);
                    }
                    this.pinchState = nextPinchState;
                } else if (evt.touches.length === 1 && this.isDragging) {
                    const point = this.getCanvasPointFromTouch(evt.touches[0]);
                    onMouseMove({ offsetX: point.x, offsetY: point.y });
                }
            },
            { passive: false },
        );

        this.canvas.addEventListener(
            'touchend',
            evt => {
                evt.preventDefault();
                if (evt.touches.length <= 1) {
                    this.pinchState = null;
                    onMouseUp();
                }
            },
            { passive: false },
        );
    }

    private isPrime(value: number): boolean {
        if (value < 2) return false;
        if (value === 2) return true;
        if (value % 2 === 0) return false;
        for (let i = 3; i * i <= value; i += 2) {
            if (value % i === 0) return false;
        }
        return true;
    }

    private nearestPrime(value: number): number {
        const min = 2;
        const max = 80;
        const safeValue = Math.min(Math.max(Math.round(value), min), max);
        if (this.isPrime(safeValue)) return safeValue;
        let lower = safeValue;
        let upper = safeValue;
        while (lower >= min && !this.isPrime(lower)) lower--;
        while (upper <= max && !this.isPrime(upper)) upper++;
        if (lower < min) return upper;
        if (upper > max) return lower;
        return safeValue - lower <= upper - safeValue ? lower : upper;
    }
}
