import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useMemberStore } from '@/stores/memberStore'
import { useTaskStore } from '@/stores/taskStore'
import { useUserStore } from '@/stores/userStore'
import { canDeleteTask, isProjectMember, canOperateTask as canOperate, canCancelTask as canCancel } from '@/utils/permissions'

// 待验收 / 已验收都视为前置任务已完成
const DEP_DONE = ['done', 'accepted']

/**
 * 任务看板的全部操作与权限判断。
 * 页面只保留数据加载、筛选和弹窗状态，这里负责「能不能做」以及具体动作。
 */
export function useTaskBoardActions({
    currentProjectId,
    currentProject,
    canReviewCurrentProject,
    canceledOpen
}) {
    const taskStore = useTaskStore()
    const memberStore = useMemberStore()
    const userStore = useUserStore()

    // 认领需要是项目成员（管理员如果不是成员，接口也会拒绝）
    const canClaimThisProject = computed(() =>
        isProjectMember(userStore.userInfo, currentProject.value)
    )

    // 提交验收 / 阻塞 / 解除：负责人本人、PM 或 admin
    const canOperateTask = (task) => canOperate(userStore.userInfo, currentProject.value, task)

    const canCancelTask = (task) => canCancel(userStore.userInfo, currentProject.value, task)

    const projectTasks = () => taskStore.taskMap?.[currentProjectId.value] || []

    // 尚未完成的前置任务
    const pendingDepsOfTask = (task) => {
        const list = projectTasks()
        return (task.dependsOn || [])
            .map((id) => list.find((t) => t.id === id))
            .filter((t) => t && !DEP_DONE.includes(t.status))
    }

    // 卡片展示用的依赖信息：总数、未完成数、前置任务名
    const depsInfoOf = (task) => {
        const ids = task.dependsOn || []
        if (!ids.length) return null
        const list = projectTasks()
        const names = ids.map((id) => list.find((t) => t.id === id)?.title).filter(Boolean)
        return { total: ids.length, pending: pendingDepsOfTask(task).length, names }
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

    return {
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
    }
}