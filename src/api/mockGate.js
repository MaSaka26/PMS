// 模拟数据层的加载开关与就绪门。
//
// 为什么需要这一层：
// 1. mockjs 会劫持 window.XMLHttpRequest，必须在本项目发出第一个请求之前完成安装，
//    否则那个请求会打到真实网络并 404。靠调整 import 顺序是不可靠的约定，
//    这里改成显式等待，请求拦截器统一在这里排队。
// 2. 不再在 main.js 里静态 import，mock 与种子数据变成异步 chunk：
//    首屏先渲染骨架与登录页，mock 在后台并行加载，
//    真正要发请求时才等它——首屏关键路径上少 50 KB gzip。
// 3. 生产构建默认关闭 mock（import.meta.env.DEV 为 false）。
//    GitHub Pages 演示站用 .env.production 里的 VITE_USE_MOCK=true 打开；
//    接上真实后端后把它改成 false 即可，业务代码无需改动。

const ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_USE_MOCK === 'true'

let pending = null

export function ensureMock() {
  if (!ENABLED) return Promise.resolve()
  if (!pending) {
    pending = import('@/mock/index.js').then(() => undefined)
  }
  return pending
}

export const mockEnabled = ENABLED
