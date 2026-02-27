import * as path from 'path';
import * as fs from 'fs';
import { runTests } from '@vscode/test-electron';

function resolveLocalVSCodeExecutable(): string | undefined {
    const envPath = process.env.VSCODE_EXECUTABLE_PATH;
    const candidates = [
        envPath,
        '/Applications/Visual Studio Code.app/Contents/MacOS/Electron',
        '/Applications/Cursor.app/Contents/MacOS/Cursor',
        '/Applications/VSCodium.app/Contents/MacOS/Electron',
    ].filter((item): item is string => !!item);

    return candidates.find(candidate => fs.existsSync(candidate));
}

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to the extension test script
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        const vscodeExecutablePath = resolveLocalVSCodeExecutable();

        // Download VS Code, unzip it and run the integration test
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            ...(vscodeExecutablePath ? { vscodeExecutablePath } : {}),
        });
    } catch (err) {
        console.error('Failed to run tests', err);
        process.exit(1);
    }
}

main();
