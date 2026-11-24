import { seedProjects } from './projects.js'
import { seedTasks } from './tasks.js'
import { members, users } from './members.js'

// 版本 15：补齐项目经理的待办与待验收事务（此前 u2 名下 0 条任务，「我的任务」对他永远是空页）；
// 同时解决 ex-分支 feat/schedule-validator 也用了 14 导致旧数据不会重置的撞号问题
export const SEED_VERSION = 15

export const defaultData = {
    seedVersion: SEED_VERSION,
    projects: seedProjects,
    tasks: seedTasks,
    fields: [],
    templates: [],
    members,
    users,
}