import { Block } from '../types/blocks';
import { Config } from '../types/messages';
import { blocksToLines } from './generators';

const DEFAULT_CONFIG: Config = {
    syncMode: 'onSave',
    indentSize: 4,
    indentStyle: 'spaces',
    defaultZoom: 100,
    showMinimap: true,
    showBlockIcons: false,
    palettePosition: 'left',
};

/**
 * Convert block tree back to Python code
 */
export function blocksToCode(blocks: Block[], config?: Partial<Config>): string {
    const settings = { ...DEFAULT_CONFIG, ...config };
    const indent = settings.indentStyle === 'tabs'
        ? '\t'
        : ' '.repeat(settings.indentSize);

    const lines = blocksToLines(blocks, 0, indent);

    // Ensure file ends with newline
    return lines.join('\n') + '\n';
}

// Export helper for convenience
export { blocksToLines } from './generators';
