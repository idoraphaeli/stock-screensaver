import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Relative asset paths in production — the Electron build loads
  // dist/index.html from the filesystem (file://), where absolute /assets
  // URLs would break.
  base: command === 'build' ? './' : '/',
  plugins: [react()],
  server: {
    proxy: {
      // Yahoo Finance blocks direct browser requests with CORS.
      // Routing through Vite's dev server sidesteps that: the browser talks
      // to localhost (same origin, no CORS), and Vite (running in Node,
      // not subject to browser CORS rules) forwards the request to Yahoo.
      '/yahoo-api': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yahoo-api/, ''),
      },
      // News headlines come from Yahoo's RSS feed, which lives on a
      // different host than the chart API.
      '/yahoo-feeds': {
        target: 'https://feeds.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yahoo-feeds/, ''),
      },
    },
  },
}))
