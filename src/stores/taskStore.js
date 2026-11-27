import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { createIdempotentLoader } from '@/utils/async'
import {
    getTasksByProject,
    getAllTasks,
    getTaskDetail,
    createTask as createTaskApi,
    updateTask as updateTaskApi,
    deleteTask as deleteTaskApi,
    claimTask as claimTaskApi,
    blockTask as blockTaskApi,
    unblockTask as unblockTaskApi,
    cancelTask as cancelTaskApi,
    restoreTask as restoreTaskApi
} from '@/api/task'
import { useMemberStore } from '@/stores/memberStore'
import { useUserStore } from '@/stores/userStore'
import { useProjectStore } from '@/stores/projectStore'
import { buildMyTaskBuckets, countMyPendingTasks } from '@/utils/my-tasks'

export const useTaskStore = defineStore('task', () => {
    // 用 projectId 做缓存 key（不搞全局大数组，按项目拉更省）
    const taskMap = ref({}) // { projectId: [task, task, ...] }
    // 任务详情（含事件日志），只在打开抽屉时拉
    const taskDetail = ref(null)
    const memberStore = useMemberStore()
    const userStore = useUserStore()
    const projectStore = useProjectStore()

    // 侧边栏「我的任务」徽标：与「我的任务」页面共用收件箱口径（本人该做的三类事务，去重）
    const myPendingCount = computed(() => {
        const me = userStore.userInfo
        if (!me?.id) return 0
        const archived = new Set((projectStore.projectList || []).filter((p) => p.status === 'archived').map((p) => p.id))
        const tasks = []
        for (const [pid, list] of Object.entries(taskMap.value || {})) {
            if (archived.has(pid)) continue
            for (const t of list || []) tasks.push({ task: t, projectId: pid })
        }
        const buckets = buildMyTaskBuckets(tasks, {
            me,
            getProject: (id) => (projectStore.projectList || []).find((p) => p.id === id)
        })
        return countMyPendingTasks(buckets)
    })

    // 按项目取任务（普通函数；看板的 grouped computed 会直接引用 taskMap 追踪响应式）
    const tasksOfProject = (projectId) => taskMap.value[projectId] || []

    const groupedByStatus = (projectId) => {
        const list = tasksOfProject(projectId)
        return {
            todo: list.filter((t) => t.status === 'todo'),
            doing: list.filter((t) => t.status === 'doing'),
            done: list.filter((t) => t.status === 'done'),
            accepted: list.filter((t) => t.status === 'accepted')
        }
    }

    const initAll = createIdempotentLoader(async () => {
        const list = await getAllTasks()
        taskMap.value = {}
        for (const t of list) {
            if (!taskMap.value[t.projectId]) taskMap.value[t.projectId] = []
            taskMap.value[t.projectId].push(t)
        }
    })

    // 强制刷新某一项目的任务
    const refreshProject = async (projectId) => {
        taskMap.value[projectId] = await getTasksByProject(projectId)
    }

    const createTask = async (data) => {
        const task = await createTaskApi(data)
        if (!taskMap.value[data.projectId]) taskMap.value[data.projectId] = []
        taskMap.value[data.projectId].unshift(task)
        return task
    }

    const updateTask = async (id, data, projectId) => {
        const updated = await updateTaskApi(id, data)
        const list = taskMap.value[projectId] || []
        const idx = list.findIndex((t) => t.id === id)
        if (idx !== -1) list[idx] = updated
        return updated
    }

    const removeTask = async (id, projectId) => {
        await deleteTaskApi(id)
        taskMap.value[projectId] = (taskMap.value[projectId] || []).filter((t) => t.id !== id)
    }

    const claimTask = async (id, memberId, projectId, forceStart = false) => {
        const updated = await claimTaskApi(id, memberId, forceStart)
        const list = taskMap.value[projectId] || []
        const idx = list.findIndex((t) => t.id === id)
        if (idx !== -1) list[idx] = updated
        return updated
    }

    // 看板列间移动：改 status，可附带额外字段（如重开/驳回原因）
    const moveColumn = async (id, newStatus, projectId, extra = {}) => {
        await updateTask(id, { status: newStatus, ...extra }, projectId)
    }

    // ——— 详情与事件日志 ———
    const fetchTaskDetail = async (id) => {
        taskDetail.value = await getTaskDetail(id)
        return taskDetail.value
    }

    // 用接口返回的最新任务替换列表里的旧对象（保持看板同步）
    const syncList = (updated) => {
        if (!updated) return
        const list = taskMap.value[updated.projectId] || []
        const idx = list.findIndex((t) => t.id === updated.id)
        if (idx !== -1) list[idx] = updated
        // 抽屉打开时同步刷新详情的事件日志
        if (taskDetail.value?.id === updated.id) {
            fetchTaskDetail(updated.id).catch(() => {})
        }
    }

    const blockTask = async (id, reason, projectId) => {
        const updated = await blockTaskApi(id, reason)
        syncList({ ...updated, projectId })
        return updated
    }

    const unblockTask = async (id, projectId) => {
        const updated = await unblockTaskApi(id)
        syncList({ ...updated, projectId })
        return updated
    }

    const cancelTask = async (id, reason, projectId) => {
        const updated = await cancelTaskApi(id, reason)
        syncList({ ...updated, projectId })
        return updated
    }

    const restoreTask = async (id, projectId) => {
        const updated = await restoreTaskApi(id)
        syncList({ ...updated, projectId })
        return updated
    }

    // 帮助函数：member 名字
    const memberName = (id) => memberStore.memberName(id)

    return {
        taskMap,
        taskDetail,
        myPendingCount,
        tasksOfProject,
        groupedByStatus,
        initAll,
        refreshProject,
        fetchTaskDetail,
        createTask,
        updateTask,
        removeTask,
        claimTask,
        moveColumn,
        blockTask,
        unblockTask,
        cancelTask,
        restoreTask,
        memberName
    }
})