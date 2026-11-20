
window.onload = () => {
    const canvas = document.getElementById('c');
    const context = canvas.getContext('2d');

    // See individual pixels when zooming
    context.imageSmoothingEnabled = false;

    const mousePos = document.getElementById('mouse-pos');
    const transformedMousePos = document.getElementById('transformed-mouse-pos');

    let isDragging = false;
    let dragStartPosition = { x: 0, y: 0 };
    let currentTransformedCursor;
    let currentZoom = 1;

    let clickedControl = null;

    function getTransformedPoint(x, y) {
        const originalPoint = new DOMPoint(x, y);
        return context.getTransform().invertSelf().transformPoint(originalPoint);
    }

    function onMouseDown(event) {
        isDragging = true;
        dragStartPosition = getTransformedPoint(event.offsetX, event.offsetY);


        for (let k of Object.keys(controls)) {
            const distance = Math.sqrt(
                Math.pow(currentTransformedCursor.x - controls[k].x, 2) +
                Math.pow(currentTransformedCursor.y - controls[k].y, 2)
            );

            if (distance < 10) {
                clickedControl = k;
            }
        }
    }

    function onMouseMove(event) {
        currentTransformedCursor = getTransformedPoint(event.offsetX, event.offsetY);
        mousePos.innerText = `Original X: ${event.offsetX}, Y: ${event.offsetY}`;
        transformedMousePos.innerText = `Transformed X: ${currentTransformedCursor.x}, Y: ${currentTransformedCursor.y}`;

        if (isDragging) {
            if (clickedControl) {
                const control = controls[clickedControl];

                if (control === controls.primeGearMultiplicator) {
                    if (planetaryGearEnabled) return;

                    const primeGearSize = gearSize60 / 60 * primeGear * primeGearMultiplier * currentZoom;
                    const newGearSize = primeGearSize + (currentTransformedCursor.y - dragStartPosition.y);
                    const newPrimeGearMultiplier = newGearSize / (gearSize60 / 60 * primeGear * currentZoom);
                    // document.getElementById('primeGearMultiplier').value = newPrimeGearMultiplier;
                    // updateParams();
                    primeGearMultiplier = Math.max(0, newPrimeGearMultiplier);
                    dragStartPosition = getTransformedPoint(event.offsetX, event.offsetY);
                }
                if (control === controls.normGearMultiplicator) {
                    const normGearSize = gearSize60 / 60 * normGear * normGearMultiplier * currentZoom;
                    const newGearSize = normGearSize + (currentTransformedCursor.y - dragStartPosition.y);
                    const newNormGearMultiplier = newGearSize / (gearSize60 / 60 * normGear * currentZoom);
                    normGearMultiplier = Math.max(0, newNormGearMultiplier);
                    // document.getElementById('normGearMultiplier').value = newNormGearMultiplier;
                    // updateParams();
                    dragStartPosition = getTransformedPoint(event.offsetX, event.offsetY);
                }
                if (control === controls.midpointAxis) {
                    let factor = anchor === "Normal" ? -1 : 1;
                    let newRodX = rodX + (currentTransformedCursor.x - dragStartPosition.x) * factor;
                    rodX = newRodX;
                    // document.getElementById('rodX').value = newRodX;
                    // updateParams();
                    // You can add any specific logic for midpoint axis manipulation here if needed
                    dragStartPosition = getTransformedPoint(event.offsetX, event.offsetY);
                }
                if (control === controls.targetPoint) {
                    if (armType === 'SuperClaw') {
                        let newPrimeSuperClawExtension = primeSuperClawScissorLength + (currentTransformedCursor.x - dragStartPosition.x);
                        primeSuperClawScissorLength = newPrimeSuperClawExtension;
                        let newNormSuperClawExtension = normSuperClawScissorLength + (currentTransformedCursor.y - dragStartPosition.y);
                        normSuperClawScissorLength = newNormSuperClawExtension;
                        // document.getElementById('primeSuperClawExtension').value = newPrimeSuperClawExtension;
                        // updateParams();
                        dragStartPosition = getTransformedPoint(event.offsetX, event.offsetY);

                    } else {

                        let factor = anchor === "Normal" ? -1 : 1;
                        let newRodY = rodLength + (currentTransformedCursor.y - dragStartPosition.y) * factor;
                        rodLength = newRodY;

                        let newRodX = rodX + (currentTransformedCursor.x - dragStartPosition.x) * factor;
                        rodX = newRodX;
                        // document.getElementById('rodLength').value = newRodY;
                        // updateParams();
                        // You can add any specific logic for target point manipulation here if needed
                        dragStartPosition = getTransformedPoint(event.offsetX, event.offsetY);
                    }

                }
                if (control === controls.rodMidpoint) {
                    // let factor = anchor === "Normal" ? 1 : -1;
                    let newRoDangle = rodAngle + (currentTransformedCursor.x - dragStartPosition.x) * -1;
                    // document.getElementById('rodAngle').value = newRoDangle;
                    rodAngle = newRoDangle;
                    // updateParams();
                    dragStartPosition = getTransformedPoint(event.offsetX, event.offsetY);
                }
                if (control === controls.clawIntersection) {
                    let newPrimeClawIntersectionLength = primeClawIntersectionLength + (currentTransformedCursor.x - dragStartPosition.x);
                    primeClawIntersectionLength = newPrimeClawIntersectionLength;
                    let newNormClawIntersectionLength = normClawIntersectionLength + (currentTransformedCursor.y - dragStartPosition.y);
                    normClawIntersectionLength = newNormClawIntersectionLength;
                    dragStartPosition = getTransformedPoint(event.offsetX, event.offsetY);
                }

                if (control === controls.superClawPrimeExtension) {
                    let newPrimeSuperClawExtensionLength = primeSuperClawExtension + (currentTransformedCursor.x - dragStartPosition.x);
                    primeSuperClawExtension = Math.max(0, newPrimeSuperClawExtensionLength);
                    dragStartPosition = getTransformedPoint(event.offsetX, event.offsetY);
                }
                if (control === controls.superClawNormExtension) {
                    let newNormSuperClawExtensionLength = normSuperClawExtension + (currentTransformedCursor.y - dragStartPosition.y);
                    normSuperClawExtension = Math.max(0, newNormSuperClawExtensionLength);
                    dragStartPosition = getTransformedPoint(event.offsetX, event.offsetY);
                }
                updateUIFromParams()
                storeSettings()
                calculatePoint(currentRounds, false, true)
            } else {
                context.translate(currentTransformedCursor.x - dragStartPosition.x, currentTransformedCursor.y - dragStartPosition.y);
                calculatePoint(currentRounds, false, true)
            }
        }
    }

    function onMouseUp() {
        isDragging = false;
        clickedControl = null;
    }

    function onWheel(event) {
        const zoom = event.deltaY < 0 ? 1.1 : 0.9;

        context.translate(currentTransformedCursor.x, currentTransformedCursor.y);
        context.scale(zoom, zoom);
        currentZoom *= zoom;
        context.translate(-currentTransformedCursor.x, -currentTransformedCursor.y);

        calculatePoint(currentRounds, false, true)
        event.preventDefault();
    }

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel);
}