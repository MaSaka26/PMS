// 统一的权限判断，前端页面共用；mock 接口里也会做对应校验

export const isAdmin = (user) => user?.role === 'admin'

export const isManager = (user) => ['admin', 'pm'].includes(user?.role)

export const isProjectMember = (user, project) =>
    !!user && !!project && (project.members || []).includes(user.id)

// 项目负责人或管理员
export const canManageProject = (user, project) =>
    isAdmin(user) || (!!project && project.PM === user?.id)

export const canCreateProject = (user) => isManager(user)

// 任务编辑：管理员 / 项目负责人 / 创建人 / 负责人
export const canEditTask = (user, project, task) =>
    canManageProject(user, project) ||
    task?.createdBy === user?.id ||
    task?.assignee === user?.id

// 任务删除：管理员 / 项目负责人
export const canDeleteTask = (user, project) => canManageProject(user, project)

// 验收 / 驳回 / 重开：管理员 / 项目负责人
// 这是全系统唯一的判定入口：mock 接口的 403、任务看板的按钮、我的任务的分组都调它，
// 避免三处各写一遍（改一处漏两处是这类权限问题的老毛病）。
export const canReviewTask = (user, project) => canManageProject(user, project)

// 是否「自己验收自己做的任务」
// 这里只用来打标记，不做拦截：一旦拦死，老板自己做的那条任务就永远没人能验收，
// 项目阶段推导会在「所有任务已验收」这一步永远为假，卡在「任务验收」回不去。
export const isSelfReview = (user, task) =>
    !!user && !!task && !!task.assignee && task.assignee === user.id

// 字段配置只有管理员可以修改
export const canManageFields = (user) => isAdmin(user)

// 模板由管理员 / 项目经理维护和使用
export const canManageTemplates = (user) => isManager(user)

