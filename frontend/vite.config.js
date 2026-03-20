import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:3002',
    },
  },
  preview: {
    port: 4175,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
