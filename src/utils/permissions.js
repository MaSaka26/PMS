// 统一的权限判断：前端页面与 mock 接口共用同一份规则。
// 口径：role 是全局身份，PM 是项目内授权。canManageProject 只认 PM 字段，不认 role 字符串。

export const isAdmin = (user) => user?.role === 'admin'

export const isManager = (user) => ['admin', 'pm'].includes(user?.role)

export const isProjectMember = (user, project) =>
    !!user && !!project && (project.members || []).includes(user.id)

// 项目负责人或管理员
export const canManageProject = (user, project) =>
    isAdmin(user) || (!!project && project.PM === user?.id)

// 管理员 / 项目经理可创建项目
export const canCreateProject = (user) => isManager(user)

// 变更项目负责人：只有管理员
export const canSetProjectOwner = (user) => isAdmin(user)

// 项目可见：管理员全局可见，其余看 PM 或成员
export const canViewProject = (user, project) =>
    isAdmin(user) || canManageProject(user, project) || isProjectMember(user, project)

// 建任务：管理员或项目成员
export const canCreateTask = (user, project) => isAdmin(user) || isProjectMember(user, project)

// 指派 / 改派：管理员或项目负责人
export const canAssignTask = (user, project) => canManageProject(user, project)

// 任务编辑：管理员 / 项目负责人 / 创建人 / 负责人
export const canEditTask = (user, project, task) =>
    canManageProject(user, project) ||
    task?.createdBy === user?.id ||
    task?.assignee === user?.id

// 任务删除：管理员 / 项目负责人
export const canDeleteTask = (user, project) => canManageProject(user, project)

// 验收 / 驳回 / 重开：管理员 / 项目负责人
export const canReviewTask = (user, project) => canManageProject(user, project)

// 提交验收 / 阻塞 / 解除阻塞：负责人本人、项目负责人或管理员
export const canOperateTask = (user, project, task) =>
    canManageProject(user, project) || task?.assignee === user?.id

// 取消任务：管理员 / 项目负责人 / 创建人
export const canCancelTask = (user, project, task) =>
    canManageProject(user, project) || task?.createdBy === user?.id

// 是否「自己验收自己做的任务」
// 这里只用来打标记，不做拦截：一旦拦死，老板自己做的那条任务就永远没人能验收，
// 项目阶段推导会在「所有任务已验收」这一步永远为假，卡在「任务验收」回不去。
export const isSelfReview = (user, task) =>
    !!user && !!task && !!task.assignee && task.assignee === user.id

// 字段配置只有管理员可以修改
export const canManageFields = (user) => isAdmin(user)

// 模板由管理员 / 项目经理维护和使用
export const canManageTemplates = (user) => isManager(user)

// ——— 成员管理 ———
// 新增成员：管理员 / 项目经理
export const canCreateMember = (user) => isManager(user)

// 编辑成员：admin 改全部；pm 改自己或普通成员；普通成员只改自己
export const canEditMember = (user, target) => {
    if (!user || !target) return false
    if (isAdmin(user)) return true
    if (isManager(user)) return user.id === target.id || target.role === 'member'
    return user.id === target.id
}

// 开通账号 / 改角色 / 启停 / 删除成员：仅管理员
export const canManageAccount = (user) => isAdmin(user)
export const canChangeRole = (user) => isAdmin(user)
export const canToggleMemberActive = (user) => isAdmin(user)
export const canDeleteMember = (user) => isAdmin(user)
