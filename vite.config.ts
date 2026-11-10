/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Many engine/world tests loop over seeds in one case: 2-4 s alone, up to ~8 s when every
    // file runs in parallel. The 5 s default made them fail at random, one test at a time.
    testTimeout: 30_000,
  },
})
