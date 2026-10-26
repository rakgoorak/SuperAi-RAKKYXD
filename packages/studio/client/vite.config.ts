import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * `@xterm/xterm` 5.5.0's ESM build (`lib/xterm.mjs`) contains an unused inline enum inside
 * `InputHandler.requestMode`: `let r; (P => (...))(r ||= {});`. Rollup folds `r ||= {}` to
 * `void 0 || (r = {})` and drops `let r;`, leaving an undeclared variable assignment in strict
 * ESM output that throws `ReferenceError` on any DECRQM sequence (`\x1b[?...$p`, sent on startup
 * by Freebuff and OpenCode TUIs).
 */
function fixXtermRollupBug(): Plugin {
  return {
    name: 'fix-xterm-rollup-bug',
    enforce: 'pre',
    transform(code) {
      if (!code.includes('PERMANENTLY_RESET')) return null;
      const next = code.replace(
        /let \w+;\(\w+=>\(\w+\[\w+\.NOT_RECOGNIZED=0\]="NOT_RECOGNIZED"[^;]*?\)\(\w+\|\|=\{\}\);/g,
        '',
      );
      return next !== code ? { code: next, map: null } : null;
    },
  };
}

export default defineConfig({
  plugins: [fixXtermRollupBug(), react()],
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
