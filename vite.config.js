import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// GitHub Pages 部署在 /<repo>/ 下；用户主页仓库（*.github.io）则部署在根路径
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
const isUserSite = repo?.endsWith('.github.io')
const base = process.env.GITHUB_ACTIONS && repo && !isUserSite ? `/${repo}/` : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
