<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import * as ElementPlusIcons from '@element-plus/icons-vue'
import { useFieldStore } from '@/stores/fieldStore'
import { useMemberStore } from '@/stores/memberStore'
import { PRIORITY, PRIORITY_ORDER } from '@/constants/status'

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    // null 表示新增，传入项目对象表示编辑
    project: { type: Object, default: null },
    // 项目经理创建/编辑时锁定负责人为自己
    pmLockedTo: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue', 'submit'])

const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

const isEdit = computed(() => !!props.project)
const dialogTitle = computed(() => (isEdit.value ? '编辑项目' : '新增项目'))

const memberStore = useMemberStore()
const fieldStore = useFieldStore()

const formRef = ref(null)

const emptyForm = () => ({
    icon: 'Apple',
    title: '',
    type: '',
    desc: '',
    priority: PRIORITY.MEDIUM,
    PM: '',
    createdAt: '',
    // 项目计划周期（任务计划开始/截止必须落在该区间内）
    startDate: '',
    endDate: '',
    members: [],
    // 项目自定义字段值：{ [fieldId]: value }
    extra: {}
})
const form = ref(emptyForm())

// 未选择创建时间时，默认用今天
const today = () => {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 由模板生成的项目会带 fieldIds：只展示模板勾选的字段；手建项目（无 fieldIds）展示全部
const visibleProjectFields = computed(() => {
    const ids = props.project?.fieldIds
    const all = fieldStore.enabledProjectFields
    if (!Array.isArray(ids)) return all
    return all.filter((f) => ids.includes(f.id))
})

const fillForm = (project) => {
    if (!project) {
        form.value = emptyForm()
        if (props.pmLockedTo) {
            form.value.PM = props.pmLockedTo
            form.value.members = [props.pmLockedTo]
        }
        return
    }
    form.value = {
        icon: project.icon || 'Apple',
        title: project.title || '',
        type: project.type || '',
        desc: project.desc || '',
        priority: project.priority || PRIORITY.MEDIUM,
        PM: project.PM || '',
        createdAt: project.createdAt || '',
        startDate: project.startDate || '',
        endDate: project.endDate || '',
        members: [...(project.members || [])],
        extra: { ...(project.extra || {}) }
    }
    if (props.pmLockedTo) {
        form.value.PM = props.pmLockedTo
        if (!form.value.members.includes(props.pmLockedTo)) {
            form.value.members.push(props.pmLockedTo)
        }
    }
}

watch(
    () => [props.modelValue, props.project],
    ([open]) => {
        if (!open) return
        fillForm(props.project)
        fieldStore.initFields().catch(() => {})
        nextTick(() => formRef.value?.clearValidate())
    }
)

// 选中负责人时，自动把他加进项目成员
watch(
    () => form.value.PM,
    (pm) => {
        if (pm && !form.value.members.includes(pm)) form.value.members.push(pm)
    }
)

// 图标选择器
const iconPickerVisible = ref(false)
const iconKeyword = ref('')
const iconNames = Object.keys(ElementPlusIcons).filter((name) => name !== 'default')
const filteredIcons = computed(() => {
    const kw = iconKeyword.value.trim().toLowerCase()
    return kw
        ? iconNames.filter((name) => name.toLowerCase().includes(kw))
        : iconNames
})

const selectIcon = (name) => {
    form.value.icon = name
    iconPickerVisible.value = false
}

// 下拉、日期、单选都要用 change 触发，blur 不会触发
const rules = {
    title: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
    type: [{ required: true, message: '请输入项目类型', trigger: 'blur' }],
    desc: [{ required: true, message: '请输入项目描述', trigger: 'blur' }],
    priority: [{ required: true, message: '请选择项目优先级', trigger: 'change' }],
    PM: [{ required: true, message: '请选择项目负责人', trigger: 'change' }],
    endDate: [
        {
            validator: (rule, value, callback) => {
                if (value && form.value.startDate && value < form.value.startDate) {
                    return callback(new Error('计划结束不能早于计划开始'))
                }
                callback()
            },
            trigger: 'change'
        }
    ],
    members: [{ type: 'array', required: true, message: '请选择项目成员', trigger: 'change' }]
}

// 计划结束日期不能早于计划开始
const disableProjectEnd = (time) => {
    if (!form.value.startDate) return false
    return time.getTime() < new Date(`${form.value.startDate}T00:00:00`).getTime()
}

// 项目自定义字段：只有“必填”才生成校验规则
const projectFieldRules = (field) => {
    if (!field.required) return []
    return [
        {
            required: true,
            message: `请填写${field.label}`,
            trigger: field.type === 'text' || field.type === 'textarea' ? 'blur' : 'change'
        }
    ]
}

const handleCancel = () => {
    visible.value = false
}

const handleConfirm = async () => {
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return
    emit('submit', {
        ...form.value,
        createdAt: form.value.createdAt || today(),
        // 负责人必须同时是成员，这里再做一次兜底
        members: [...new Set([form.value.PM, ...form.value.members])].filter(Boolean)
    })
}
</script>

<template>
    <el-dialog :title="dialogTitle" v-model="visible" width="640px">
        <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
            <el-form-item label="项目icon" prop="icon">
                <el-popover v-model:visible="iconPickerVisible" placement="bottom-start" :width="380" trigger="click">
                    <template #reference>
                        <el-input :model-value="form.icon" readonly placeholder="请选择项目图标">
                            <template #prefix>
                                <el-icon v-if="form.icon">
                                    <component :is="form.icon" />
                                </el-icon>
                            </template>
                        </el-input>
                    </template>
                    <el-input v-model="iconKeyword" size="small" placeholder="搜索图标名称" clearable />
                    <div class="icon-grid">
                        <div v-for="name in filteredIcons" :key="name" class="icon-cell"
                            :class="{ active: form.icon === name }" :title="name" @click="selectIcon(name)">
                            <el-icon :size="20">
                                <component :is="name" />
                            </el-icon>
                        </div>
                    </div>
                </el-popover>
            </el-form-item>
            <el-form-item label="项目名称" prop="title">
                <el-input v-model="form.title" placeholder="请输入项目名称" />
            </el-form-item>
            <el-form-item label="项目类型" prop="type">
                <el-input v-model="form.type" placeholder="请输入项目类型" />
            </el-form-item>
            <el-form-item label="项目描述" prop="desc">
                <el-input v-model="form.desc" type="textarea" :rows="3" placeholder="请输入项目描述" />
            </el-form-item>
            <el-form-item label="计划周期" prop="startDate">
                <div class="date-range">
                    <el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD"
                        placeholder="计划开始" style="width: 200px" />
                    <span class="range-sep">至</span>
                    <el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD"
                        placeholder="计划结束" :disabled-date="disableProjectEnd" style="width: 200px" />
                </div>
            </el-form-item>
            <el-form-item label="项目优先级" prop="priority">
                <el-radio-group v-model="form.priority">
                    <el-radio-button v-for="level in PRIORITY_ORDER" :key="level" :value="level">
                        {{ level }}
                    </el-radio-button>
                </el-radio-group>
            </el-form-item>
            <el-form-item label="项目负责人" prop="PM">
                <el-select v-model="form.PM" filterable placeholder="请选择项目负责人" style="width: 240px"
                    :disabled="!!pmLockedTo">
                    <el-option v-for="member in memberStore.memberList" :key="member.id" :label="member.name"
                        :value="member.id" :disabled="member.active === false" />
                </el-select>
                <p v-if="pmLockedTo" class="form-tip">项目经理创建的项目，负责人固定为自己</p>
            </el-form-item>
            <el-form-item label="项目创建时间" prop="createdAt">
                <el-date-picker v-model="form.createdAt" type="date" value-format="YYYY-MM-DD"
                    placeholder="不填默认为今天" style="width: 240px" />
            </el-form-item>
            <el-form-item label="项目成员" prop="members">
                <el-select v-model="form.members" multiple filterable placeholder="请选择项目成员" style="width: 320px">
                    <el-option v-for="member in memberStore.memberList" :key="member.id" :label="member.name"
                        :value="member.id" :disabled="member.active === false" />
                </el-select>
            </el-form-item>

            <!-- 项目自定义字段：由「字段配置」页动态生成 -->
            <template v-if="visibleProjectFields.length">
                <el-divider content-position="left">扩展信息</el-divider>
                <el-form-item v-for="f in visibleProjectFields" :key="f.id" :label="f.label"
                    :prop="`extra.${f.id}`" :rules="projectFieldRules(f)">
                    <el-input v-if="f.type === 'text'" v-model="form.extra[f.id]"
                        :placeholder="f.description || '请输入'" />
                    <el-input v-else-if="f.type === 'textarea'" v-model="form.extra[f.id]" type="textarea" :rows="2"
                        :placeholder="f.description || '请输入'" />
                    <el-input-number v-else-if="f.type === 'number'" v-model="form.extra[f.id]" :controls="false"
                        :placeholder="f.description || '请输入数字'" style="width: 240px" />
                    <el-date-picker v-else-if="f.type === 'date'" v-model="form.extra[f.id]" type="date"
                        value-format="YYYY-MM-DD" :placeholder="f.description || '选择日期'" style="width: 240px" />
                    <el-select v-else-if="f.type === 'select'" v-model="form.extra[f.id]" clearable
                        :placeholder="f.description || '请选择'" style="width: 240px">
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
.icon-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 4px;
    max-height: 240px;
    margin-top: 8px;
    overflow-y: auto;
}

.icon-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    color: #606266;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;

    &:hover {
        background: #f5f7fa;
    }

    &.active {
        color: #409eff;
        border-color: #409eff;
    }
}

.form-tip {
    width: 100%;
    margin: 4px 0 0;
    font-size: 11px;
    line-height: 1.5;
    color: #9ca3af;
}

.date-range {
    display: flex;
    align-items: center;
    gap: 8px;

    .range-sep {
        font-size: 12px;
        color: #9ca3af;
    }
}
</style>
