import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
    plugins: [
        svelte(),
    ],
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        // Build as IIFE for VS Code webview (no ES modules)
        lib: {
            entry: resolve(__dirname, 'src/main.ts'),
            name: 'VisualPyWebview',
            formats: ['iife'],
            fileName: () => 'webview.js',
        },
        rollupOptions: {
            output: {
                // Single CSS file
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name?.endsWith('.css')) return 'webview.css';
                    return assetInfo.name ?? 'asset';
                },
            },
        },
        // No minification in dev for easier debugging
        minify: process.env.NODE_ENV === 'production',
        sourcemap: true,
    },
});
