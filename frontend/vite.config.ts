import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5204', changeOrigin: true },
      '/hubs': { target: 'http://localhost:5204', ws: true, changeOrigin: true }
    }
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React core
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-is/')) {
            return 'vendor-react'
          }
          // React Router
          if (id.includes('node_modules/react-router') || id.includes('node_modules/@remix-run')) {
            return 'vendor-router'
          }
          // Redux
          if (id.includes('node_modules/@reduxjs/') || id.includes('node_modules/react-redux/') || id.includes('node_modules/redux/') || id.includes('node_modules/immer/') || id.includes('node_modules/reselect/')) {
            return 'vendor-redux'
          }
          // Charts — recharts is large, isolate it
          if (id.includes('node_modules/recharts/') || id.includes('node_modules/d3-') || id.includes('node_modules/victory-')) {
            return 'vendor-charts'
          }
          // Flow diagram
          if (id.includes('node_modules/@xyflow/')) {
            return 'vendor-xyflow'
          }
          // SignalR
          if (id.includes('node_modules/@microsoft/signalr')) {
            return 'vendor-signalr'
          }
          // HTTP client
          if (id.includes('node_modules/axios/')) {
            return 'vendor-axios'
          }
          // Barcode
          if (id.includes('node_modules/react-barcode/') || id.includes('node_modules/jsbarcode/')) {
            return 'vendor-barcode'
          }
          // Everything else in node_modules → shared vendor chunk
          if (id.includes('node_modules/')) {
            return 'vendor-misc'
          }
        }
      }
    }
  }
})
