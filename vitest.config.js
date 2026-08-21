import { defineConfig, mergeConfig } from 'vite'
import viteConfig from './vite.config.js'

// Inherit plugins + the `@` alias from the build config so component tests resolve
// imports exactly the way `vite build` does. A separate file (instead of a `test`
// block inside vite.config.js) keeps the production build config free of test noise.
export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/component/**/*.spec.mjs'],
    setupFiles: ['tests/component/setup.mjs'],
    restoreMocks: true,
    clearMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    environmentOptions: {
      jsdom: { pretendToBeVisual: true }
    }
  }
}))
