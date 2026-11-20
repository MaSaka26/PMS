<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useTemplateStore } from '@/stores/templateStore'
import { useUserStore } from '@/stores/userStore'
import { canManageTemplates } from '@/utils/permissions'
import TemplateFormDialog from './TemplateFormDialog.vue'
import ApplyTemplateDialog from './ApplyTemplateDialog.vue'

const props = defineProps({
    modelValue: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'applied'])

const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

const templateStore = useTemplateStore()
const userStore = useUserStore()

const canManage = computed(() => canManageTemplates(userStore.userInfo))

const loading = ref(false)
const keyword = ref('')

const templates = computed(() => {
    const kw = keyword.value.trim()
    return templateStore.templateList.filter((t) => !kw || t.name.includes(kw))
})

const load = async () => {
    loading.value = true
    try {
        await templateStore.initTemplates(true)
    } catch (error) {
        ElMessage.error(error.message || '模板加载失败')
    } finally {
        loading.value = false
    }
}

watch(
    () => props.modelValue,
    (open) => {
        if (!open) return
        userStore.restoreUserInfo()
        load()
    }
)

// ——— 编辑 / 新增模板 ———
const formVisible = ref(false)
const editingTemplate = ref(null)

const ensureManage = () => {
    if (canManage.value) return true
    ElMessage.warning('只有管理员或项目经理可以维护模板')
    return false
}

const openCreate = () => {
    if (!ensureManage()) return
    editingTemplate.value = null
    formVisible.value = true
}

const openEdit = (template) => {
    if (!ensureManage()) return
    editingTemplate.value = template
    formVisible.value = true
}

const submitTemplate = async (payload) => {
    try {
        if (editingTemplate.value) {
            await templateStore.updateTemplate(editingTemplate.value.id, payload)
            ElMessage.success('模板已更新')
        } else {
            await templateStore.createTemplate(payload)
            ElMessage.success('模板已创建')
        }
        formVisible.value = false
        editingTemplate.value = null
        // 重新拉一次，确保选择列表里是最新配置
        await load()
    } catch (error) {
        ElMessage.error(error.message || '保存失败')
    }
}

// ——— 使用模板 ———
const applyVisible = ref(false)
const applyTarget = ref(null)

const openApply = (template) => {
    if (!canManage.value) {
        ElMessage.warning('只有管理员或项目经理可以使用模板创建项目')
        return
    }
    if (!template.enabled) {
        ElMessage.warning('模板已停用，请先编辑模板并启用')
        return
    }
    applyTarget.value = template
    applyVisible.value = true
}

const submitApply = async (payload) => {
    if (!applyTarget.value) return
    try {
        const project = await templateStore.applyTemplate(applyTarget.value.id, payload)
        applyVisible.value = false
        applyTarget.value = null
        visible.value = false
        emit('applied', project)
    } catch (error) {
        ElMessage.error(error.message || '创建项目失败')
    }
}
</script>

<template>
    <el-dialog title="从模板创建项目" v-model="visible" width="640px">
        <div class="picker-toolbar">
            <el-input v-model="keyword" placeholder="搜索模板名称" clearable style="width: 220px" size="small" />
            <el-button v-if="canManage" size="small" type="primary" :icon="Plus" @click="openCreate">新增模板</el-button>
        </div>

        <div v-loading="loading" class="picker-list">
            <div v-for="t in templates" :key="t.id" class="tpl-item" :class="{ disabled: !t.enabled }">
                <div class="tpl-main">
                    <div class="tpl-title-row">
                        <span class="tpl-title">{{ t.name }}</span>
                        <el-tag v-if="!t.enabled" size="small" type="info">已停用</el-tag>
                    </div>
                    <p class="tpl-meta">
                        {{ t.projectType || '通用' }} · {{ (t.tasks || []).length }} 个任务 ·
                        {{ (t.fieldIds || []).length }} 个项目字段
                    </p>
                    <p v-if="t.description" class="tpl-desc">{{ t.description }}</p>
                </div>
                <div v-if="canManage" class="tpl-actions">
                    <el-button type="primary" size="small" :disabled="!t.enabled" @click="openApply(t)">
                        使用
                    </el-button>
                    <el-button size="small" @click="openEdit(t)">编辑</el-button>
                </div>
                <span v-else class="readonly-tag">只读</span>
            </div>

            <el-empty v-if="!loading && !templates.length"
                :description="keyword ? '没有匹配的模板' : '还没有模板，先创建一个大促或官网改版模板'" :image-size="80" />
        </div>

        <template #footer>
            <el-button @click="visible = false">关闭</el-button>
        </template>

        <!-- 编辑模板：保存后回到选择列表，可继续使用 -->
        <TemplateFormDialog v-model="formVisible" :template="editingTemplate" @submit="submitTemplate" />
        <!-- 使用模板：创建成功后关闭整个选择弹窗 -->
        <ApplyTemplateDialog v-model="applyVisible" :template="applyTarget" @submit="submitApply" />
    </el-dialog>
</template>

<style scoped lang="scss">
.picker-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
}

.picker-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 120px;
    max-height: 52vh;
    overflow-y: auto;
}

.tpl-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 12px 14px;
    background: #f8fafc;
    border: 1px solid #eef2f7;
    border-radius: 10px;

    &.disabled {
        opacity: 0.72;
    }

    .tpl-main {
        min-width: 0;
    }

    .tpl-title-row {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .tpl-title {
        font-size: 13px;
        font-weight: 600;
        color: #1f2430;
    }

    .tpl-meta {
        margin: 4px 0 0;
        font-size: 11px;
        color: #9ca3af;
    }

    .tpl-desc {
        margin: 4px 0 0;
        font-size: 11px;
        color: #6b7280;
        line-height: 1.5;
    }

    .tpl-actions {
        display: flex;
        gap: 6px;
        flex-shrink: 0;
    }

    .readonly-tag {
        flex-shrink: 0;
        font-size: 12px;
        color: #9ca3af;
    }
}
</style>
