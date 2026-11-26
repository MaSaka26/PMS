import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createKeyedIdempotentLoader } from '@/utils/async'
import {
    getProjectList,
    createProject as createProjectApi,
    updateProject as updateProjectApi,
    deleteProject as deleteProjectApi,
    closeProject as closeProjectApi,
    reopenProject as reopenProjectApi
} from '@/api/project'

export const useProjectStore = defineStore('project', () => {
    const projectList = ref([])
    const total = ref(0)
    // 按 scope 隔离：active / archived / all 各自幂等，互不覆盖
    const initProjects = createKeyedIdempotentLoader(async (scope) => {
        const res = await getProjectList({ page: 1, size: 100, scope })
        // request.js 已拆包，res 就是 { list, total }
        projectList.value = res.list || []
        total.value = res.total || 0
    })

    const refresh = (scope = 'active') => initProjects(scope)

    const createProject = async (data) => {
        const project = await createProjectApi(data)
        projectList.value.unshift(project)
        return project
    }

    const updateProject = async (id, data) => {
        const updated = await updateProjectApi(id, data)
        const idx = projectList.value.findIndex((p) => p.id === id)
        if (idx !== -1) projectList.value[idx] = updated
        return updated
    }

    const removeProject = async (id) => {
        await deleteProjectApi(id)
        projectList.value = projectList.value.filter((p) => p.id !== id)
    }

    // 关闭项目：从看板列表移除（归档是状态推导出来的视图，不是搬家）
    const closeProject = async (id, reason) => {
        await closeProjectApi(id, reason)
        projectList.value = projectList.value.filter((p) => p.id !== id)
    }

    const reopenProject = async (id) => {
        await reopenProjectApi(id)
        projectList.value = projectList.value.filter((p) => p.id !== id)
    }

    const getById = (id) => projectList.value.find((p) => p.id === id)

    // 下拉选择友好的 label（只给进行中的项目，归档项目不可选）
    const projectOptions = computed(() =>
        projectList.value
            .filter((p) => p.status !== 'archived')
            .map((p) => ({
                value: p.id,
                label: `${p.title} · ${p.type}`
            }))
    )

    return {
        projectList,
        total,
        initProjects,
        refresh,
        createProject,
        updateProject,
        removeProject,
        closeProject,
        reopenProject,
        getById,
        projectOptions
    }
})