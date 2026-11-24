import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// GitHub Pages 部署在 /<repo>/ 下；用户主页仓库（*.github.io）则部署在根路径
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
const isUserSite = repo?.endsWith('.github.io')
const base = process.env.GITHUB_ACTIONS && repo && !isUserSite ? `/${repo}/` : '/'

// 第三方依赖按「变更频率」分块。目的不是减小总体积，
// 而是让长期不变的依赖拥有稳定 hash：改一行业务代码时，
// 用户不必重新下载整个 Element Plus。
// 注意：Vite 8 底层是 rolldown，manualChunks 只接受函数，不接受对象。
const VENDOR_RULES = [
  [/node_modules[\\/](element-plus|@element-plus)[\\/]/, 'v-element'],
  [/node_modules[\\/](vue|@vue|vue-router|pinia|@vueuse)[\\/]/, 'v-vendor'],
  [/node_modules[\\/]axios[\\/]/, 'v-axios'],
  [/node_modules[\\/]highcharts[\\/]/, 'v-highcharts'],
  [/node_modules[\\/]mockjs[\\/]/, 'v-mock'],
]

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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          for (const [re, name] of VENDOR_RULES) {
            if (re.test(id)) return name
          }
        },
      },
    },
  },
})
