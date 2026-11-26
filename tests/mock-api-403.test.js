// 接口级 403 断言：直接调用 mockjs 注册的 handler，验证服务端兜底而非只看前端按钮。
// localStorage 必须在加载 mock 层之前装好；db 内存对象可跨测试复用，每个测试只改身份 token。
import test, { before } from 'node:test'
import assert from 'node:assert/strict'

const store = new Map()
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
}

let Mock
let db
before(async () => {
    // auth 与 db 都通过 import 加载，先装 localStorage 再 import
    const dbMod = await import('../src/mock/db/index.js')
    db = dbMod.db
    await import('../src/mock/api/project.js')
    await import('../src/mock/api/task.js')
    await import('../src/mock/api/member.js')
    Mock = (await import('mockjs')).default
})

// mockjs 把每个注册项存在 _mocked，键是 rurl + rtype。
// 函数型 template 可直接调用，options.url/body 就是请求上下文。
const call = (url, type, body = {}, userToken = '') => {
    store.set('pm_token', userToken)
    // 有些 handler 用正则注册，键是正则的字符串形式；逐个找匹配的注册项
    const key = Object.keys(Mock._mocked).find((k) => {
        const entry = Mock._mocked[k]
        const rurl = entry.rurl
        const ok =
            typeof rurl === 'string'
                ? rurl === url
                : rurl instanceof RegExp
                  ? rurl.test(url)
                  : false
        return ok && entry.rtype === type
    })
    if (!key) throw new Error('未找到 handler: ' + url + ' ' + type)
    // task 列表/新增 handler 会 JSON.parse(options.body)，要传字符串
    const entry = Mock._mocked[key]
    const isJsonBody = type === 'post' || type === 'put' || type === 'delete'
    return entry.template({ url, body: isJsonBody ? JSON.stringify(body) : body })
}

const asUser = (id) => `token_${id}_1`

test('非项目成员不能编辑项目（403）', () => {
    // seed_3 的 PM 是 u1；u4 不是成员
    const res = call('/api/projects/project_seed_3', 'put', { name: '越权改名' }, asUser('u4'))
    assert.equal(res.code, 403)
})

test('归档项目上新建任务被拒（403）', () => {
    const res = call(
        '/api/tasks',
        'post',
        { projectId: 'project_seed_4', title: '归档后加任务' },
        asUser('u2')
    )
    assert.equal(res.code, 403)
})

test('普通成员不能开通账号（403）', () => {
    const res = call('/api/members/u4', 'put', { active: true }, asUser('u3'))
    assert.equal(res.code, 403)
})
