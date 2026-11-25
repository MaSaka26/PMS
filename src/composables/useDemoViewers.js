// 演示用的「谁正在看这张卡」——纯前端随机模拟，不是真的在线状态。
//
// 数据模型（2026-11 改）：人只归属到「任务」这一个叶子实体，项目不是可以"进去"的地方，
// 它是容器。所以：
//   - 内存里只有 task:<taskId> 一种存在位（slot），presence 只按任务记
//   - 项目卡片上的头像 = 该项目所有任务访客的并集（去重，取前 3 + N）
// 这样「某人在项目卡上、同时也在他这个项目的某张任务卡上」不再是矛盾，
// 而是同一件事在两个缩放层级上的呈现；一个人也不可能同时出现在两个项目里，
// 因为他被钉在某个任务上，任务只属于一个项目。
//
// 其他约定：
// 1. 只有一份状态、一个定时器，放在模块顶层。项目看板一次渲染几十张任务卡，
//    如果每张卡自己 setInterval，就会有几十个计时器各走各的。
// 2. 只给「当前页面上真有的任务」安排人（register/unregister），离开页面就把
//    那个任务上的人放走，避免人一直被页面上看不见的任务占着。
// 3. 一个人同一时刻只在一个任务上（occupancy 记账）。
// 4. 绝不写 pm_mock_db：src/mock/db/index.js 的 storage 监听在 key 相同且
//    多标签页时会把对方标签页强刷掉，presence 这种高频写会把两个标签页打成死循环。
//    这里全部在内存里，刷新即清零。
// 5. 接真实后端时，把本文件与调用点删掉即可，业务代码不用动：
//    服务端应当是 presence 表（entityType/entityId/userId/heartbeatAt）+ WS/SSE 推送，
//    项目卡片的汇总就是在该表上按 entityId ∈ 该项目任务集合 做一次聚合。

import { reactive } from 'vue'
import { mockEnabled } from '@/api/mockGate'

const TICK_MS = 40 * 1000
const LIFETIME_MIN = 120 * 1000
const LIFETIME_MAX = 300 * 1000
// 每次 tick 有人进来的概率：太高会一直满员，太低会长时间没人，都显得假
const JOIN_CHANCE = 0.55
// 一个任务最多叠几个人，超过就变成 +N
const PER_ENTITY_MAX = 3
// 首屏热启动的人头数上限：不必等第一个 tick，进来就有人在看
const HOT_START = 3

const AVATAR_COLORS = ['#6366f1', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6']

// slotKey（task:<id>）-> [{ id, name, initial, color, until }]
const presence = reactive({})
// 当前页面上存在的任务位
const registered = new Set()
// slotKey -> projectId，汇总项目卡时要用
const slotProject = new Map()
// slotKey -> 引用计数：同一个任务可能被多个组件注册（比如项目卡汇总 + 任务卡）
const refCount = new Map()

let timer = null
let started = false

const taskKey = (taskId) => `task:${taskId}`

const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1))
const pick = (list) => list[randomInt(0, list.length - 1)]

const colorOf = (id) => {
    let hash = 0
    for (let i = 0; i < String(id).length; i++) hash = (hash * 31 + String(id).charCodeAt(i)) | 0
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const initialOf = (name) => (name || '').trim().charAt(0) || '?'

// 已被人占住的任务：userId -> slotKey。
// 这里统计「所有还留着人的任务」，不筛 registered：unregister 时人已经被放走了，
// 存量 presence 与 registered 基本重合，多算一层没有意义。
function occupancy() {
    const map = new Map()
    for (const [key, list] of Object.entries(presence)) {
        for (const person of list) map.set(person.id, key)
    }
    return map
}

// 某个项目当前有几个不同的人在任务上（用于「优先点亮还没人的项目」）
function projectVisitorCount(projectId) {
    const seen = new Set()
    for (const key of Object.keys(presence)) {
        if (slotProject.get(key) !== projectId) continue
        for (const person of presence[key] || []) seen.add(person.id)
    }
    return seen.size
}

// 当前页面上实际可见的人数（按人头去重）
function visibleCount() {
    const seen = new Set()
    for (const key of registered) {
        for (const person of presence[key] || []) seen.add(person.id)
    }
    return seen.size
}

// 候选人池由页面注入，不在这里 useStore()：
// 定时器回调里没有组件上下文，直接取 store 属于碰运气，显式传进来最稳。
let pool = []
let meId = ''

export function setViewerPool(members, currentUserId) {
    meId = currentUserId || ''
    pool = (members || [])
        .filter((m) => m.active !== false)
        .map((m) => ({ id: m.id, name: m.name, initial: initialOf(m.name), color: colorOf(m.id) }))
}

// 候选：池里还没被别人占住的人，且排除自己（自己不用「正在查看」提示自己）
function candidates() {
    const taken = occupancy()
    return pool.filter((m) => m.id !== meId && !taken.has(m.id))
}

function expire(now) {
    for (const [key, list] of Object.entries(presence)) {
        const alive = list.filter((person) => person.until > now)
        if (alive.length !== list.length) presence[key] = alive
    }
}

function addOne(now) {
    const available = candidates()
    if (!available.length) return false
    const slots = [...registered].filter((key) => (presence[key] || []).length < PER_ENTITY_MAX)
    if (!slots.length) return false

    // 两段式择位：先挑"人最少的项目"，再在那项目里挑"人最少的任务"。
    // 不能把所有格子放在一起排序取前半：项目里任务数量差别很大（PMS 开发记录有 10 条任务、
    // 会员体系升级只有 1 条），混在一起排会让三条人全压进任务多的那个项目。
    const byProject = new Map()
    for (const key of slots) {
        const projectId = slotProject.get(key) || ''
        if (!byProject.has(projectId)) byProject.set(projectId, [])
        byProject.get(projectId).push(key)
    }
    const projectIds = [...byProject.keys()]
    const minVisitors = Math.min(...projectIds.map((id) => projectVisitorCount(id)))
    // 只在"人最少"的项目里挑，人一样多时随机 —— 于是新进来的一个人总是先点亮
    // 还没人在看的项目，看起来才像"各忙各的"，而不是全挤在同一个项目里。
    const coldest = projectIds.filter((id) => projectVisitorCount(id) === minVisitors)
    const projectId = pick(coldest)

    // 项目内部同理：优先放人少的任务，人一样多时随机
    const group = byProject.get(projectId)
    const fewest = Math.min(...group.map((key) => (presence[key] || []).length))
    const key = pick(group.filter((k) => (presence[k] || []).length === fewest))

    const person = pick(available)
    // 每个人独立寿命：不是下个 tick 就消失，否则看起来像整批刷新
    const until = now + randomInt(LIFETIME_MIN, LIFETIME_MAX)
    presence[key] = [...(presence[key] || []), { ...person, until }]
    return true
}

function tick() {
    const now = Date.now()
    expire(now)
    if (!registered.size) return
    if (Math.random() > JOIN_CHANCE) return
    addOne(now)
}

// 首屏热启动：卡片刚挂载时成员列表往往还没拉回来，candidates() 是空的。
// 少数几次退避重试，避免出现「打开页面十分钟后才慢慢飘出一个人」的观感。
function warmUp(attempt = 0) {
    if (!started || !registered.size) return
    const now = Date.now()
    // 目标：当前页面上大约三分之一的「任务」有人，但总人头不超过 HOT_START。
    // 太少看不出效果，太多会像全员在线。
    const target = Math.max(1, Math.min(HOT_START, Math.ceil(registered.size / 3)))
    const missing = target - visibleCount()
    if (missing <= 0) return
    let placed = 0
    for (let i = 0; i < missing; i++) {
        if (addOne(now)) placed++
    }
    // 成员列表还没拉回来时池子是空的，退避重试几次
    if (!placed && attempt < 6) {
        setTimeout(() => warmUp(attempt + 1), 1200)
    }
}

function start() {
    started = true
    warmUp()
    timer = setInterval(tick, TICK_MS)
    // 开发期热更新会重新执行模块，别留下野定时器
    if (import.meta.hot) {
        import.meta.hot.dispose(() => {
            if (timer) clearInterval(timer)
            timer = null
            started = false
        })
    }
}

// 注册一个「任务位」：任务卡自己调，项目卡的汇总也用它把整组任务登记进来。
export function registerTaskSlot(taskId, projectId) {
    if (!taskId || !mockEnabled) return
    const key = taskKey(taskId)
    const count = (refCount.get(key) || 0) + 1
    refCount.set(key, count)
    if (count > 1) return
    slotProject.set(key, projectId || '')
    registered.add(key)
    if (!started) start()
    // 卡片是逐个挂载的：每新挂上一个格子就按当前页面总量再补一次，
    // 否则第一张卡挂载时算出的目标只有 1 个人，后面几张就永远是空的。
    else warmUp()
}

export function unregisterTaskSlot(taskId) {
    if (!taskId) return
    const key = taskKey(taskId)
    const count = (refCount.get(key) || 0) - 1
    if (count > 0) {
        refCount.set(key, count)
        return
    }
    refCount.delete(key)
    registered.delete(key)
    slotProject.delete(key)
    // 这个格子离开视野了，上面的人也要放走：
    // 否则他会一直被页面上看不见的任务占着，换到别的页面就少一个人可分。
    if (presence[key]) delete presence[key]
}

export function viewersOfTask(taskId) {
    if (!taskId || !mockEnabled) return []
    return presence[taskKey(taskId)] || []
}

// 项目卡上的头像 = 该项目所有任务访客的并集。
// 这正是接真后端后要做的聚合（presence 表按 entityId ∈ 该项目任务集合 分组）。
//
// 注意这里遍历的是 presence 而不是 registered：registered 是普通 Set，
// 对它做 for-of 不会建立响应式依赖，computed 算过一次空结果后就再也不会更新
// （第一次渲染时 presence 还是空的，于是卡片永远显示不出头像）。
export function viewersOfProject(projectId) {
    if (!projectId || !mockEnabled) return []
    const seen = new Set()
    const out = []
    for (const key of Object.keys(presence)) {
        if (slotProject.get(key) !== projectId) continue
        for (const person of presence[key] || []) {
            if (seen.has(person.id)) continue
            seen.add(person.id)
            out.push(person)
        }
    }
    return out
}

export const demoViewersEnabled = mockEnabled

export function useDemoViewers() {
    return { viewersOfTask, viewersOfProject, demoViewersEnabled }
}
