import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// O GitHub Pages serve o site em /<nome-do-repositório>/
export default defineConfig({
  base: '/carbono-a4-a5/',
  plugins: [react()],
  test: {
    environment: 'node',
  },
})
