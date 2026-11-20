<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown, ArrowUp, Plus } from '@element-plus/icons-vue'
import { useFieldStore } from '@/stores/fieldStore'
import { useUserStore } from '@/stores/userStore'
import { canManageFields } from '@/utils/permissions'

const TYPE_LABEL = {
    text: '单行文本',
    textarea: '多行文本',
    number: '数字',
    date: '日期',
    select: '单选'
}
const TYPE_OPTIONS = Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))

const TARGET_LABEL = { task: '任务字段', project: '项目字段' }

const fieldStore = useFieldStore()
const userStore = useUserStore()

const canManage = computed(() => canManageFields(userStore.userInfo))

const loading = ref(false)
const keyword = ref('')
const activeTarget = ref('task')

const currentFields = computed(() =>
    activeTarget.value === 'task' ? fieldStore.taskFields : fieldStore.projectFields
)

// 按名称过滤（排序沿用 store 里的顺序）
const fields = computed(() => {
    const kw = keyword.value.trim()
    return currentFields.value.filter((f) => !kw || f.label.includes(kw))
})

// 排序按钮的边界按完整列表判断（搜索过滤不影响真实顺序）
const isFirstField = (field) => currentFields.value[0]?.id === field.id
const isLastField = (field) =>
    currentFields.value[currentFields.value.length - 1]?.id === field.id

const emptyText = computed(() => `还没有${TARGET_LABEL[activeTarget.value]}，先新增一个试试`)

const load = async () => {
    loading.value = true
    try {
        await fieldStore.initFields(true)
    } catch (error) {
        ElMessage.error(error.message || '字段加载失败')
    } finally {
        loading.value = false
    }
}

// ——— 新增 / 编辑 ———
const dialogVisible = ref(false)
const editingId = ref('')
const isEdit = computed(() => !!editingId.value)
const dialogTitle = computed(() => (isEdit.value ? '编辑字段' : '新增字段'))

const emptyForm = () => ({
    label: '',
    type: 'text',
    targetType: activeTarget.value,
    required: false,
    options: [],
    description: ''
})
const form = reactive(emptyForm())
const formRef = ref(null)

const rules = {
    label: [{ required: true, message: '请输入字段名称', trigger: 'blur' }],
    type: [{ required: true, message: '请选择字段类型', trigger: 'change' }],
    options: [
        {
            validator: (rule, value, callback) => {
                if (form.type === 'select' && !value.length) {
                    return callback(new Error('请至少添加一个选项'))
                }
                callback()
            },
            trigger: 'change'
        }
    ]
}

const ensureManage = () => {
    if (canManage.value) return true
    ElMessage.warning('只有管理员可以修改字段配置')
    return false
}

const openCreate = () => {
    if (!ensureManage()) return
    editingId.value = ''
    Object.assign(form, emptyForm())
    dialogVisible.value = true
    formRef.value?.clearValidate()
}

const openEdit = (field) => {
    if (!ensureManage()) return
    editingId.value = field.id
    Object.assign(form, {
        label: field.label,
        type: field.type,
        targetType: field.targetType,
        required: !!field.required,
        options: [...(field.options || [])],
        description: field.description || ''
    })
    dialogVisible.value = true
    formRef.value?.clearValidate()
}

const closeDialog = () => {
    dialogVisible.value = false
    editingId.value = ''
}

// 切到非单选时清空选项，避免提交无意义数据
const onTypeChange = (type) => {
    if (type !== 'select') form.options = []
}

const submitForm = async () => {
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return
    try {
        const payload = {
            label: form.label.trim(),
            type: form.type,
            targetType: form.targetType,
            required: form.required,
            options: form.type === 'select' ? form.options : [],
            description: form.description.trim()
        }
        if (isEdit.value) {
            await fieldStore.updateField(editingId.value, payload)
            ElMessage.success('字段已更新')
        } else {
            await fieldStore.createField(payload)
            // 新建后切到对应分组，避免“创建成功但列表里看不到”
            activeTarget.value = payload.targetType
            ElMessage.success('字段已创建')
        }
        closeDialog()
    } catch (error) {
        ElMessage.error(error.message || '保存失败')
    }
}

// ——— 启停 / 排序 / 删除 ———
const toggleField = async (field, enabled) => {
    if (!ensureManage()) return
    try {
        await fieldStore.toggleField(field, enabled)
        ElMessage.success(enabled ? '已启用，任务表单中可见' : '已停用，任务表单中不再显示')
    } catch (error) {
        ElMessage.error(error.message || '状态更新失败')
    }
}

const moveField = async (field, direction) => {
    if (!ensureManage()) return
    try {
        await fieldStore.moveField(field, direction)
    } catch (error) {
        ElMessage.error(error.message || '排序失败')
    }
}

const removeField = async (field) => {
    if (!ensureManage()) return
    try {
        await ElMessageBox.confirm(
            `确定删除${TARGET_LABEL[field.targetType]}「${field.label}」吗？\n\n删除后不再出现在表单里，已填写的内容也不会再展示。\n如果只是暂时不用，建议改为「停用」。`,
            '删除字段',
            { type: 'warning', confirmButtonText: '仍然删除', cancelButtonText: '取消' }
        )
    } catch {
        return
    }
    try {
        await fieldStore.removeField(field.id)
        ElMessage.success('字段已删除')
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
    <div class="field-page">
        <div class="toolbar">
            <div class="toolbar-left">
                <el-radio-group v-model="activeTarget">
                    <el-radio-button value="task">任务字段</el-radio-button>
                    <el-radio-button value="project">项目字段</el-radio-button>
                </el-radio-group>
                <el-input v-model="keyword" placeholder="搜索字段名称" clearable style="width: 220px" />
            </div>
            <el-button v-if="canManage" type="primary" :icon="Plus" @click="openCreate">新增字段</el-button>
        </div>

        <el-alert class="tip" :type="canManage ? 'info' : 'warning'" :closable="false" show-icon
            :title="canManage
                ? '任务字段会出现在任务新建/编辑弹窗；项目字段会出现在项目新增/编辑表单。停用只是隐藏，已填内容仍会保留。'
                : '字段配置仅管理员可修改，当前为只读视图。'" />

        <div class="table-wrap">
            <el-table v-loading="loading" :data="fields" stripe style="width: 100%">
                <el-table-column label="字段名称" min-width="180">
                    <template #default="{ row }">
                        <div class="label-cell">
                            <span class="field-label">{{ row.label }}</span>
                            <span v-if="row.description" class="field-desc">{{ row.description }}</span>
                        </div>
                    </template>
                </el-table-column>
                <el-table-column label="类型" width="110">
                    <template #default="{ row }">
                        <el-tag size="small" effect="plain" :type="row.type === 'select' ? 'warning' : 'info'">
                            {{ TYPE_LABEL[row.type] || row.type }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="必填" width="70">
                    <template #default="{ row }">
                        <span :class="row.required ? 'required-yes' : 'required-no'">
                            {{ row.required ? '是' : '否' }}
                        </span>
                    </template>
                </el-table-column>
                <el-table-column label="选项" min-width="200">
                    <template #default="{ row }">
                        <div v-if="row.type === 'select' && row.options?.length" class="options-cell">
                            <el-tag v-for="opt in row.options.slice(0, 3)" :key="opt" size="small" type="info"
                                effect="plain">
                                {{ opt }}
                            </el-tag>
                            <span v-if="row.options.length > 3" class="options-more">
                                +{{ row.options.length - 3 }}
                            </span>
                        </div>
                        <span v-else class="muted">—</span>
                    </template>
                </el-table-column>
                <el-table-column label="状态" width="100">
                    <template #default="{ row }">
                        <el-switch v-if="canManage" :model-value="row.enabled"
                            @change="toggleField(row, $event)" />
                        <span v-else :class="row.enabled ? 'required-yes' : 'required-no'">
                            {{ row.enabled ? '启用' : '停用' }}
                        </span>
                    </template>
                </el-table-column>
                <el-table-column label="排序" width="90">
                    <template #default="{ row }">
                        <div v-if="canManage" class="sort-cell">
                            <el-button link size="small" :icon="ArrowUp" :disabled="isFirstField(row)"
                                aria-label="上移" @click="moveField(row, -1)" />
                            <el-button link size="small" :icon="ArrowDown" :disabled="isLastField(row)"
                                aria-label="下移" @click="moveField(row, 1)" />
                        </div>
                        <span v-else class="muted">—</span>
                    </template>
                </el-table-column>
                <el-table-column label="操作" width="140" fixed="right">
                    <template #default="{ row }">
                        <template v-if="canManage">
                            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
                            <el-button link type="danger" size="small" @click="removeField(row)">删除</el-button>
                        </template>
                        <span v-else class="muted">只读</span>
                    </template>
                </el-table-column>
                <template #empty>
                    <el-empty :description="emptyText" :image-size="80" />
                </template>
            </el-table>
        </div>

        <el-dialog :title="dialogTitle" v-model="dialogVisible" width="520px" destroy-on-close>
            <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
                <el-form-item label="字段名称" prop="label">
                    <el-input v-model="form.label" placeholder="例如：客户名称、投放渠道" maxlength="20"
                        show-word-limit />
                </el-form-item>
                <el-form-item label="字段类型" prop="type">
                    <el-select v-model="form.type" style="width: 100%" @change="onTypeChange">
                        <el-option v-for="t in TYPE_OPTIONS" :key="t.value" :label="t.label" :value="t.value" />
                    </el-select>
                </el-form-item>
                <el-form-item label="作用对象">
                    <el-radio-group v-if="!isEdit" v-model="form.targetType">
                        <el-radio-button value="task">任务字段</el-radio-button>
                        <el-radio-button value="project">项目字段</el-radio-button>
                    </el-radio-group>
                    <span v-else class="target-fixed">{{ TARGET_LABEL[form.targetType] }}（创建后不可更改）</span>
                </el-form-item>
                <el-form-item v-if="form.type === 'select'" label="选项" prop="options">
                    <el-select v-model="form.options" multiple filterable allow-create default-first-option
                        placeholder="输入选项后按回车添加" style="width: 100%">
                        <el-option v-for="opt in form.options" :key="opt" :label="opt" :value="opt" />
                    </el-select>
                    <p class="field-tip">至少一个选项；任务里会以下拉框展示</p>
                </el-form-item>
                <el-form-item label="是否必填">
                    <el-switch v-model="form.required" active-text="必填" inactive-text="选填" />
                </el-form-item>
                <el-form-item label="字段说明">
                    <el-input v-model="form.description" type="textarea" :rows="2" maxlength="60" show-word-limit
                        placeholder="选填，提示填写的人该怎么填" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="closeDialog">取消</el-button>
                <el-button type="primary" @click="submitForm">确定</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<style scoped lang="scss">
.field-page {
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

    .toolbar-left{
        display: flex;
        align-items: center;
        gap: 8px;
    }
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

.label-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .field-label {
        font-weight: 600;
        color: #1f2430;
    }

    .field-desc {
        font-size: 11px;
        color: #9ca3af;
        line-height: 1.4;
    }
}

.required-yes {
    color: #d97706;
    font-weight: 600;
}

.required-no {
    color: #9ca3af;
}

.options-cell {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;

    .options-more {
        font-size: 11px;
        color: #9ca3af;
    }
}

.sort-cell {
    display: flex;
    align-items: center;
    gap: 2px;
}

.muted {
    color: #9ca3af;
}

.field-tip {
    width: 100%;
    margin: 4px 0 0;
    font-size: 11px;
    color: #9ca3af;
    line-height: 1.5;
}

.target-fixed {
    font-size: 12px;
    color: #6b7280;
}
</style>
