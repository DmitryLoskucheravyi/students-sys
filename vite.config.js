import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  // manifest потрібен пререндеру (scripts/prerender.mjs): які CSS і JS у шматка сайту
  build: { outDir: 'dist', emptyOutDir: true, assetsInlineLimit: 0, manifest: true },
  // Шрифти — CSS-пакети: у серверну збірку сайту їх треба вбудувати, а не імпортувати з node_modules
  ssr: { noExternal: [/^@fontsource/] },
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:3000' } },
});
