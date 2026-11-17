
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

    function getTransformedPoint(x, y) {
      const originalPoint = new DOMPoint(x, y);
      return context.getTransform().invertSelf().transformPoint(originalPoint);
    }

    function onMouseDown(event) {
        isDragging = true;
        dragStartPosition = getTransformedPoint(event.offsetX, event.offsetY);
    }

    function onMouseMove(event) {
        currentTransformedCursor = getTransformedPoint(event.offsetX, event.offsetY);
        mousePos.innerText = `Original X: ${event.offsetX}, Y: ${event.offsetY}`;
        transformedMousePos.innerText = `Transformed X: ${currentTransformedCursor.x}, Y: ${currentTransformedCursor.y}`;
        
        if (isDragging) {
            context.translate(currentTransformedCursor.x - dragStartPosition.x, currentTransformedCursor.y - dragStartPosition.y);
            calculatePoint(currentRounds, false, true)
            
        }
    }

    function onMouseUp() {
        isDragging = false;
    }

    function onWheel(event) {
        const zoom = event.deltaY < 0 ? 1.1 : 0.9;
    
        context.translate(currentTransformedCursor.x, currentTransformedCursor.y);
        context.scale(zoom, zoom);
        context.translate(-currentTransformedCursor.x, -currentTransformedCursor.y);
            
        calculatePoint(currentRounds, false, true)
        event.preventDefault();
    }

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel);
}