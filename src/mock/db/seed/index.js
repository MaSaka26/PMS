import { seedProjects } from './projects.js'
import { seedTasks } from './tasks.js'
import { members, users } from './members.js'

// 版本 11：补充 P0 缺陷修复任务与跨标签同步（老缓存整份重置）
export const SEED_VERSION = 11

export const defaultData = {
    seedVersion: SEED_VERSION,
    projects: seedProjects,
    tasks: seedTasks,
    fields: [],
    templates: [],
    members,
    users,
}
