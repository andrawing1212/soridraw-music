import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const geminiApiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
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
  };
});