/**
 * Webview entry point.
 * Mounts the Svelte app and imports global styles.
 */
import './styles/global.css';
import { mount } from 'svelte';
import App from './App.svelte';

// Mount the Svelte application
const app = mount(App, {
    target: document.getElementById('app')!,
});

export default app;
