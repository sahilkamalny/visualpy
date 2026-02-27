import { Block } from '../types/blocks';
import { Config } from '../types/messages';
import { blocksToLines } from './generators';

const DEFAULT_CONFIG: Config = {
    syncMode: 'onSave',
    indentSize: 4,
    indentStyle: 'spaces',
    defaultZoom: 100,
    showMinimap: true,
    palettePosition: 'left',
};

function getRuntimeConfig(): Config {
    try {
        // Lazy require keeps unit tests independent from the VS Code host module.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const configModule = require('../utils/config') as {
            getConfig: () => Config;
        };
        return configModule.getConfig();
    } catch {
        return DEFAULT_CONFIG;
    }
}

/**
 * Convert block tree back to Python code
 */
export function blocksToCode(blocks: Block[], config?: Partial<Config>): string {
    const settings = { ...getRuntimeConfig(), ...config };
    const indent = settings.indentStyle === 'tabs'
        ? '\t'
        : ' '.repeat(settings.indentSize);

    const lines = blocksToLines(blocks, 0, indent);

    // Ensure file ends with newline
    return lines.join('\n') + '\n';
}

// Export helper for convenience
export { blocksToLines } from './generators';
