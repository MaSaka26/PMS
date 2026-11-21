<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Collection, Pointer, Edit, RefreshLeft, SwitchButton, WarningFilled } from '@element-plus/icons-vue'
import {
    getProjectDetail,
    getProjectActivities,
    closeProject,
    reopenProject,
    updateProject
} from '@/api/project'
import { useFieldStore } from '@/stores/fieldStore'
import { useTaskStore } from '@/stores/taskStore'
import { useMemberStore } from '@/stores/memberStore'
import { useTemplateStore } from '@/stores/templateStore'
import { useUserStore } from '@/stores/userStore'
import { PROJECT_STATUS_LABEL, TASK_STATUS_LABEL } from '@/constants/status'
import { getEventMeta } from '@/constants/event'
import TaskDrawer from '@/views/task/components/TaskDrawer.vue'
import TemplateFormDialog from '@/views/template/components/TemplateFormDialog.vue'
import ProjectFormDialog from './components/ProjectFormDialog.vue'
import DrilldownPieChart from './components/DrilldownPieChart.vue'
import DueBadge from '@/components/DueBadge.vue'

const route = useRoute()
const router = useRouter()
const taskStore = useTaskStore()
const memberStore = useMemberStore()
const userStore = useUserStore()
const fieldStore = useFieldStore()
const templateStore = useTemplateStore()

const projectId = computed(() => String(route.params.id || ''))
const project = ref(null)
const loading = ref(true)
const forbidden = ref(false)
const tab = ref('overview')

// 任务
const tasks = computed(() => taskStore.taskMap?.[projectId.value] || [])
const statusFilter = ref('all')
const assigneeFilter = ref('all')
const onlyBlocked = ref(false)

// 动态
const activities = ref([])
const activityTotal = ref(0)
const activityPage = ref(1)
const activitySize = ref(30)
const includeEdited = ref(false)
const activityLoading = ref(false)

// 任务抽屉
const drawerVisible = ref(false)
const drawerTaskId = ref('')

// 项目扩展信息：只展示已填写的字段，停用字段仍保留展示
const projectExtraRows = computed(() => {
    const extra = project.value?.extra || {}
    return fieldStore.fieldList
        .filter((f) => f.targetType === 'project')
        .filter((f) => extra[f.id] !== undefined && extra[f.id] !== '')
        .map((f) => ({
            id: f.id,
            label: f.label,
            enabled: f.enabled,
            value: Array.isArray(extra[f.id]) ? extra[f.id].join('、') : String(extra[f.id])
        }))
})

const isArchived = computed(() => project.value?.status === 'archived')
const canManage = computed(() => {
    const user = userStore.userInfo
    if (!user || !project.value) return false
    return user.role === 'admin' || project.value.PM === user.id
})

const memberName = (id) => memberStore.memberName(id)
const initial = (id) => (memberName(id) || '?').trim().charAt(0).toUpperCase()

const projectIcon = computed(() => project.value?.icon || 'Folder')
const priorityClass = computed(() => {
    const map = { 高: 'is-high', 中: 'is-medium', 低: 'is-low' }
    return map[project.value?.priority] || 'is-medium'
})
const statusText = computed(() => PROJECT_STATUS_LABEL[project.value?.status] || project.value?.status || '')

// ——— 指标 ———
const todayStr = new Date().toISOString().slice(0, 10)
const stats = computed(() => {
    const list = tasks.value
    const byStatus = { todo: 0, doing: 0, done: 0, accepted: 0, canceled: 0 }
    let blocked = 0
    let overdue = 0
    for (const t of list) {
        if (byStatus[t.status] !== undefined) byStatus[t.status] += 1
        if (t.blocked && t.status !== 'canceled') blocked += 1
        if (t.dueDate && t.dueDate < todayStr && !['accepted', 'canceled'].includes(t.status)) overdue += 1
    }
    const active = list.length - byStatus.canceled
    const progress = active > 0 ? Math.round((byStatus.accepted / active) * 100) : 0
    return { total: list.length, byStatus, blocked, overdue, active, progress }
})

const filteredTasks = computed(() => {
    return tasks.value.filter((t) => {
        if (statusFilter.value !== 'all' && t.status !== statusFilter.value) return false
        if (assigneeFilter.value !== 'all') {
            if (assigneeFilter.value === 'unassigned') {
                if (t.assignee) return false
            } else if (t.assignee !== assigneeFilter.value) {
                return false
            }
        }
        if (onlyBlocked.value && !t.blocked) return false
        return true
    })
})

const statusOptions = [
    { value: 'todo', label: '待办' },
    { value: 'doing', label: '进行中' },
    { value: 'done', label: '待验收' },
    { value: 'accepted', label: '已验收' },
    { value: 'canceled', label: '已取消' }
]

// 成员 + 各自任务数
const memberRows = computed(() => {
    if (!project.value) return []
    const counts = new Map()
    for (const t of tasks.value) {
        if (t.assignee) counts.set(t.assignee, (counts.get(t.assignee) || 0) + 1)
    }
    return (project.value.members || []).map((id) => ({
        id,
        name: memberName(id),
        initial: initial(id),
        isPM: project.value.PM === id,
        count: counts.get(id) || 0
    }))
})

// ——— 动态 ———
const pad = (n) => String(n).padStart(2, '0')
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const timeText = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

const dayLabel = (d) => {
    const now = new Date()
    const yesterday = new Date()
    yesterday.setDate(now.getDate() - 1)
    if (dateKey(d) === dateKey(now)) return '今天'
    if (dateKey(d) === dateKey(yesterday)) return '昨天'
    return dateKey(d)
}

const itemText = (ev) => {
    const meta = getEventMeta(ev.type)
    if (ev.type === 'project_status' && ev.from && ev.to) {
        return `项目阶段：${PROJECT_STATUS_LABEL[ev.from] || ev.from} → ${PROJECT_STATUS_LABEL[ev.to] || ev.to}`
    }
    if (ev.type === 'edited' && Array.isArray(ev.changes) && ev.changes.length) {
        const summary = ev.changes
            .map((c) => (c.textOnly ? `修改了${c.label}` : `修改${c.label}`))
            .join('、')
        return summary
    }
    return meta.label
}

const activityGroups = computed(() => {
    const groups = []
    let current = null
    for (const ev of activities.value) {
        const d = new Date(ev.at)
        if (Number.isNaN(d.getTime())) continue
        const key = dateKey(d)
        if (!current || current.key !== key) {
            current = { key, label: dayLabel(d), items: [] }
            groups.push(current)
        }
        current.items.push({
            ...ev,
            time: timeText(d),
            meta: getEventMeta(ev.type),
            text: itemText(ev)
        })
    }
    return groups
})

const recentActivities = computed(() => activities.value.slice(0, 5))

// ——— 加载 ———
const loadProject = async () => {
    loading.value = true
    forbidden.value = false
    try {
        project.value = await getProjectDetail(projectId.value)
    } catch (error) {
        if (String(error.message || '').includes('无权')) {
            forbidden.value = true
        } else {
            ElMessage.error(error.message || '项目加载失败')
        }
        project.value = null
    } finally {
        loading.value = false
    }
}

const loadTasks = async () => {
    try {
        await taskStore.refreshProject(projectId.value)
    } catch (error) {
        ElMessage.error(error.message || '任务加载失败')
    }
}

const loadActivities = async () => {
    activityLoading.value = true
    try {
        const res = await getProjectActivities(projectId.value, {
            page: activityPage.value,
            size: activitySize.value,
            includeEdited: includeEdited.value ? 1 : 0
        })
        activities.value = res.list || []
        activityTotal.value = res.total || 0
    } catch (error) {
        if (!forbidden.value) ElMessage.error(error.message || '动态加载失败')
    } finally {
        activityLoading.value = false
    }
}

const reloadAll = async () => {
    await loadProject()
    if (forbidden.value) return
    await Promise.all([loadTasks(), loadActivities()])
}

watch(includeEdited, () => {
    activityPage.value = 1
    loadActivities()
})

watch(activityPage, () => loadActivities())

onMounted(async () => {
    memberStore.initMembers()
    fieldStore.initFields().catch(() => {})
    await userStore.restoreUserInfo()
    await reloadAll()
})

// ——— 操作 ———
// 详情挂在两个父路由下：从看板进回看板，从归档进回归档
const isArchiveDetail = computed(() => route.name === 'ProjectArchiveDetail')
const parentPath = computed(() => (isArchiveDetail.value ? '/project/archive' : '/project/board'))
const parentLabel = computed(() => (isArchiveDetail.value ? '项目归档' : '项目看板'))

const goBack = () => router.push(parentPath.value)

const openBoard = () => router.push({ path: '/task/board', query: { projectId: projectId.value } })

// ——— 编辑项目 ———
// 项目经理只能把负责人锁定为自己，避免改完失去管理权
const pmLockedTo = computed(() =>
    userStore.userInfo?.role === 'pm' ? userStore.userInfo.id : ''
)
const editVisible = ref(false)

const openEditProject = () => {
    if (!canManage.value) {
        ElMessage.warning('只有项目负责人或管理员可以编辑项目')
        return
    }
    editVisible.value = true
}

const submitProjectEdit = async (payload) => {
    try {
        await updateProject(projectId.value, payload)
        ElMessage.success('项目已更新')
        editVisible.value = false
        await reloadAll()
    } catch (error) {
        ElMessage.error(error.message || '保存失败')
    }
}

// ——— 另存为模板：把项目结构提取成模板草稿 ———
const templateFormVisible = ref(false)
const templateDraft = ref(null)

const diffDays = (a, b) =>
    Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000)

const openSaveAsTemplate = () => {
    if (!project.value) return
    // 全部未取消任务
    const list = tasks.value.filter((t) => t.status !== 'canceled')
    if (!list.length) {
        ElMessage.warning('项目还没有任务，无法生成模板')
        return
    }

    const sorted = [...list].sort((a, b) => {
        const sa = a.plannedStart || a.createdAt || ''
        const sb = b.plannedStart || b.createdAt || ''
        if (sa !== sb) return sa < sb ? -1 : 1
        return (a.createdAt || '') < (b.createdAt || '') ? -1 : 1
    })

    const base =
        project.value.startDate ||
        sorted[0]?.plannedStart ||
        sorted[0]?.createdAt ||
        new Date().toISOString().slice(0, 10)

    const included = new Set(list.map((t) => t.id))
    const keyOf = (id) => `t_${id}`

    templateDraft.value = {
        name: `${project.value.title}模板`,
        projectType: project.value.type || '',
        priority: project.value.priority || '中',
        description: project.value.desc || '',
        fieldIds: Array.isArray(project.value.fieldIds)
            ? [...project.value.fieldIds]
            : fieldStore.enabledProjectFields.map((f) => f.id),
        enabled: true,
        tasks: sorted.map((t) => {
            const start = t.plannedStart || t.createdAt || base
            const startOffset = Math.max(0, diffDays(base, start))
            return {
                key: keyOf(t.id),
                title: t.title,
                description: t.desc || '',
                priority: t.priority || '中',
                startOffset,
                duration: t.dueDate ? Math.max(1, diffDays(start, t.dueDate) + 1) : 1,
                dependsOn: (t.dependsOn || [])
                    .filter((id) => included.has(id))
                    .map(keyOf)
            }
        })
    }
    templateFormVisible.value = true
}

const submitTemplateDraft = async (payload) => {
    try {
        await templateStore.createTemplate(payload)
        ElMessage.success('模板已创建，可在「项目模板」中查看')
        templateFormVisible.value = false
        templateDraft.value = null
    } catch (error) {
        ElMessage.error(error.message || '模板创建失败')
    }
}

const openTask = (row) => {
    drawerTaskId.value = row.id
    drawerVisible.value = true
}

// 动态条目：有 taskId 才能点开对应任务
const openActivity = (ev) => {
    if (!ev.taskId) return
    drawerTaskId.value = ev.taskId
    drawerVisible.value = true
}

const gotoTasks = (status) => {
    statusFilter.value = status
    tab.value = 'tasks'
}

const switchTab = (name) => {
    if (name === 'overview') {
        statusFilter.value = 'all'
        assigneeFilter.value = 'all'
        onlyBlocked.value = false
    }
}

const closeHandler = async () => {
    try {
        await ElMessageBox.confirm(
            `关闭「${project.value.title}」后，项目会进入「项目归档」，所有任务变为只读，历史与时间线完整保留。`,
            '关闭项目',
            { type: 'warning', confirmButtonText: '关闭并归档', cancelButtonText: '取消' }
        )
    } catch {
        return
    }
    try {
        await closeProject(projectId.value)
        ElMessage.success('项目已关闭并归档')
        await reloadAll()
    } catch (error) {
        ElMessage.error(error.message || '关闭项目失败')
    }
}

const reopenHandler = async () => {
    try {
        await ElMessageBox.confirm(
            `撤销归档后，「${project.value.title}」会恢复为执行中并重新可编辑。\n\n已删除的任务不会被自动恢复。`,
            '撤销归档',
            { type: 'warning', confirmButtonText: '撤销归档', cancelButtonText: '取消' }
        )
    } catch {
        return
    }
    try {
        await reopenProject(projectId.value)
        ElMessage.success('项目已撤销归档')
        await reloadAll()
    } catch (error) {
        ElMessage.error(error.message || '撤销归档失败')
    }
}
</script>

<template>
    <div class="detail-page">
        <!-- 无权查看 -->
        <div v-if="forbidden" class="forbidden">
            <el-empty description="你不是该项目成员，无权查看">
                <el-button type="primary" @click="goBack">返回{{ parentLabel }}</el-button>
            </el-empty>
        </div>

        <template v-else>
            <div v-loading="loading" class="page-inner">
                <!-- 头部 -->
                <header v-if="project" class="hero" :class="priorityClass">
                    <div class="hero-main">
                        <button type="button" class="back-btn" :title="`返回${parentLabel}`" @click="goBack">
                            <el-icon><ArrowLeft /></el-icon>
                        </button>
                        <div class="hero-icon">
                            <el-icon>
                                <component :is="projectIcon" />
                            </el-icon>
                        </div>
                        <div class="hero-text">
                            <div class="title-row">
                                <h1>{{ project.title }}</h1>
                                <span class="type-chip">{{ project.type }}</span>
                                <span class="status-pill" :class="{ archived: isArchived }">
                                    <span class="dot" aria-hidden="true"></span>{{ statusText }}
                                </span>
                            </div>
                            <p class="meta">
                                负责人：{{ memberName(project.PM) }} ·
                                {{ (project.members || []).length }} 位成员 ·
                                创建于 {{ project.createdAt }}
                                <template v-if="isArchived && project.closedAt">
                                    · 关闭于 {{ new Date(project.closedAt).toLocaleDateString() }}
                                </template>
                            </p>
                        </div>
                    </div>
                    <div class="hero-actions">
                        <el-button v-if="!isArchived && canManage" :icon="Edit" @click="openEditProject">
                            编辑项目
                        </el-button>
                        <el-button v-if="!isArchived" :icon="Pointer" @click="openBoard">打开任务看板</el-button>
                        <el-button v-if="canManage" :icon="Collection" @click="openSaveAsTemplate">
                            另存为模板
                        </el-button>
                        <el-button v-if="!isArchived && canManage" type="warning" plain :icon="SwitchButton"
                            @click="closeHandler">
                            关闭并归档
                        </el-button>
                        <el-button v-if="isArchived && canManage" type="primary" :icon="RefreshLeft"
                            @click="reopenHandler">
                            撤销归档
                        </el-button>
                    </div>
                </header>

                <!-- 归档横幅 -->
                <el-alert v-if="isArchived" class="archive-banner" type="info" :closable="false" show-icon
                    title="该项目已归档，仅可查看。任务、事件与时间线完整保留；需要继续推进请联系项目负责人撤销归档。" />

                <p v-if="project?.desc" class="project-desc">{{ project.desc }}</p>

                <!-- 项目自定义字段 -->
                <div v-if="projectExtraRows.length" class="project-extra">
                    <span v-for="row in projectExtraRows" :key="row.id" class="extra-chip">
                        <span class="extra-label">{{ row.label }}</span>
                        <span class="extra-value">{{ row.value }}</span>
                        <span v-if="!row.enabled" class="extra-off">已停用</span>
                    </span>
                </div>

                <!-- 指标 -->
                <section class="stat-grid">
                    <div class="stat-card" @click="gotoTasks('all')">
                        <span class="stat-label">任务总数</span>
                        <span class="stat-value">{{ stats.total }}</span>
                    </div>
                    <div class="stat-card tone-doing" @click="gotoTasks('doing')">
                        <span class="stat-label">进行中</span>
                        <span class="stat-value">{{ stats.byStatus.doing }}</span>
                    </div>
                    <div class="stat-card tone-done" @click="gotoTasks('done')">
                        <span class="stat-label">待验收</span>
                        <span class="stat-value">{{ stats.byStatus.done }}</span>
                    </div>
                    <div class="stat-card tone-blocked" :class="{ alert: stats.blocked > 0 }" @click="gotoTasks('all')">
                        <span class="stat-label">
                            <el-icon><WarningFilled /></el-icon>阻塞
                        </span>
                        <span class="stat-value">{{ stats.blocked }}</span>
                    </div>
                    <div class="stat-card tone-overdue" :class="{ alert: stats.overdue > 0 }" @click="gotoTasks('all')">
                        <span class="stat-label">逾期</span>
                        <span class="stat-value">{{ stats.overdue }}</span>
                    </div>
                    <div class="stat-card tone-progress">
                        <span class="stat-label">完成率</span>
                        <span class="stat-value">{{ stats.progress }}%</span>
                        <el-progress :percentage="stats.progress" :show-text="false" :stroke-width="4" />
                    </div>
                </section>

                <!-- 标签页 -->
                <el-tabs v-model="tab" class="detail-tabs" @tab-change="switchTab">
                    <!-- 概览 -->
                    <el-tab-pane label="概览" name="overview">
                        <div class="overview-grid">
                            <!-- 任务分布：状态 → 负责人 -->
                            <div class="panel">
                                <div class="panel-head">
                                    <h3>任务分布</h3>
                                    <el-button link type="primary" @click="gotoTasks('all')">任务列表</el-button>
                                </div>
                                <DrilldownPieChart :tasks="tasks" dimension="status" />
                            </div>

                            <!-- 负责人分布：负责人 → 状态 -->
                            <div class="panel">
                                <div class="panel-head">
                                    <h3>负责人分布</h3>
                                    <span class="panel-hint">点击下钻看状态</span>
                                </div>
                                <DrilldownPieChart :tasks="tasks" dimension="assignee" />
                            </div>

                            <!-- 最近动态：与前两张图同一行 -->
                            <div class="panel recent-panel">
                                <div class="panel-head">
                                    <h3>最近动态</h3>
                                    <el-button link type="primary" @click="tab = 'activity'">查看全部</el-button>
                                </div>
                                <div v-if="recentActivities.length" class="activity-mini">
                                    <div v-for="ev in recentActivities" :key="ev.id" class="mini-item"
                                        :class="`tone-${getEventMeta(ev.type).tone}`" @click="openActivity(ev)">
                                        <span class="mini-dot"></span>
                                        <span class="mini-actor">{{ memberName(ev.by) }}</span>
                                        <span class="mini-text">{{ itemText(ev) }}</span>
                                        <span v-if="ev.taskTitle" class="mini-task">「{{ ev.taskTitle }}」</span>
                                        <span class="mini-time">{{ new Date(ev.at).toLocaleString() }}</span>
                                    </div>
                                </div>
                                <el-empty v-else description="暂无动态" :image-size="60" />
                            </div>
                        </div>
                    </el-tab-pane>

                    <!-- 任务 -->
                    <el-tab-pane :label="`任务 (${stats.total})`" name="tasks">
                        <div class="task-toolbar">
                            <el-select v-model="statusFilter" size="small" style="width: 140px">
                                <el-option label="全部状态" value="all" />
                                <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
                            </el-select>
                            <el-select v-model="assigneeFilter" size="small" style="width: 160px">
                                <el-option label="全部负责人" value="all" />
                                <el-option label="待认领" value="unassigned" />
                                <el-option v-for="m in memberRows" :key="m.id" :label="m.name" :value="m.id" />
                            </el-select>
                            <el-checkbox v-model="onlyBlocked" size="small">仅看阻塞</el-checkbox>
                            <span class="toolbar-count">共 {{ filteredTasks.length }} 条</span>
                        </div>

                        <el-table :data="filteredTasks" stripe style="width: 100%" empty-text="暂无任务"
                            row-class-name="task-row" @row-click="openTask">
                            <el-table-column label="任务" min-width="240">
                                <template #default="{ row }">
                                    <div class="task-title-cell">
                                        <span class="task-name">{{ row.title }}</span>
                                        <span v-if="row.blocked" class="blocked-tag">
                                            <el-icon><WarningFilled /></el-icon>阻塞
                                        </span>
                                    </div>
                                </template>
                            </el-table-column>
                            <el-table-column label="负责人" width="120">
                                <template #default="{ row }">
                                    <span v-if="row.assignee">{{ memberName(row.assignee) }}</span>
                                    <span v-else class="muted">待认领</span>
                                </template>
                            </el-table-column>
                            <el-table-column label="状态" width="110">
                                <template #default="{ row }">
                                    <span class="status-text" :class="`st-${row.status}`">
                                        {{ TASK_STATUS_LABEL[row.status] || row.status }}
                                    </span>
                                </template>
                            </el-table-column>
                            <el-table-column label="优先级" width="90">
                                <template #default="{ row }">{{ row.priority || '—' }}</template>
                            </el-table-column>
                            <el-table-column label="截止日期" width="150">
                                <template #default="{ row }">
                                    <span v-if="row.dueDate" class="due-cell">
                                        {{ row.dueDate }}
                                        <DueBadge :due-date="row.dueDate" :status="row.status" />
                                    </span>
                                    <span v-else class="muted">—</span>
                                </template>
                            </el-table-column>
                        </el-table>
                    </el-tab-pane>

                    <!-- 动态 -->
                    <el-tab-pane :label="`动态 (${activityTotal})`" name="activity">
                        <div class="activity-toolbar">
                            <el-checkbox v-model="includeEdited" size="small">显示编辑记录</el-checkbox>
                            <span class="toolbar-tip">默认只显示状态流转类事件，编辑类默认折叠</span>
                        </div>

                        <div v-loading="activityLoading" class="activity-list">
                            <template v-if="activityGroups.length">
                                <div v-for="group in activityGroups" :key="group.key" class="day-group">
                                    <div class="day-label">{{ group.label }}</div>
                                    <div v-for="ev in group.items" :key="ev.id" class="activity-item"
                                        :class="`tone-${ev.meta.tone}`" @click="openActivity(ev)">
                                        <span class="activity-dot" aria-hidden="true"></span>
                                        <div class="activity-main">
                                            <div class="activity-head">
                                                <span class="actor">
                                                    <span class="mini-avatar">{{ initial(ev.by) }}</span>
                                                    {{ memberName(ev.by) }}
                                                </span>
                                                <span class="activity-time">{{ ev.time }}</span>
                                            </div>
                                            <p class="activity-text">
                                                {{ ev.text }}
                                                <span v-if="ev.taskTitle" class="task-chip">「{{ ev.taskTitle }}」</span>
                                            </p>
                                            <p v-if="ev.reason" class="activity-reason">原因：{{ ev.reason }}</p>
                                        </div>
                                    </div>
                                </div>
                                <div v-if="activityTotal > activitySize" class="activity-pagination">
                                    <el-pagination background layout="prev, pager, next" :total="activityTotal"
                                        :page-size="activitySize" :current-page="activityPage"
                                        @current-change="activityPage = $event" />
                                </div>
                            </template>
                            <el-empty v-else description="暂无动态" :image-size="80" />
                        </div>
                    </el-tab-pane>

                    <!-- 成员 -->
                    <el-tab-pane :label="`成员 (${memberRows.length})`" name="members">
                        <div class="member-grid">
                            <div v-for="m in memberRows" :key="m.id" class="member-card">
                                <span class="member-avatar">{{ m.initial }}</span>
                                <div class="member-info">
                                    <span class="member-name">{{ m.name }}</span>
                                    <span class="member-role" :class="{ pm: m.isPM }">
                                        {{ m.isPM ? '项目负责人' : '成员' }}
                                    </span>
                                </div>
                                <span class="member-count">{{ m.count }} 个任务</span>
                            </div>
                        </div>
                    </el-tab-pane>
                </el-tabs>
            </div>

            <TaskDrawer v-model="drawerVisible" :task-id="drawerTaskId" />
            <TemplateFormDialog v-model="templateFormVisible" :template="templateDraft"
                @submit="submitTemplateDraft" />
            <ProjectFormDialog v-model="editVisible" :project="project" :pm-locked-to="pmLockedTo"
                @submit="submitProjectEdit" />
        </template>
    </div>
</template>

<style scoped lang="scss">
.detail-page {
    padding: 24px;
    min-height: 100%;
}

.forbidden {
    padding: 80px 0;
}

// 头部
.hero {
    --c: #409eff;
    --c-2: #79bbff;
    --c-soft: rgba(64, 158, 255, 0.1);
    --c-glow: rgba(64, 158, 255, 0.35);

    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 22px;
    background: #fff;
    border: 1px solid #e8eaef;
    border-top: 3px solid var(--c);
    border-radius: 14px;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
    flex-wrap: wrap;

    &.is-high {
        --c: #f43f5e;
        --c-2: #fb7185;
        --c-soft: rgba(244, 63, 94, 0.1);
        --c-glow: rgba(244, 63, 94, 0.35);
    }

    &.is-medium {
        --c: #409eff;
        --c-2: #79bbff;
        --c-soft: rgba(64, 158, 255, 0.1);
        --c-glow: rgba(64, 158, 255, 0.35);
    }

    &.is-low {
        --c: #10b981;
        --c-2: #34d399;
        --c-soft: rgba(16, 185, 129, 0.1);
        --c-glow: rgba(16, 185, 129, 0.35);
    }

    .hero-main {
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 0;
    }

    .back-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        flex-shrink: 0;
        font-size: 15px;
        color: #6b7280;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        cursor: pointer;
        transition: color 0.15s ease, border-color 0.15s ease;

        &:hover {
            color: var(--c);
            border-color: var(--c);
        }
    }

    .hero-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 46px;
        height: 46px;
        flex-shrink: 0;
        font-size: 24px;
        color: #fff;
        background: linear-gradient(135deg, var(--c), var(--c-2));
        border-radius: 12px;
        box-shadow: 0 4px 10px var(--c-glow);
    }

    .hero-text {
        min-width: 0;
    }

    .title-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;

        h1 {
            margin: 0;
            font-size: 20px;
            color: #1f2430;
            letter-spacing: -0.2px;
        }
    }

    .type-chip {
        padding: 2px 9px;
        font-size: 11px;
        font-weight: 600;
        color: var(--c);
        background: var(--c-soft);
        border-radius: 999px;
    }

    .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 2px 9px;
        font-size: 11px;
        font-weight: 500;
        color: #4b5563;
        background: #f1f5f9;
        border-radius: 999px;

        .dot {
            width: 6px;
            height: 6px;
            background: #67c23a;
            border-radius: 50%;
        }

        &.archived {
            color: #6b7280;
            background: #f3f4f6;

            .dot {
                background: #9ca3af;
            }
        }
    }

    .meta {
        margin: 6px 0 0;
        font-size: 12px;
        color: #6b7280;
    }

    .hero-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }
}

.archive-banner {
    margin-top: 12px;
}

.project-desc {
    margin: 14px 2px 0;
    font-size: 13px;
    line-height: 1.7;
    color: #4b5563;
}

.project-extra {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 10px 2px 0;

    .extra-chip {
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
        padding: 5px 10px;
        font-size: 12px;
        background: #f8fafc;
        border: 1px solid #eef2f7;
        border-radius: 8px;
    }

    .extra-label {
        color: #9ca3af;
    }

    .extra-value {
        font-weight: 500;
        color: #1f2430;
    }

    .extra-off {
        padding: 0 4px;
        font-size: 10px;
        color: #9ca3af;
        background: #f3f4f6;
        border-radius: 4px;
    }
}

// 指标卡
.stat-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 12px;
    margin-top: 16px;

    .stat-card {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 14px 16px;
        background: #fff;
        border: 1px solid #e8eaef;
        border-radius: 12px;
        cursor: pointer;
        transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;

        &:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 18px -10px rgba(16, 24, 40, 0.3);
        }

        .stat-label {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            color: #6b7280;
        }

        .stat-value {
            font-size: 22px;
            font-weight: 700;
            color: #1f2430;
            line-height: 1.2;
        }

        &.tone-doing .stat-value { color: #409eff; }
        &.tone-done .stat-value { color: #e6a23c; }
        &.tone-blocked .stat-value { color: #f43f5e; }
        &.tone-overdue .stat-value { color: #b45309; }
        &.tone-progress .stat-value { color: #67c23a; }

        &.alert {
            border-color: #fecdd3;
            background: #fff8f9;
        }

        :deep(.el-progress) {
            margin-top: 2px;
        }
    }
}

// 标签页
.detail-tabs {
    margin-top: 18px;

    :deep(.el-tabs__header) {
        margin-bottom: 16px;
    }
}

// 概览
// 概览：任务分布 / 负责人分布 / 最近动态 同一行
.overview-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    align-items: stretch;
}

.panel {
    display: flex;
    flex-direction: column;
    padding: 16px 18px;
    background: #fff;
    border: 1px solid #e8eaef;
    border-radius: 12px;
    min-width: 0;

    h3 {
        margin: 0 0 12px;
        font-size: 13px;
        font-weight: 600;
        color: #1f2430;
    }
}

.panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;

    h3 {
        margin: 0;
    }
}

.panel-hint {
    font-size: 11px;
    color: #9ca3af;
}

.recent-panel {
    margin-top: 0;

    .activity-mini {
        max-height: 300px;
        overflow-y: auto;
        padding-right: 4px;
    }
}

.mini-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 600;
    color: #fff;
    background: linear-gradient(135deg, #60a5fa, #3b82f6);
    border-radius: 50%;

    &.empty {
        color: #9ca3af;
        background: #eef1f5;
    }
}

.activity-mini {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.mini-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #4b5563;
    flex-wrap: wrap;
    cursor: pointer;

    &:hover .mini-text {
        color: #1f2430;
    }

    .mini-dot {
        width: 7px;
        height: 7px;
        flex-shrink: 0;
        background: #94a3b8;
        border-radius: 50%;
    }

    &.tone-primary .mini-dot { background: #409eff; }
    &.tone-success .mini-dot { background: #67c23a; }
    &.tone-warning .mini-dot { background: #e6a23c; }
    &.tone-danger .mini-dot { background: #f43f5e; }

    .mini-actor {
        font-weight: 600;
        color: #1f2430;
    }

    .mini-task {
        color: #409eff;
    }

    .mini-time {
        margin-left: auto;
        font-size: 11px;
        color: #9ca3af;
    }
}

// 任务表格
.task-toolbar,
.activity-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    flex-wrap: wrap;

    .toolbar-count,
    .toolbar-tip {
        font-size: 12px;
        color: #9ca3af;
    }
}

:deep(.task-row) {
    cursor: pointer;
}

.task-title-cell {
    display: flex;
    align-items: center;
    gap: 8px;

    .task-name {
        font-weight: 500;
        color: #1f2430;
    }

    .blocked-tag {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 1px 7px;
        font-size: 11px;
        color: #be123c;
        background: #fff1f2;
        border-radius: 999px;
    }
}

.status-text {
    font-size: 12px;

    &.st-todo { color: #909399; }
    &.st-doing { color: #409eff; }
    &.st-done { color: #e6a23c; }
    &.st-accepted { color: #67c23a; }
    &.st-canceled { color: #9ca3af; }
}

.due-cell {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.muted {
    color: #9ca3af;
    font-style: italic;
}

// 动态
.activity-list {
    min-height: 160px;
}

.day-group + .day-group {
    margin-top: 16px;
}

.day-label {
    margin-bottom: 10px;
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
}

.activity-item {
    --c: #94a3b8;

    position: relative;
    display: flex;
    gap: 10px;
    padding-bottom: 14px;
    cursor: pointer;

    &::before {
        content: '';
        position: absolute;
        left: 4px;
        top: 12px;
        bottom: 0;
        width: 1px;
        background: #eef1f5;
    }

    &:last-child::before {
        display: none;
    }

    &.tone-primary { --c: #409eff; }
    &.tone-success { --c: #67c23a; }
    &.tone-warning { --c: #e6a23c; }
    &.tone-danger { --c: #f43f5e; }

    .activity-dot {
        position: relative;
        z-index: 1;
        width: 9px;
        height: 9px;
        margin-top: 5px;
        flex-shrink: 0;
        background: var(--c);
        border-radius: 50%;
        box-shadow: 0 0 0 3px #fff;
    }

    .activity-main {
        flex: 1;
        min-width: 0;
    }

    .activity-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 3px;
    }

    .actor {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 600;
        color: #1f2430;
    }

    .activity-time {
        font-size: 11px;
        color: #9ca3af;
        font-variant-numeric: tabular-nums;
    }

    .activity-text {
        margin: 0;
        font-size: 12px;
        line-height: 1.6;
        color: #4b5563;

        .task-chip {
            color: #409eff;
        }
    }

    .activity-reason {
        margin: 6px 0 0;
        padding: 6px 10px;
        font-size: 12px;
        line-height: 1.6;
        color: #92400e;
        background: #fffbeb;
        border-radius: 6px;
    }
}

.activity-pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
}

// 成员
.member-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
}

.member-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    background: #fff;
    border: 1px solid #e8eaef;
    border-radius: 12px;

    .member-avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        flex-shrink: 0;
        font-size: 14px;
        font-weight: 600;
        color: #fff;
        background: linear-gradient(135deg, #60a5fa, #3b82f6);
        border-radius: 50%;
    }

    .member-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }

    .member-name {
        font-size: 13px;
        font-weight: 600;
        color: #1f2430;
    }

    .member-role {
        font-size: 11px;
        color: #9ca3af;

        &.pm {
            color: #409eff;
        }
    }

    .member-count {
        margin-left: auto;
        font-size: 12px;
        color: #6b7280;
        flex-shrink: 0;
    }
}

// 三栏布局在常规桌面宽度下保持一行；<1100px 折成两栏，<720px 折成单栏
@media (max-width: 1100px) {
    .overview-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .recent-panel {
        grid-column: span 2;
    }
}

@media (max-width: 1200px) {
    .stat-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .member-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 720px) {
    .stat-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .overview-grid {
        grid-template-columns: 1fr;
    }

    .recent-panel {
        grid-column: auto;
    }

    .member-grid {
        grid-template-columns: 1fr;
    }
}

@media (prefers-reduced-motion: reduce) {
    .detail-page *,
    .detail-page *::before,
    .detail-page *::after {
        transition: none !important;
    }
}
</style>
