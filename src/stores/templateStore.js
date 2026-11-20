import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
    getTemplateList,
    createTemplate as createTemplateApi,
    updateTemplate as updateTemplateApi,
    deleteTemplate as deleteTemplateApi,
    applyTemplate as applyTemplateApi
} from '@/api/template'

export const useTemplateStore = defineStore('template', () => {
    const templateList = ref([])
    let initPromise = null

    const initTemplates = (force = false) => {
        if (initPromise && !force) return initPromise
        initPromise = getTemplateList()
            .then((list) => {
                templateList.value = list || []
            })
            .finally(() => {
                initPromise = null
            })
        return initPromise
    }

    const refresh = () => initTemplates(true)

    const enabledTemplates = computed(() => templateList.value.filter((t) => t.enabled))

    const createTemplate = async (data) => {
        const template = await createTemplateApi(data)
        templateList.value.unshift(template)
        return template
    }

    const updateTemplate = async (id, data) => {
        const updated = await updateTemplateApi(id, data)
        const index = templateList.value.findIndex((t) => t.id === id)
        if (index !== -1) templateList.value[index] = updated
        return updated
    }

    const removeTemplate = async (id) => {
        await deleteTemplateApi(id)
        templateList.value = templateList.value.filter((t) => t.id !== id)
    }

    const toggleTemplate = (template, enabled) => updateTemplate(template.id, { enabled })

    // 套用后返回新项目，调用方负责跳转
    const applyTemplate = (id, data) => applyTemplateApi(id, data)

    return {
        templateList,
        enabledTemplates,
        initTemplates,
        refresh,
        createTemplate,
        updateTemplate,
        removeTemplate,
        toggleTemplate,
        applyTemplate
    }
})
