// 演示用的「谁正在看这张卡」——纯前端随机模拟，不是真的在线状态。
//
// 为什么这么写：
// 1. 只有一份状态、一个定时器，放在模块顶层。项目看板一次渲染十几张卡，
//    如果每张卡自己 setInterval，就会有十几个计时器各走各的。
// 2. 只给「当前页面上真有的实体」安排人（register/unregister），
//    否则翻页离开的卡片也会一直占着人，回到看板时那几个人永远飘在外面。
// 3. 一个人同一时刻只能出现在一个实体上（occupancy 记账），
//    否则同一个「张经理」会同时出现在三张项目卡上，一眼假。
// 4. 绝不写 pm_mock_db：src/mock/db/index.js 的 storage 监听在 key 相同且
//    多标签页时会把对方标签页强刷掉，presence 这种高频写会把两个标签页打成死循环。
//    这里全部在内存里，刷新即清零。
// 5. 接真实后端时，把本文件与两处调用点删掉即可，业务代码不用动：
//    服务端应当是 presence 表（entityType/entityId/userId/heartbeatAt）+ WS/SSE 推送。

import { reactive } from 'vue'
import { mockEnabled } from '@/api/mockGate'

const TICK_MS = 40 * 1000
const LIFETIME_MIN = 120 * 1000
const LIFETIME_MAX = 300 * 1000
// 每次 tick 有人进来的概率：太高会一直满员，太低会长时间没人，都显得假
const JOIN_CHANCE = 0.55
// 一张卡最多叠几个人，超过就变成 +N
const PER_ENTITY_MAX = 3
// 首屏热启动：不必等第一个 tick，进来就有人在看。同时也是「偶尔有人进来」的上限
const HOT_START = 3

const AVATAR_COLORS = ['#6366f1', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6']

// entityKey -> [{ id, name, initial, color, until }]
const presence = reactive({})
// 当前页面上存在的实体
const registered = new Set()
let timer = null
let started = false

const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1))
const pick = (list) => list[randomInt(0, list.length - 1)]

const colorOf = (id) => {
    let hash = 0
    for (let i = 0; i < String(id).length; i++) hash = (hash * 31 + String(id).charCodeAt(i)) | 0
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const initialOf = (name) => (name || '').trim().charAt(0) || '?'

// 已被人占住的实体：userId -> entityKey
// 只统计「当前页面上存在」的实体。切到另一个页面时，上一页占着的人要让出来，
// 否则刚进任务看板就会因为人全被项目卡占着而一个都分不到。
function occupancy() {
    const map = new Map()
    for (const [key, list] of Object.entries(presence)) {
        if (!registered.has(key)) continue
        for (const person of list) map.set(person.id, key)
    }
    return map
}

// 当前页面上实际可见的人数
function visibleCount() {
    let total = 0
    for (const key of registered) total += (presence[key] || []).length
    return total
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

function addOne(now, onlyKey) {
    const available = candidates()
    if (!available.length) return false
    const keys = (onlyKey ? [onlyKey] : [...registered]).filter(
        (key) => (presence[key] || []).length < PER_ENTITY_MAX
    )
    if (!keys.length) return false
    // 优先往人少的卡上放：否则随机分配容易把几个人挤在同一张卡上，
    // 而另外几张空着，看起来像「只有一个人在线」。
    const sorted = keys.sort((a, b) => (presence[a] || []).length - (presence[b] || []).length)
    const half = Math.max(1, Math.ceil(sorted.length / 2))
    const key = pick(sorted.slice(0, half))
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
    // 目标：当前页面上大约三分之一的卡有人，但总数不超过 HOT_START 个人。
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

export function registerViewer(key) {
    if (!key || !mockEnabled) return
    const isNew = !registered.has(key)
    registered.add(key)
    if (!started) start()
    // 卡片是逐个挂载的：每新挂上一张就按当前页面的总量再补一次，
    // 否则第一张卡挂载时算出的目标只有 1 个人，后面几张就永远是空的。
    else if (isNew) warmUp()
}

export function unregisterViewer(key) {
    if (!key) return
    // 不立刻清人：离开再回来时卡片上还是那几个人，比每次重掷一次真实。
    // 但如果一个实体被从 presence 里彻底遗忘了（下面这行只在 presence 里已经没它时才成立），
    // 也没必要留一份空数组。
    registered.delete(key)
    if (presence[key] && !presence[key].length) delete presence[key]
}

export function viewersOf(key) {
    if (!key || !mockEnabled) return []
    return presence[key] || []
}

export const demoViewersEnabled = mockEnabled

export function useDemoViewers() {
    return { viewersOf, demoViewersEnabled }
}
