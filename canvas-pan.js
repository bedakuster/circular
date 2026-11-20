
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

        let minDistance = Infinity;
        let minDistanceControl = null;

        for (let k of Object.keys(draggables)) {
            if (draggables[k].showWhen && !draggables[k].showWhen(drawingParameters)) {
                continue;
            }

            const distance = Math.sqrt(
                Math.pow(currentTransformedCursor.x - draggables[k].x, 2) +
                Math.pow(currentTransformedCursor.y - draggables[k].y, 2)
            );

            if (distance < minDistance) {
                minDistance = distance;
                minDistanceControl = draggables[k];
            }
        }

        if (minDistanceControl && minDistance < 20) {
            clickedControl = minDistanceControl;
            reset();
        }
    }

    function onMouseMove(event) {
        currentTransformedCursor = getTransformedPoint(event.offsetX, event.offsetY);
        mousePos.innerText = `Original X: ${event.offsetX}, Y: ${event.offsetY}`;
        transformedMousePos.innerText = `Transformed X: ${currentTransformedCursor.x}, Y: ${currentTransformedCursor.y}`;

        if (isDragging) {
            if (clickedControl) {

                const newX = clickedControl.x + (currentTransformedCursor.x - dragStartPosition.x);
                const newY = clickedControl.y + (currentTransformedCursor.y - dragStartPosition.y);

                if (clickedControl.allowX !== false) {
                    clickedControl.x = newX;
                }
                if (clickedControl.allowY !== false) {
                    clickedControl.y = newY;
                }
                if (clickedControl.moveAlso) {
                    for (let moveKey of clickedControl.moveAlso) {
                        if (draggables[moveKey]) {
                            if (clickedControl.allowX !== false) {
                                draggables[moveKey].x = draggables[moveKey].x + (currentTransformedCursor.x - dragStartPosition.x);
                            }
                            if (clickedControl.allowY !== false) {
                                draggables[moveKey].y = draggables[moveKey].y + (currentTransformedCursor.y - dragStartPosition.y);
                            }
                        }
                    }
                }

                dragStartPosition = getTransformedPoint(event.offsetX, event.offsetY);

                updateDrawingSettingsFromDraggables()
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