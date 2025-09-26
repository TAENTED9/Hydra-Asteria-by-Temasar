import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'backend/index.ts',
    'offchain/index.ts'
  ],
  format: ['esm'],
  outDir: 'dist',
  clean: true,
  dts: false,
  splitting: false,
  sourcemap: true,
  target: 'es2022',
  outExtension: () => ({ js: '.js' }) 
})
