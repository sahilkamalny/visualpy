import { Block } from '../types/blocks';
import { Config } from '../types/messages';
import { getConfig } from '../utils/config';
import { blocksToLines } from './generators';

/**
 * Convert block tree back to Python code
 */
export function blocksToCode(blocks: Block[], config?: Partial<Config>): string {
    const settings = { ...getConfig(), ...config };
    const indent = settings.indentStyle === 'tabs'
        ? '\t'
        : ' '.repeat(settings.indentSize);

    const lines = blocksToLines(blocks, 0, indent);

    // Ensure file ends with newline
    return lines.join('\n') + '\n';
}

// Export helper for convenience
export { blocksToLines } from './generators';
