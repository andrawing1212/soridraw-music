import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
  build: {
    outDir: 'build',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/')
          ) {
            return 'react-core';
          }

          if (id.includes('/firebase/')) {
            return 'firebase';
          }

          if (
            id.includes('@google') ||
            id.includes('/axios/') ||
            id.includes('/zod/')
          ) {
            return 'api';
          }

          if (
            id.includes('/lodash/') ||
            id.includes('/dayjs/') ||
            id.includes('/clsx/')
          ) {
            return 'utils';
          }

          return 'vendor';
        },
      },
    },
  },
});
