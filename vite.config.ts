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
    // HMR 설정을 객체로 명시하여 연결 안정성을 높입니다.
    hmr: process.env.DISABLE_HMR === 'true' ? false : {
      protocol: 'ws',
      host: 'localhost',
    },
    // 필요 시 포트 번호를 고정하거나 host를 true로 설정할 수 있습니다.
    host: true, 
    strictPort: true,
  },
  build: {
    outDir: 'dist',
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