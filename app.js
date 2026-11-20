let canvas = null
let ctx = null

let turntableLocationX = 500
let turntableLocationY = 500
let turntableRadius = 400

let primeDotStartY = 200
let primeDotStartX = 100

let normDotStartY = 200
let normDotStartX = 900

let primeGear = 23
let primeGearMultiplier = 1

let normGear = 60
let normGearMultiplier = 1

let rodLength = 400
let rodX = 0.5
let rodAngle = 90

let clawPrimeLength = 200
let clawNormLength = 200

let reverseNormgear = false
let reversePrimegear = false
let reverseTurntable = false
let disableTurntable = false

let planetaryGearEnabled = true
let planetaryInnerGear = 120
let planetaryOuterGear = 29

let gearSize60 = 100
let turntable = 60

let primeClawIntersectionLength = 500
let normClawIntersectionLength = 500

let primeSuperClawExtension = 100
let normSuperClawExtension = 100

let primeSuperClawScissorLength = 100
let normSuperClawScissorLength = 100

let anchor = 'Prime'

// Arm type can be 'Simple' or 'Claw' or 'SuperClaw'
let armType = 'SuperClaw'

const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const keepEveryNthPoint = 2
let realPointCount = 0

let neededRounds = 0

let points = []
let currentRounds = 0
let animationHandle = null

let isStopped = false

let controls = {
    'primeGearMultiplicator': { x: null, y: null },
    'normGearMultiplicator': { x: null, y: null }
}

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

function drawInfo() {
    const infoPanel = document.getElementById('info-panel')
    infoPanel.innerHTML = `
        Progress: ${(currentRounds / neededRounds * 100).toFixed(2)}% | Rounds: ${currentRounds.toFixed(3)} / ${neededRounds} | Vertices: ${points.length} | GCD: ${gcd(turntable, normGear)} | Factor: ${turntable / gcd(turntable, normGear)}
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

function clawPoint(primeDotCurrentX, primeDotCurrentY, normDotCurrentX, normDotCurrentY, primeLength, normLength) {
    const pointDistance = Math.sqrt((primeDotCurrentX - normDotCurrentX) ** 2 + (primeDotCurrentY - normDotCurrentY) ** 2)

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

    const primeRounds = turntable / primeGear * rounds * (reversePrimegear ? -1 : 1)
    const normRounds = turntable / normGear * rounds * (reverseNormgear ? -1 : 1)

    const primeY = Math.cos(primeRounds * 2 * Math.PI)
    const primeX = Math.sin(primeRounds * 2 * Math.PI)

    const normY = Math.cos(normRounds * 2 * Math.PI)
    const normX = Math.sin(normRounds * 2 * Math.PI)

    const turntableY = Math.cos(rounds * 2 * Math.PI * (disableTurntable ? 0 : (reverseTurntable ? -1 : 1)))
    const turntableX = Math.sin(rounds * 2 * Math.PI * (disableTurntable ? 0 : (reverseTurntable ? -1 : 1)))


    if (!skipDraw) {
        // ctx.reset()
        ctx.fillStyle = getCanvasBackgroundColor()
        ctx.fillRect(-10000, -10000, canvas.width * 100, canvas.height * 100)
    }

    // delete older intermediate points
    points = points.filter((p) => p.keep || p.i > realPointCount - 100)

    if (!disableTurntable) {

        for (let i = 0; i < points.length; i++) {
            const p = points[i]
            const rotatedPoint = rotatePointAroundPivot(p, turntableLocationX, turntableLocationY, (rounds - currentRounds) * (reverseTurntable ? -1 : 1))

            p.x = rotatedPoint.x
            p.y = rotatedPoint.y


        }
    }


    if (!skipDraw)
        drawPattern()


    let primeDotCurrentX = primeDotStartX + primeX * gearSize60 / 60 * primeGear * primeGearMultiplier
    const primeDotCurrentY = primeDotStartY + primeY * gearSize60 / 60 * primeGear * primeGearMultiplier

    const normXWay = normX * gearSize60 / 60 * normGear * normGearMultiplier

    let normDotCurrentX = normDotStartX + normX * gearSize60 / 60 * normGear * normGearMultiplier
    let normDotCurrentY = normDotStartY + normY * gearSize60 / 60 * normGear * normGearMultiplier

    const turntableCurrentX = turntableLocationX + turntableX * 400
    const turntableCurrentY = turntableLocationY + turntableY * 400

    const drawControls = document.getElementById('drawControls').checked


    if (planetaryGearEnabled) {

        const planetaryOuterGearStartX = normDotCurrentX
        const planetaryOuterGearStartY = normDotCurrentY

        const planetaryOuterRounds = normRounds * (planetaryInnerGear + planetaryOuterGear) / planetaryOuterGear

        const planetaryOuterGearMovX = Math.sin(planetaryOuterRounds * 2 * Math.PI)
        const planetaryOuterGearMovY = Math.cos(planetaryOuterRounds * 2 * Math.PI)

        const planetaryOuterGearCurrentX = planetaryOuterGearStartX + planetaryOuterGearMovX * gearSize60 / 60 * planetaryOuterGear
        const planetaryOuterGearCurrentY = planetaryOuterGearStartY + planetaryOuterGearMovY * gearSize60 / 60 * planetaryOuterGear

        normDotCurrentX = planetaryOuterGearCurrentX
        normDotCurrentY = planetaryOuterGearCurrentY

        // const planetaryOuterGearCurrent = rotatePointAroundPivot(planetaryOuterGearCenterX, planetaryOuterGearCenterY, planetaryInnerGearCenterX, planetaryInnerGearCenterY, (rounds - currentRounds) * (reverseNormgear ? -1 : 1))

        if (drawControls) {
            ctx.fillStyle = getControlColor()
            ctx.strokeStyle = getControlColor()

            ctx.beginPath()
            ctx.arc(planetaryOuterGearCurrentX, planetaryOuterGearCurrentY, 2, 0, 2 * Math.PI)
            ctx.fill()

            ctx.beginPath()
            ctx.arc(planetaryOuterGearStartX, planetaryOuterGearStartY, gearSize60 / 60 * planetaryOuterGear, 0, 2 * Math.PI)
            ctx.stroke()
        }


    }

    let targetPointX = 0, targetPointY = 0

    // claw stuff
    const pointDistance = Math.sqrt((primeDotCurrentX - normDotCurrentX) ** 2 + (primeDotCurrentY - normDotCurrentY) ** 2)

    const primeClawTotalLength = primeClawIntersectionLength + primeSuperClawExtension
    const normClawTotalLength = normClawIntersectionLength + normSuperClawExtension

    const clawTarget = clawPoint(primeDotCurrentX, primeDotCurrentY, normDotCurrentX, normDotCurrentY, primeClawIntersectionLength, normClawIntersectionLength)

    if (armType === 'Claw') {
        targetPointX = clawTarget.x
        targetPointY = clawTarget.y
    }

    const extendedPrimeClaw = extendLine(primeDotCurrentX, primeDotCurrentY, clawTarget.l1Angle, primeClawTotalLength)
    const extendedNormClaw = extendLine(normDotCurrentX, normDotCurrentY, clawTarget.l2Angle, normClawTotalLength)

    const superClawTarget = clawPoint(extendedNormClaw.x, extendedNormClaw.y, extendedPrimeClaw.x, extendedPrimeClaw.y, normSuperClawScissorLength, primeSuperClawScissorLength)

    if (armType === 'SuperClaw') {

        targetPointX = superClawTarget.x
        targetPointY = superClawTarget.y
    }
    // claw end

    let ox = primeDotCurrentX
    let oy = primeDotCurrentY

    let sx = normDotCurrentX
    let sy = normDotCurrentY

    if (anchor == 'Normal') {
        [ox, oy] = [normDotCurrentX, normDotCurrentY];
        [sx, sy] = [primeDotCurrentX, primeDotCurrentY];
    }
    else {
        [ox, oy] = [primeDotCurrentX, primeDotCurrentY];
        [sx, sy] = [normDotCurrentX, normDotCurrentY];
    }
    const dx = sx - ox
    const dy = sy - oy

    const distance = Math.sqrt(dx * dx + dy * dy)

    const midX = ox + rodX * dx / distance
    const midY = oy + rodX * dy / distance

    const midpointAxisX = midX
    const midpointAxisY = midY

    const rotatedNormPointX = midpointAxisX + (ox - midpointAxisX) * Math.cos(Math.PI / 180 * rodAngle) - (oy - midpointAxisY) * Math.sin(Math.PI / 180 * rodAngle)
    const rotatedNormPointY = midpointAxisY + (ox - midpointAxisX) * Math.sin(Math.PI / 180 * rodAngle) + (oy - midpointAxisY) * Math.cos(Math.PI / 180 * rodAngle)

    let d2x = rotatedNormPointX - midpointAxisX
    let d2y = rotatedNormPointY - midpointAxisY
    const d2Distance = Math.sqrt(d2x * d2x + d2y * d2y)


    if (armType === 'Simple') {
        targetPointX = midpointAxisX + rodLength * d2x / d2Distance
        targetPointY = midpointAxisY + rodLength * d2y / d2Distance
    }

    const rodMidpointX = (midpointAxisX + targetPointX) / 2
    const rodMidpointY = (midpointAxisY + targetPointY) / 2


    controls.primeGearMultiplicator = { x: primeDotCurrentX, y: primeDotCurrentY }
    controls.normGearMultiplicator = { x: normDotCurrentX, y: normDotCurrentY }
    controls.targetPoint = { x: targetPointX, y: targetPointY }
    controls.midpointAxis = { x: midpointAxisX, y: midpointAxisY }
    controls.rodMidpoint = { x: rodMidpointX, y: rodMidpointY }
    controls.clawIntersection = { x: clawTarget.x, y: clawTarget.y }
    controls.superClawPrimeExtension = { x: extendedPrimeClaw.x, y: extendedPrimeClaw.y }
    controls.superClawNormExtension = { x: extendedNormClaw.x, y: extendedNormClaw.y }


    if (!skipDraw && drawControls) {

        ctx.fillStyle = getControlColor()
        ctx.lineWidth = 1
        ctx.font = '12px Arial'

        ctx.fillText(primeGear.toString(), primeDotStartX, primeDotStartY)
        ctx.fillText(normGear.toString(), normDotStartX, normDotStartY)
        ctx.fillText(turntable.toString(), turntableLocationX, turntableLocationY - turntableRadius - 20)

        ctx.lineWidth = 0.5
        ctx.strokeStyle = getControlColor()
        ctx.fillStyle = getControlColor()

        // Draw prime gear cricle
        ctx.beginPath()
        ctx.arc(primeDotStartX, primeDotStartY, gearSize60 / 60 * primeGear * primeGearMultiplier, 0, 2 * Math.PI)
        ctx.stroke()


        // draw prime gear anchor point
        ctx.beginPath()
        ctx.arc(primeDotCurrentX, primeDotCurrentY, 2, 0, 2 * Math.PI)
        ctx.fill()


        // draw normal gear circle
        ctx.beginPath()
        ctx.arc(normDotStartX, normDotStartY, gearSize60 / 60 * normGear * normGearMultiplier, 0, 2 * Math.PI)
        ctx.stroke()


        // draw normal gear anchor point
        ctx.beginPath()
        ctx.arc(normDotCurrentX, normDotCurrentY, 2, 0, 2 * Math.PI)
        ctx.fill()

        if (anchor === "Normal") {
            ctx.beginPath()
            ctx.arc(normDotCurrentX, normDotCurrentY, 8, 0, 2 * Math.PI)
            ctx.stroke()
        } else {
            ctx.beginPath()
            ctx.arc(primeDotCurrentX, primeDotCurrentY, 8, 0, 2 * Math.PI)
            ctx.stroke()
        }

        // draw turntable circle
        ctx.beginPath()
        ctx.arc(turntableLocationX, turntableLocationY, turntableRadius, 0, 2 * Math.PI)
        ctx.stroke()

        // draw turntable center point
        ctx.fillStyle = getControlColor()
        ctx.beginPath()
        ctx.arc(turntableLocationX, turntableLocationY, 2, 0, 2 * Math.PI)
        ctx.fill()


        // draw turntable round indicator point
        ctx.beginPath()
        ctx.arc(turntableCurrentX, turntableCurrentY, 2, 0, 2 * Math.PI)
        ctx.fill()



        // draw line from prime gear anchor to normal gear anchor
        ctx.beginPath()
        ctx.moveTo(primeDotCurrentX, primeDotCurrentY)
        ctx.lineTo(normDotCurrentX, normDotCurrentY)
        ctx.stroke()
        if (armType === 'SuperClaw') {

            ctx.beginPath()
            ctx.arc(clawTarget.x, clawTarget.y, 2, 0, 2 * Math.PI)
            ctx.fill()

            ctx.beginPath()
            ctx.moveTo(primeDotCurrentX, primeDotCurrentY)
            ctx.lineTo(extendedPrimeClaw.x, extendedPrimeClaw.y)
            ctx.lineTo(targetPointX, targetPointY)
            ctx.stroke()

            ctx.beginPath()
            ctx.moveTo(normDotCurrentX, normDotCurrentY)
            ctx.lineTo(extendedNormClaw.x, extendedNormClaw.y)
            ctx.lineTo(targetPointX, targetPointY)
            ctx.stroke()

            ctx.beginPath()
            ctx.arc(extendedPrimeClaw.x, extendedPrimeClaw.y, 2, 0, 2 * Math.PI)
            ctx.fill()
            
            ctx.beginPath()
            ctx.arc(extendedNormClaw.x, extendedNormClaw.y, 2, 0, 2 * Math.PI)
            ctx.fill()
        }

        else if (armType === 'Claw') {
            ctx.beginPath()
            ctx.moveTo(primeDotCurrentX, primeDotCurrentY)

            // // move primeClawTotalLength into primeClawAngle
            ctx.lineTo(
                targetPointX,
                targetPointY
            )
            ctx.stroke()

            ctx.beginPath()
            ctx.moveTo(normDotCurrentX, normDotCurrentY)
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

            ctx.beginPath()
            ctx.arc(rodMidpointX, rodMidpointY, 2, 0, 2 * Math.PI)
            ctx.fill()
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
    document.getElementById('primeGear').value = settings.primeGear || 23
    document.getElementById('normGear').value = settings.normGear || 60
    document.getElementById('turntable').value = settings.turntable || 60
    document.getElementById('primeGearMultiplier').value = settings.primeGearMultiplier
    document.getElementById('normGearMultiplier').value = settings.normGearMultiplier
    document.getElementById('anchor').value = settings.anchor || 'Prime'
    document.getElementById('rodLength').value = settings.rodLength || 100
    document.getElementById('rodX').value = settings.rodX || 500
    document.getElementById('rodAngle').value = settings.rodAngle || 90
    document.getElementById('strokeSize').value = settings.stroke || 1
    document.getElementById('strokeColor').value = settings.color || 'black'
    document.getElementById('stepSize').value = settings.step || 0.01
    document.getElementById('speed').value = settings.speed || 1
    document.getElementById('drawControls').checked = settings.drawControls || false
    document.getElementById('reverseNormgear').checked = settings.reverseNormgear || false
    document.getElementById('reversePrimegear').checked = settings.reversePrimegear || false
    document.getElementById('reverseTurntable').checked = settings.reverseTurntable || false
    document.getElementById('disableTurntable').checked = settings.disableTurntable || false
    document.getElementById('themeToggle').innerText = settings.darkMode ? 'Light mode' : 'Dark mode'

    document.getElementById('planetaryGearEnabled').checked = settings.planetaryGearEnabled || false
    document.getElementById('planetaryInnerGear').value = settings.planetaryInnerGear || 120
    document.getElementById('planetaryOuterGear').value = settings.planetaryOuterGear || 29

    applyTheme(settings.darkMode ? 'dark' : 'light')
}



function updateUIFromParams() {
    document.getElementById('primeGearMultiplier').value = primeGearMultiplier
    document.getElementById('normGearMultiplier').value = normGearMultiplier
    document.getElementById('rodLength').value = rodLength
    document.getElementById('rodX').value = rodX
    document.getElementById('rodAngle').value = rodAngle
}

function storeSettings() {
    const darkMode = isDarkMode()
    const stroke = document.getElementById('strokeSize').value
    const color = document.getElementById('strokeColor').value
    const step = document.getElementById('stepSize').value
    const speed = document.getElementById('speed').value

    const drawControls = document.getElementById('drawControls').checked

    const settings = {
        primeGear,
        normGear,
        turntable,
        primeGearMultiplier,
        normGearMultiplier,
        anchor,
        disableTurntable,
        rodLength,
        rodX,
        rodAngle,
        stroke,
        color,
        step,
        speed,
        drawControls,
        reverseNormgear,
        reversePrimegear,
        reverseTurntable,
        darkMode,
        planetaryGearEnabled,
        planetaryInnerGear,
        planetaryOuterGear
    }

    localStorage.setItem('settings', JSON.stringify(settings))
}

function updateParamsFromUI() {

    primeGear = parseInt(document.getElementById('primeGear').value)
    normGear = parseInt(document.getElementById('normGear').value)
    turntable = parseInt(document.getElementById('turntable').value)

    primeGearMultiplier = parseFloat(document.getElementById('primeGearMultiplier').value)
    normGearMultiplier = parseFloat(document.getElementById('normGearMultiplier').value)

    reverseNormgear = document.getElementById('reverseNormgear').checked
    reversePrimegear = document.getElementById('reversePrimegear').checked
    reverseTurntable = document.getElementById('reverseTurntable').checked

    disableTurntable = document.getElementById('disableTurntable').checked

    anchor = document.getElementById('anchor').value

    // primeGearMultiplier = 1
    // normGearMultiplier = 1

    rodLength = parseInt(document.getElementById('rodLength').value)
    rodX = parseInt(document.getElementById('rodX').value)
    rodAngle = parseInt(document.getElementById('rodAngle').value)

    planetaryGearEnabled = document.getElementById('planetaryGearEnabled').checked
    planetaryInnerGear = parseInt(document.getElementById('planetaryInnerGear').value)
    planetaryOuterGear = parseInt(document.getElementById('planetaryOuterGear').value)

    if (planetaryGearEnabled) {
        primeGearMultiplier = 0
    }

    storeSettings()

    if (!animationHandle) {
        calculatePoint(currentRounds, false, true)
    }

}

function calculateNeededRounds() {
    if (planetaryGearEnabled) {
        neededRounds = Math.min(turntable, normGear) / gcd(turntable, normGear) * planetaryOuterGear
    }
    else {
        neededRounds = Math.min(turntable, normGear) / gcd(turntable, normGear) * primeGear
    }

    if (disableTurntable) {
        neededRounds = normGear / turntable * primeGear
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

    for (let i = 0; i < neededRounds; i += stepSize) {
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
    }
    drawInfo()
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

    const primeGearInput = document.getElementById('primeGear');
    primeGearInput.value = nearestPrime(Number(primeGearInput.value));

    const planetaryOuterGearInput = document.getElementById('planetaryOuterGear');
    planetaryOuterGearInput.value = nearestPrime(Number(planetaryOuterGearInput.value));

    loadSettings();

    ['primeGear', 'normGear', 'turntable', 'primeGearMultiplier', 'normGearMultiplier', 'rodLength', 'rodX', 'rodAngle', 'stepSize', 'planetaryInnerGear', 'planetaryOuterGear'].forEach(t => bindSlider(t, true));
    ['speed', 'strokeSize'].forEach(t => bindSlider(t, false));

    document.getElementById('primeGear').value = nearestPrime(Number(document.getElementById('primeGear').value));
    document.querySelector('[data-slider="primeGear"]').value = document.getElementById('primeGear').value;

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
