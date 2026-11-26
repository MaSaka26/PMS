// domain 层不 import mock：存储、当前用户、持久化由使用方（mock 数据层）注入。
// 这样纯规则可以脱离 localStorage 单测，将来换真实后端也只需换适配器。

let current = null

export function configureDomain(services) {
    current = { ...(current || {}), ...services }
}

export function domainServices() {
    if (!current) throw new Error('[domain] 未注入存储服务：请先加载 mock 数据层')
    return current
}
