/**
 * Ghost element manager.
 * The ghost is a single persistent DOM element that clones the dragged block
 * and follows the pointer via GPU-composited translate3d transforms.
 */

let ghost: HTMLElement | null = null;

function ensureGhost(): HTMLElement {
    if (!ghost) {
        ghost = document.createElement('div');
        ghost.className = 'vp-drag-ghost';
        ghost.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 10000;
      will-change: transform;
      display: none;
      opacity: 0;
      transition: opacity 120ms ease;
    `;
        document.body.appendChild(ghost);
    }
    return ghost;
}

/** Show the ghost by cloning the source block element */
export function showGhost(sourceEls: HTMLElement[], width: number): void {
    const g = ensureGhost();
    g.innerHTML = '';

    sourceEls.forEach(sourceEl => {
        // Clone the block visually
        const clone = sourceEl.cloneNode(true) as HTMLElement;
        clone.style.width = width + 'px'; // Enforce same width for all? Or width of source?
        // Actually, if we pass width of primary, others might be different?
        // But usually in code blocks, they are full width or aligned.
        // Let's stick to passed width for now to keep uniform look.

        clone.style.margin = '0 0 4px 0'; // Add small gap between stacked blocks
        clone.style.boxShadow = '0 12px 40px rgba(0,0,0,0.35)';
        clone.style.borderRadius = '10px';
        clone.classList.remove('selected');
        clone.classList.add('ghost-clone');
        g.appendChild(clone);
    });

    g.style.width = width + 'px';
    g.style.display = 'block';
    // Small delay for transition
    requestAnimationFrame(() => {
        g.style.opacity = '0.92';
    });
}

/** Update the ghost position using translate3d (GPU-composited) */
export function moveGhost(x: number, y: number): void {
    if (!ghost) return;
    ghost.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1.03)`;
}

/** Hide and reset the ghost */
export function hideGhost(): void {
    if (!ghost) return;
    ghost.style.opacity = '0';
    ghost.style.display = 'none';
    ghost.style.transform = '';
    ghost.innerHTML = '';
}

/** Get the ghost element (for FLIP animation target) */
export function getGhostElement(): HTMLElement | null {
    return ghost;
}
