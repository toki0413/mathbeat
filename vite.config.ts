import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: '.',
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        composer: resolve(__dirname, 'composer.html')
      },
      treeshake: false
    }
  },
  server: {
    port: 8080,
    strictPort: true
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.test.ts']
  }
})
