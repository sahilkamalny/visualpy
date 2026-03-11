/**
 * Auto-scroll the canvas when the pointer is near the top/bottom edge during drag.
 * Called inside the RAF loop.
 */

const EDGE_ZONE = 50;    // pixels from edge to activate
const MAX_SPEED = 12;    // max pixels per frame

/**
 * Scroll the container if the pointer is near the top or bottom edge.
 * Returns the scroll delta applied.
 */
export function autoScroll(container: HTMLElement, pointerY: number): number {
    const rect = container.getBoundingClientRect();
    let delta = 0;

    if (pointerY < rect.top + EDGE_ZONE) {
        // Near top edge — scroll up
        const intensity = 1 - Math.max(0, (pointerY - rect.top)) / EDGE_ZONE;
        delta = -MAX_SPEED * Math.max(0, intensity);
    } else if (pointerY > rect.bottom - EDGE_ZONE) {
        // Near bottom edge — scroll down
        const intensity = 1 - Math.max(0, (rect.bottom - pointerY)) / EDGE_ZONE;
        delta = MAX_SPEED * Math.max(0, intensity);
    }

    if (delta !== 0) {
        container.scrollTop += delta;
    }

    return delta;
}
