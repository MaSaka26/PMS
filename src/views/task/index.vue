<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useFieldStore } from '@/stores/fieldStore'
import { useMemberStore } from '@/stores/memberStore'
import { useProjectStore } from '@/stores/projectStore'
import { useTaskStore } from '@/stores/taskStore'
import { useUserStore } from '@/stores/userStore'
import { canDeleteTask, canEditTask, canReviewTask, isAdmin, isProjectMember } from '@/utils/permissions'
import { PROJECT_STATUS_LABEL } from '@/constants/status'
import TaskDrawer from './components/TaskDrawer.vue'
import AssignTaskDialog from './components/AssignTaskDialog.vue'
import TaskBoardToolbar from './components/TaskBoardToolbar.vue'
import TaskBoardColumn from './components/TaskBoardColumn.vue'
import CanceledTaskSection from './components/CanceledTaskSection.vue'
import TaskFormDialog from './components/TaskFormDialog.vue'
import { useTaskBoardActions } from './composables/useTaskBoardActions'

// 状态列定义（控制显示顺序和文案）
const COLUMN_DEFS = [
    { status: 'todo', label: '待办',        hint: '新建或待启动的任务' },
    { status: 'doing', label: '进行中',      hint: '已指派，正在执行' },
    { status: 'done', label: '待验收',       hint: '执行人自认为完成' },
    { status: 'accepted', label: '已验收',    hint: '已通过验收' }
]

const memberStore = useMemberStore()
const projectStore = useProjectStore()
const taskStore = useTaskStore()
const userStore = useUserStore()
const fieldStore = useFieldStore()
const route = useRoute()

const loading = ref(false)
const currentProjectId = ref('')

const currentProject = computed(() => projectStore.getById(currentProjectId.value))
const currentTasks = computed(() => taskStore.taskMap?.[currentProjectId.value] || [])

// 项目内的成员（用于"指派"下拉过滤）
const membersOfCurrentProject = computed(() => {
    if (!currentProject.value) return []
    return memberStore.memberList.filter((m) =>
        currentProject.value.members.includes(m.id)
    )
})

// 新建任务：管理员或项目成员
const canCreateTask = computed(() => {
    const user = userStore.userInfo
    if (!user) return false
    return isAdmin(user) || isProjectMember(user, currentProject.value)
})

// 当前用户是否能"验收/驳回/重开"这个项目下的任务
// 判定收敛到 utils/permissions.js 的 canReviewTask，与 mock 接口 403 的口径一致
const canReviewCurrentProject = computed(() =>
    canReviewTask(userStore.userInfo, currentProject.value)
)

// 顶部筛选：关键字 + 负责人 + 仅看阻塞
const onlyBlocked = ref(false)
const taskKeyword = ref('')
const assigneeFilter = ref('all')

const matchesFilter = (task) => {
    const kw = taskKeyword.value.trim().toLowerCase()
    if (kw && !(task.title || '').toLowerCase().includes(kw)) return false
    if (assigneeFilter.value === 'unassigned') return !task.assignee
    if (assigneeFilter.value !== 'all') return task.assignee === assigneeFilter.value
    return true
}

// 按列分组（直接读 taskStore.taskMap，让 Vue 能追踪到乐观更新的变化）
const grouped = computed(() => {
    const columns = {}
    for (const col of COLUMN_DEFS) columns[col.status] = []
    if (!currentProjectId.value) return columns
    // Pinia 的 store 属性已自动解包：taskMap 就是对象本身，不能再取 .value
    const list = currentTasks.value.filter(matchesFilter)
    const filtered = onlyBlocked.value ? list.filter((t) => t.blocked) : list
    for (const t of filtered) {
        if (columns[t.status]) columns[t.status].push(t)
        else if (t.status !== 'canceled') columns.todo.push(t)
    }
    return columns
})

// 已取消任务单独放折叠区，不占日常视野
const canceledTasks = computed(() =>
    currentTasks.value.filter((t) => t.status === 'canceled' && matchesFilter(t))
)

// 切换项目时清空筛选
watch(currentProjectId, () => {
    taskKeyword.value = ''
    assigneeFilter.value = 'all'
    onlyBlocked.value = false
})
// 已取消折叠区是否展开
const canceledOpen = ref(false)

// 从「我的任务」跳进来定位某一张卡片：滚到它、亮一下，然后自动撤掉
const highlightId = ref('')
let highlightTimer = null

const clearHighlight = () => {
    if (highlightTimer) {
        clearTimeout(highlightTimer)
        highlightTimer = null
    }
    highlightId.value = ''
}

const locateTask = async (taskId) => {
    if (!taskId) return
    // 筛选可能把目标卡片藏起来，定位前先清掉筛选条件
    taskKeyword.value = ''
    assigneeFilter.value = 'all'
    onlyBlocked.value = false
    // 已取消的任务在折叠区里，先展开
    if (canceledTasks.value.some((t) => t.id === taskId)) canceledOpen.value = true
    await nextTick()
    const el = document.getElementById(`task-card-${taskId}`)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    highlightId.value = taskId
    clearTimeout(highlightTimer)
    highlightTimer = setTimeout(() => { highlightId.value = '' }, 2600)
}

onBeforeUnmount(clearHighlight)

// 任务详情抽屉
const drawerVisible = ref(false)
const drawerTaskId = ref('')

const openTask = (task) => {
    drawerTaskId.value = task.id
    drawerVisible.value = true
}

// 操作与权限统一放在 composable 里，页面只负责编排
const {
    canClaimThisProject,
    canOperateTask,
    canCancelTask,
    depsInfoOf,
    canAssignTask,
    assignVisible,
    assigningTask,
    openAssign,
    confirmAssign,
    claimTask,
    advanceTask,
    rejectTask,
    reopenTask,
    blockHandler,
    unblockHandler,
    cancelHandler,
    restoreHandler,
    removeTask
} = useTaskBoardActions({
    currentProjectId,
    currentProject,
    canReviewCurrentProject,
    canceledOpen
})

// 透传给子组件时固定当前项目上下文
const canEditTaskOf = (task) => canEditTask(userStore.userInfo, currentProject.value, task)
const canDeleteTaskOf = () => canDeleteTask(userStore.userInfo, currentProject.value)

const fetchProjects = async () => {
    // 第一次拉完后，默认选第一个项目
    await projectStore.initProjects()
    // 支持从项目详情页带 projectId 跳进来
    const fromQuery = String(route.query.projectId || '')
    if (fromQuery && projectStore.projectList.some((p) => p.id === fromQuery)) {
        currentProjectId.value = fromQuery
        return
    }
    if (projectStore.projectList.length && !currentProjectId.value) {
        // 默认加载置顶泳道的第一条；没有置顶则退回第一个项目
        const pinned = projectStore.projectList.find((p) => p.pinned)
        currentProjectId.value = (pinned || projectStore.projectList[0]).id
    }
}

// 新建 / 编辑 弹窗：表单状态在 TaskFormDialog 内部维护
const dialogVisible = ref(false)
const editingTask = ref(null)

const openCreate = () => {
    if (!currentProjectId.value) {
        ElMessage.warning('请先选择一个项目')
        return
    }
    if (!canCreateTask.value) {
        ElMessage.warning('只有项目成员或管理员可以创建任务')
        return
    }
    editingTask.value = null
    dialogVisible.value = true
}

const openEdit = (task) => {
    if (!canEditTask(userStore.userInfo, currentProject.value, task)) {
        ElMessage.warning('没有权限编辑该任务')
        return
    }
    editingTask.value = task
    dialogVisible.value = true
}

const submitForm = async (payload) => {
    try {
        if (editingTask.value) {
            await taskStore.updateTask(editingTask.value.id, payload, currentProjectId.value)
            ElMessage.success('任务已更新')
        } else {
            await taskStore.createTask({
                ...payload,
                projectId: currentProjectId.value,
                createdBy: userStore.userInfo?.id || ''
            })
            ElMessage.success('任务已创建')
        }
        dialogVisible.value = false
        editingTask.value = null
    } catch (error) {
        ElMessage.error(error.message || '保存失败')
    }
}

onMounted(async () => {
    loading.value = true
    try {
        // 并行拉：先等 userInfo 恢复（刷新后 userStore 自己会触发）
        await userStore.restoreUserInfo()
        await Promise.all([
            memberStore.initMembers().catch(() => {}),
            fieldStore.initFields().catch(() => {}),
            fetchProjects(),
            taskStore.initAll()
        ])
        // 从「我的任务」带 taskId 进来：等看板渲染完再定位
        await locateTask(String(route.query.taskId || ''))
    } finally {
        loading.value = false
    }
})

// 已在看板页时再次跳转：组件不会重建，得自己响应 query 变化
// 先切项目（目标任务可能属于另一个项目），再定位
watch(() => route.query.projectId, (id) => {
    const next = String(id || '')
    if (!next || next === currentProjectId.value) return
    if (!projectStore.projectList.some((p) => p.id === next)) return
    currentProjectId.value = next
    locateTask(String(route.query.taskId || ''))
})

watch(() => route.query.taskId, (id) => {
    if (id) locateTask(String(id))
})
</script>

<template>
    <div class="task-page">
        <!-- 顶部栏 -->
        <header class="page-header">
            <div class="project-switch">
                <label>项目</label>
                <el-select v-model="currentProjectId" placeholder="请选择项目" style="width: 280px">
                    <el-option v-for="p in projectStore.projectList" :key="p.id"
                        :label="`${p.title} · ${p.type}`" :value="p.id" />
                </el-select>
                <span v-if="currentProject" class="project-meta">
                    负责人：{{ memberStore.memberName(currentProject.PM) }} ·
                    {{ currentProject.members.length }} 位成员 ·
                    {{ PROJECT_STATUS_LABEL[currentProject.status] || currentProject.status }}
                </span>
            </div>
            <TaskBoardToolbar v-model:keyword="taskKeyword" v-model:assignee="assigneeFilter"
                v-model:only-blocked="onlyBlocked" :members="membersOfCurrentProject"
                :can-create="canCreateTask" :create-disabled="!currentProjectId" @create="openCreate" />
        </header>

        <!-- 看板 -->
        <div v-loading="loading" class="board">
            <TaskBoardColumn v-for="col in COLUMN_DEFS" :key="col.status" :column="col"
                :tasks="grouped[col.status]" :can-claim="canClaimThisProject"
                :can-review="canReviewCurrentProject" :can-assign-task="canAssignTask"
                :can-operate-task="canOperateTask" :can-cancel-task="canCancelTask"
                :can-edit-task="canEditTaskOf" :can-delete-task="canDeleteTaskOf"
                :deps-info-of="depsInfoOf" :highlight-id="highlightId"
                :project-id="currentProjectId"
                @open="openTask" @edit="openEdit" @delete="removeTask" @claim="claimTask"
                @assign="openAssign" @advance="advanceTask" @reject="rejectTask" @reopen="reopenTask"
                @restore="restoreHandler" @block="blockHandler" @unblock="unblockHandler"
                @cancel="cancelHandler" />
        </div>

        <!-- 已取消：折叠区，不占日常视野 -->
        <CanceledTaskSection v-if="canceledTasks.length" v-model:open="canceledOpen" :tasks="canceledTasks"
            :can-review="canReviewCurrentProject" :can-edit-task="canEditTaskOf"
            :can-delete-task="canDeleteTaskOf" :deps-info-of="depsInfoOf" :highlight-id="highlightId"
            :project-id="currentProjectId" @open-task="openTask"
            @edit="openEdit" @delete="removeTask" @restore="restoreHandler" />

        <!-- 任务详情抽屉：详情 + 完整时间线 -->
        <TaskDrawer v-model="drawerVisible" :task-id="drawerTaskId" />

        <!-- 显式指派：项目负责人 / 管理员 -->
        <AssignTaskDialog v-model="assignVisible" :task="assigningTask" :members="membersOfCurrentProject"
            @confirm="confirmAssign" />

        <!-- 新建/编辑弹窗 -->
        <TaskFormDialog v-model="dialogVisible" :task="editingTask" :members="membersOfCurrentProject"
            :tasks="currentTasks" @submit="submitForm" />
    </div>
</template>

<style scoped lang="scss">
.task-page {
    padding: 24px 16px 16px 16px;
    min-height: 100%;
}

.page-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
    flex-wrap: wrap;

    .project-switch {
        display: flex;
        align-items: center;
        gap: 10px;

        label {
            font-size: 13px;
            font-weight: 500;
            color: #6b7280;
        }

        .project-meta {
            font-size: 12px;
            color: #9ca3af;
        }
    }
}

.board {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    align-items: start;
}

@media (max-width: 1200px) {
    .board {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 720px) {
    .board {
        grid-template-columns: 1fr;
    }
}
</style>
