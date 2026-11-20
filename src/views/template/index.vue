<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useTemplateStore } from '@/stores/templateStore'
import { useUserStore } from '@/stores/userStore'
import { canManageTemplates } from '@/utils/permissions'
import TemplateFormDialog from './components/TemplateFormDialog.vue'
import ApplyTemplateDialog from './components/ApplyTemplateDialog.vue'

const router = useRouter()
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

// ——— 新增 / 编辑 ———
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
    } catch (error) {
        ElMessage.error(error.message || '保存失败')
    }
}

// ——— 套用模板 ———
const applyVisible = ref(false)
const applyTarget = ref(null)

const openApply = (template) => {
    if (!canManage.value) {
        ElMessage.warning('只有管理员或项目经理可以使用模板创建项目')
        return
    }
    if (!template.enabled) {
        ElMessage.warning('模板已停用，请先启用')
        return
    }
    applyTarget.value = template
    applyVisible.value = true
}

const submitApply = async (payload) => {
    if (!applyTarget.value) return
    try {
        const project = await templateStore.applyTemplate(applyTarget.value.id, payload)
        ElMessage.success('项目已创建')
        applyVisible.value = false
        applyTarget.value = null
        router.push(`/project/board/${project.id}`)
    } catch (error) {
        ElMessage.error(error.message || '创建项目失败')
    }
}

// ——— 启停 / 删除 ———
const toggleTemplate = async (template, enabled) => {
    if (!ensureManage()) return
    try {
        await templateStore.toggleTemplate(template, enabled)
        ElMessage.success(enabled ? '模板已启用' : '模板已停用，不能再创建项目')
    } catch (error) {
        ElMessage.error(error.message || '状态更新失败')
    }
}

const removeTemplate = async (template) => {
    if (!ensureManage()) return
    try {
        await ElMessageBox.confirm(
            `确定删除模板「${template.name}」吗？\n\n只删除模板本身，已经用它创建的项目和任务不受影响。`,
            '删除模板',
            { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
        )
    } catch {
        return
    }
    try {
        await templateStore.removeTemplate(template.id)
        ElMessage.success('模板已删除')
    } catch (error) {
        ElMessage.error(error.message || '删除失败')
    }
}

onMounted(async () => {
    await userStore.restoreUserInfo()
    load()
})
</script>

<template>
    <div class="template-page">
        <div class="toolbar">
            <el-input v-model="keyword" placeholder="搜索模板名称" clearable style="width: 240px" />
            <el-button v-if="canManage" type="primary" :icon="Plus" @click="openCreate">新增模板</el-button>
        </div>

        <el-alert class="tip" :type="canManage ? 'info' : 'warning'" :closable="false" show-icon
            :title="canManage
                ? '模板用于快速创建同类项目：生成项目时会复制模板里的任务清单和前置关系；之后修改模板不会影响已创建的项目。'
                : '模板由管理员或项目经理维护，当前为只读视图。'" />

        <div class="table-wrap">
            <el-table v-loading="loading" :data="templates" stripe style="width: 100%">
                <el-table-column label="模板名称" min-width="220">
                    <template #default="{ row }">
                        <div class="name-cell">
                            <span class="tpl-name">{{ row.name }}</span>
                            <span v-if="row.description" class="tpl-desc">{{ row.description }}</span>
                        </div>
                    </template>
                </el-table-column>
                <el-table-column label="默认类型" width="130">
                    <template #default="{ row }">
                        <span>{{ row.projectType || '通用' }}</span>
                    </template>
                </el-table-column>
                <el-table-column label="优先级" width="90">
                    <template #default="{ row }">{{ row.priority || '中' }}</template>
                </el-table-column>
                <el-table-column label="项目字段" width="100" align="right">
                    <template #default="{ row }">{{ (row.fieldIds || []).length }} 个</template>
                </el-table-column>
                <el-table-column label="任务" width="90" align="right">
                    <template #default="{ row }">{{ (row.tasks || []).length }} 个</template>
                </el-table-column>
                <el-table-column label="状态" width="90">
                    <template #default="{ row }">
                        <el-switch v-if="canManage" :model-value="row.enabled"
                            @change="toggleTemplate(row, $event)" />
                        <span v-else>{{ row.enabled ? '启用' : '停用' }}</span>
                    </template>
                </el-table-column>
                <el-table-column label="操作" width="200" fixed="right">
                    <template #default="{ row }">
                        <template v-if="canManage">
                            <el-button link type="primary" size="small" :disabled="!row.enabled"
                                @click="openApply(row)">
                                使用模板
                            </el-button>
                            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
                            <el-button link type="danger" size="small" @click="removeTemplate(row)">删除</el-button>
                        </template>
                        <span v-else class="muted">只读</span>
                    </template>
                </el-table-column>
                <template #empty>
                    <el-empty description="还没有项目模板，先创建一个大促或官网改版模板试试" :image-size="80" />
                </template>
            </el-table>
        </div>

        <TemplateFormDialog v-model="formVisible" :template="editingTemplate" @submit="submitTemplate" />
        <ApplyTemplateDialog v-model="applyVisible" :template="applyTarget" @submit="submitApply" />
    </div>
</template>

<style scoped lang="scss">
.template-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 24px;
    min-height: 100%;
}

.toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
}

.tip {
    margin: 0;
}

.table-wrap {
    padding: 4px 16px 16px;
    background: #fff;
    border: 1px solid #eef2f7;
    border-radius: 12px;
}

.muted {
    color: #9ca3af;
    font-size: 12px;
}

.name-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .tpl-name {
        font-weight: 600;
        color: #1f2430;
    }

    .tpl-desc {
        font-size: 11px;
        color: #9ca3af;
        line-height: 1.4;
    }
}
</style>
