/**
 * Drop zone hit-testing cache.
 * Pre-computes bounding rects for all possible drop positions on drag start.
 * O(n) hit-test per frame — negligible at 60fps for typical block counts.
 */

export interface DropZone {
    parentId: string | null;   // null = root level
    index: number;
    rect: DOMRect;
    element: HTMLElement;       // the block element above this zone
}

/**
 * Build the drop zone cache by walking all block containers.
 * Call this once on drag start, not on every frame.
 */
export function buildDropZoneCache(
    canvas: HTMLElement,
    excludeId: string,
): DropZone[] {
    const zones: DropZone[] = [];

    function walk(container: HTMLElement, parentId: string | null): void {
        const blockEls = Array.from(
            container.querySelectorAll<HTMLElement>(':scope > [data-block-id]')
        ).filter(el => el.dataset.blockId !== excludeId);

        // Zone before the first block (index 0)
        if (blockEls.length > 0) {
            const firstRect = blockEls[0].getBoundingClientRect();
            zones.push({
                parentId,
                index: 0,
                rect: new DOMRect(firstRect.x, firstRect.y - 12, firstRect.width, 24),
                element: blockEls[0],
            });
        } else {
            // Empty container — drop zone fills the container
            const containerRect = container.getBoundingClientRect();
            if (containerRect.height > 0) {
                zones.push({
                    parentId,
                    index: 0,
                    rect: containerRect,
                    element: container,
                });
            }
        }

        blockEls.forEach((el, i) => {
            const rect = el.getBoundingClientRect();

            // Zone after each block (index i+1)
            zones.push({
                parentId,
                index: i + 1,
                rect: new DOMRect(rect.x, rect.bottom - 12, rect.width, 24),
                element: el,
            });

            // Recurse into children containers (compound blocks)
            const childContainer = el.querySelector<HTMLElement>('[data-children-of]');
            if (childContainer) {
                walk(childContainer, el.dataset.blockId!);
            }
        });
    }

    walk(canvas, null);
    return zones;
}

/**
 * Find the closest drop zone to the pointer position.
 * Returns null if no zone is within the activation radius.
 */
export function findClosestDropZone(
    zones: DropZone[],
    pointerX: number,
    pointerY: number,
    activationRadius: number = 50,
): DropZone | null {
    let closest: DropZone | null = null;
    let minDist = Infinity;

    for (const zone of zones) {
        // Check horizontal bounds first (pointer must be roughly within the zone's X range)
        if (pointerX < zone.rect.left - 40 || pointerX > zone.rect.right + 40) continue;

        const centerY = zone.rect.top + zone.rect.height / 2;
        const dist = Math.abs(pointerY - centerY);

        if (dist < minDist && dist < activationRadius) {
            minDist = dist;
            closest = zone;
        }
    }

    return closest;
}
