import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// O GitHub Pages serve o site em /<nome-do-repositório>/
export default defineConfig({
  base: '/carbono-a4-a5/',
  plugins: [react()],
  // O MapLibre localiza o próprio worker via import.meta.url; o pré-empacotamento do Vite quebra esse caminho.
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  test: {
    environment: 'node',
  },
})
