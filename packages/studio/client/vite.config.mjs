import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': '{}',
  },
  build: { rollupOptions: { output: { manualChunks: { terminal: ['@xterm/xterm', '@xterm/addon-fit'], react: ['react', 'react-dom'] } } } },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3888',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:3888',
        ws: true
      }
    }
  }
});
