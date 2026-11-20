let canvas = null
let ctx = null

let defaultDraggables = {
    leftGear: { x: 100, y: 100, moveAlso: ['leftGearPivotPoint'] },
    rightGear: { x: 900, y: 100, moveAlso: ['rightGearPivotPoint', 'planetaryGearPivotPoint'] },
    leftGearPivotPoint: { x: 100, y: 200, allowX: false },
    rightGearPivotPoint: { x: 900, y: 200, allowX: false, moveAlso: ['planetaryGearPivotPoint'] },
    simpleArmAnglePoint: { x: 500, y: 500, showWhen: (settings) => settings.armType === 'Simple' },
    simpleArmTipPoint: { x: 500, y: 600, moveAlso: ['simpleArmAnglePoint'], showWhen: (settings) => settings.armType === 'Simple' },
    planetaryGearPivotPoint: { x: 900, y: 300, allowX: false, showWhen: (settings) => settings.planetaryGear.enabled },
    clawIntersectionPoint: { x: 500, y: 400, moveAlso: ['clawEndPoint', 'leftClawEnd', 'rightClawEnd'], showWhen: (settings) => settings.armType === 'Claw' || settings.armType === 'SuperClaw' },
    leftClawEnd: { x: 600, y: 600, showWhen: (settings) => settings.armType === 'SuperClaw' },
    rightClawEnd: { x: 400, y: 600, showWhen: (settings) => settings.armType === 'SuperClaw' },
    clawEndPoint: { x: 500, y: 600, showWhen: (settings) => settings.armType === 'SuperClaw' }
}

let defaultDrawingParameters = {
    leftGear: {
        x: 100, y: 100, teeth: 31, reversed: false, draggable: true
    },
    rightGear: {
        x: 900, y: 100, teeth: 40, reversed: false, draggable: true
    },
    anchor: 'Left',
    armType: "Simple",
    turntable: {
        x: 500, y: 500, radius: 400, teeth: 60, reversed: false, disabled: false
    },
    planetaryGear: {
        innerGear: 120,
        outerGear: 29,
        radius: 100,
        enabled: false
    },
    stepSize: 0.005,
    speed: 1,
    leftGearPivotPoint: { draggable: true, x: 100, y: 200 },
    rightGearPivotPoint: { draggable: true, x: 900, y: 200 },

    simpleArm: { x: 0, length: 0 },
    claw: {
        leftArm: { lengthToIntersection: 0, extensionLength: 0, scissorLength: 0 },
        rightArm: { lengthToIntersection: 0, extensionLength: 0, scissorLength: 0 }
    }
}

let draggables = JSON.parse(JSON.stringify(defaultDraggables))
for (let k of Object.keys(defaultDraggables)) {
    draggables[k].showWhen = defaultDraggables[k].showWhen
}
let drawingParameters = JSON.parse(JSON.stringify(defaultDrawingParameters))

const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const keepEveryNthPoint = 2
let realPointCount = 0

let neededRounds = 0

let points = []
let currentRounds = 0
let animationHandle = null

let isStopped = true



function isDarkMode() {
    return document.body && document.body.classList.contains('dark-mode')
}

function getCanvasBackgroundColor() {
    return isDarkMode() ? '#0d1117' : 'white'
}

function getStrokeColor() {
    const chosenColor = document.getElementById('strokeColor').value.trim()
    if (!chosenColor) return isDarkMode() ? '#edf3ff' : 'black'

    if (chosenColor === 'white' && !isDarkMode()) return 'black'
    return chosenColor === 'black' && isDarkMode() ? '#edf3ff' : chosenColor
}

function getControlColor() {
    return isDarkMode() ? '#3586f8' : '#003c91'
}

function getTouchableColor() {
    return isDarkMode() ? '#6bbcff' : '#001747'
}

function drawInfo() {
    const infoPanel = document.getElementById('info-panel')
    infoPanel.innerHTML = `
        Progress: ${(currentRounds / neededRounds * 100).toFixed(2)}% | Rounds: ${currentRounds.toFixed(3)} / ${neededRounds} | Vertices: ${points.length} | GCD: ${gcd(drawingParameters.turntable.teeth, drawingParameters.rightGear.teeth)} | Factor: ${drawingParameters.turntable.teeth / gcd(drawingParameters.turntable.teeth, drawingParameters.rightGear.teeth)}
    `
}

function rotatePointAroundPivot(point, pivotX, pivotY, rounds) {
    const angle = - rounds * Math.PI * 2
    const dx = point.x - pivotX
    const dy = point.y - pivotY

    return {
        x: pivotX + dx * Math.cos(angle) - dy * Math.sin(angle),
        y: pivotY + dx * Math.sin(angle) + dy * Math.cos(angle),
    }
}

function drawPattern() {
    ctx.beginPath()

    for (let i = 0; i < points.length; i++) {
        const p = points[i]

        if (i == 0)
            ctx.moveTo(p.x, p.y)
        else {
            ctx.lineTo(p.x, p.y)
        }
        ctx.lineTo(p.x, p.y)

    }

    ctx.strokeStyle = getStrokeColor()
    ctx.lineWidth = parseFloat(document.getElementById('strokeSize').value)
    ctx.stroke()


}

function getEasedStepSize(baseStepSize, rounds, speed) {
    const remainingRounds = neededRounds - rounds
    const safeSpeed = Math.max(speed, 1)

    if (remainingRounds <= 0) {
        return baseStepSize
    }

    const minFactor = 0.15
    const easeInWindow = 1
    const easeOutWindow = 1
    let easeInFactor = 1
    let easeOutFactor = 1

    if (rounds < easeInWindow) {
        const normalizedProgress = Math.max(0, rounds) / easeInWindow
        easeInFactor = minFactor + (1 - minFactor) * normalizedProgress * normalizedProgress
    }

    if (remainingRounds < easeOutWindow) {
        const normalizedRemaining = Math.max(0, remainingRounds) / easeOutWindow
        easeOutFactor = minFactor + (1 - minFactor) * normalizedRemaining * normalizedRemaining
    }

    const easedFactor = Math.min(easeInFactor, easeOutFactor)
    const easedStepSize = baseStepSize * easedFactor
    const maxStepToFinish = remainingRounds / safeSpeed

    return Math.min(easedStepSize, maxStepToFinish)
}

function triangleHeight(a, b, c) {
    const s = (a + b + c) / 2;

    const area = Math.sqrt(
        s * (s - a) * (s - b) * (s - c)
    );

    return 2 * area / c;
}

function calculateDistance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

function clawPoint(primeDotCurrentX, primeDotCurrentY, normDotCurrentX, normDotCurrentY, primeLength, normLength) {
    const pointDistance = calculateDistance(primeDotCurrentX, primeDotCurrentY, normDotCurrentX, normDotCurrentY)

    const primeClawIntersectionLength = primeLength
    const normClawIntersectionLength = normLength

    const height = triangleHeight(primeClawIntersectionLength, normClawIntersectionLength, pointDistance)
    const primeClawAngle = Math.asin(height / primeClawIntersectionLength)
    const normClawAngle = Math.asin(height / normClawIntersectionLength)

    const lineAngle = Math.atan2(normDotCurrentY - primeDotCurrentY, normDotCurrentX - primeDotCurrentX)
    const l1Angle = lineAngle + primeClawAngle
    const l2Angle = lineAngle + Math.PI - normClawAngle

    return {
        x: primeDotCurrentX + primeClawIntersectionLength * Math.cos(l1Angle),
        y: primeDotCurrentY + primeClawIntersectionLength * Math.sin(l1Angle),

        l1Angle: l1Angle,
        l2Angle: l2Angle
    }
}

function extendLine(x, y, angle, length) {
    return {
        x: x + length * Math.cos(angle),
        y: y + length * Math.sin(angle)
    }
}

function calculatePoint(rounds, skipDraw = false, drawExactlyOnce = false, skipVertexAddition = false) {

    drawInfo()

    const leftGearRounds = drawingParameters.turntable.teeth / drawingParameters.leftGear.teeth * rounds * (drawingParameters.leftGear.reversed ? -1 : 1)
    const rightGearRounds = drawingParameters.turntable.teeth / drawingParameters.rightGear.teeth * rounds * (drawingParameters.rightGear.reversed ? -1 : 1)

    const leftGearRadius = calculateDistance(drawingParameters.leftGear.x, drawingParameters.leftGear.y, drawingParameters.leftGearPivotPoint.x, drawingParameters.leftGearPivotPoint.y)
    const rightGearRadius = calculateDistance(drawingParameters.rightGear.x, drawingParameters.rightGear.y, drawingParameters.rightGearPivotPoint.x, drawingParameters.rightGearPivotPoint.y)

    const leftGearYFactor = Math.cos(leftGearRounds * 2 * Math.PI)
    const leftGearXFactor = Math.sin(leftGearRounds * 2 * Math.PI)

    const rightGearYFactor = Math.cos(rightGearRounds * 2 * Math.PI)
    const rightGearXFactor = Math.sin(rightGearRounds * 2 * Math.PI)

    const turntableYFactor = Math.cos(rounds * 2 * Math.PI * (drawingParameters.turntable.disabled ? 0 : (drawingParameters.turntable.reversed ? -1 : 1)))
    const turntableXFactor = Math.sin(rounds * 2 * Math.PI * (drawingParameters.turntable.disabled ? 0 : (drawingParameters.turntable.reversed ? -1 : 1)))



    if (!skipDraw) {
        // ctx.reset()
        ctx.fillStyle = getCanvasBackgroundColor()
        ctx.fillRect(-10000, -10000, canvas.width * 100, canvas.height * 100)
    }

    // delete older intermediate points
    points = points.filter((p) => p.keep || p.i > realPointCount - 100)

    if (!drawingParameters.turntable.disabled) {

        for (let i = 0; i < points.length; i++) {
            const p = points[i]
            const rotatedPoint = rotatePointAroundPivot(p, drawingParameters.turntable.x, drawingParameters.turntable.y, (rounds - currentRounds) * (drawingParameters.turntable.reversed ? -1 : 1))

            p.x = rotatedPoint.x
            p.y = rotatedPoint.y

        }
    }


    if (!skipDraw)
        drawPattern()


    const leftGearPivotX = drawingParameters.leftGear.x + leftGearXFactor * leftGearRadius
    const leftGearPivotY = drawingParameters.leftGear.y + leftGearYFactor * leftGearRadius

    drawingParameters.leftGearPivotPoint.x = leftGearPivotX
    drawingParameters.leftGearPivotPoint.y = leftGearPivotY
    // const normXWay = normX * gearSize60 / 60 * normGear * normGearMultiplier

    let rightGearPivotX = drawingParameters.rightGear.x + rightGearXFactor * rightGearRadius
    let rightGearPivotY = drawingParameters.rightGear.y + rightGearYFactor * rightGearRadius

    drawingParameters.rightGearPivotPoint.x = rightGearPivotX
    drawingParameters.rightGearPivotPoint.y = rightGearPivotY

    const turntableCurrentX = drawingParameters.turntable.x + turntableXFactor * drawingParameters.turntable.radius
    const turntableCurrentY = drawingParameters.turntable.y + turntableYFactor * drawingParameters.turntable.radius

    const drawControls = document.getElementById('drawControls').checked


    if (drawingParameters.planetaryGear.enabled) {

        const planetaryOuterGearStartX = rightGearPivotX
        const planetaryOuterGearStartY = rightGearPivotY

        const planetaryOuterRounds = rightGearRounds * (drawingParameters.planetaryGear.innerGear + drawingParameters.planetaryGear.outerGear) / drawingParameters.planetaryGear.outerGear

        const planetaryOuterGearMovX = Math.sin(planetaryOuterRounds * 2 * Math.PI)
        const planetaryOuterGearMovY = Math.cos(planetaryOuterRounds * 2 * Math.PI)

        const planetaryOuterGearPivotX = planetaryOuterGearStartX + planetaryOuterGearMovX * drawingParameters.planetaryGear.radius
        const planetaryOuterGearPivotY = planetaryOuterGearStartY + planetaryOuterGearMovY * drawingParameters.planetaryGear.radius

        rightGearPivotX = planetaryOuterGearPivotX
        rightGearPivotY = planetaryOuterGearPivotY

        // const planetaryOuterGearCurrent = rotatePointAroundPivot(planetaryOuterGearCenterX, planetaryOuterGearCenterY, planetaryInnerGearCenterX, planetaryInnerGearCenterY, (rounds - currentRounds) * (reverseNormgear ? -1 : 1))

        if (drawControls) {
            ctx.fillStyle = getControlColor()
            ctx.strokeStyle = getControlColor()

            ctx.beginPath()
            ctx.arc(planetaryOuterGearPivotX, planetaryOuterGearPivotY, 2, 0, 2 * Math.PI)
            ctx.fill()

            ctx.beginPath()
            ctx.arc(planetaryOuterGearStartX, planetaryOuterGearStartY, drawingParameters.planetaryGear.radius, 0, 2 * Math.PI)
            ctx.stroke()
        }


    }

    let targetPointX = 0, targetPointY = 0

    // claw stuff
    const pivotPointsDistance = calculateDistance(leftGearPivotX, leftGearPivotY, rightGearPivotX, rightGearPivotY)

    const leftClawLengthToIntersection = drawingParameters.claw.leftArm.lengthToIntersection
    const rightClawLengthToIntersection = drawingParameters.claw.rightArm.lengthToIntersection

    const clawTarget = clawPoint(leftGearPivotX, leftGearPivotY, rightGearPivotX, rightGearPivotY, leftClawLengthToIntersection, rightClawLengthToIntersection)

    if (drawingParameters.armType === 'Claw') {
        targetPointX = clawTarget.x
        targetPointY = clawTarget.y
    }

    const leftClawExtensionLength = drawingParameters.claw.leftArm.extensionLength
    const rightClawExtensionLength = drawingParameters.claw.rightArm.extensionLength

    const extendedLeftClaw = extendLine(clawTarget.x, clawTarget.y, clawTarget.l1Angle, leftClawExtensionLength)
    const extendedRightClaw = extendLine(clawTarget.x, clawTarget.y, clawTarget.l2Angle, rightClawExtensionLength)

    const superClawTarget = clawPoint(extendedRightClaw.x, extendedRightClaw.y, extendedLeftClaw.x, extendedLeftClaw.y, drawingParameters.claw.rightArm.scissorLength, drawingParameters.claw.leftArm.scissorLength)

    if (drawingParameters.armType === 'SuperClaw') {
        targetPointX = superClawTarget.x
        targetPointY = superClawTarget.y
    }
    // claw end


    // simple start
    const pivotPointAngle = Math.atan2(rightGearPivotY - leftGearPivotY, rightGearPivotX - leftGearPivotX)

    let midpointAxisX = 0
    let midpointAxisY = 0

    let armOriginX = leftGearPivotX
    let armOriginY = leftGearPivotY

    let armExtensionFactor = 1

    if (drawingParameters.anchor === 'Left') {
        armOriginX = leftGearPivotX
        armOriginY = leftGearPivotY
    }
    if (drawingParameters.anchor === 'Right') {
        armOriginX = rightGearPivotX
        armOriginY = rightGearPivotY
        armExtensionFactor = -1
    }

    const midpoint = extendLine(armOriginX, armOriginY, pivotPointAngle, drawingParameters.simpleArm.x * armExtensionFactor)

    midpointAxisX = midpoint.x
    midpointAxisY = midpoint.y

    const targetPoint = extendLine(midpointAxisX, midpointAxisY, drawingParameters.simpleArm.angle + pivotPointAngle, drawingParameters.simpleArm.length)

    if (drawingParameters.armType === 'Simple') {
        targetPointX = targetPoint.x
        targetPointY = targetPoint.y
    }

    if (drawControls && isStopped) {
        ctx.fillStyle = "green"
        for (let key of Object.keys(draggables)) {

            if (draggables[key].showWhen && !draggables[key].showWhen(drawingParameters)) {
                continue;
            }

            ctx.strokeStyle = getTouchableColor()
            ctx.beginPath()
            ctx.arc(draggables[key].x, draggables[key].y, 20, 0, 2 * Math.PI)
            ctx.stroke()
            // ctx.fillText(key, draggables[key].x + 10, draggables[key].y + 10)
        }
    }

    if (!skipDraw && drawControls) {

        ctx.fillStyle = getControlColor()
        ctx.lineWidth = 1
        ctx.font = '12px Arial'

        ctx.fillText(drawingParameters.leftGear.teeth.toString(), drawingParameters.leftGear.x, drawingParameters.leftGear.y)
        ctx.fillText(drawingParameters.rightGear.teeth.toString(), drawingParameters.rightGear.x, drawingParameters.rightGear.y)
        ctx.fillText(drawingParameters.turntable.teeth.toString(), drawingParameters.turntable.x, drawingParameters.turntable.y - drawingParameters.turntable.radius - 20)

        ctx.lineWidth = 0.5
        ctx.strokeStyle = getControlColor()
        ctx.fillStyle = getControlColor()

        // Draw prime gear cricle
        ctx.beginPath()
        ctx.arc(drawingParameters.leftGear.x, drawingParameters.leftGear.y, leftGearRadius, 0, 2 * Math.PI)
        ctx.stroke()


        // draw prime gear anchor point
        ctx.beginPath()
        ctx.arc(leftGearPivotX, leftGearPivotY, 2, 0, 2 * Math.PI)
        ctx.fill()


        // draw normal gear circle
        ctx.beginPath()
        ctx.arc(drawingParameters.rightGear.x, drawingParameters.rightGear.y, rightGearRadius, 0, 2 * Math.PI)
        ctx.stroke()


        // draw normal gear anchor point
        ctx.beginPath()
        ctx.arc(rightGearPivotX, rightGearPivotY, 2, 0, 2 * Math.PI)
        ctx.fill()

        if (drawingParameters.anchor === "Right") {
            ctx.beginPath()
            ctx.arc(rightGearPivotX, rightGearPivotY, 8, 0, 2 * Math.PI)
            ctx.stroke()
        } else {
            ctx.beginPath()
            ctx.arc(leftGearPivotX, leftGearPivotY, 8, 0, 2 * Math.PI)
            ctx.stroke()
        }

        // draw turntable circle
        ctx.beginPath()
        ctx.arc(drawingParameters.turntable.x, drawingParameters.turntable.y, drawingParameters.turntable.radius, 0, 2 * Math.PI)
        ctx.stroke()

        // draw turntable center point
        ctx.fillStyle = getControlColor()
        ctx.beginPath()
        ctx.arc(drawingParameters.turntable.x, drawingParameters.turntable.y, 2, 0, 2 * Math.PI)
        ctx.fill()


        // draw turntable round indicator point
        ctx.beginPath()
        ctx.arc(turntableCurrentX, turntableCurrentY, 2, 0, 2 * Math.PI)
        ctx.fill()



        // draw line from prime gear anchor to normal gear anchor
        ctx.beginPath()
        ctx.moveTo(leftGearPivotX, leftGearPivotY)
        ctx.lineTo(rightGearPivotX, rightGearPivotY)
        ctx.stroke()
        if (drawingParameters.armType === 'SuperClaw') {

            ctx.beginPath()
            ctx.arc(clawTarget.x, clawTarget.y, 2, 0, 2 * Math.PI)
            ctx.fill()

            ctx.beginPath()
            ctx.moveTo(leftGearPivotX, leftGearPivotY)
            ctx.lineTo(extendedLeftClaw.x, extendedLeftClaw.y)
            ctx.lineTo(targetPointX, targetPointY)
            ctx.stroke()

            ctx.beginPath()
            ctx.moveTo(rightGearPivotX, rightGearPivotY)
            ctx.lineTo(extendedRightClaw.x, extendedRightClaw.y)
            ctx.lineTo(targetPointX, targetPointY)
            ctx.stroke()

            ctx.beginPath()
            ctx.arc(extendedLeftClaw.x, extendedLeftClaw.y, 2, 0, 2 * Math.PI)
            ctx.fill()

            ctx.beginPath()
            ctx.arc(extendedRightClaw.x, extendedRightClaw.y, 2, 0, 2 * Math.PI)
            ctx.fill()
        }

        else if (drawingParameters.armType === 'Claw') {
            ctx.beginPath()
            ctx.moveTo(leftGearPivotX, leftGearPivotY)

            // // move primeClawTotalLength into primeClawAngle
            ctx.lineTo(
                targetPointX,
                targetPointY
            )
            ctx.stroke()

            ctx.beginPath()
            ctx.moveTo(rightGearPivotX, rightGearPivotY)
            ctx.lineTo(
                targetPointX,
                targetPointY
            )
            ctx.stroke()



        } else {

            ctx.beginPath()
            ctx.arc(midpointAxisX, midpointAxisY, 2, 0, 2 * Math.PI)
            ctx.fill()

            // draw line from midpoint axis to target point
            ctx.beginPath()
            ctx.moveTo(midpointAxisX, midpointAxisY)
            ctx.lineTo(targetPointX, targetPointY)
            ctx.stroke()

        }

    }

    if ((!skipDraw && rounds < neededRounds) || drawControls) {
        // draw target point
        if (drawControls) ctx.fillStyle = getControlColor()
        else ctx.fillStyle = getStrokeColor()
        ctx.beginPath()
        ctx.arc(targetPointX, targetPointY, 2, 0, 2 * Math.PI)
        ctx.fill()
    }

    if (!drawExactlyOnce) {

        if (!skipVertexAddition) {
            points.push({ keep: true, i: realPointCount, x: targetPointX, y: targetPointY })
            realPointCount++;

            if (realPointCount % keepEveryNthPoint !== 0) {
                points[points.length - 1].keep = false
            }
        }

        currentRounds = rounds
    }

    if (rounds > neededRounds) {
        stop()
        return false
    };

    if (skipDraw)
        return

    if (drawExactlyOnce)
        return

    const baseStepSize = parseFloat(document.getElementById('stepSize').value)
    const speed = parseFloat(document.getElementById('speed').value)
    const stepSize = getEasedStepSize(baseStepSize, currentRounds, speed)


    for (let i = 0; i < speed - 1; i++) {
        const shouldContinue = calculatePoint(rounds + stepSize * (i + 1), true)


        if (currentRounds >= neededRounds || shouldContinue === false) {
            // drawPattern()
            // final draw
            calculatePoint(currentRounds, false, true)
            return
        }
    }

    // setTimeout(() => {
    //     animationHandle = window.requestAnimationFrame(() => calculatePoint(currentRounds + stepSize))
    // }, 1000)


    animationHandle = window.requestAnimationFrame(() => calculatePoint(currentRounds + stepSize))

}

function loadSettings() {
    const savedSettings = localStorage.getItem('settings')
    if (!savedSettings) {
        applyTheme('dark')
        return
    }


    const settings = JSON.parse(savedSettings)

    drawingParameters = settings.drawingParameters || drawingParameters

    for (let k of Object.keys(draggables)) {
        if (settings.draggables && settings.draggables[k] && settings.draggables[k].x && settings.draggables[k].y) {
            draggables[k].x = settings.draggables[k].x
            draggables[k].y = settings.draggables[k].y
        }
    }

    darkMode = settings.darkMode || false
    stroke = settings.stroke || 1
    color = settings.color || 'black'
    step = settings.step || 0.01
    speed = settings.speed || 1
    drawControls = settings.drawControls || false

    document.getElementById('strokeSize').value = stroke
    document.getElementById('strokeColor').value = color
    document.getElementById('stepSize').value = step
    document.getElementById('speed').value = speed
    document.getElementById('drawControls').checked = drawControls

    document.getElementById('leftGear').value = drawingParameters.leftGear?.teeth || 43
    document.getElementById('rightGear').value = drawingParameters.rightGear?.teeth || 40
    document.getElementById('turntable').value = drawingParameters.turntable?.teeth || 60
    document.getElementById('anchor').value = drawingParameters.anchor || 'Left'
    document.getElementById('rodLength').value = drawingParameters.rodLength || 100
    document.getElementById('rodX').value = drawingParameters.rodX || 500
    document.getElementById('leftGearRadius').value = draggables.leftGearPivotPoint.y - draggables.leftGear.y
    document.getElementById('rightGearRadius').value = draggables.rightGearPivotPoint.y - draggables.rightGear.y
    document.getElementById('planetaryGearEnabled').checked = drawingParameters.planetaryGearEnable || false
    document.getElementById('planetaryInnerGear').value = drawingParameters.planetaryGear.innerGear || 12
    document.getElementById('planetaryOuterGear').value = drawingParameters.planetaryGear.outerGear || 24
    document.getElementById('arm').value = drawingParameters.armType || "Simple"

    applyTheme(settings.darkMode ? 'dark' : 'light')
}

function lineIntersection(x1, x2, p1, p2) {
    const dx = x2.x - x1.x;
    const dy = x2.y - x1.y;

    const ex = p2.x - p1.x;
    const ey = p2.y - p1.y;

    const denominator = dx * ey - dy * ex;

    // Lines are parallel (or coincident)
    if (denominator === 0) {
        return null;
    }

    const t =
        ((p1.x - x1.x) * ey - (p1.y - x1.y) * ex) /
        denominator;

    return {
        x: x1.x + t * dx,
        y: x1.y + t * dy
    };
}

function updateDrawingSettingsFromDraggables() {
    drawingParameters.leftGear.x = draggables.leftGear.x
    drawingParameters.leftGear.y = draggables.leftGear.y
    drawingParameters.rightGear.x = draggables.rightGear.x
    drawingParameters.rightGear.y = draggables.rightGear.y
    drawingParameters.leftGearPivotPoint.x = draggables.leftGearPivotPoint.x
    drawingParameters.leftGearPivotPoint.y = draggables.leftGearPivotPoint.y
    drawingParameters.rightGearPivotPoint.x = draggables.rightGearPivotPoint.x
    drawingParameters.rightGearPivotPoint.y = draggables.rightGearPivotPoint.y

    drawingParameters.planetaryGear.radius = draggables.planetaryGearPivotPoint.y - draggables.rightGearPivotPoint.y

    let rightGearPivotPointX = draggables.rightGearPivotPoint.x
    let rightGearPivotPointY = draggables.rightGearPivotPoint.y

    if (drawingParameters.planetaryGear.enabled) {
        rightGearPivotPointX = draggables.planetaryGearPivotPoint.x
        rightGearPivotPointY = draggables.planetaryGearPivotPoint.y

        draggables.leftGearPivotPoint.x = draggables.leftGear.x
        draggables.leftGearPivotPoint.y = draggables.leftGear.y

        drawingParameters.leftGearPivotPoint.x = draggables.leftGearPivotPoint.x
        drawingParameters.leftGearPivotPoint.y = draggables.leftGearPivotPoint.y
    }


    const pivotPointAngle = Math.atan2(rightGearPivotPointY - draggables.leftGearPivotPoint.y, rightGearPivotPointX - draggables.leftGearPivotPoint.x)
    const leftArmAngle = Math.atan2(draggables.simpleArmTipPoint.y - draggables.simpleArmAnglePoint.y, draggables.simpleArmTipPoint.x - draggables.simpleArmAnglePoint.x)
    const rightArmAngle = Math.atan2(draggables.simpleArmAnglePoint.y - draggables.simpleArmTipPoint.y, draggables.simpleArmAnglePoint.x - draggables.simpleArmTipPoint.x)


    const intersection = lineIntersection(
        draggables.simpleArmTipPoint,
        draggables.simpleArmAnglePoint,
        draggables.leftGearPivotPoint,
        { x: rightGearPivotPointX, y: rightGearPivotPointY }
    )

    const leftArmX = calculateDistance(intersection.x, intersection.y, draggables.leftGearPivotPoint.x, draggables.leftGearPivotPoint.y)
    const rightArmX = calculateDistance(intersection.x, intersection.y, rightGearPivotPointX, rightGearPivotPointY)

    const leftArmLength = calculateDistance(intersection.x, intersection.y, draggables.simpleArmTipPoint.x, draggables.simpleArmTipPoint.y)
    const rightArmLength = calculateDistance(intersection.x, intersection.y, draggables.simpleArmTipPoint.x, draggables.simpleArmTipPoint.y)

    // const leftPivotPenPointAngle = Math.atan2(draggables.simpleArmTipPoint.y - draggables.leftGearPivotPoint.y, draggables.simpleArmTipPoint.x - draggables.leftGearPivotPoint.x)
    // const rightPivotPenPointAngle = Math.atan2(draggables.rightGearPivotPoint.y - draggables.simpleArmTipPoint.y, draggables.rightGearPivotPoint.x - draggables.simpleArmTipPoint.x)

    // const leftPivotPenDistance = calculateDistance(draggables.leftGearPivotPoint.x, draggables.leftGearPivotPoint.y, draggables.simpleArmTipPoint.x, draggables.simpleArmTipPoint.y)
    // const rightPivotPenDistance = calculateDistance(draggables.rightGearPivotPoint.x, draggables.rightGearPivotPoint.y, draggables.simpleArmTipPoint.x, draggables.simpleArmTipPoint.y)

    // const leftArmLength = Math.sin(leftPivotPenPointAngle - pivotPointAngle ) * leftPivotPenDistance
    // const rightArmLength = Math.sin(rightPivotPenPointAngle - pivotPointAngle - Math.PI ) * rightPivotPenDistance

    // const leftArmX = Math.cos(leftPivotPenPointAngle - pivotPointAngle) * leftPivotPenDistance
    // const rightArmX = Math.cos(rightPivotPenPointAngle - pivotPointAngle - Math.PI) * rightPivotPenDistance


    if (drawingParameters.anchor === 'Left') {
        drawingParameters.simpleArm.x = leftArmX
        drawingParameters.simpleArm.length = leftArmLength
        drawingParameters.simpleArm.angle = leftArmAngle
    } else {
        drawingParameters.simpleArm.x = rightArmX
        drawingParameters.simpleArm.length = rightArmLength
        drawingParameters.simpleArm.angle = leftArmAngle
    }




    const leftGearPivotX = draggables.leftGearPivotPoint.x
    const leftGearPivotY = draggables.leftGearPivotPoint.y

    let rightGearPivotX = draggables.rightGearPivotPoint.x
    let rightGearPivotY = draggables.rightGearPivotPoint.y

    if (drawingParameters.planetaryGear.enabled) {
        rightGearPivotX = draggables.planetaryGearPivotPoint.x
        rightGearPivotY = draggables.planetaryGearPivotPoint.y
    }


    const pivotPointsDistance = calculateDistance(leftGearPivotX, leftGearPivotY, rightGearPivotX, rightGearPivotY)

    const leftClawLengthToIntersection = calculateDistance(leftGearPivotX, leftGearPivotY, draggables.clawIntersectionPoint.x, draggables.clawIntersectionPoint.y)
    const rightClawLengthToIntersection = calculateDistance(rightGearPivotX, rightGearPivotY, draggables.clawIntersectionPoint.x, draggables.clawIntersectionPoint.y)

    drawingParameters.claw.leftArm.lengthToIntersection = leftClawLengthToIntersection
    drawingParameters.claw.rightArm.lengthToIntersection = rightClawLengthToIntersection

    const clawTarget = clawPoint(leftGearPivotX, leftGearPivotY, rightGearPivotX, rightGearPivotY, leftClawLengthToIntersection, rightClawLengthToIntersection)

    const leftClawExtensionLength = calculateDistance(draggables.clawIntersectionPoint.x, draggables.clawIntersectionPoint.y, draggables.leftClawEnd.x, draggables.leftClawEnd.y)
    const rightClawExtensionLength = calculateDistance(draggables.clawIntersectionPoint.x, draggables.clawIntersectionPoint.y, draggables.rightClawEnd.x, draggables.rightClawEnd.y)

    drawingParameters.claw.leftArm.extensionLength = leftClawExtensionLength
    drawingParameters.claw.rightArm.extensionLength = rightClawExtensionLength

    const leftArmExtension = extendLine(clawTarget.x, clawTarget.y, clawTarget.l1Angle, leftClawExtensionLength)
    const rightArmExtension = extendLine(clawTarget.x, clawTarget.y, clawTarget.l2Angle, rightClawExtensionLength)

    draggables.leftClawEnd.x = leftArmExtension.x
    draggables.leftClawEnd.y = leftArmExtension.y
    draggables.rightClawEnd.x = rightArmExtension.x
    draggables.rightClawEnd.y = rightArmExtension.y

    drawingParameters.claw.leftArm.scissorLength = calculateDistance(leftArmExtension.x, leftArmExtension.y, draggables.clawEndPoint.x, draggables.clawEndPoint.y)
    drawingParameters.claw.rightArm.scissorLength = calculateDistance(rightArmExtension.x, rightArmExtension.y, draggables.clawEndPoint.x, draggables.clawEndPoint.y)

}

function updateUIFromParams() {
    document.getElementById('leftGearRadius').value = draggables.leftGearPivotPoint.y - draggables.leftGear.y
    document.getElementById('rightGearRadius').value = draggables.rightGearPivotPoint.y - draggables.rightGear.y

    document.getElementById('rodLength').value = drawingParameters.simpleArm.length
    document.getElementById('rodX').value = drawingParameters.simpleArm.x
    document.getElementById('rodAngle').value = drawingParameters.simpleArm.angle

}

function storeSettings() {
    const darkMode = isDarkMode()
    const stroke = document.getElementById('strokeSize').value
    const color = document.getElementById('strokeColor').value
    const step = document.getElementById('stepSize').value
    const speed = document.getElementById('speed').value

    const drawControls = document.getElementById('drawControls').checked

    const settings = {
        drawingParameters,
        draggables,
        darkMode,
        stroke,
        color,
        step,
        speed,
        drawControls
    }

    localStorage.setItem('settings', JSON.stringify(settings))
}

function updateParamsFromUI() {

    drawingParameters.leftGear.teeth = parseInt(document.getElementById('leftGear').value)
    drawingParameters.rightGear.teeth = parseInt(document.getElementById('rightGear').value)
    drawingParameters.turntable.teeth = parseInt(document.getElementById('turntable').value)

    draggables.leftGearPivotPoint.x = draggables.leftGear.x
    draggables.leftGearPivotPoint.y = draggables.leftGear.y + parseFloat(document.getElementById('leftGearRadius').value)
    draggables.rightGearPivotPoint.x = draggables.rightGear.x
    draggables.rightGearPivotPoint.y = draggables.rightGear.y + parseFloat(document.getElementById('rightGearRadius').value)

    drawingParameters.rightGear.reversed = document.getElementById('reverseRightGear').checked
    drawingParameters.leftGear.reversed = document.getElementById('reverseLeftGear').checked
    drawingParameters.turntable.reversed = document.getElementById('reverseTurntable').checked

    drawingParameters.turntable.disabled = document.getElementById('disableTurntable').checked

    drawingParameters.anchor = document.getElementById('anchor').value
    drawingParameters.armType = document.getElementById('arm').value

    // primeGearMultiplier = 1
    // normGearMultiplier = 1

    drawingParameters.simpleArm.length = parseInt(document.getElementById('rodLength').value)
    drawingParameters.simpleArm.x = parseInt(document.getElementById('rodX').value)

    drawingParameters.planetaryGear.enabled = document.getElementById('planetaryGearEnabled').checked
    drawingParameters.planetaryGear.innerGear = parseInt(document.getElementById('planetaryInnerGear').value)
    drawingParameters.planetaryGear.outerGear = parseInt(document.getElementById('planetaryOuterGear').value)

    if (drawingParameters.planetaryGear.enabled) {
        drawingParameters.leftGearPivotPoint.x = drawingParameters.leftGear.x
        drawingParameters.leftGearPivotPoint.y = drawingParameters.leftGear.y
    }

    updateDrawingSettingsFromDraggables()

    storeSettings()

    if (!animationHandle) {
        calculatePoint(currentRounds, false, true)
    }

}

function calculateNeededRounds() {
    if (drawingParameters.planetaryGear.enabled) {
        neededRounds = Math.min(drawingParameters.turntable.teeth, drawingParameters.rightGear.teeth) / gcd(drawingParameters.turntable.teeth, drawingParameters.rightGear.teeth) * drawingParameters.planetaryGear.outerGear
    }
    else {
        neededRounds = Math.min(drawingParameters.turntable.teeth, drawingParameters.rightGear.teeth) / gcd(drawingParameters.turntable.teeth, drawingParameters.rightGear.teeth) * drawingParameters.leftGear.teeth
    }

    if (drawingParameters.turntable.disabled) {
        neededRounds = drawingParameters.rightGear.teeth / drawingParameters.turntable.teeth * drawingParameters.leftGear.teeth
    }

}

function reset() {
    stop()
    // updateParams()
    calculateNeededRounds()
    currentRounds = 0
    points = []
    realPointCount = 0
    drawInfo()
    calculatePoint(0, false, true)
}

function last10Percents() {
    stop()
    // updateParams()
    calculateNeededRounds()
    if (!validateNeededRounds()) return;
    drawInfo()
    currentRounds = 0
    points = []
    realPointCount = 0

    stepSize = parseFloat(document.getElementById('stepSize').value)

    for (let i = 0; i < neededRounds * 0.9; i += stepSize) {
        calculatePoint(i, true)
    }

    calculatePoint(neededRounds * 0.9, false, true)
    isStopped = true
    start()
}

function validateNeededRounds() {
    if (neededRounds >= 230) {
        return confirm("Needed rounds exceeds 230, this can take very long...");
    }
    return true
}

function immediate() {
    stop()
    // updateParams()
    calculateNeededRounds()
    if (!validateNeededRounds()) return;
    drawInfo()
    currentRounds = 0
    realPointCount = 0
    points = []

    stepSize = parseFloat(document.getElementById('stepSize').value)

    for (let i = 0; i <= neededRounds; i += stepSize) {
        calculatePoint(i, true)
    }

    calculatePoint(neededRounds, false, true)
}

function restart() {
    if (animationHandle) {
        window.cancelAnimationFrame(animationHandle)
    }

    // updateParams()
    calculateNeededRounds()
    if (!validateNeededRounds()) return;

    currentRounds = 0
    points = []
    realPointCount = 0
    animationHandle = window.requestAnimationFrame(() => calculatePoint(currentRounds))
}

function start() {

    if (!isStopped) {
        restart()
        return
    }

    if (currentRounds >= neededRounds) {
        restart()
        return
    }

    isStopped = false
    animationHandle = window.requestAnimationFrame(() => calculatePoint(currentRounds))
}

function stop() {

    if (animationHandle) {
        window.cancelAnimationFrame(animationHandle)
        animationHandle = null
        isStopped = true
        calculatePoint(currentRounds, false, true)
    }
    drawInfo()
}

function factoryReset() {
    localStorage.removeItem('settings')
    draggables = JSON.parse(JSON.stringify(defaultDraggables))
    for (let k of Object.keys(defaultDraggables)) {
        draggables[k].showWhen = defaultDraggables[k].showWhen
    }
    drawingParameters = JSON.parse(JSON.stringify(defaultDrawingParameters))
    updateDrawingSettingsFromDraggables()
    storeSettings()
    loadSettings()
    updateUIFromParams()
    reset()
}


function isPrime(value) {
    if (value < 2) return false;
    if (value === 2) return true;
    if (value % 2 === 0) return false;

    for (let i = 3; i * i <= value; i += 2) {
        if (value % i === 0) return false;
    }

    return true;
}

function nearestPrime(value) {
    const min = 2;
    const max = 80;
    const safeValue = Math.min(Math.max(Math.round(value), min), max);

    if (isPrime(safeValue)) return safeValue;

    let lower = safeValue;
    let upper = safeValue;

    while (lower >= min && !isPrime(lower)) lower--;
    while (upper <= max && !isPrime(upper)) upper++;

    if (lower < min) return upper;
    if (upper > max) return lower;

    return safeValue - lower <= upper - safeValue ? lower : upper;
}

function syncControlPair(rangeId) {
    const rangeInput = document.getElementById(rangeId);
    const valueInput = document.querySelector('[data-slider="' + rangeId + '"]');
    if (!rangeInput || !valueInput) return;

    const value = Number(rangeInput.value);
    const step = Number(rangeInput.step || 1);
    const decimals = step < 1 ? (String(step).split('.')[1] || '').length : 0;
    const formatted = Number.isInteger(value) ? String(value) : value.toFixed(decimals);
    valueInput.value = formatted;
}

function bindSlider(rangeId, needsResetOnChange) {
    const rangeInput = document.getElementById(rangeId);
    const valueInput = document.querySelector('[data-slider="' + rangeId + '"]');
    if (!rangeInput || !valueInput) return;

    const applyRangeValue = (nextValue) => {
        const safeValue = ['primeGear', 'planetaryOuterGear'].includes(rangeId) ? nearestPrime(nextValue) : nextValue;
        rangeInput.value = safeValue;
        valueInput.value = safeValue;
    };

    rangeInput.addEventListener('input', () => {
        applyRangeValue(Number(rangeInput.value));
        updateParamsFromUI()
        if (needsResetOnChange) reset()
    });

    valueInput.addEventListener('input', () => {
        if (valueInput.value === '') return;
        applyRangeValue(Number(valueInput.value));
        updateParamsFromUI()
        if (needsResetOnChange) reset()
    });

    syncControlPair(rangeId);
}

function applyTheme(themeName) {
    const darkMode = themeName === 'dark';
    document.body.classList.toggle('dark-mode', darkMode);
    const toggle = document.getElementById('themeToggle');
    if (toggle) toggle.textContent = darkMode ? 'Light mode' : 'Dark mode';

    const canvas = document.getElementById('c');
    if (canvas) {
        canvas.style.background = darkMode ? '#0d1117' : '#ffffff';
    }

    if (typeof reset === 'function') {
        reset();
    }
}

function resize() {
    const canvasContainer = document.querySelector('.canvas-container');
    const width = canvasContainer ? canvasContainer.clientWidth : document.documentElement.clientWidth;
    const height = canvasContainer ? canvasContainer.clientHeight : document.documentElement.clientHeight;

    const canvas = document.getElementById('c');
    if (canvas) {
        canvas.width = width;
        canvas.height = height;

        if (!animationHandle) {
            calculatePoint(0, false, true);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {

    canvas = document.getElementById('c');
    ctx = canvas.getContext('2d');

    const primeGearInput = document.getElementById('leftGear');
    primeGearInput.value = nearestPrime(Number(primeGearInput.value));

    const planetaryOuterGearInput = document.getElementById('planetaryOuterGear');
    planetaryOuterGearInput.value = nearestPrime(Number(planetaryOuterGearInput.value));

    loadSettings();

    ['leftGear', 'rightGear', 'turntable', 'leftGearRadius', 'rightGearRadius', 'rodLength', 'rodX', 'rodAngle', 'stepSize', 'planetaryInnerGear', 'planetaryOuterGear'].forEach(t => bindSlider(t, true));
    ['speed', 'strokeSize'].forEach(t => bindSlider(t, false));

    document.getElementById('leftGear').value = nearestPrime(Number(document.getElementById('leftGear').value));
    document.querySelector('[data-slider="leftGear"]').value = document.getElementById('leftGear').value;

    document.getElementById('planetaryOuterGear').value = nearestPrime(Number(document.getElementById('planetaryOuterGear').value));
    document.querySelector('[data-slider="planetaryOuterGear"]').value = document.getElementById('planetaryOuterGear').value;

    document.getElementById('themeToggle').addEventListener('click', () => {
        const nextTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
        applyTheme(nextTheme);
    });

    updateParamsFromUI();
    calculatePoint(0, false, true);

    window.addEventListener('resize', resize);
    resize();

    canvasWidth = document.getElementById('c').clientWidth;
    canvasHeight = document.getElementById('c').clientHeight;

    turntableLocationX = canvasWidth / 2;
    turntableLocationY = 500;

    primeDotStartX = canvasWidth / 2 - 400;
    primeDotStartY = 200;

    normDotStartX = canvasWidth / 2 + 400;
    normDotStartY = 200;

    turntableRadius = 400;
    gearSize60 = 100;

    calculatePoint(0, false, true);
});
