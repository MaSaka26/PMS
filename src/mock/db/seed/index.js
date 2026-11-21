import { seedProjects } from './projects.js'
import { seedTasks } from './tasks.js'
import { members, users } from './members.js'

// 版本 13：修正 PMS 开发记录项目结束日，使其覆盖手工待办的截止日期
export const SEED_VERSION = 13

export const defaultData = {
    seedVersion: SEED_VERSION,
    projects: seedProjects,
    tasks: seedTasks,
    fields: [],
    templates: [],
    members,
    users,
}
