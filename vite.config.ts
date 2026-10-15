import { defineConfig } from 'vite';

export default defineConfig({
  // User site (davipferr.github.io) is served from the domain root.
  base: '/',
  // Three.js alone is ~550 kB minified (150 kB gzipped); one chunk is fine for a single-page app.
  build: { chunkSizeWarningLimit: 800 },
});
