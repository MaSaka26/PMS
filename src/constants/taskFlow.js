import { Check, RefreshLeft, User, WarningFilled } from '@element-plus/icons-vue'

// 主干四列（泳道），已取消是分支终态，单独展示
export const STATUSES = [
    {
        key: 'todo',
        label: '待办',
        short: '有人建了，但还没人接',
        enter: '新建任务时负责人留空',
        exit: '成员认领',
        who: '项目成员'
    },
    {
        key: 'doing',
        label: '进行中',
        short: '已有人负责，正在推进',
        enter: '认领成功 / 新建或编辑时选择负责人',
        exit: '提交验收 / 驳回 / 重开',
        who: '执行人 + 项目成员'
    },
    {
        key: 'done',
        label: '待验收',
        short: '执行人认为完成，等待确认',
        enter: '执行人提交验收',
        exit: '验收通过 / 驳回',
        who: '项目负责人（PM）、admin'
    },
    {
        key: 'accepted',
        label: '已验收',
        short: '确认完成；可因缺陷或变更重开',
        enter: 'PM 验收通过',
        exit: '重开（必须填写原因）',
        who: '项目负责人（PM）、admin'
    }
]

// 分支终态：已取消
export const CANCELED_STATUS = {
    key: 'canceled',
    label: '已取消',
    short: '这件事不再需要做了，与「完成」是两个不同的结论',
    enter: '待办 / 进行中 / 待验收 主动取消（必须填原因）',
    exit: '恢复回待办（PM / admin）',
    who: 'PM / admin / 任务创建人'
}

// 每一次状态流转
export const TRANSITIONS = [
    {
        no: '01',
        from: '待办',
        to: '进行中',
        name: '认领',
        tone: 'primary',
        who: '项目成员 / PM / admin',
        trigger: '卡片上的「认领」按钮',
        rules: [
            '任务必须还没有负责人（待办不挂负责人）',
            '认领人必须是该项目的 members 之一',
            '认领成功后自动进入「进行中」——认领即承诺开始',
            '前置任务未完成时会提示，确认后可以强制认领'
        ]
    },
    {
        no: '02',
        from: '待办',
        to: '进行中',
        name: '指派（Push 派单）',
        tone: 'primary',
        who: '项目负责人（PM） / admin；新建或编辑任务的人也可指定负责人',
        trigger: '待办卡片上的「指派」按钮，或在任务弹窗里选择负责人',
        rules: [
            '被指派人必须是该项目的 members 之一',
            '选负责人即开工：指派后状态直接落为「进行中」，不经过待办',
            '新建弹窗已移除「当前状态」，状态完全由负责人推导：留空 = 待办，选人 = 进行中',
            '待办任务不允许保留负责人；清空非待办任务的负责人会被拒绝',
            '认领只能把任务给自己；把任务交给别人必须使用「指派」'
        ]
    },
    {
        no: '03',
        from: '进行中',
        to: '待验收',
        name: '提交验收',
        tone: 'success',
        who: '任务负责人（PM / admin 可代提交）',
        trigger: '卡片上的「提交验收」按钮',
        rules: [
            '提交只是声明「我认为做完了」，不等于验收通过',
            '任务处于阻塞状态时不能直接提交：界面会提示「解除阻塞并提交」，确认后依次记 unblocked + submitted 两条事件',
            '接口层同样校验，阻塞中直接改状态会返回 400'
        ]
    },
    {
        no: '04',
        from: '待验收',
        to: '已验收',
        name: '验收通过',
        tone: 'success',
        who: '项目负责人（PM） / admin',
        trigger: '卡片上的「验收通过」按钮',
        rules: [
            '执行人不能验收自己提交的任务（职责分离）',
            '非 PM / admin 的卡片上不显示该按钮',
            'mock 接口同样校验，绕过前端也会被 403 拦截'
        ]
    },
    {
        no: '05',
        from: '待验收',
        to: '进行中',
        name: '驳回',
        tone: 'warning',
        who: '项目负责人（PM） / admin',
        trigger: '卡片上的「驳回」按钮（必须填写原因）',
        rules: [
            '驳回原因不能为空，会显示在时间线与卡片详情中',
            '驳回后执行人需要重新处理并再次提交'
        ]
    },
    {
        no: '06',
        from: '已验收',
        to: '进行中',
        name: '重开',
        tone: 'danger',
        who: '项目负责人（PM） / admin',
        trigger: '卡片上的「重开」按钮（必须填写原因）',
        rules: [
            '重开原因不能为空，会写入 reopenReason / reopenAt / reopenBy',
            '卡片上会显示「重开原因」琥珀色提示条，便于追溯',
            '用于验收后发现缺陷、需求变更、返工等真实场景'
        ]
    },
    {
        no: '07',
        from: '待办 / 进行中 / 待验收',
        to: '已取消',
        name: '取消',
        tone: 'danger',
        who: '项目负责人（PM） / admin / 任务创建人',
        trigger: '卡片上的「取消」按钮（必须填写原因）',
        rules: [
            '取消原因不能为空，写入 canceledReason / canceledAt / canceledBy',
            '已验收的任务不能取消——如需返工请使用重开',
            '取消后进入看板底部「已取消」折叠区，不计入完成率',
            '若任务处于阻塞中，取消会同时清掉阻塞标记'
        ]
    },
    {
        no: '08',
        from: '已取消',
        to: '待办',
        name: '恢复',
        tone: 'info',
        who: '项目负责人（PM） / admin',
        trigger: '已取消卡片上的「恢复」按钮',
        rules: [
            '恢复后回到「待办」重新排队，原负责人会被清空，需要重新认领',
            '时间线会记录 restored 事件，取消历史不会被抹掉'
        ]
    }
]

// 权限矩阵
export const PERMISSIONS = [
    { action: '认领任务', admin: true, pm: true, member: true, outsider: false },
    { action: '提交验收（负责人本人）', admin: true, pm: true, member: true, outsider: false },
    { action: '验收通过', admin: true, pm: true, member: false, outsider: false },
    { action: '驳回', admin: true, pm: true, member: false, outsider: false },
    { action: '重开已验收任务', admin: true, pm: true, member: false, outsider: false },
    { action: '标记 / 解除阻塞', admin: true, pm: true, member: true, outsider: false },
    { action: '取消任务', admin: true, pm: true, member: true, outsider: false },
    { action: '恢复已取消任务', admin: true, pm: true, member: false, outsider: false }
]

export const DESIGN_NOTES = [
    {
        icon: User,
        title: '认领即启动',
        desc: 'Pull 制下「我接了」就意味着「我开始做」，所以认领会自动把任务推进到进行中，避免出现「已认领但永远不动」的僵尸任务。'
    },
    {
        icon: Check,
        title: '提交 ≠ 验收',
        desc: '执行人只能「提交验收」，由 PM 或管理员「验收通过」。自评自过会让质量失控，看板数据也会失真。'
    },
    {
        icon: RefreshLeft,
        title: '终态可回退，但要留痕',
        desc: '已验收不是死路。验收后回归发现缺陷、需求变更都要能重开，但必须填写原因并记录操作人，保证可追溯。'
    },
    {
        icon: WarningFilled,
        title: '双层校验',
        desc: '前端按角色隐藏按钮，mock 接口再按状态机 + 权限二次校验。即使绕过 UI 直接调接口，非法流转也会被拒绝。'
    }
]
