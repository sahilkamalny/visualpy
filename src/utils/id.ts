
/**
 * Generate a unique ID
 */
export function generateId(): string {
    return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
