import { authors as gitAuthors, commits as gitCommits } from './gitSeed.js'

// Github 记录生成的项目与任务：一条提交 = 一个任务
export const GIT_PROJECT_ID = 'project_seed_5'
// 由项目经理统一验收，避免「提交人验收自己」
export const GIT_PM_ID = 'u2'

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

// 首次运行时写入的示例项目，避免页面一片空白
export const seedProjects = [
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
