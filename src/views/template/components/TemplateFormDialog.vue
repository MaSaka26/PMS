<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useFieldStore } from '@/stores/fieldStore'
import { PRIORITY_ORDER } from '@/constants/status'
import TemplateTaskEditor from './TemplateTaskEditor.vue'

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    // null 表示新增，传模板对象表示编辑
    template: { type: Object, default: null }
})
const emit = defineEmits(['update:modelValue', 'submit'])

const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

// 有 id = 编辑已有模板；无 id 但传了对象 = 从项目另存为模板的草稿
const isDraft = computed(() => !!props.template && !props.template.id)
const dialogTitle = computed(() => {
    if (isDraft.value) return '另存为模板'
    return props.template ? '编辑模板' : '新增模板'
})

const fieldStore = useFieldStore()
const formRef = ref(null)

const emptyForm = () => ({
    name: '',
    projectType: '',
    priority: '中',
    description: '',
    fieldIds: [],
    enabled: true,
    tasks: []
})
const form = ref(emptyForm())

const fillForm = (template) => {
    if (!template) {
        form.value = emptyForm()
        return
    }
    form.value = {
        name: template.name || '',
        projectType: template.projectType || '',
        priority: template.priority || '中',
        description: template.description || '',
        fieldIds: [...(template.fieldIds || [])],
        enabled: template.enabled !== false,
        tasks: (template.tasks || []).map((t) => ({
            key: t.key,
            title: t.title || '',
            description: t.description || '',
            priority: t.priority || '中',
            startOffset: t.startOffset ?? 0,
            duration: t.duration ?? 1,
            dependsOn: [...(t.dependsOn || [])]
        }))
    }
}

watch(
    () => [props.modelValue, props.template],
    ([open]) => {
        if (!open) return
        fillForm(props.template)
        fieldStore.initFields().catch(() => {})
        nextTick(() => formRef.value?.clearValidate())
    }
)

const rules = {
    name: [{ required: true, message: '请输入模板名称', trigger: 'blur' }]
}

const handleCancel = () => {
    visible.value = false
}

const handleConfirm = async () => {
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return

    const tasks = form.value.tasks
    if (!tasks.length) {
        ElMessage.warning('至少添加一个任务')
        return
    }
    if (tasks.some((t) => !String(t.title || '').trim())) {
        ElMessage.warning('任务标题不能为空')
        return
    }

    emit('submit', {
        name: form.value.name.trim(),
        projectType: form.value.projectType.trim(),
        priority: form.value.priority,
        description: form.value.description.trim(),
        fieldIds: [...form.value.fieldIds],
        enabled: form.value.enabled,
        tasks: tasks.map((t) => ({
            key: t.key,
            title: t.title.trim(),
            description: String(t.description || '').trim(),
            priority: t.priority,
            startOffset: Number(t.startOffset) || 0,
            duration: Math.max(1, Number(t.duration) || 1),
            dependsOn: [...(t.dependsOn || [])]
        }))
    })
}
</script>

<template>
    <el-dialog :title="dialogTitle" v-model="visible" width="760px">
        <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" class="template-form">
            <el-form-item label="模板名称" prop="name">
                <el-input v-model="form.name" placeholder="例如：大促项目模板" maxlength="30" show-word-limit />
            </el-form-item>
            <el-form-item label="默认类型">
                <el-input v-model="form.projectType" placeholder="例如：活动运营（选填）" maxlength="20" />
            </el-form-item>
            <el-form-item label="默认优先级">
                <el-radio-group v-model="form.priority">
                    <el-radio-button v-for="p in PRIORITY_ORDER" :key="p" :value="p">{{ p }}</el-radio-button>
                </el-radio-group>
            </el-form-item>
            <el-form-item label="模板说明">
                <el-input v-model="form.description" type="textarea" :rows="2" maxlength="100" show-word-limit
                    placeholder="选填：这个模板适合什么项目" />
            </el-form-item>
            <el-form-item label="启用">
                <el-switch v-model="form.enabled" active-text="启用" inactive-text="停用" />
            </el-form-item>

            <el-form-item label="项目字段">
                <div class="field-picker">
                    <el-checkbox-group v-if="fieldStore.enabledProjectFields.length" v-model="form.fieldIds">
                        <el-checkbox v-for="f in fieldStore.enabledProjectFields" :key="f.id" :value="f.id">
                            {{ f.label }}
                        </el-checkbox>
                    </el-checkbox-group>
                    <span v-else class="empty-tip">还没有启用的项目字段，可先到「字段配置」添加</span>
                    <p class="field-tip">勾选的字段会限定模板生成的项目表单展示范围</p>
                </div>
            </el-form-item>

            <el-divider content-position="left">任务清单</el-divider>
            <TemplateTaskEditor v-model="form.tasks" />
        </el-form>

        <template #footer>
            <el-button @click="handleCancel">取消</el-button>
            <el-button type="primary" @click="handleConfirm">确定</el-button>
        </template>
    </el-dialog>
</template>

<style scoped lang="scss">
.template-form {
    max-height: 62vh;
    padding-right: 8px;
    overflow-y: auto;
}

.field-picker {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;

    .empty-tip {
        font-size: 12px;
        color: #9ca3af;
    }

    .field-tip {
        margin: 0;
        font-size: 11px;
        color: #9ca3af;
    }
}
</style>
