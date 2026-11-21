<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { PRIORITY_ORDER, TASK_STATUS_LABEL } from '@/constants/status'
import { useFieldStore } from '@/stores/fieldStore'

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    // null 表示新增，任务对象表示编辑
    task: { type: Object, default: null },
    // 当前项目成员
    members: { type: Array, default: () => [] },
    // 当前项目任务，用于「前置任务」下拉
    tasks: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue', 'submit'])

const fieldStore = useFieldStore()
const formRef = ref(null)

const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})
const isEdit = computed(() => !!props.task)
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

const fillForm = (task) => {
    if (!task) {
        form.value = emptyForm()
        return
    }
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
}

watch(
    () => [props.modelValue, props.task],
    ([open]) => {
        if (!open) return
        fillForm(props.task)
        fieldStore.initFields().catch(() => {})
        nextTick(() => formRef.value?.clearValidate())
    }
)

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
const dependencyOptions = computed(() =>
    props.tasks.filter((t) => t.id !== props.task?.id && t.status !== 'canceled')
)

const handleCancel = () => {
    visible.value = false
}

const handleConfirm = async () => {
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
    emit('submit', { ...form.value, status })
}
</script>

<template>
    <el-dialog :title="dialogTitle" v-model="visible" width="520px" destroy-on-close>
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
                    <el-option v-for="m in members" :key="m.id" :label="m.name" :value="m.id"
                        :disabled="m.active === false" />
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
                <el-date-picker v-model="form.createdAt" type="date" value-format="YYYY-MM-DD"
                    placeholder="默认今天，可回溯" :disabled-date="disableFutureDate" :clearable="false"
                    style="width: 100%" @change="onCreatedAtChange" />
            </el-form-item>
            <el-form-item label="计划开始" prop="plannedStart">
                <el-date-picker v-model="form.plannedStart" type="date" value-format="YYYY-MM-DD"
                    placeholder="排期用，可早于创建时间" style="width: 100%" />
            </el-form-item>
            <el-form-item label="截止日期" prop="dueDate">
                <el-date-picker v-model="form.dueDate" type="date" value-format="YYYY-MM-DD"
                    placeholder="不早于创建时间 / 计划开始" :disabled-date="disableDueDate" style="width: 100%" />
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
                        value-format="YYYY-MM-DD" :placeholder="f.description || '选择日期'" style="width: 100%" />
                    <el-select v-else-if="f.type === 'select'" v-model="form.extra[f.id]" clearable
                        :placeholder="f.description || '请选择'" style="width: 100%">
                        <el-option v-for="opt in f.options" :key="opt" :label="opt" :value="opt" />
                    </el-select>
                </el-form-item>
            </template>
        </el-form>
        <template #footer>
            <el-button @click="handleCancel">取消</el-button>
            <el-button type="primary" @click="handleConfirm">确定</el-button>
        </template>
    </el-dialog>
</template>

<style scoped lang="scss">
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

.dep-option-status {
    float: right;
    margin-left: 12px;
    font-size: 11px;
    color: #9ca3af;
}
</style>
