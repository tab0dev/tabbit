import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Generate a clean build suitable for an extension
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`
      },
      // @daybrush/utils (react-selecto dep) ships a /*#__PURE__*/ annotation
      // at an invalid position in its ESM build. Rollup strips it and continues
      // normally — this just silences the cosmetic warning until they fix it upstream.
      onwarn(warning, defaultHandler) {
        if (warning.code === 'INVALID_ANNOTATION' && warning.id?.includes('@daybrush/utils')) return;
        defaultHandler(warning);
      },
    }
  }
})
