import { FolderOpened, Lock, RefreshRight, Sort } from '@element-plus/icons-vue'

// 项目阶段：与 domain/project-status.js 的推导规则一一对应
export const PROJECT_STAGES = [
    {
        key: 'draft',
        label: '项目立项',
        short: '项目刚建，还没有可执行任务',
        rule: '还没有未取消任务',
        enter: 'PM / admin 创建项目',
        exit: '成员拆出第一条任务',
        who: 'PM / admin'
    },
    {
        key: 'planning',
        label: '项目规划',
        short: '任务拆好了，都还在排队',
        rule: '有任务，但都还在待办',
        enter: '出现待办任务',
        exit: '有人认领或指派',
        who: 'PM / 项目成员'
    },
    {
        key: 'active',
        label: '任务执行',
        short: '至少一个任务正在推进',
        rule: '至少一个任务进行中',
        enter: '任务进入进行中',
        exit: '全部进入待验收 / 已验收',
        who: '项目成员'
    },
    {
        key: 'accepting',
        label: '任务验收',
        short: '执行完成，等待 PM 确认',
        rule: '没有待办 / 进行中，且至少一个待验收',
        enter: '最后一个进行中提交验收',
        exit: '全部验收通过，或被驳回',
        who: 'PM / admin'
    },
    {
        key: 'iterating',
        label: '项目收尾',
        short: '任务全部收口，可以关闭归档',
        rule: '全部未取消任务已验收',
        enter: '最后一个待验收通过',
        exit: '关闭并归档（手动）',
        who: 'PM / admin'
    }
]

// 关闭与归档：项目阶段之后的收尾动作
export const ARCHIVE_STEPS = [
    {
        title: '关闭项目',
        desc: 'PM 或 admin 在项目看板执行「关闭并归档」，项目从看板移除。'
    },
    {
        title: '归档只读',
        desc: '项目进入「项目归档」页，所有任务、事件与时间线完整保留，但不可再编辑。'
    },
    {
        title: '撤销归档',
        desc: '需要继续推进时，PM / admin 可撤销归档，项目恢复编辑，并按当前任务重新推导阶段，操作记入项目事件。'
    }
]

// 项目动作权限矩阵
export const PROJECT_PERMISSIONS = [
    { action: '查看项目', admin: true, pm: true, member: true, outsider: false },
    { action: '创建项目', admin: true, pm: true, member: false, outsider: false },
    { action: '编辑项目（负责人）', admin: true, pm: true, member: false, outsider: false },
    { action: '关闭并归档', admin: true, pm: true, member: false, outsider: false },
    { action: '撤销归档', admin: true, pm: true, member: false, outsider: false },
    { action: '置顶 / 取消置顶', admin: true, pm: true, member: false, outsider: false },
    { action: '泳道内调整顺序', admin: true, pm: true, member: false, outsider: false },
    { action: '另存为项目模板', admin: true, pm: true, member: false, outsider: false }
]

export const PROJECT_NOTES = [
    {
        icon: RefreshRight,
        title: '阶段自动推导',
        desc: '项目阶段不需要手动维护，每次任务状态变化后按规则重新计算，PM 看到的就是项目真实进度。'
    },
    {
        icon: Lock,
        title: '只进不退',
        desc: '推导结果与当前阶段比较，只有更高才更新。新增待办、取消任务都不会让已推进的项目回退。'
    },
    {
        icon: FolderOpened,
        title: '归档不是删除',
        desc: '关闭归档只是把同一份数据放进另一个筛选视图，任务、事件与时间线完整保留，随时可以撤销。'
    },
    {
        icon: Sort,
        title: '负责人即管理权',
        desc: '项目管理权按项目的 PM 字段判定，不按成员角色。负责人变更后，管理权随之转移。'
    }
]