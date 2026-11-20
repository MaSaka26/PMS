export const PROJECT_STATUS = {
  DRAFT: 'draft',
  PLANNING: 'planning',
  ACTIVE: 'active',
  ACCEPTING: 'accepting',
  ITERATING: 'iterating',
  ARCHIVED: 'archived',
}

// 顺序即流程顺序，界面画步骤条/进度时用它换算位置
export const PROJECT_STATUS_ORDER = Object.values(PROJECT_STATUS)

export const PROJECT_STATUS_LABEL = {
  draft: '项目立项',
  planning: '项目规划',
  active: '任务执行',
  accepting: '任务验收',
  iterating: '项目迭代/收尾',
  archived: '项目归档',
}

export const PRIORITY = {
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
}

export const PRIORITY_ORDER = Object.values(PRIORITY)

export const TASK_STATUS = {
  TODO: 'todo',
  DOING: 'doing',
  DONE: 'done',
  ACCEPTED: 'accepted',
  CANCELED: 'canceled',
}

export const TASK_STATUS_LABEL = {
  todo: '待办',
  doing: '进行中',
  done: '待验收',
  accepted: '已验收',
  canceled: '已取消',
}
