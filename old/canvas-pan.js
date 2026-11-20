
function initializeCanvasPan() {
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
    let pinchState = null;

    let clickedControl = null;

    function getCanvasPoint(touch) {
        const rect = canvas.getBoundingClientRect();
        const logicalWidth = canvas.width / pixelRatio;
        const logicalHeight = canvas.height / pixelRatio;
        return {
            x: (touch.clientX - rect.left) * logicalWidth / rect.width,
            y: (touch.clientY - rect.top) * logicalHeight / rect.height,
        };
    }

    function getMouseCanvasPoint(event) {
        const rect = canvas.getBoundingClientRect();
        const logicalWidth = canvas.width / pixelRatio;
        const logicalHeight = canvas.height / pixelRatio;
        const offsetX = event.offsetX ?? event.clientX - rect.left;
        const offsetY = event.offsetY ?? event.clientY - rect.top;

        return {
            x: offsetX * logicalWidth / rect.width,
            y: offsetY * logicalHeight / rect.height,
        };
    }

    function zoomAt(point, zoom) {
        const nextZoom = Math.min(10, Math.max(0.05, currentZoom * zoom));
        const appliedZoom = nextZoom / currentZoom;
        const transformedPoint = getTransformedPoint(point.x, point.y);

        context.translate(transformedPoint.x, transformedPoint.y);
        context.scale(appliedZoom, appliedZoom);
        context.translate(-transformedPoint.x, -transformedPoint.y);

        currentZoom = nextZoom;
    }

    function getTransformedPoint(x, y) {
        const originalPoint = new DOMPoint(x * pixelRatio, y * pixelRatio);
        return context.getTransform().invertSelf().transformPoint(originalPoint);
    }

    function onMouseDown(event) {
        isDragging = true;
        const canvasPoint = getMouseCanvasPoint(event);
        dragStartPosition = getTransformedPoint(canvasPoint.x, canvasPoint.y);

        let minDistance = Infinity;
        let minDistanceControl = null;

        for (let k of Object.keys(draggables)) {
            if (draggables[k].showWhen && !draggables[k].showWhen(drawingParameters)) {
                continue;
            }

            const distance = Math.sqrt(
                Math.pow(dragStartPosition.x - draggables[k].x, 2) +
                Math.pow(dragStartPosition.y - draggables[k].y, 2)
            );

            if (distance < minDistance) {
                minDistance = distance;
                minDistanceControl = draggables[k];
            }

            mousePos.innerText = `${k}: ${distance} / ${minDistanceControl}`;
        }

        if (minDistanceControl && minDistance < 50) {
            clickedControl = minDistanceControl;
            reset();
        }
    }

    function onMouseMove(event) {
        const canvasPoint = getMouseCanvasPoint(event);
        currentTransformedCursor = getTransformedPoint(canvasPoint.x, canvasPoint.y);
        mousePos.innerText = `Original X: ${canvasPoint.x}, Y: ${canvasPoint.y}, clickedControl: ${clickedControl ? clickedControl.id : 'none'}`;
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

                dragStartPosition = getTransformedPoint(canvasPoint.x, canvasPoint.y);

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
        mousePos.innerText = `Mouseup`;
    }

    function onWheel(event) {
        const zoom = event.deltaY < 0 ? 1.1 : 0.9;
        zoomAt(getMouseCanvasPoint(event), zoom);

        calculatePoint(currentRounds, false, true)
        event.preventDefault();
    }

    function getPinchState(touches) {
        const firstPoint = getCanvasPoint(touches[0]);
        const secondPoint = getCanvasPoint(touches[1]);

        return {
            distance: Math.hypot(
                secondPoint.x - firstPoint.x,
                secondPoint.y - firstPoint.y
            ),
            midpoint: {
                x: (firstPoint.x + secondPoint.x) / 2,
                y: (firstPoint.y + secondPoint.y) / 2,
            },
        };
    }

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel);

    canvas.style.touchAction = 'none';

    canvas.addEventListener('touchstart', evt => {
        evt.preventDefault();

        if (evt.touches.length === 2) {
            isDragging = false;
            clickedControl = null;
            pinchState = getPinchState(evt.touches);
        } else if (evt.touches.length === 1) {
            const point = getCanvasPoint(evt.touches[0]);
            pinchState = null;
            onMouseDown({ offsetX: point.x, offsetY: point.y });
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', evt => {
        evt.preventDefault();

        if (evt.touches.length === 2) {
            const nextPinchState = getPinchState(evt.touches);

            if (pinchState && pinchState.distance > 0) {
                const zoom = nextPinchState.distance / pinchState.distance;
                zoomAt(nextPinchState.midpoint, zoom);

                const midpointDelta = {
                    x: nextPinchState.midpoint.x - pinchState.midpoint.x,
                    y: nextPinchState.midpoint.y - pinchState.midpoint.y,
                };
                context.translate(midpointDelta.x, midpointDelta.y);

                calculatePoint(currentRounds, false, true);
            }

            pinchState = nextPinchState;
        } else if (evt.touches.length === 1 && isDragging) {
            const point = getCanvasPoint(evt.touches[0]);
            onMouseMove({ offsetX: point.x, offsetY: point.y });
        }
    }, { passive: false });

    canvas.addEventListener('touchend', evt => {
        evt.preventDefault();

        if (evt.touches.length === 0) {
            pinchState = null;
            onMouseUp();
        } else if (evt.touches.length === 1) {
            pinchState = null;
            onMouseUp();
        }
    }, { passive: false });
}
