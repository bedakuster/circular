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

let reverseNormgear = false
let reversePrimegear = false
let reverseTurntable = false

let planetaryGearEnabled = true
let planetaryInnerGear = 120
let planetaryOuterGear = 29

let gearSize60 = 100
let turntable = 60

let anchor = 'Prime'

const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));

let neededRounds = 0

let points = []
let currentRounds = 0
let animationHandle = null

let isStopped = false

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
    return isDarkMode() ? '#9bb5d9' : 'gray'
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

function calculatePoint(rounds, skipDraw = false, drawExactlyOnce = false, skipVertexAddition = false) {

    drawInfo()

    const primeRounds = turntable / primeGear * rounds * (reversePrimegear ? -1 : 1)
    const normRounds = turntable / normGear * rounds * (reverseNormgear ? -1 : 1)

    const primeY = Math.cos(primeRounds * 2 * Math.PI)
    const primeX = Math.sin(primeRounds * 2 * Math.PI)
    const normY = Math.cos(normRounds * 2 * Math.PI)
    const normX = Math.sin(normRounds * 2 * Math.PI)

    const turntableY = Math.cos(rounds * 2 * Math.PI * (reverseTurntable ? -1 : 1))
    const turntableX = Math.sin(rounds * 2 * Math.PI * (reverseTurntable ? -1 : 1))



    if (!skipDraw) {
        // ctx.reset()
        ctx.fillStyle = getCanvasBackgroundColor()
        ctx.fillRect(-10000, -10000, canvas.width * 100, canvas.height * 100)
    }

    for (let i = 0; i < points.length; i++) {
        const p = points[i]
        const rotatedPoint = rotatePointAroundPivot(p, turntableLocationX, turntableLocationY, (rounds - currentRounds) * (reverseTurntable ? -1 : 1))

        p.x = rotatedPoint.x
        p.y = rotatedPoint.y
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

    const targetPointX = midpointAxisX + rodLength * d2x / d2Distance
    const targetPointY = midpointAxisY + rodLength * d2y / d2Distance


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

        ctx.beginPath()
        ctx.arc(primeDotStartX, primeDotStartY, gearSize60 / 60 * primeGear * primeGearMultiplier, 0, 2 * Math.PI)
        ctx.stroke()


        ctx.beginPath()
        ctx.arc(primeDotCurrentX, primeDotCurrentY, 2, 0, 2 * Math.PI)
        ctx.fill()


        ctx.beginPath()
        ctx.arc(normDotStartX, normDotStartY, gearSize60 / 60 * normGear * normGearMultiplier, 0, 2 * Math.PI)
        ctx.stroke()


        ctx.beginPath()
        ctx.arc(normDotCurrentX, normDotCurrentY, 2, 0, 2 * Math.PI)
        ctx.fill()


        ctx.beginPath()
        ctx.arc(turntableLocationX, turntableLocationY, turntableRadius, 0, 2 * Math.PI)
        ctx.stroke()

        ctx.fillStyle = getControlColor()
        ctx.beginPath()
        ctx.arc(turntableLocationX, turntableLocationY, 2, 0, 2 * Math.PI)
        ctx.fill()


        ctx.beginPath()
        ctx.arc(turntableCurrentX, turntableCurrentY, 2, 0, 2 * Math.PI)
        ctx.fill()


        ctx.beginPath()
        ctx.moveTo(primeDotCurrentX, primeDotCurrentY)
        ctx.lineTo(normDotCurrentX, normDotCurrentY)
        ctx.stroke()


        ctx.beginPath()
        ctx.moveTo(midpointAxisX, midpointAxisY)
        ctx.lineTo(targetPointX, targetPointY)
        ctx.stroke()
    }

    if (!skipDraw && rounds < neededRounds) {
        ctx.fillStyle = getControlColor()
        ctx.beginPath()
        ctx.arc(targetPointX, targetPointY, 2, 0, 2 * Math.PI)
        ctx.fill()
    }

    if (!drawExactlyOnce) {

        if (!skipVertexAddition) {
            points.push({ r: rounds, x: targetPointX, y: targetPointY })
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

    stepSize = parseFloat(document.getElementById('stepSize').value)
    speed = parseFloat(document.getElementById('speed').value)


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
    document.getElementById('themeToggle').innerText = settings.darkMode ? 'Light mode' : 'Dark mode'

    document.getElementById('planetaryGearEnabled').checked = settings.planetaryGearEnabled || false
    document.getElementById('planetaryInnerGear').value = settings.planetaryInnerGear || 120
    document.getElementById('planetaryOuterGear').value = settings.planetaryOuterGear || 29

    applyTheme(settings.darkMode ? 'dark' : 'light')
}


function updateParams() {
    canvas = document.getElementById('c');
    ctx = canvas.getContext('2d');

    primeGear = parseInt(document.getElementById('primeGear').value)
    normGear = parseInt(document.getElementById('normGear').value)
    turntable = parseInt(document.getElementById('turntable').value)

    primeGearMultiplier = parseFloat(document.getElementById('primeGearMultiplier').value)
    normGearMultiplier = parseFloat(document.getElementById('normGearMultiplier').value)

    reverseNormgear = document.getElementById('reverseNormgear').checked
    reversePrimegear = document.getElementById('reversePrimegear').checked
    reverseTurntable = document.getElementById('reverseTurntable').checked

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

    if (planetaryGearEnabled) {
        neededRounds = Math.ceil(Math.min(turntable, normGear) / gcd(turntable, normGear)) * planetaryOuterGear
    }
    else {
        neededRounds = Math.ceil(Math.min(turntable, normGear) / gcd(turntable, normGear)) * primeGear
    }

}

function reset() {
    stop()
    updateParams()
    currentRounds = 0
    points = []
    drawInfo()
    calculatePoint(0, false, true)
}

function validateNeededRounds() {
    if(neededRounds >= 230) {
        return confirm("Needed rounds exceeds 230, this can take very long...");
    }
    return true
}

function immediate() {
    stop()
    updateParams()
    if(!validateNeededRounds()) return;
    drawInfo()
    currentRounds = 0
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

    updateParams()
    if(!validateNeededRounds()) return;

    currentRounds = 0
    points = []
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
        if (needsResetOnChange) reset()
    });

    valueInput.addEventListener('input', () => {
        if (valueInput.value === '') return;
        applyRangeValue(Number(valueInput.value));
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

    updateParams();
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
