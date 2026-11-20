<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, QuestionFilled, Search } from '@element-plus/icons-vue'
import { useFieldStore } from '@/stores/fieldStore'
import { useMemberStore } from '@/stores/memberStore'
import { useProjectStore } from '@/stores/projectStore'
import { useTaskStore } from '@/stores/taskStore'
import { useUserStore } from '@/stores/userStore'
import { canDeleteTask, canEditTask, isAdmin, isProjectMember } from '@/utils/permissions'
import { PRIORITY_ORDER, PROJECT_STATUS_LABEL, TASK_STATUS, TASK_STATUS_LABEL } from '@/constants/status'
import TaskCard from './components/TaskCard.vue'
import TaskDrawer from './components/TaskDrawer.vue'
import AssignTaskDialog from './components/AssignTaskDialog.vue'

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

// 项目内的成员（用于"指派"下拉过滤）
const membersOfCurrentProject = computed(() => {
    if (!currentProject.value) return []
    return memberStore.memberList.filter((m) =>
        currentProject.value.members.includes(m.id)
    )
})

// 认领需要是项目成员（管理员如果不是成员，接口也会拒绝）
const canClaimThisProject = computed(() =>
    isProjectMember(userStore.userInfo, currentProject.value)
)

// 新建任务：管理员或项目成员
const canCreateTask = computed(() => {
    const user = userStore.userInfo
    if (!user) return false
    return isAdmin(user) || isProjectMember(user, currentProject.value)
})

// 当前用户是否能"验收/驳回/重开"这个项目下的任务
// 只有项目负责人（PM）或 admin 可以，避免自己验收自己做的任务
const canReviewCurrentProject = computed(() => {
    const user = userStore.userInfo
    if (!user) return false
    if (user.role === 'admin') return true
    return !!currentProject.value && currentProject.value.PM === user.id
})

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
    const all = taskStore.taskMap?.[currentProjectId.value] || []
    const list = all.filter(matchesFilter)
    const filtered = onlyBlocked.value ? list.filter((t) => t.blocked) : list
    for (const t of filtered) {
        if (columns[t.status]) columns[t.status].push(t)
        else if (t.status !== 'canceled') columns.todo.push(t)
    }
    return columns
})

// 已取消任务单独放折叠区，不占日常视野
const canceledTasks = computed(() => {
    const list = taskStore.taskMap?.[currentProjectId.value] || []
    return list.filter((t) => t.status === 'canceled' && matchesFilter(t))
})

// 切换项目时清空筛选
watch(currentProjectId, () => {
    taskKeyword.value = ''
    assigneeFilter.value = 'all'
    onlyBlocked.value = false
})
// 已取消折叠区是否展开
const canceledOpen = ref(false)

// 任务详情抽屉
const drawerVisible = ref(false)
const drawerTaskId = ref('')

const openTask = (task) => {
    drawerTaskId.value = task.id
    drawerVisible.value = true
}

// 提交验收 / 阻塞 / 解除：负责人本人、PM 或 admin
const canOperateTask = (task) => {
    const user = userStore.userInfo
    if (!user) return false
    if (user.role === 'admin') return true
    if (currentProject.value?.PM === user.id) return true
    return task.assignee === user.id
}

const canCancelTask = (task) => {
    const user = userStore.userInfo
    if (!user) return false
    if (user.role === 'admin') return true
    if (currentProject.value?.PM === user.id) return true
    return task.createdBy === user.id
}

// 尚未完成的前置任务（待验收/已验收视为完成）
const DEP_DONE = ['done', 'accepted']
const pendingDepsOfTask = (task) => {
    const list = taskStore.taskMap?.[currentProjectId.value] || []
    return (task.dependsOn || [])
        .map((id) => list.find((t) => t.id === id))
        .filter((t) => t && !DEP_DONE.includes(t.status))
}

// 卡片展示用的依赖信息：总数、未完成数、前置任务名
const depsInfoOf = (task) => {
    const ids = task.dependsOn || []
    if (!ids.length) return null
    const list = taskStore.taskMap?.[currentProjectId.value] || []
    const names = ids.map((id) => list.find((t) => t.id === id)?.title).filter(Boolean)
    return { total: ids.length, pending: pendingDepsOfTask(task).length, names }
}

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
        currentProjectId.value = projectStore.projectList[0].id
    }
}

// 新建 / 编辑 弹窗
const dialogVisible = ref(false)
const editingId = ref('')
const isEdit = computed(() => !!editingId.value)
const dialogTitle = computed(() => (isEdit.value ? '编辑任务' : '新增任务'))

// 本地日期（YYYY-MM-DD），避免 toISOString 的时区偏移
const todayStr = () => {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const emptyForm = () => ({
    title: '',
    desc: '',
    priority: '中',
    assignee: '',
    status: 'todo',
    // 创建时间：可编辑，默认今天；支持回溯（复盘导入时改成历史日期）
    createdAt: todayStr(),
    // 计划开始：排期用，独立于审计字段 createdAt
    plannedStart: todayStr(),
    dueDate: '',
    // 前置任务 id 数组（同项目、无环）
    dependsOn: [],
    // 自定义字段值：{ [fieldId]: value }
    extra: {}
})
const form = ref(emptyForm())
const formRef = ref(null)

// 截止日期不能早于「创建时间」和「计划开始」中较晚的那个
const dueLowerBound = computed(() => {
    const a = form.value.createdAt || ''
    const b = form.value.plannedStart || ''
    return a > b ? a : b
})

const validateDueDate = (rule, value, callback) => {
    if (!value || !dueLowerBound.value) return callback()
    if (value < dueLowerBound.value) {
        return callback(new Error('截止日期不能早于创建时间或计划开始'))
    }
    callback()
}

const validatePlannedStart = (rule, value, callback) => {
    if (!value) return callback()
    if (form.value.dueDate && value > form.value.dueDate) {
        return callback(new Error('计划开始不能晚于截止日期'))
    }
    callback()
}

const rules = {
    title: [{ required: true, message: '请输入任务标题', trigger: 'blur' }],
    status: [{ required: true, message: '请选择状态', trigger: 'change' }],
    plannedStart: [{ validator: validatePlannedStart, trigger: 'change' }],
    dueDate: [{ validator: validateDueDate, trigger: 'change' }]
}

// 自定义字段：只有“必填”才生成校验规则
const fieldRules = (field) => {
    if (!field.required) return []
    return [{
        required: true,
        message: `请填写${field.label}`,
        trigger: field.type === 'text' || field.type === 'textarea' ? 'blur' : 'change'
    }]
}

// 创建时间最晚只能选今天（不允许把任务"建在未来"）
const disableFutureDate = (time) => time.getTime() > Date.now()
// 截止日期不能早于创建时间 / 计划开始
const disableDueDate = (time) => {
    if (!dueLowerBound.value) return false
    return time.getTime() < new Date(`${dueLowerBound.value}T00:00:00`).getTime()
}

// 创建时间被改到截止日期之后时，清掉非法的截止日期
const onCreatedAtChange = (value) => {
    if (form.value.dueDate && value && form.value.dueDate < value) {
        form.value.dueDate = ''
        ElMessage.warning('截止日期早于新的创建时间，已清空，请重新选择')
    }
}

// 可选的前置任务：同项目、非自己、未取消
const dependencyOptions = computed(() => {
    const list = taskStore.taskMap?.[currentProjectId.value] || []
    return list.filter((t) => t.id !== editingId.value && t.status !== 'canceled')
})

// 新建：assignee 选当前项目的 members（留空也行，留空就是 Pull 制待认领）
const openCreate = () => {
    if (!currentProjectId.value) {
        ElMessage.warning('请先选择一个项目')
        return
    }
    if (!canCreateTask.value) {
        ElMessage.warning('只有项目成员或管理员可以创建任务')
        return
    }
    editingId.value = ''
    form.value = emptyForm()
    dialogVisible.value = true
}

const openEdit = (task) => {
    if (!canEditTask(userStore.userInfo, currentProject.value, task)) {
        ElMessage.warning('没有权限编辑该任务')
        return
    }
    editingId.value = task.id
    form.value = {
        title: task.title,
        desc: task.desc || '',
        priority: task.priority || '中',
        assignee: task.assignee || '',
        status: task.status || 'todo',
        createdAt: task.createdAt || todayStr(),
        plannedStart: task.plannedStart || task.createdAt || todayStr(),
        dueDate: task.dueDate || '',
        dependsOn: [...(task.dependsOn || [])],
        extra: { ...(task.extra || {}) }
    }
    dialogVisible.value = true
}

const closeDialog = () => {
    dialogVisible.value = false
    editingId.value = ''
    form.value = emptyForm()
}

const submitForm = async () => {
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return

    // 状态由负责人推导：待办 = 无人负责；选了负责人 = 直接开工
    const assignee = form.value.assignee || ''
    let status = form.value.status
    if (!isEdit.value) {
        status = assignee ? 'doing' : 'todo'
    } else if (status === 'todo' && assignee) {
        status = 'doing'
    }
    if (!['todo', 'canceled'].includes(status) && !assignee) {
        ElMessage.warning('非待办任务必须有负责人，请先选择负责人')
        return
    }

    const payload = { ...form.value, status }
    try {
        if (isEdit.value) {
            await taskStore.updateTask(editingId.value, payload, currentProjectId.value)
            ElMessage.success('任务已更新')
        } else {
            await taskStore.createTask({
                ...payload,
                projectId: currentProjectId.value,
                createdBy: userStore.userInfo?.id || ''
            })
            ElMessage.success('任务已创建')
        }
        closeDialog()
    } catch (error) {
        ElMessage.error(error.message || '保存失败')
    }
}

const removeTask = async (task) => {
    if (!canDeleteTask(userStore.userInfo, currentProject.value)) {
        ElMessage.warning('只有项目负责人或管理员可以删除任务')
        return
    }
    try {
        await ElMessageBox.confirm(
            `删除会把「${task.title}」从看板移除，且不可恢复。\n\n如果只是不做了，请改用「取消任务」：任务会进入「已取消」区，之后可以恢复。`,
            '删除任务',
            {
                type: 'warning',
                confirmButtonText: '仍然删除',
                cancelButtonText: '再想想'
            }
        )
    } catch {
        return
    }
    try {
        await taskStore.removeTask(task.id, currentProjectId.value)
        ElMessage.success('任务已删除')
    } catch (error) {
        ElMessage.error(error.message || '删除失败')
    }
}

// ——— 显式指派：项目负责人 / 管理员 ———
const assignVisible = ref(false)
const assigningTask = ref(null)

const canAssignTask = (task) =>
    task.status === 'todo' && !task.assignee && canReviewCurrentProject.value

const openAssign = (task) => {
    if (!canReviewCurrentProject.value) {
        ElMessage.warning('只有项目负责人或管理员可以指派任务')
        return
    }
    assigningTask.value = task
    assignVisible.value = true
}

const confirmAssign = async (memberId) => {
    const task = assigningTask.value
    if (!task) return
    let forceStart = false
    const pending = pendingDepsOfTask(task)
    if (pending.length) {
        try {
            await ElMessageBox.confirm(
                `前置任务尚未完成：${pending.map((t) => t.title).join('、')}。\n指派后任务会直接开工，请确认顺序风险。`,
                '前置任务未完成',
                { type: 'warning', confirmButtonText: '仍然指派', cancelButtonText: '取消' }
            )
        } catch {
            return
        }
        forceStart = true
    }
    try {
        await taskStore.updateTask(
            task.id,
            { assignee: memberId, forceStart },
            currentProjectId.value
        )
        ElMessage.success(`已指派给${memberStore.memberName(memberId)}`)
        assignVisible.value = false
        assigningTask.value = null
    } catch (error) {
        ElMessage.error(error.message || '指派失败')
    }
}

const claimTask = async (task) => {
    const currentUserId = userStore.userInfo?.id
    if (!currentUserId) {
        ElMessage.warning('请先登录')
        return
    }
    if (!canClaimThisProject.value) {
        ElMessage.warning('你不是该项目的成员，无法认领')
        return
    }
    // 前置任务未完成：提醒后可强制认领
    let forceStart = false
    const pending = pendingDepsOfTask(task)
    if (pending.length) {
        try {
            await ElMessageBox.confirm(
                `前置任务尚未完成：${pending.map((t) => t.title).join('、')}。\n强制认领后仍可继续，但请确认顺序风险。`,
                '前置任务未完成',
                { type: 'warning', confirmButtonText: '强制认领', cancelButtonText: '取消' }
            )
        } catch {
            return
        }
        forceStart = true
    }
    try {
        await taskStore.claimTask(task.id, currentUserId, currentProjectId.value, forceStart)
        ElMessage.success(`已认领「${task.title}」，任务自动启动`)
    } catch (error) {
        ElMessage.error(error.message || '认领失败')
    }
}

// 推进状态：blocked 时先解除阻塞再提交（一次确认，产生两条事件）
const advanceTask = async (task) => {
    let next = null
    let verb = ''
    if (task.status === 'doing') {
        if (!canOperateTask(task)) {
            ElMessage.warning('只有任务负责人、项目负责人或管理员可以提交验收')
            return
        }
        // 阻塞中的任务不允许直接提交：确认后自动解除阻塞，再提交
        if (task.blocked) {
            try {
                await ElMessageBox.confirm(
                    `该任务仍处于阻塞状态（原因：${task.blockedReason || '未填写'}）。\n提交验收将自动解除阻塞，是否继续？`,
                    '提交验收',
                    { type: 'warning', confirmButtonText: '解除并提交', cancelButtonText: '取消' }
                )
            } catch {
                return
            }
            try {
                await taskStore.unblockTask(task.id, currentProjectId.value)
            } catch (error) {
                ElMessage.error(error.message || '解除阻塞失败，请稍后重试')
                return
            }
        }
        next = 'done'
        verb = '已提交验收'
    } else if (task.status === 'done') {
        if (!canReviewCurrentProject.value) {
            ElMessage.warning('只有项目负责人或管理员可以验收')
            return
        }
        next = 'accepted'
        verb = '已验收通过'
    }
    if (!next) return
    try {
        await taskStore.moveColumn(task.id, next, currentProjectId.value)
        ElMessage.success(`「${task.title}」${verb}`)
    } catch (error) {
        ElMessage.error(error.message || '状态更新失败')
    }
}

// 驳回：done→doing（PM 驳回重新做）
const rejectTask = async (task) => {
    if (!canReviewCurrentProject.value) {
        ElMessage.warning('只有项目负责人或管理员可以驳回')
        return
    }
    let reason = ''
    try {
        const { value } = await ElMessageBox.prompt(
            `确定将任务「${task.title}」驳回到"进行中"吗？请填写驳回原因：`,
            '驳回任务',
            {
                confirmButtonText: '确认驳回',
                cancelButtonText: '取消',
                inputPlaceholder: '例如：主图尺寸不符合规范',
                inputValidator: (val) => (val && val.trim() ? true : '驳回原因不能为空'),
                inputType: 'textarea'
            }
        )
        reason = value.trim()
    } catch {
        return
    }
    try {
        await taskStore.moveColumn(task.id, 'doing', currentProjectId.value, { reason })
        ElMessage.success(`「${task.title}」已驳回，执行人需重新提交`)
    } catch (error) {
        ElMessage.error(error.message || '驳回失败')
    }
}

// 重开：accepted→doing（PM/admin，必须填写原因，留痕）
const reopenTask = async (task) => {
    if (!canReviewCurrentProject.value) {
        ElMessage.warning('只有项目负责人或管理员可以重开任务')
        return
    }
    let reason = ''
    try {
        const { value } = await ElMessageBox.prompt(
            `重开「${task.title}」后，任务会退回"进行中"重新处理。请填写重开原因：`,
            '重开已验收任务',
            {
                confirmButtonText: '确认重开',
                cancelButtonText: '取消',
                inputPlaceholder: '例如：验收后回归发现缺陷 / 需求变更',
                inputValidator: (val) => (val && val.trim() ? true : '重开原因不能为空'),
                inputType: 'textarea'
            }
        )
        reason = value.trim()
    } catch {
        return
    }
    try {
        await taskStore.moveColumn(task.id, 'doing', currentProjectId.value, { reason })
        ElMessage.success(`「${task.title}」已重开，退回进行中`)
    } catch (error) {
        ElMessage.error(error.message || '重开失败')
    }
}

// ——— 阻塞：标记不改变泳道，只挂一个 flag ———
const blockHandler = async (task) => {
    if (!canOperateTask(task)) {
        ElMessage.warning('只有任务负责人、项目负责人或管理员可以标记阻塞')
        return
    }
    let reason = ''
    try {
        const { value } = await ElMessageBox.prompt(
            `标记「${task.title}」为阻塞后，任务仍在当前泳道，但会带阻塞标记。请填写阻塞原因：`,
            '标记阻塞',
            {
                confirmButtonText: '标记阻塞',
                cancelButtonText: '取消',
                inputPlaceholder: '例如：等待后端订单接口联调',
                inputValidator: (val) => (val && val.trim() ? true : '阻塞原因不能为空'),
                inputType: 'textarea'
            }
        )
        reason = value.trim()
    } catch {
        return
    }
    try {
        await taskStore.blockTask(task.id, reason, currentProjectId.value)
        ElMessage.success('已标记阻塞')
    } catch (error) {
        ElMessage.error(error.message || '标记阻塞失败')
    }
}

const unblockHandler = async (task) => {
    if (!canOperateTask(task)) {
        ElMessage.warning('只有任务负责人、项目负责人或管理员可以解除阻塞')
        return
    }
    try {
        await taskStore.unblockTask(task.id, currentProjectId.value)
        ElMessage.success('已解除阻塞')
    } catch (error) {
        ElMessage.error(error.message || '解除阻塞失败')
    }
}

// ——— 取消 / 恢复 ———
const cancelHandler = async (task) => {
    if (!canCancelTask(task)) {
        ElMessage.warning('只有项目负责人、管理员或任务创建人可以取消任务')
        return
    }
    let reason = ''
    try {
        const { value } = await ElMessageBox.prompt(
            `取消「${task.title}」后任务会进入"已取消"，不再计入完成率。请填写取消原因：`,
            '取消任务',
            {
                confirmButtonText: '确认取消',
                cancelButtonText: '再想想',
                inputPlaceholder: '例如：需求已砍 / 与其它任务重复',
                inputValidator: (val) => (val && val.trim() ? true : '取消原因不能为空'),
                inputType: 'textarea'
            }
        )
        reason = value.trim()
    } catch {
        return
    }
    try {
        await taskStore.cancelTask(task.id, reason, currentProjectId.value)
        ElMessage.success(`「${task.title}」已取消`)
    } catch (error) {
        ElMessage.error(error.message || '取消失败')
    }
}

const restoreHandler = async (task) => {
    if (!canReviewCurrentProject.value) {
        ElMessage.warning('只有项目负责人或管理员可以恢复任务')
        return
    }
    try {
        await taskStore.restoreTask(task.id, currentProjectId.value)
        ElMessage.success(`「${task.title}」已恢复到待办`)
        canceledOpen.value = true
    } catch (error) {
        ElMessage.error(error.message || '恢复失败')
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
    } finally {
        loading.value = false
    }
})
</script>

<template>
    <div class="task-page">
        <!-- 顶部栏 -->
        <header class="page-header">
            <div class="project-switch">
                <label>项目</label>
                <el-select v-model="currentProjectId" placeholder="请选择项目" style="width: 280px">
                    <el-option
                        v-for="p in projectStore.projectList"
                        :key="p.id"
                        :label="`${p.title} · ${p.type}`"
                        :value="p.id"
                    />
                </el-select>
                <span v-if="currentProject" class="project-meta">
                    负责人：{{ memberStore.memberName(currentProject.PM) }} ·
                    {{ currentProject.members.length }} 位成员 ·
                    {{ PROJECT_STATUS_LABEL[currentProject.status] || currentProject.status }}
                </span>
            </div>
            <div class="page-actions">
                <el-input v-model="taskKeyword" placeholder="搜索任务标题" clearable size="small"
                    style="width: 180px">
                    <template #prefix>
                        <el-icon><Search /></el-icon>
                    </template>
                </el-input>
                <el-select v-model="assigneeFilter" size="small" style="width: 170px">
                    <el-option label="全部负责人" value="all" />
                    <el-option label="待认领" value="unassigned" />
                    <el-option v-for="m in membersOfCurrentProject" :key="m.id"
                        :label="m.active === false ? `${m.name}（已停用）` : m.name" :value="m.id" />
                </el-select>
                <el-radio-group v-model="onlyBlocked" size="small">
                    <el-radio-button :value="false">全部</el-radio-button>
                    <el-radio-button :value="true">仅看阻塞</el-radio-button>
                </el-radio-group>
                <el-popover placement="bottom-end" :width="340" trigger="click">
                    <template #reference>
                        <el-button text size="small" class="help-btn">
                            <el-icon><QuestionFilled /></el-icon>阻塞 / 取消 / 删除区别
                        </el-button>
                    </template>
                    <div class="help-list">
                        <p>
                            <b>阻塞</b>：任务仍留在当前泳道，只标注“暂时推进不了”，不改变状态；
                            问题解决后点「解除阻塞」继续。
                        </p>
                        <p>
                            <b>取消任务</b>：这件事不做了，任务进入「已取消」区，不计入完成率，
                            之后可以恢复。
                        </p>
                        <p>
                            <b>删除</b>：把任务从看板移除，只用于误建或重复数据，删除后不可恢复。
                        </p>
                    </div>
                </el-popover>
                <el-button v-if="canCreateTask" type="primary" @click="openCreate" :disabled="!currentProjectId">
                    <el-icon style="margin-right: 4px"><Plus /></el-icon>新建任务
                </el-button>
            </div>
        </header>

        <!-- 看板 -->
        <div v-loading="loading" class="board">
            <div
                v-for="col in COLUMN_DEFS"
                :key="col.status"
                class="column"
                :class="`col-${col.status}`"
            >
                <header class="col-header">
                    <span class="col-title">{{ col.label }}</span>
                    <span class="col-count">{{ grouped[col.status].length }}</span>
                </header>
                <p class="col-hint">{{ col.hint }}</p>
                <div class="col-body">
                    <TaskCard
                        v-for="t in grouped[col.status]"
                        :key="t.id"
                        :task="t"
                        :can-claim="canClaimThisProject"
                        :can-assign="canAssignTask(t)"
                        :can-submit="canOperateTask(t)"
                        :can-review="canReviewCurrentProject"
                        :can-block="canOperateTask(t)"
                        :can-cancel="canCancelTask(t)"
                        :can-edit="canEditTask(userStore.userInfo, currentProject, t)"
                        :can-delete="canDeleteTask(userStore.userInfo, currentProject)"
                        :deps="depsInfoOf(t)"
                        @open="openTask"
                        @edit="openEdit"
                        @delete="removeTask"
                        @claim="claimTask"
                        @assign="openAssign"
                        @advance="advanceTask"
                        @reject="rejectTask"
                        @reopen="reopenTask"
                        @restore="restoreHandler"
                        @block="blockHandler"
                        @unblock="unblockHandler"
                        @cancel="cancelHandler"
                    />
                </div>
            </div>
        </div>

        <!-- 已取消：折叠区，不占日常视野 -->
        <section v-if="canceledTasks.length" class="canceled-section" :class="{ open: canceledOpen }">
            <button type="button" class="canceled-head" @click="canceledOpen = !canceledOpen">
                <span class="canceled-title">
                    已取消
                    <span class="canceled-count">{{ canceledTasks.length }}</span>
                </span>
                <span class="canceled-toggle">{{ canceledOpen ? '收起' : '展开' }}</span>
            </button>
            <div v-if="canceledOpen" class="canceled-body">
                <TaskCard
                    v-for="t in canceledTasks"
                    :key="t.id"
                    :task="t"
                    :can-claim="false"
                    :can-review="canReviewCurrentProject"
                    :can-block="false"
                    :can-cancel="false"
                    :can-edit="canEditTask(userStore.userInfo, currentProject, t)"
                    :can-delete="canDeleteTask(userStore.userInfo, currentProject)"
                    :deps="depsInfoOf(t)"
                    @open="openTask"
                    @edit="openEdit"
                    @delete="removeTask"
                    @restore="restoreHandler"
                />
            </div>
        </section>

        <!-- 任务详情抽屉：详情 + 完整时间线 -->
        <TaskDrawer v-model="drawerVisible" :task-id="drawerTaskId" />

        <!-- 显式指派：项目负责人 / 管理员 -->
        <AssignTaskDialog v-model="assignVisible" :task="assigningTask" :members="membersOfCurrentProject"
            @confirm="confirmAssign" />

        <!-- 新建/编辑弹窗 -->
        <el-dialog :title="dialogTitle" v-model="dialogVisible" width="520px" destroy-on-close>
            <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
                <el-form-item label="标题" prop="title">
                    <el-input v-model="form.title" placeholder="请输入任务标题" maxlength="60" show-word-limit />
                </el-form-item>
                <el-form-item label="描述">
                    <el-input v-model="form.desc" type="textarea" :rows="3" placeholder="选填" />
                </el-form-item>
                <el-form-item label="优先级">
                    <el-radio-group v-model="form.priority">
                        <el-radio-button v-for="p in PRIORITY_ORDER" :key="p" :value="p">
                            {{ p }}
                        </el-radio-button>
                    </el-radio-group>
                </el-form-item>
                <el-form-item label="负责人">
                    <el-select v-model="form.assignee" clearable placeholder="留空表示待认领" style="width: 100%">
                        <el-option
                            v-for="m in membersOfCurrentProject"
                            :key="m.id"
                            :label="m.name"
                            :value="m.id"
                            :disabled="m.active === false"
                        />
                    </el-select>
                    <p class="assignee-hint">
                        {{ isEdit
                            ? '非待办任务必须保留负责人；待办任务一旦指派负责人，会自动进入「进行中」'
                            : '留空 = 待办（成员可认领）；选择负责人 = 直接进入「进行中」' }}
                    </p>
                </el-form-item>
                <el-form-item v-if="isEdit" label="当前状态">
                    <span class="status-readonly">{{ TASK_STATUS_LABEL[form.status] || form.status }}</span>
                </el-form-item>
                <el-form-item label="创建时间" prop="createdAt">
                    <el-date-picker
                        v-model="form.createdAt"
                        type="date"
                        value-format="YYYY-MM-DD"
                        placeholder="默认今天，可回溯"
                        :disabled-date="disableFutureDate"
                        :clearable="false"
                        style="width: 100%"
                        @change="onCreatedAtChange"
                    />
                </el-form-item>
                <el-form-item label="计划开始" prop="plannedStart">
                    <el-date-picker
                        v-model="form.plannedStart"
                        type="date"
                        value-format="YYYY-MM-DD"
                        placeholder="排期用，可早于创建时间"
                        style="width: 100%"
                    />
                </el-form-item>
                <el-form-item label="截止日期" prop="dueDate">
                    <el-date-picker
                        v-model="form.dueDate"
                        type="date"
                        value-format="YYYY-MM-DD"
                        placeholder="不早于创建时间 / 计划开始"
                        :disabled-date="disableDueDate"
                        style="width: 100%"
                    />
                </el-form-item>
                <el-form-item label="前置任务">
                    <el-select v-model="form.dependsOn" multiple filterable clearable
                        placeholder="选填，本项目内、不能成环" style="width: 100%">
                        <el-option v-for="t in dependencyOptions" :key="t.id" :label="t.title" :value="t.id">
                            <span>{{ t.title }}</span>
                            <span class="dep-option-status">{{ TASK_STATUS_LABEL[t.status] || t.status }}</span>
                        </el-option>
                    </el-select>
                </el-form-item>

                <!-- 自定义字段：由「字段配置」页动态生成 -->
                <template v-if="fieldStore.enabledTaskFields.length">
                    <el-divider content-position="left">扩展信息</el-divider>
                    <el-form-item v-for="f in fieldStore.enabledTaskFields" :key="f.id" :label="f.label"
                        :prop="`extra.${f.id}`" :rules="fieldRules(f)">
                        <el-input v-if="f.type === 'text'" v-model="form.extra[f.id]"
                            :placeholder="f.description || '请输入'" />
                        <el-input v-else-if="f.type === 'textarea'" v-model="form.extra[f.id]" type="textarea"
                            :rows="2" :placeholder="f.description || '请输入'" />
                        <el-input-number v-else-if="f.type === 'number'" v-model="form.extra[f.id]"
                            :controls="false" :placeholder="f.description || '请输入数字'" style="width: 100%" />
                        <el-date-picker v-else-if="f.type === 'date'" v-model="form.extra[f.id]" type="date"
                            value-format="YYYY-MM-DD" :placeholder="f.description || '选择日期'"
                            style="width: 100%" />
                        <el-select v-else-if="f.type === 'select'" v-model="form.extra[f.id]" clearable
                            :placeholder="f.description || '请选择'" style="width: 100%">
                            <el-option v-for="opt in f.options" :key="opt" :label="opt" :value="opt" />
                        </el-select>
                    </el-form-item>
                </template>
            </el-form>
            <template #footer>
                <el-button @click="closeDialog">取消</el-button>
                <el-button type="primary" @click="submitForm">确定</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<style scoped lang="scss">
.task-page {
    padding: 24px;
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

.help-btn {
    color: #6b7280;

    .el-icon {
        margin-right: 3px;
    }
}

.help-list {
    p {
        margin: 0 0 8px;
        font-size: 12px;
        line-height: 1.7;
        color: #4b5563;

        &:last-child {
            margin-bottom: 0;
        }
    }

    b {
        color: #1f2430;
    }
}

.assignee-hint {
    width: 100%;
    margin: 4px 0 0;
    font-size: 11px;
    line-height: 1.5;
    color: #9ca3af;
}

.status-readonly {
    font-size: 13px;
    font-weight: 500;
    color: #4b5563;
}

.board {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    align-items: start;
}

.page-actions {
    display: flex;
    align-items: center;
    gap: 12px;
}

.dep-option-status {
    float: right;
    margin-left: 12px;
    font-size: 11px;
    color: #9ca3af;
}

// 已取消：默认折叠，点开才展开
.canceled-section {
    margin-top: 16px;
    background: #f7f8fa;
    border: 1px dashed #dfe3ea;
    border-radius: 12px;
    overflow: hidden;

    .canceled-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 10px 16px;
        font-family: inherit;
        background: transparent;
        border: none;
        cursor: pointer;
        transition: background 0.15s ease;

        &:hover {
            background: #f0f2f5;
        }
    }

    .canceled-title {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 600;
        color: #4b5563;
    }

    .canceled-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        font-size: 11px;
        font-weight: 600;
        color: #6b7280;
        background: #e5e7eb;
        border-radius: 999px;
    }

    .canceled-toggle {
        font-size: 12px;
        color: #9ca3af;
    }

    .canceled-body {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        padding: 0 16px 16px;
    }
}

.column {
    background: #f1f1f1;
    border: 1px solid #cfcfcf;
    border-radius: 14px;
    padding: 14px 12px;
    min-height: 494px;
    box-sizing: border-box;
    position: relative;

    .col-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 2px;

        .col-title {
            font-size: 14px;
            font-weight: 600;
            color: #1f2430;
        }

        .col-count {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 20px;
            height: 20px;
            font-size: 11px;
            font-weight: 600;
            color: #fff;
            background: #d1d5db;
            border-radius: 999px;
            padding: 0 6px;
        }
    }

    .col-hint {
        font-size: 11px;
        color: #9ca3af;
        margin: 0 0 12px;
    }

    .col-body {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
}

// 各列主题色（通过 count 徽章染色列头部）
.col-todo .col-count { background: #909399; }
.col-doing .col-count { background: #409eff; }
.col-done .col-count { background: #e6a23c; }
.col-accepted .col-count { background: #67c23a; }

@media (max-width: 1200px) {
    .board {
        grid-template-columns: repeat(2, 1fr);
    }

    .canceled-section .canceled-body {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 720px) {
    .board {
        grid-template-columns: 1fr;
    }

    .page-actions {
        flex-wrap: wrap;
    }

    .canceled-section .canceled-body {
        grid-template-columns: 1fr;
    }
}
</style>
