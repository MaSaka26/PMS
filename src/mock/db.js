import { authors as gitAuthors, commits as gitCommits } from './gitSeed.js'

const STORAGE_KEY = 'pm_mock_db'
// 版本 9：「PMS 开发记录」补充真实待办与已取消任务（老缓存整份重置）
const SEED_VERSION = 9

let EVENT_SEQ = 0
// 种子事件生成器：保证 id 唯一，字段结构和运行时事件一致
const mkEvent = (taskId, projectId, type, by, at, extra = {}) => ({
  id: `ev_seed_${++EVENT_SEQ}`,
  taskId,
  projectId,
  type,
  by,
  at,
  ...extra,
})

// Github 记录生成的项目与任务：一条提交 = 一个任务
const GIT_PROJECT_ID = 'project_seed_5'
// 由项目经理统一验收，避免「提交人验收自己」
const GIT_PM_ID = 'u2'
const gitMembers = gitAuthors.map((a) => ({
  id: a.id,
  name: a.name,
  role: 'member',
  position: '开发者',
  active: true,
}))

const plusMinutes = (iso, minutes) => new Date(Date.parse(iso) + minutes * 60000).toISOString()
const dayOf = (iso) => iso.slice(0, 10)

const gitProject = gitCommits.length
  ? {
      id: GIT_PROJECT_ID,
      title: 'PMS 开发记录',
      type: '内部系统',
      icon: 'Monitor',
      desc: '提交对应的任务由 git log 生成；待办与已取消为手工补充的真实事项',
      priority: '高',
      PM: GIT_PM_ID,
      members: [...gitAuthors.map((a) => a.id), GIT_PM_ID],
      createdAt: dayOf(gitCommits[0].date),
      startDate: dayOf(gitCommits[0].date),
      endDate: dayOf(gitCommits[gitCommits.length - 1].date),
      status: 'iterating',
      closedAt: null,
      closedBy: null,
      events: [],
    }
  : null

const gitTasks = gitCommits.map((c) => {
  const id = `task_git_${c.shortHash}`
  const day = dayOf(c.date)
  return {
    id,
    projectId: GIT_PROJECT_ID,
    title: c.subject,
    desc: `提交 ${c.shortHash} · ${c.author} · ${c.date.slice(0, 16).replace('T', ' ')}`,
    assignee: c.authorId,
    priority: /^(feat|fix)/.test(c.subject) ? '高' : '中',
    status: 'accepted',
    dueDate: day,
    createdAt: day,
    createdBy: c.authorId,
    plannedStart: day,
    dependsOn: [],
    blocked: false,
    blockedReason: '',
    blockedAt: null,
    blockedBy: null,
    deletedAt: null,
    extra: {},
    events: [
      mkEvent(id, GIT_PROJECT_ID, 'created', c.authorId, plusMinutes(c.date, 0), { to: 'todo' }),
      mkEvent(id, GIT_PROJECT_ID, 'assigned', c.authorId, plusMinutes(c.date, 1), {
        from: 'todo',
        to: 'doing',
        changes: [{ field: 'assignee', from: '', to: c.authorId }],
      }),
      mkEvent(id, GIT_PROJECT_ID, 'submitted', c.authorId, plusMinutes(c.date, 2), {
        from: 'doing',
        to: 'done',
      }),
      mkEvent(id, GIT_PROJECT_ID, 'accepted', GIT_PM_ID, plusMinutes(c.date, 3), {
        from: 'done',
        to: 'accepted',
      }),
    ],
  }
})

// 手工补充的真实事项：未落地的工作不会出现在 git 里，只能按对话记录补
const backlogTasks = [
  {
    id: 'task_manual_1',
    projectId: GIT_PROJECT_ID,
    title: '拆分主包，降低首屏体积',
    desc: '构建告警：index 已超过 1.2MB，按路由拆分 Element Plus / Highcharts 等大依赖',
    assignee: '',
    priority: '中',
    status: 'todo',
    dueDate: '2026-12-10',
    createdAt: '2026-11-21',
    createdBy: 'u2',
    plannedStart: '2026-11-24',
    dependsOn: [],
    blocked: false,
    blockedReason: '',
    blockedAt: null,
    blockedBy: null,
    deletedAt: null,
    extra: {},
    events: [
      mkEvent('task_manual_1', GIT_PROJECT_ID, 'created', 'u2', '2026-11-21T05:00:00.000Z', {
        to: 'todo',
      }),
    ],
  },
  {
    id: 'task_manual_2',
    projectId: GIT_PROJECT_ID,
    title: '升级 GitHub Actions 到 Node 24 版本',
    desc: 'checkout@v4 / setup-node@v4 仍以 Node 20 为目标，升级后消除弃用告警',
    assignee: '',
    priority: '低',
    status: 'todo',
    dueDate: '2026-12-05',
    createdAt: '2026-11-21',
    createdBy: 'u2',
    plannedStart: '2026-11-25',
    dependsOn: [],
    blocked: false,
    blockedReason: '',
    blockedAt: null,
    blockedBy: null,
    deletedAt: null,
    extra: {},
    events: [
      mkEvent('task_manual_2', GIT_PROJECT_ID, 'created', 'u2', '2026-11-21T05:10:00.000Z', {
        to: 'todo',
      }),
    ],
  },
  {
    id: 'task_manual_3',
    projectId: GIT_PROJECT_ID,
    title: '任务排期视图（甘特 / 依赖连线）',
    desc: '已下线：使用频率低、维护成本高，产品决定收敛复杂度',
    assignee: '',
    priority: '低',
    status: 'canceled',
    dueDate: '2026-11-30',
    createdAt: '2026-11-19',
    createdBy: 'u2',
    plannedStart: '2026-11-19',
    dependsOn: [],
    blocked: false,
    blockedReason: '',
    blockedAt: null,
    blockedBy: null,
    deletedAt: null,
    canceledReason: '使用频率低、维护成本高，聚焦任务看板与项目模板',
    canceledAt: '2026-11-19T03:00:00.000Z',
    canceledBy: 'u1',
    extra: {},
    events: [
      mkEvent('task_manual_3', GIT_PROJECT_ID, 'created', 'u2', '2026-11-19T01:00:00.000Z', {
        to: 'todo',
      }),
      mkEvent('task_manual_3', GIT_PROJECT_ID, 'canceled', 'u1', '2026-11-19T03:00:00.000Z', {
        from: 'todo',
        to: 'canceled',
        reason: '使用频率低、维护成本高，聚焦任务看板与项目模板',
      }),
    ],
  },
  {
    id: 'task_manual_4',
    projectId: GIT_PROJECT_ID,
    title: '项目排期分析（CPM 关键路径）',
    desc: '已下线：ES/EF/LS/LF 与浮动时间计算维护成本高，底层依赖能力保留',
    assignee: '',
    priority: '低',
    status: 'canceled',
    dueDate: '2026-11-30',
    createdAt: '2026-11-19',
    createdBy: 'u2',
    plannedStart: '2026-11-19',
    dependsOn: [],
    blocked: false,
    blockedReason: '',
    blockedAt: null,
    blockedBy: null,
    deletedAt: null,
    canceledReason: '偏专业项目管理场景，日常使用频率低',
    canceledAt: '2026-11-19T03:05:00.000Z',
    canceledBy: 'u1',
    extra: {},
    events: [
      mkEvent('task_manual_4', GIT_PROJECT_ID, 'created', 'u2', '2026-11-19T01:05:00.000Z', {
        to: 'todo',
      }),
      mkEvent('task_manual_4', GIT_PROJECT_ID, 'canceled', 'u1', '2026-11-19T03:05:00.000Z', {
        from: 'todo',
        to: 'canceled',
        reason: '偏专业项目管理场景，日常使用频率低',
      }),
    ],
  },
]

// 首次运行时写入的示例项目，避免页面一片空白
const seedProjects = [
  {
    id: 'project_seed_1',
    title: '双十一大促',
    type: '电商',
    icon: 'ShoppingCart',
    desc: '大促活动的整体策划与执行',
    priority: '高',
    PM: 'u2',
    members: ['u2', 'u3'],
    createdAt: '2026-11-11',
    startDate: '2026-11-11',
    endDate: '2026-12-15',
    status: 'active',
    closedAt: null,
    closedBy: null,
    events: [],
  },
  {
    id: 'project_seed_2',
    title: '官网改版',
    type: '官网',
    icon: 'Monitor',
    desc: '官网视觉与信息架构升级',
    priority: '中',
    PM: 'u2',
    members: ['u2', 'u3'],
    createdAt: '2026-11-12',
    startDate: '2026-11-12',
    endDate: '2026-12-20',
    status: 'planning',
    closedAt: null,
    closedBy: null,
    events: [],
  },
  {
    id: 'project_seed_3',
    title: '会员体系升级',
    type: '内部系统',
    icon: 'User',
    desc: '会员等级与权益规则重构',
    priority: '低',
    PM: 'u1',
    members: ['u1', 'u2', 'u3'],
    createdAt: '2026-11-13',
    startDate: '2026-11-13',
    endDate: '2026-11-30',
    status: 'draft',
    closedAt: null,
    closedBy: null,
    events: [],
  },
  // 已关闭项目：用于演示"项目归档"页
  {
    id: 'project_seed_4',
    title: '618 大促复盘',
    type: '电商',
    icon: 'ShoppingCart',
    desc: '618 活动结束，复盘报告与数据沉淀完成',
    priority: '中',
    PM: 'u2',
    members: ['u2', 'u3'],
    createdAt: '2026-09-01',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    status: 'archived',
    closedAt: '2026-09-30T10:00:00.000Z',
    closedBy: 'u2',
    events: [
      {
        id: `ev_seed_project_closed`,
        projectId: 'project_seed_4',
        type: 'project_closed',
        by: 'u2',
        at: '2026-09-30T10:00:00.000Z',
        reason: '活动结束，复盘完成',
      },
    ],
  },
  // 由 git log 生成：一条提交 = 一个任务
  ...(gitProject ? [gitProject] : []),
]

const defaultData = {
  seedVersion: SEED_VERSION,
  projects: seedProjects,
  tasks: [
    // 双十一大促：Push + Pull 混合示例（task_seed_1 额外演示"阻塞"）
    {
      id: 'task_seed_1',
      projectId: 'project_seed_1',
      title: '大促主视觉设计',
      desc: '海报、banner、商品详情页主图',
      assignee: 'u3',
      priority: '高',
      status: 'doing',
      dueDate: '2026-11-20',
      createdAt: '2026-11-18',
      createdBy: 'u2',
      plannedStart: '2026-11-18',
      dependsOn: [],
      blocked: true,
      blockedReason: '等待后端商品主图接口联调',
      blockedAt: '2026-11-18T06:00:00.000Z',
      blockedBy: 'u3',
      deletedAt: null,
      extra: {},
      events: [
        mkEvent('task_seed_1', 'project_seed_1', 'created', 'u2', '2026-11-18T01:00:00.000Z', {
          to: 'todo',
        }),
        mkEvent('task_seed_1', 'project_seed_1', 'claimed', 'u3', '2026-11-18T02:00:00.000Z', {
          from: 'todo',
          to: 'doing',
        }),
        mkEvent('task_seed_1', 'project_seed_1', 'blocked', 'u3', '2026-11-18T06:00:00.000Z', {
          reason: '等待后端商品主图接口联调',
        }),
      ],
    },
    {
      id: 'task_seed_2',
      projectId: 'project_seed_1',
      title: '商品详情页 UI 微调',
      desc: '根据新视觉规范微调样式',
      assignee: '',
      priority: '中',
      status: 'todo',
      dueDate: '2026-11-22',
      createdAt: '2026-11-18',
      createdBy: 'u2',
      plannedStart: '2026-11-20',
      dependsOn: ['task_seed_1'],
      blocked: false,
      blockedReason: '',
      blockedAt: null,
      blockedBy: null,
      deletedAt: null,
      extra: {},
      events: [
        mkEvent('task_seed_2', 'project_seed_1', 'created', 'u2', '2026-11-18T01:05:00.000Z', {
          to: 'todo',
        }),
      ],
    },
    {
      id: 'task_seed_3',
      projectId: 'project_seed_1',
      title: '支付流程埋点',
      desc: '转化漏斗数据采集',
      assignee: '',
      priority: '低',
      status: 'todo',
      dueDate: '2026-11-25',
      createdAt: '2026-11-18',
      createdBy: 'u2',
      plannedStart: '2026-11-22',
      dependsOn: ['task_seed_2'],
      blocked: false,
      blockedReason: '',
      blockedAt: null,
      blockedBy: null,
      deletedAt: null,
      extra: {},
      events: [
        mkEvent('task_seed_3', 'project_seed_1', 'created', 'u2', '2026-11-18T01:10:00.000Z', {
          to: 'todo',
        }),
      ],
    },
    // 官网改版：演示"编辑字段"事件
    {
      id: 'task_seed_4',
      projectId: 'project_seed_2',
      title: '首页重构',
      desc: '信息架构 + 视觉升级',
      assignee: 'u3',
      priority: '高',
      status: 'doing',
      dueDate: '2026-12-05',
      createdAt: '2026-11-12',
      createdBy: 'u2',
      plannedStart: '2026-11-14',
      dependsOn: [],
      blocked: false,
      blockedReason: '',
      blockedAt: null,
      blockedBy: null,
      deletedAt: null,
      extra: {},
      events: [
        mkEvent('task_seed_4', 'project_seed_2', 'created', 'u2', '2026-11-12T02:00:00.000Z', {
          to: 'todo',
        }),
        mkEvent('task_seed_4', 'project_seed_2', 'assigned', 'u2', '2026-11-12T02:05:00.000Z', {
          from: 'todo',
          to: 'doing',
          changes: [{ field: 'assignee', from: '', to: 'u3' }],
        }),
        mkEvent('task_seed_4', 'project_seed_2', 'edited', 'u2', '2026-11-14T03:00:00.000Z', {
          changes: [{ field: 'priority', from: '中', to: '高' }],
        }),
      ],
    },
    // 会员体系升级：待验收
    {
      id: 'task_seed_5',
      projectId: 'project_seed_3',
      title: '会员等级规则梳理',
      desc: '与产品经理对齐等级与权益',
      assignee: 'u1',
      priority: '高',
      status: 'done',
      dueDate: '2026-11-15',
      createdAt: '2026-11-13',
      createdBy: 'u1',
      plannedStart: '2026-11-13',
      dependsOn: [],
      blocked: false,
      blockedReason: '',
      blockedAt: null,
      blockedBy: null,
      deletedAt: null,
      extra: {},
      events: [
        mkEvent('task_seed_5', 'project_seed_3', 'created', 'u1', '2026-11-13T01:00:00.000Z', {
          to: 'todo',
        }),
        mkEvent('task_seed_5', 'project_seed_3', 'claimed', 'u1', '2026-11-13T01:30:00.000Z', {
          from: 'todo',
          to: 'doing',
        }),
        mkEvent('task_seed_5', 'project_seed_3', 'submitted', 'u1', '2026-11-15T09:00:00.000Z', {
          from: 'doing',
          to: 'done',
        }),
      ],
    },
    // 已关闭项目下的任务：归档页只读查看用
    {
      id: 'task_seed_6',
      projectId: 'project_seed_4',
      title: '618 复盘报告输出',
      desc: '输出活动数据复盘与改进建议',
      assignee: 'u3',
      priority: '中',
      status: 'accepted',
      dueDate: '2026-09-28',
      createdAt: '2026-09-15',
      createdBy: 'u2',
      plannedStart: '2026-09-15',
      dependsOn: [],
      blocked: false,
      blockedReason: '',
      blockedAt: null,
      blockedBy: null,
      deletedAt: null,
      extra: {},
      events: [
        mkEvent('task_seed_6', 'project_seed_4', 'created', 'u2', '2026-09-15T01:00:00.000Z', {
          to: 'todo',
        }),
        mkEvent('task_seed_6', 'project_seed_4', 'claimed', 'u3', '2026-09-15T02:00:00.000Z', {
          from: 'todo',
          to: 'doing',
        }),
        mkEvent('task_seed_6', 'project_seed_4', 'submitted', 'u3', '2026-09-27T08:00:00.000Z', {
          from: 'doing',
          to: 'done',
        }),
        mkEvent('task_seed_6', 'project_seed_4', 'accepted', 'u2', '2026-09-28T02:00:00.000Z', {
          from: 'done',
          to: 'accepted',
        }),
      ],
    },
    ...gitTasks,
    ...backlogTasks,
  ],
  fields: [],
  templates: [],
  members: [
    { id: 'u1', name: '老板', role: 'admin', position: '总经理', active: true },
    { id: 'u2', name: '张经理', role: 'pm', position: '项目经理', active: true },
    { id: 'u3', name: '李员工', role: 'member', position: '前端工程师', active: true },
    // Agent：演示用成员，当前没有分配任务，可手工派发
    { id: 'u4', name: 'Agent', role: 'member', position: 'AI 执行者', active: true },
    // 由 git log 的提交作者生成
    ...gitMembers,
  ],
  // 登录账号（密码明文，仅测试用）
  users: [
    { id: 'u1', username: 'admin',   password: 'admin',   name: '老板',   role: 'admin' },
    { id: 'u2', username: 'pm',      password: 'pm',      name: '张经理', role: 'pm' },
    { id: 'u3', username: 'member',  password: 'member',  name: '李员工', role: 'member' },
    { id: 'u4', username: 'agent',   password: 'agent',   name: 'Agent',  role: 'member' },
  ],
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return clone(defaultData)
  try {
    const data = JSON.parse(raw)
    // 版本低于当前版本：结构不完整，直接整份重置（演示项目，不做迁移脚本）
    if (!data.seedVersion || data.seedVersion < SEED_VERSION) {
      const fresh = clone(defaultData)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
      return fresh
    }
    // tasks 为空（用户删光了所有种子任务），也重新 seed 一份
    if (!Array.isArray(data.tasks) || data.tasks.length === 0) {
      data.tasks = clone(defaultData.tasks)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }
    // 规则修正：待办 = 无人负责。历史遗留的“待办 + 负责人”自动视为已开工
    let normalized = false
    for (const t of data.tasks) {
      if (t.status === 'todo' && t.assignee) {
        t.status = 'doing'
        normalized = true
      }
    }
    // 老数据没有岗位字段：给种子成员补一个默认岗位（用户主动清空的不再覆盖）
    const defaultPositions = { u1: '总经理', u2: '项目经理', u3: '前端工程师' }
    for (const m of data.members || []) {
      if (m.position === undefined && defaultPositions[m.id]) {
        m.position = defaultPositions[m.id]
        normalized = true
      }
      // 老数据默认启用
      if (m.active === undefined) {
        m.active = true
        normalized = true
      }
    }
    if (normalized) localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return data
  } catch {
    return clone(defaultData)
  }
}

export const db = load()

export function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

// 简易分页工具
export function paginate(list, page = 1, size = 10) {
  const start = (page - 1) * size
  return { list: list.slice(start, start + size), total: list.length }
}

// 简易 id
export function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`
}

// 统一时间戳：事件必须带时分秒，否则时间线里分不清先后
export function nowISO() {
  return new Date().toISOString()
}
