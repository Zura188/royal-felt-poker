import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // base relatif agar hasil build bisa dipakai website maupun Capacitor (APK)
  base: './',
  build: {
    // WebView Android/Chrome modern; target eksplisit menghindari daftar browser lama bawaan Vite
    // (mis. safari14) yang tidak bisa diturunkan oleh esbuild versi baru.
    target: 'es2020',
  },
});
