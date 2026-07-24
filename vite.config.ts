import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: '.',
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    // 启用摇树优化（移除曾误设的 treeshake: false）
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        composer: resolve(__dirname, 'composer.html')
      },
      output: {
        // 分离 vendor 与共用模块，提升缓存命中
        manualChunks: {
          // 8 个 world 模块单独 chunk（按需加载场景下可进一步动态 import）
          'worlds-bundle': [
            './src/worlds/world1.ts',
            './src/worlds/world2.ts',
            './src/worlds/world3.ts',
            './src/worlds/world4.ts',
            './src/worlds/world5.ts',
            './src/worlds/world6.ts',
            './src/worlds/world7.ts',
            './src/worlds/world8.ts'
          ],
          // 音频核心（独立 chunk 避免主包过大）
          'audio-core': ['./src/audio.ts', './src/synth.ts', './src/core/transport.ts']
        }
      }
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
