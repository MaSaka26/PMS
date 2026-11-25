<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
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
import { PROJECT_STATUS_LABEL } from '@/constants/status'
import TaskDrawer from '@/views/task/components/TaskDrawer.vue'
import TemplateFormDialog from '@/views/template/components/TemplateFormDialog.vue'
import ProjectFormDialog from './components/ProjectFormDialog.vue'
import DetailHero from './components/DetailHero.vue'
import DetailStats from './components/DetailStats.vue'
import DetailOverview from './components/DetailOverview.vue'
import DetailActivity from './components/DetailActivity.vue'
import DetailTaskTable from './components/DetailTaskTable.vue'
import DetailMemberList from './components/DetailMemberList.vue'
import { buildTemplateDraft } from './composables/buildTemplateDraft'

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
// 筛选状态由指标卡和任务表共同使用，因此留在父组件
const statusFilter = ref('all')
const assigneeFilter = ref('all')
const onlyBlocked = ref(false)
const onlyOverdue = ref(false)

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
    return { total: list.length, byStatus, blocked, overdue, active, progress, members: memberRows.value.length }
})

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

const openSaveAsTemplate = () => {
    if (!project.value) return
    const draft = buildTemplateDraft({
        project: project.value,
        tasks: tasks.value,
        enabledProjectFields: fieldStore.enabledProjectFields
    })
    if (!draft) {
        ElMessage.warning('项目还没有任务，无法生成模板')
        return
    }
    templateDraft.value = draft
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

// 指标卡点击：按卡片语义切 tab 并带上筛选条件
const resetTaskFilters = () => {
    statusFilter.value = 'all'
    assigneeFilter.value = 'all'
    onlyBlocked.value = false
    onlyOverdue.value = false
}

// 概览里的「任务列表」入口：回到全部任务，不残留上一次的筛选
const gotoTasks = (status) => {
    resetTaskFilters()
    statusFilter.value = status
    tab.value = 'tasks'
}
const selectStat = (payload = {}) => {
    if (payload.tab === 'members') {
        tab.value = 'members'
        return
    }
    statusFilter.value = payload.status || 'all'
    assigneeFilter.value = payload.assignee || 'all'
    onlyBlocked.value = !!payload.onlyBlocked
    onlyOverdue.value = !!payload.onlyOverdue
    tab.value = 'tasks'
}

const switchTab = (name) => {
    if (name === 'overview') resetTaskFilters()
}

// 地址栏里的 :id 变了要重新拉数据。
// /project/board/:id 只有一个路由记录，Vue 会复用同一个组件实例，
// 于是 onMounted 不会再跑一次 —— 从看板点卡片进来时中间经过了列表页，
// 组件是全新挂载的所以没问题；直接手改地址栏或从历史/收藏跳转就会残留上一个项目的
// 标题、动态列表和成员数，只有任务数因为 taskStore 里没有这个 key 而变成 0。
watch(projectId, () => {
    tab.value = 'overview'
    resetTaskFilters()
    // 清空而不是等新请求回来：否则新数据到达前，页面会短暂显示上一个项目的动态
    activities.value = []
    activityTotal.value = 0
    activityPage.value = 1
    includeEdited.value = false
    drawerVisible.value = false
    reloadAll()
})

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
                <DetailHero v-if="project" :project="project" :is-archived="isArchived" :can-manage="canManage"
                    :status-text="statusText" :project-icon="projectIcon" :priority-class="priorityClass"
                    :pm-name="memberName(project.PM)" :back-label="`返回${parentLabel}`" @back="goBack"
                    @edit="openEditProject" @board="openBoard" @save-template="openSaveAsTemplate"
                    @close="closeHandler" @reopen="reopenHandler" />

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
                <DetailStats :stats="stats" @select="selectStat" />

                <!-- 标签页 -->
                <el-tabs v-model="tab" class="detail-tabs" @tab-change="switchTab">
                    <!-- 概览 -->
                    <el-tab-pane label="概览" name="overview">
                        <DetailOverview :tasks="tasks" :activities="activities" :member-name="memberName"
                            @open-activity="openActivity" @show-tasks="gotoTasks('all')"
                            @show-activity="tab = 'activity'" />
                    </el-tab-pane>

                    <!-- 任务 -->
                    <el-tab-pane :label="`任务 (${stats.total})`" name="tasks">
                        <DetailTaskTable v-model:status="statusFilter" v-model:assignee="assigneeFilter"
                            v-model:only-blocked="onlyBlocked" v-model:only-overdue="onlyOverdue" :tasks="tasks"
                            :members="memberRows" :member-name="memberName" @open-task="openTask" />
                    </el-tab-pane>

                    <!-- 动态 -->
                    <el-tab-pane :label="`动态 (${activityTotal})`" name="activity">
                        <DetailActivity v-model:page="activityPage" v-model:include-edited="includeEdited"
                            :activities="activities" :total="activityTotal" :size="activitySize"
                            :loading="activityLoading" :member-name="memberName" @open="openActivity" />
                    </el-tab-pane>

                    <!-- 成员 -->
                    <el-tab-pane :label="`成员 (${memberRows.length})`" name="members">
                        <DetailMemberList :members="memberRows" />
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

// 标签页
.detail-tabs {
    margin-top: 18px;

    :deep(.el-tabs__header) {
        margin-bottom: 16px;
    }
}

@media (prefers-reduced-motion: reduce) {
    .detail-page :deep(*),
    .detail-page :deep(*::before),
    .detail-page :deep(*::after) {
        transition: none !important;
    }
}
</style>
