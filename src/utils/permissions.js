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

// 字段配置只有管理员可以修改
export const canManageFields = (user) => isAdmin(user)

// 模板由管理员 / 项目经理维护和使用
export const canManageTemplates = (user) => isManager(user)

