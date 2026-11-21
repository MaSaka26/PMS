import { seedProjects } from './projects.js'
import { seedTasks } from './tasks.js'
import { members, users } from './members.js'

// 版本 10：mock 目录重构后重新生成 git 记录（老缓存整份重置）
export const SEED_VERSION = 10

export const defaultData = {
    seedVersion: SEED_VERSION,
    projects: seedProjects,
    tasks: seedTasks,
    fields: [],
    templates: [],
    members,
    users,
}
