import { seedProjects } from './projects.js'
import { seedTasks } from './tasks.js'
import { members, users } from './members.js'

// 版本 12：按最新 git 提交重新生成开发记录，移除手工占位的 P0 任务
export const SEED_VERSION = 12

export const defaultData = {
    seedVersion: SEED_VERSION,
    projects: seedProjects,
    tasks: seedTasks,
    fields: [],
    templates: [],
    members,
    users,
}
