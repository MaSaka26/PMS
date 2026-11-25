import { seedProjects } from './projects.js'
import { seedTasks } from './tasks.js'
import { members, users } from './members.js'

// 版本 15：补齐项目经理的待办与待验收事务（此前 u2 名下 0 条任务，「我的任务」对他永远是空页）；
// 同时解决 ex-分支 feat/schedule-validator 也用了 14 导致旧数据不会重置的撞号问题
export const SEED_VERSION = 15

// 比对键：只有「种子内容」参与，不含 seedVersion 本身。
// 用户自己改的数据（新建任务、改状态）不在这里，所以不会因为用户操作触发重置。
const SIGNATURE_PAYLOAD = {
    projects: seedProjects,
    tasks: seedTasks,
    members,
    users,
}

// djb2：足够区分内容差异，且不引第三方依赖（浏览器与 node 里行为一致）
function hashSeed(value) {
    const text = JSON.stringify(value)
    let hash = 5381
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0
    }
    return (hash >>> 0).toString(36)
}

export const SEED_SIGNATURE = hashSeed(SIGNATURE_PAYLOAD)

// 判定是否要把本地数据整份丢掉重来。
// 抽成纯函数放在这里（而不是散在 db/index.js 的 load 里）是为了能被 node:test 覆盖：
// load() 依赖 localStorage，测试里跑不起来，但这条判定本身不碰存储。
// 方向是单向的：只认「代码比本地新」，本地比代码新（拿到缓存的旧 bundle）绝不能刷。
export function shouldResetSeed(data) {
    if (!data || !data.seedVersion) return true
    if (data.seedVersion < SEED_VERSION) return true
    // 版本号撞车（不同分支用过同一个数字）时，数字比不出差异，只能比内容指纹
    return data.seedVersion === SEED_VERSION && data.seedSignature !== SEED_SIGNATURE
}

export const defaultData = {
    seedVersion: SEED_VERSION,
    seedSignature: SEED_SIGNATURE,
    projects: seedProjects,
    tasks: seedTasks,
    fields: [],
    templates: [],
    members,
    users,
}
