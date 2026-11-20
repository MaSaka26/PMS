import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
    getFieldList,
    createField as createFieldApi,
    updateField as updateFieldApi,
    deleteField as deleteFieldApi,
    reorderFields as reorderFieldsApi
} from '@/api/field'

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0)

export const useFieldStore = defineStore('field', () => {
    const fieldList = ref([])
    let initPromise = null

    const applyList = (list) => {
        fieldList.value = [...(list || [])].sort(byOrder)
    }

    // 幂等初始化：多处页面同时调用也只发一次请求
    const initFields = (force = false) => {
        if (initPromise && !force) return initPromise
        initPromise = getFieldList()
            .then(applyList)
            .finally(() => {
                initPromise = null
            })
        return initPromise
    }

    const refresh = () => initFields(true)

    const taskFields = computed(() =>
        fieldList.value.filter((f) => f.targetType === 'task')
    )
    const enabledTaskFields = computed(() => taskFields.value.filter((f) => f.enabled))
    const projectFields = computed(() =>
        fieldList.value.filter((f) => f.targetType === 'project')
    )
    const enabledProjectFields = computed(() => projectFields.value.filter((f) => f.enabled))
    const fieldById = computed(() => new Map(fieldList.value.map((f) => [f.id, f])))

    const createField = async (data) => {
        const field = await createFieldApi(data)
        await refresh()
        return field
    }

    const updateField = async (id, data) => {
        const field = await updateFieldApi(id, data)
        await refresh()
        return field
    }

    const removeField = async (id) => {
        await deleteFieldApi(id)
        await refresh()
    }

    const toggleField = (field, enabled) => updateField(field.id, { enabled })

    // 上移 / 下移：只在同一作用对象内排序，交换后整体提交顺序
    const moveField = async (field, direction) => {
        const list = fieldList.value.filter((f) => f.targetType === field.targetType)
        const index = list.findIndex((f) => f.id === field.id)
        const target = index + direction
        if (index === -1 || target < 0 || target >= list.length) return
        ;[list[index], list[target]] = [list[target], list[index]]
        const updated = await reorderFieldsApi(list.map((f) => f.id))
        applyList(updated)
    }

    return {
        fieldList,
        taskFields,
        enabledTaskFields,
        projectFields,
        enabledProjectFields,
        fieldById,
        initFields,
        refresh,
        createField,
        updateField,
        removeField,
        toggleField,
        moveField
    }
})
