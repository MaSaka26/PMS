# PMS 项目管理系统

一个基于 Vue 3 的前端项目管理系统，覆盖项目、任务、成员、自定义字段和项目模板。数据全部由 Mock.js 模拟，并通过 localStorage 持久化，适合作为课程设计、演示或前端练习项目。

## 目录

- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [测试与 CI](#测试与-ci)
- [测试账号](#测试账号)
- [功能模块](#功能模块)
- [页面路由](#页面路由)
- [页面详解与代码地图](#页面详解与代码地图)
- [角色与权限](#角色与权限)
- [核心业务规则](#核心业务规则)
- [数据模型（概要）](#数据模型概要)
- [目录结构](#目录结构)
- [数据存储与重置](#数据存储与重置)
- [部署到 GitHub Pages](#部署到-github-pages)
- [已下线功能：排期视图与关键路径](#已下线功能排期视图与关键路径)
- [已知限制](#已知限制)
- [后续规划](#后续规划)

## 技术栈

| 类别 | 技术 |
|---|---|
| 框架 | Vue 3（`<script setup>`） |
| 路由 | Vue Router 5（Hash 模式，兼容 GitHub Pages） |
| 状态管理 | Pinia 4（setup stores） |
| UI 组件 | Element Plus 2 |
| 图表 | Highcharts 13（向下钻取饼图） |
| 数据模拟 | Mock.js |
| 构建工具 | Vite 8 |
| 样式 | SCSS |

Node 版本要求：`^22.18.0 || >=24.12.0`。

## 快速开始

```bash
cd PMS
npm install
npm run dev      # 本地开发
npm run test     # 单元测试（Node 内置 test runner）
npm run build    # 生产构建
npm run preview  # 预览构建结果
npm run seed:git # 从 git log 生成「PMS 开发记录」种子数据
```

启动后访问终端提示的地址，默认进入登录页。

## 测试与 CI

- `tests/*.test.js` 覆盖权限判断、截止日期分级、登录与停用校验，使用 Node 内置 `node:test`，无需额外测试依赖。
- `.github/workflows/ci.yml` 在 pull request 与非 `master` 分支的 push 时执行：安装依赖 → 单元测试 → 生产构建；`master` 的推送由部署工作流负责。
- 页面与 Mock 流程仍以手工冒烟验证为主。

## 测试账号

| 用户名 | 密码 | 角色 | 姓名 |
|---|---|---|---|
| admin | admin | 管理员 | 老板 |
| pm | pm | 项目经理 | 张经理 |
| member | member | 成员 | 李员工 |
| agent | agent | 成员 | Agent |

项目看板里的「PMS 开发记录」由 `npm run seed:git` 读取 `git log` 生成（写入 `src/mock/gitSeed.js`）：一条提交对应一个任务，时间与提交人来自仓库记录，状态统一收口为已验收，验收人记为项目经理。有新提交后重新执行该命令并提交生成文件即可，CI 不依赖 git 历史。

登录后会写入 `pm_token`，未登录访问业务页面会被路由守卫重定向到登录页。

## 功能模块

- **项目管理**：项目增删改查、优先级、负责人、成员、计划周期、关闭并归档、撤销归档、项目详情、动态时间线。
- **任务看板**：四泳道（待办 / 进行中 / 待验收 / 已验收）、认领、显式指派、提交验收、验收、驳回、重开、阻塞、取消、恢复、任务详情抽屉与事件时间线；支持按标题关键字、负责人、阻塞状态筛选。
- **成员管理**：按角色分为管理员 / 项目经理 / 成员三条泳道，支持岗位、搜索、详情预览、分级权限、停用/启用和登录账号开通。
- **字段配置**：任务字段与项目字段两套命名空间，支持单行文本、多行文本、数字、日期、单选；支持必填、说明、选项、启停、排序、删除。
- **项目模板**：模板配置（字段 + 任务清单 + 相对日期 + 模板内依赖）、套用模板创建项目、从已有项目另存为模板、看板内模板选择入口。
- **数据概览**：项目详情中的任务分布与负责人分布下钻饼图、最近动态。
- **布局**：固定头部、侧边栏、面包屑，内容区使用 `el-scrollbar` 独立滚动。

## 页面路由

| 路径 | 说明 |
|---|---|
| `/login` | 登录页 |
| `/project/board` | 项目看板 |
| `/project/board/:id` | 项目详情 |
| `/project/archive` | 项目归档 |
| `/project/archive/:id` | 归档项目详情（只读） |
| `/task/board` | 任务看板 |
| `/task/flow` | 任务流程与规则说明 |
| `/field` | 字段配置 |
| `/template` | 项目模板 |
| `/member` | 成员管理 |

项目使用 Hash 路由，部署到 GitHub Pages 后地址形如 `https://用户名.github.io/PMS/#/login`。

## 页面详解与代码地图

### 页面关联总览

```
字段配置 ──→ 任务表单 / 项目表单
成员管理 ──→ 角色权限、项目负责人、任务负责人、登录账号
项目模板 ──→ 套用模板 ──→ 项目看板 ──→ 项目详情
                                      │
                                      └─→ 任务看板 ──→ 项目阶段自动推进
任务操作 ──→ 任务事件 / 项目动态 / 详情图表
项目关闭 ──→ 项目归档 ──→ 撤销归档
```

### 代码分层约定

| 层 | 位置 | 职责 |
|---|---|---|
| 页面 | `src/views/**` | 编排数据加载、权限判断、弹窗开关和页面交互 |
| 组件 | `src/views/**/components`、`src/components` | 可复用的展示与交互单元，不直接写业务接口 |
| 状态 | `src/stores/**` | 跨页面共享的数据，如成员列表、任务缓存、字段配置 |
| 请求 | `src/api/**` | axios 封装，页面只关心调用和结果 |
| 模拟后端 | `src/mock/**` | 接口、业务规则、权限校验、事件日志、localStorage 持久化 |
| 公共能力 | `src/utils/**`、`src/constants/**` | 权限、日期、状态常量等纯逻辑 |

理解这个项目时，可以按「页面 → 组件 → store → api → mock」的顺序追一条业务链路。

一条典型业务链路：

1. 管理员在「字段配置」定义任务字段和项目字段。
2. 在「项目模板」配置默认字段和任务清单。
3. 在「项目看板」从模板创建项目，生成项目和待办任务。
4. 成员在「任务看板」认领任务，项目自动进入「任务执行」。
5. 任务提交验收、验收通过，项目阶段自动推进到「任务验收」「项目收尾」。
6. 项目详情实时展示任务分布、负责人分布和最近动态。
7. 项目结束可在看板关闭并归档，或从详情另存为新的模板。

---

### 1. 登录页 `/login`

**页面职责**：账号密码登录、三个种子账号快捷填充、错误提示、登录后跳回原目标页。

**主要功能**

- 表单校验用户名和密码
- 点击快捷账号自动填入 admin / pm / member
- 登录成功后写入 token，拉取用户信息
- 停用账号登录时提示「账号已停用，请联系管理员」

**核心代码**

| 文件 | 作用 |
|---|---|
| [Login/index.vue](src/views/Login/index.vue) | 登录表单、快捷填充、调用 `userStore.login` |
| [stores/userStore.js](src/stores/userStore.js) | 保存 token、用户信息、恢复登录态、退出登录 |
| [mock/user.js](src/mock/user.js) | `/api/login`、`/api/info` 接口 |
| [mock/auth.js](src/mock/auth.js) | 账号密码校验、停用检查、当前用户解析 |
| [router/index.js](src/router/index.js) | 路由守卫：未登录跳登录页，token 变化时校验 `/info` |

**与其他页面的关系**：登录身份决定所有页面的角色和权限；成员页修改角色或停用后，登录和接口权限同步变化。

---

### 2. 项目看板 `/project/board`

**页面职责**：项目列表、搜索、分页、新建（空白 / 从模板）、编辑、关闭归档、删除、进入详情。

**主要功能**

- 卡片展示图标、名称、类型、负责人、优先级、项目阶段
- 按名称搜索，分页展示
- 「新建项目」下拉：新建空白项目 / 从模板创建
- 只有项目负责人或管理员能看到编辑、关闭、删除操作
- 项目经理创建项目时负责人固定为自己
- 卡片点击进入项目详情

**核心代码**

| 文件 | 作用 |
|---|---|
| [project/index.vue](src/views/project/index.vue) | 列表加载、搜索分页、权限判断、新建/编辑/关闭/删除 |
| [project/components/card.vue](src/views/project/components/card.vue) | 项目卡片与状态、优先级、操作按钮 |
| [project/components/ProjectFormDialog.vue](src/views/project/components/ProjectFormDialog.vue) | 项目表单、图标选择、计划周期、项目自定义字段 |
| [template/components/TemplatePickerDialog.vue](src/views/template/components/TemplatePickerDialog.vue) | 从模板创建项目的选择弹窗 |
| [mock/project.js](src/mock/project.js) | 项目增删改查、归档过滤、权限与日期校验 |
| [mock/projectStatus.js](src/mock/projectStatus.js) | 读取项目时按任务规范化项目阶段 |

**与其他页面的关系**：项目来源于空白创建或模板套用；项目负责人和成员来自成员管理；任务状态会反向推动项目阶段；项目关闭后进入项目归档。

---

### 3. 项目详情 `/project/board/:id`

**页面职责**：单个项目的完整视图，包括指标、图表、任务、成员、动态和项目操作。

**主要功能**

- 六个指标卡：任务总数、进行中、待验收、已验收、成员数、逾期数
- 任务分布下钻饼图：状态 → 负责人
- 负责人分布下钻饼图：负责人 → 状态
- 最近动态、任务列表、成员列表
- 点击任务打开任务详情抽屉
- 关闭并归档、撤销归档、另存为模板
- 归档项目只读，非项目成员显示 403

**核心代码**

| 文件 | 作用 |
|---|---|
| [project/detail.vue](src/views/project/detail.vue) | 详情数据、指标计算、动态、任务表格、权限和项目操作 |
| [project/components/DrilldownPieChart.vue](src/views/project/components/DrilldownPieChart.vue) | Highcharts 下钻饼图，支持状态与负责人两个维度 |
| [task/components/TaskDrawer.vue](src/views/task/components/TaskDrawer.vue) | 任务详情与事件时间线 |
| [components/DueBadge.vue](src/components/DueBadge.vue) | 截止日期倒计时徽标 |
| [stores/taskStore.js](src/stores/taskStore.js) | 项目任务列表与任务详情缓存 |
| [stores/fieldStore.js](src/stores/fieldStore.js) | 项目字段定义与展示 |
| [mock/project.js](src/mock/project.js) | 详情、动态、归档与撤销归档接口 |

**与其他页面的关系**：数据来自任务看板的任务、成员管理的成员、字段配置的项目字段；任务状态变化会反映在图表和动态中；关闭后进入归档；另存为模板会跳到项目模板体系。

---

### 4. 项目归档 `/project/archive`

**页面职责**：查看已归档项目、搜索、分页、撤销归档、只读查看详情。

**主要功能**

- 只展示 `archived` 状态的项目
- 项目负责人或管理员可以撤销归档
- 归档项目详情复用项目详情页，但所有编辑入口隐藏
- 撤销归档后按当前任务重新推导项目阶段

**核心代码**

| 文件 | 作用 |
|---|---|
| [project/archive.vue](src/views/project/archive.vue) | 归档列表、搜索分页、撤销归档 |
| [project/detail.vue](src/views/project/detail.vue) | 归档详情只读模式、返回路径 |
| [mock/project.js](src/mock/project.js) | `scope=archived`、`reopen` 接口与归档只读保护 |

**与其他页面的关系**：项目看板和项目详情负责「关闭并归档」；归档页负责查看和撤销；归档详情与正常详情共用同一个组件。

---

### 5. 任务看板 `/task/board`

**页面职责**：按项目查看任务泳道，执行认领、指派、验收、阻塞、取消等全部任务操作。

**主要功能**

- 四泳道：待办、进行中、待验收、已验收
- 按标题关键字、负责人、仅看阻塞筛选
- 新建 / 编辑任务，支持计划开始、截止日期、前置任务和自定义字段
- 待办卡片支持「认领」和「指派」：认领只能给自己，指派由项目负责人/管理员操作
- 提交验收、验收、驳回、重开、阻塞、取消、恢复、删除
- 已取消任务折叠区
- 任务详情抽屉展示扩展信息和事件时间线

**核心代码**

| 文件 | 作用 |
|---|---|
| [task/index.vue](src/views/task/index.vue) | 项目切换、筛选、泳道分组、权限、任务表单和操作 |
| [task/components/TaskCard.vue](src/views/task/components/TaskCard.vue) | 任务卡片、优先级、截止徽标、依赖提示、认领/指派等操作按钮 |
| [task/components/AssignTaskDialog.vue](src/views/task/components/AssignTaskDialog.vue) | 显式指派弹窗：选择项目成员并确认 |
| [task/components/TaskDrawer.vue](src/views/task/components/TaskDrawer.vue) | 任务详情、扩展字段、事件时间线 |
| [stores/taskStore.js](src/stores/taskStore.js) | `taskMap`、任务详情、认领/阻塞/取消/恢复 |
| [mock/task.js](src/mock/task.js) | 状态机、权限校验、日期与依赖校验、事件日志、项目阶段同步 |
| [constants/status.js](src/constants/status.js) | 任务状态、项目状态、优先级常量 |
| [utils/due.js](src/utils/due.js) | 截止日期分级计算 |

**与其他页面的关系**：任务属于某个项目；负责人来自成员管理；任务字段来自字段配置；任务状态变化会推动项目阶段，并影响项目详情的指标、图表和动态；模板生成的任务直接出现在这里。

---

### 6. 任务流程 `/task/flow`

**页面职责**：用静态文档说明任务状态、流转、权限、阻塞/取消/归档规则和项目阶段。

**主要功能**

- 5 个任务状态与 8 条流转
- 认领、指派、验收、驳回的权限说明
- 阻塞、取消、恢复的语义
- 项目阶段自动推导和只进不退规则
- 撤销归档、恢复任务的注意事项

**核心代码**

| 文件 | 作用 |
|---|---|
| [task/flow.vue](src/views/task/flow.vue) | 流程说明页面，纯展示 |
| [constants/status.js](src/constants/status.js) | 状态与文案来源 |

**与其他页面的关系**：是任务看板和项目阶段规则的说明书；规则变更时应同步更新此页。

---

### 7. 字段配置 `/field`

**页面职责**：维护任务字段和项目字段，控制表单上还能填哪些扩展信息。

**主要功能**

- 「任务字段 / 项目字段」两个分组
- 5 种类型：单行文本、多行文本、数字、日期、单选
- 必填开关、字段说明、单选选项维护
- 启用 / 停用、上移 / 下移、删除
- 非管理员只读

**核心代码**

| 文件 | 作用 |
|---|---|
| [field/index.vue](src/views/field/index.vue) | 字段列表、分组切换、增删改、启停、排序 |
| [stores/fieldStore.js](src/stores/fieldStore.js) | `taskFields`、`projectFields`、启用字段计算 |
| [mock/field.js](src/mock/field.js) | 字段增删改查、同作用对象内重名校验、权限校验 |
| [utils/permissions.js](src/utils/permissions.js) | `canManageFields` 权限判断 |

**与其他页面的关系**：启用的任务字段会出现在任务新建/编辑弹窗和任务详情；启用的项目字段会出现在项目表单和项目详情；字段 id 会写入任务或项目的 `extra`；模板会勾选项目字段。

---

### 8. 项目模板 `/template`

**页面职责**：维护项目模板，支持从模板创建项目，也支持把已有项目另存为模板。

**主要功能**

- 模板列表、搜索、启用 / 停用、编辑、删除
- 模板内容：默认类型、优先级、说明、项目字段、任务清单
- 任务清单支持相对开始 `T+N`、工期、模板内前置依赖
- 套用模板：填项目名称、开始日期、负责人，生成项目和任务
- 看板内模板选择、项目详情「另存为模板」
- 成员角色只读，管理员和项目经理可维护与套用

**核心代码**

| 文件 | 作用 |
|---|---|
| [template/index.vue](src/views/template/index.vue) | 模板列表、启停、编辑、删除、套用入口 |
| [template/components/TemplateFormDialog.vue](src/views/template/components/TemplateFormDialog.vue) | 模板基本信息、字段勾选、任务清单容器 |
| [template/components/TemplateTaskEditor.vue](src/views/template/components/TemplateTaskEditor.vue) | 任务增删、相对日期、工期、前置依赖 |
| [template/components/ApplyTemplateDialog.vue](src/views/template/components/ApplyTemplateDialog.vue) | 套用模板、日期预览、负责人锁定 |
| [template/components/TemplatePickerDialog.vue](src/views/template/components/TemplatePickerDialog.vue) | 项目看板内的模板选择弹窗 |
| [stores/templateStore.js](src/stores/templateStore.js) | 模板列表与套用状态 |
| [mock/template.js](src/mock/template.js) | 模板 CRUD、依赖校验、套用生成项目与任务 |

**与其他页面的关系**：模板引用字段配置的项目字段；套用后生成项目看板里的项目和任务看板里的任务；项目详情可以把已有项目结构提取成模板。

---

### 9. 成员管理 `/member`

**页面职责**：按角色管理成员、岗位、登录账号和启用状态。

**主要功能**

- 三条角色泳道：管理员 / 项目经理 / 成员
- 按姓名、角色搜索；搜索时隐藏空泳道
- 成员卡片显示角色、岗位、停用状态
- 点击卡片查看详情：姓名、角色、岗位、邮箱、状态、登录账号
- 新增 / 编辑成员，维护岗位
- 管理员可以开通登录账号、设置初始密码、重置密码
- 管理员可以停用 / 启用成员，停用有项目负责人和未完成任务保护
- 分级权限：管理员全局、项目经理管理普通成员、成员只能改自己

**核心代码**

| 文件 | 作用 |
|---|---|
| [member/index.vue](src/views/member/index.vue) | 泳道分组、搜索、权限、账号开通、停用 |
| [member/components/MemberRoleLane.vue](src/views/member/components/MemberRoleLane.vue) | 单条角色泳道与成员卡片布局 |
| [member/components/card.vue](src/views/member/components/card.vue) | 成员卡片、岗位与停用标签 |
| [member/components/MemberFormDialog.vue](src/views/member/components/MemberFormDialog.vue) | 成员表单、角色、岗位、登录账号 |
| [member/components/MemberDetailDialog.vue](src/views/member/components/MemberDetailDialog.vue) | 成员详情、账号、状态、停用/启用 |
| [stores/memberStore.js](src/stores/memberStore.js) | 成员列表、名称映射、增删改 |
| [mock/member.js](src/mock/member.js) | 成员权限、停用保护、账号创建与重置 |
| [mock/auth.js](src/mock/auth.js) | 登录身份以成员表为准，停用阻止登录 |

**与其他页面的关系**：成员是所有项目负责人、任务负责人的来源；角色决定全站权限；停用会阻止登录并从负责人下拉中移除；姓名会显示在项目卡片、任务卡片和时间线中。

---

### 10. 全局布局与公共能力

**页面职责**：提供固定头部、侧边栏、面包屑和内容区滚动。

**核心代码**

| 文件 | 作用 |
|---|---|
| [layout/index.vue](src/layout/index.vue) | 整体布局，固定头部/侧栏/面包屑，内容区 `el-scrollbar` |
| [layout/components/header.vue](src/layout/components/header.vue) | 当前用户、角色、退出登录 |
| [layout/components/aside.vue](src/layout/components/aside.vue) | 侧边栏菜单与路由高亮 |
| [layout/components/Breadcrumb.vue](src/layout/components/Breadcrumb.vue) | 基于 `route.matched` 的三级面包屑 |
| [router/index.js](src/router/index.js) | 路由表、嵌套路由、登录守卫、token 校验 |
| [utils/permissions.js](src/utils/permissions.js) | 全站统一的权限判断 |
| [components/DueBadge.vue](src/components/DueBadge.vue) | 截止日期倒计时徽标 |
| [constants/status.js](src/constants/status.js) | 状态、优先级、项目阶段文案 |

**与其他页面的关系**：所有业务页面都挂载在布局下；路由守卫控制访问；权限工具和状态常量被各页面复用。

### 页面依赖速查

| 页面 | 主要依赖 | 主要影响 |
|---|---|---|
| 登录 | 成员角色、账号状态 | 决定全站登录态和权限 |
| 项目看板 | 项目模板、成员 | 生成项目、进入详情、关闭归档 |
| 项目详情 | 任务、成员、字段、项目动态 | 展示分析、另存模板、归档 |
| 项目归档 | 已归档项目 | 只读查看、撤销归档 |
| 任务看板 | 项目、成员、字段 | 任务状态 → 项目阶段、详情图表 |
| 任务流程 | 状态常量 | 规则说明 |
| 字段配置 | 无 | 任务/项目表单、模板字段 |
| 项目模板 | 项目字段 | 生成项目和任务 |
| 成员管理 | 无 | 全站角色权限、负责人、登录 |
| 全局布局 | 用户状态 | 导航、面包屑、退出登录 |

---

## 角色与权限

### 全局角色

| 操作 | 管理员 | 项目经理 | 成员 |
|---|---|---|---|
| 新增成员 | ✓ | ✓（只能新增普通成员） | ✗ |
| 编辑成员 | 全部 | 普通成员 + 自己 | 仅自己 |
| 修改角色 | ✓ | ✗ | ✗ |
| 停用 / 启用成员 | ✓（不能停用自己或最后一个启用管理员） | ✗ | ✗ |
| 字段配置 | 增删改 | 只读 | 只读 |
| 项目模板 | 增删改、套用 | 增删改、套用 | 只读 |

### 项目

- 创建项目：管理员、项目经理；项目经理创建时负责人固定为自己。
- 编辑 / 删除 / 关闭归档：项目负责人或管理员。
- 项目负责人变更：仅管理员。
- 查看项目：项目成员或管理员。

### 任务

- 创建任务：项目成员或管理员。
- 编辑任务基本信息：管理员、项目负责人、任务创建人、任务负责人。
- 改派负责人：管理员、项目负责人、任务创建人。
- 删除任务：管理员、项目负责人。
- 认领任务：项目成员，且只能把任务认领给自己。
- 显式指派：项目负责人、管理员；在待办卡片上点击「指派」选择项目成员。
- 提交验收：任务负责人、项目负责人、管理员。
- 验收 / 驳回 / 重开：项目负责人、管理员。
- 取消任务：项目负责人、管理员、任务创建人。
- 恢复已取消任务：项目负责人、管理员。

## 核心业务规则

### 1. 待办 = 无人负责

- 新建任务时负责人留空 → 任务进入「待办」，由成员认领。
- 新建或编辑时选择负责人 → 直接进入「进行中」，选择负责人即视为开工。
- 非待办任务必须有负责人；清空非待办任务的负责人会被拒绝。
- 恢复已取消任务时清空负责人，任务回到任务池重新认领。
- 「认领」只能把任务给自己；「指派」是把任务交给别人，只有项目负责人或管理员操作。
- 管理员如果不是项目成员，不能认领该项目的任务，但可以指派；要亲自执行需先加入项目成员。

### 2. 任务生命周期

```
待办 --认领/指派--> 进行中 --提交验收--> 待验收 --验收--> 已验收
                      ^                    |
                      |----驳回------------|
                      |----重开（已验收）---|

待办 / 进行中 / 待验收 --取消--> 已取消 --恢复--> 待办
```

- 阻塞是叠加标记，不改变泳道；阻塞中的任务提交验收前会自动解除阻塞。
- 所有状态变化都会写入任务事件日志，任务详情抽屉按天展示时间线。

### 3. 项目阶段自动推导

项目阶段由任务状态自动汇总，**只进不退**：

| 阶段 | 条件 |
|---|---|
| 项目立项 | 没有未取消任务 |
| 项目规划 | 有任务，但都还在待办 |
| 任务执行 | 至少一个任务进行中 |
| 任务验收 | 没有待办 / 进行中，且至少一个待验收（允许部分已验收） |
| 项目收尾 | 全部未取消任务已验收 |
| 项目归档 | 只能通过「关闭并归档」手动触发 |

新增待办任务、取消任务都不会让项目回退；撤销归档后会按当前任务重新推导阶段。

### 4. 自定义字段

- 分为「任务字段」和「项目字段」，两个命名空间允许同名。
- 字段值分别存入 `task.extra` 和 `project.extra`，键为字段 id。
- 停用只隐藏表单，历史值保留；删除后定义消失，历史值不再展示。
- 模板生成的项目会携带 `fieldIds`，项目表单只展示模板勾选的字段。
- 必填校验目前在前端表单层完成。

### 5. 项目模板

- 模板包含：名称、默认类型、默认优先级、说明、项目字段、任务清单。
- 模板任务的日期使用相对项目开始日的 `T+N` 和工期天数。
- 模板内任务支持前置依赖；套用时映射为真实任务 id。
- 生成的任务全部进入「待办」，不复制负责人、状态、事件和自定义字段值。
- 本功能使用快照语义：修改模板不影响已生成项目，修改项目也不会反写模板。

### 6. 成员与岗位

- 角色 `role` 决定权限：`admin` / `pm` / `member`。
- 岗位 `position` 仅用于展示和详情预览，不参与权限判断，手动填写。
- 成员管理按角色分为三条泳道，卡片默认居中。
- 点击成员卡片打开详情弹窗，按权限显示编辑 / 停用入口。
- 成员支持停用而不是删除：停用后保留历史记录，但不能再被选为新任务的负责人。
- 停用后无法登录；已登录用户在下一次路由切换或刷新时会被校验并退回登录页。
- 登录身份以成员表为准：成员页修改姓名、角色后，下次登录立即生效。
- 管理员新增或编辑成员时可以开通登录账号、设置初始密码或重置密码；项目经理新增成员不能开通账号。
- 停用保护：不能停用自己或最后一个启用管理员；成员仍是进行中项目负责人、或还有未完成任务时，必须先移交 / 转派。

## 数据模型（概要）

| 实体 | 关键字段 |
|---|---|
| project | `id, title, type, icon, desc, priority, PM, members, status, startDate, endDate, fieldIds, extra, events, closedAt` |
| task | `id, projectId, title, desc, priority, assignee, status, dueDate, createdAt, plannedStart, dependsOn, blocked, canceledReason, reopenReason, extra, events, deletedAt` |
| member | `id, name, role, position, email, active`；登录用户名来自账号表，接口以 `username` 返回 |
| field | `id, label, type, targetType, required, options, description, enabled, order` |
| template | `id, name, projectType, priority, description, fieldIds, tasks[], enabled` |
| template task | `key, title, description, priority, startOffset, duration, dependsOn[]` |

## 目录结构

```
PMS/
├─ src/
│  ├─ api/                 # 请求封装（project/task/member/field/template/user）
│  ├─ components/          # 通用组件（DueBadge）
│  ├─ constants/           # 状态、事件元信息
│  ├─ layout/              # 头部、侧边栏、面包屑、整体布局
│  ├─ mock/                # Mock.js 接口与 localStorage 数据
│  ├─ router/              # 路由与登录守卫
│  ├─ stores/              # Pinia stores
│  ├─ styles/              # 全局样式
│  ├─ utils/               # 日期与倒计时工具
│  └─ views/
│     ├─ Login/            # 登录
│     ├─ project/          # 项目看板、详情、归档、表单弹窗
│     ├─ task/             # 任务看板、流程说明、任务卡片与抽屉
│     ├─ member/           # 成员三泳道、卡片、表单、详情
│     ├─ field/            # 字段配置
│     └─ template/         # 模板列表、表单、任务编辑、套用与选择
├─ tests/                  # node:test 单元测试
├─ .github/workflows/      # CI
├─ package.json
└─ vite.config.js
```

## 数据存储与重置

- 数据保存在浏览器 localStorage，键为 `pm_mock_db`。
- `src/mock/db.js` 中的 `SEED_VERSION` 控制种子版本；版本变化时整份重置。
- 需要恢复初始数据时，可在浏览器控制台执行：

```js
localStorage.removeItem('pm_mock_db')
location.reload()
```

## 部署到 GitHub Pages

项目已内置 GitHub Pages 部署配置：

- 路由使用 `createWebHashHistory()`，刷新页面不会 404
- [vite.config.js](vite.config.js) 在 GitHub Actions 中自动使用 `/<仓库名>/` 作为 base，本地开发仍为 `/`
- [deploy-pages.yml](.github/workflows/deploy-pages.yml) 在 push 到 `master` / `main` 时执行测试、构建并发布

### 操作步骤

1. 推送代码到 GitHub：

```bash
git remote add origin https://github.com/MaSaka26/PMS.git
git push -u origin master
```

2. 打开仓库 **Settings → Pages**，把 **Source** 设为 **GitHub Actions**。

3. 推送到 `master` 后，Actions 会自动运行 `Deploy to GitHub Pages`；也可以在 Actions 页面手动触发 `workflow_dispatch`。

4. 部署完成后访问：

```
https://masaka26.github.io/PMS/
```

### 说明

- 如果仓库名不是 `PMS`，base 会自动跟随仓库名，不需要改代码
- 如果仓库是 `用户名.github.io` 形式，会自动部署在根路径
- 本地验证 Pages 版：先设置 `GITHUB_ACTIONS=true`、`GITHUB_REPOSITORY=MaSaka26/PMS` 执行 `npm run build`，再用同样的环境变量执行 `npm run preview`，访问 `http://localhost:4173/PMS/`（preview 与构建的 base 必须一致，否则资源 404、页面空白）
- Mock 数据保存在每个访问者自己的 localStorage 中，不同人之间的数据不共享

## 已下线功能：排期视图与关键路径

以下功能已经下线，不再提供入口和路由，仅保留在本文档中作为历史记录：

- 任务排期视图：`/task/schedule`，甘特式任务横条、项目周期、依赖连线、越界告警。
- 项目排期分析：`/project/board/:id/schedule`、`/project/archive/:id/schedule`，CPM 关键路径、ES/EF/LS/LF、浮动时间。
- 相关组件与工具：`ScheduleGantt.vue`、`utils/cpm.js`。

**下线原因**：系统功能逐渐增多，排期与关键路径偏向专业项目管理场景，日常使用频率低，维护成本却较高。产品决定收敛复杂度，聚焦任务看板、项目模板和成员管理。

**仍保留的底层能力**：

- 项目 `startDate / endDate`
- 任务 `plannedStart`
- 任务 `dependsOn` 前置依赖
- 日期先后校验、依赖同项目校验、循环依赖检测
- 前置任务未完成时的认领提示与强制认领

这些能力仍服务于任务表单、任务详情和时间线；只是不再提供排期视图与 CPM 分析页面。

## 已知限制

- 数据层为 Mock.js + localStorage，不是真实后端。
- 权限已在页面和 mock 接口两层校验，但个别细粒度规则（如负责人能否修改任务描述）仍可按业务继续细化。
- 成员默认通过“停用”管理；`DELETE /api/members/:id` 仍保留在接口层，但页面不再提供删除入口。
- 停用成员不会出现在新的项目负责人 / 任务负责人下拉中，也不能登录；历史数据仍保留其姓名。
- 已登录用户被停用后，不会立即断开当前页面，但下一次路由切换或刷新会被退回登录页。
- 登录账号需要管理员在成员表单中显式开通；未开通账号的成员只用于项目分工。
- 字段删除后，历史 `extra` 中的值仍保留但不再展示，也没有使用情况统计。
- 任务看板一次性加载当前项目全部任务，任务量很大时需要分页或虚拟列表。
- 自动化测试覆盖纯函数（权限判断、截止日期分级、登录与停用校验），页面与 Mock 流程仍以手工冒烟为主。
- 生产构建存在主包体积告警（Element Plus + Highcharts + Mock.js）。

## 后续规划

1. 视数据量补充任务分页或虚拟滚动。
2. 为字段增加使用情况统计和删除影响预览。
3. 补充自动化测试和 CI。
4. 按实际使用情况细化任务编辑、改派等细粒度权限。
