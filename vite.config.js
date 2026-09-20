import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const normaliseBasePath = (value) => {
  const path = value?.trim() || '/'
  const withoutTrailingSlash = path.replace(/\/+$/, '')
  if (!withoutTrailingSlash) return '/'
  return `${withoutTrailingSlash.startsWith('/') ? withoutTrailingSlash : `/${withoutTrailingSlash}`}/`
}

export default defineConfig({
  base: normaliseBasePath(process.env.BASE_PATH),
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectRegister: false,
      manifest: {
        name: 'The Long Haul Calculator',
        short_name: 'Long Haul',
        start_url: '.',
        display: 'standalone',
        background_color: '#101222',
        theme_color: '#101222',
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,json,svg,webmanifest}'],
        globIgnores: ['.vite/**', 'sw.js'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
})
