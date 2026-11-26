<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useMemberStore } from '@/stores/memberStore'
import { useUserStore } from '@/stores/userStore'
import { ROLE } from '@/constants/user'

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    template: { type: Object, default: null }
})
const emit = defineEmits(['update:modelValue', 'submit'])

const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

const memberStore = useMemberStore()
const userStore = useUserStore()
const formRef = ref(null)

// 项目经理使用模板时，负责人锁定为自己
const pmLockedTo = computed(() =>
    userStore.userInfo?.role === ROLE.PM ? userStore.userInfo.id : ''
)

const pad = (n) => String(n).padStart(2, '0')
const todayStr = () => {
    const d = new Date()
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const addDays = (dateStr, days) => {
    const d = new Date(`${dateStr}T00:00:00`)
    d.setDate(d.getDate() + days)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const form = ref({
    name: '',
    startDate: todayStr(),
    PM: '',
    members: []
})

const rules = {
    name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
    startDate: [{ required: true, message: '请选择项目开始日期', trigger: 'change' }],
    PM: [{ required: true, message: '请选择项目负责人', trigger: 'change' }]
}

watch(
    () => props.modelValue,
    (open) => {
        if (!open) return
        form.value = {
            name: props.template?.name || '',
            startDate: todayStr(),
            PM: pmLockedTo.value,
            members: pmLockedTo.value ? [pmLockedTo.value] : []
        }
        memberStore.initMembers().catch(() => {})
        nextTick(() => formRef.value?.clearValidate())
    }
)

// 负责人自动加入成员
watch(
    () => form.value.PM,
    (pm) => {
        if (pm && !form.value.members.includes(pm)) form.value.members.push(pm)
    }
)

// 预览：按模板任务与开始日期算出实际日期
const previewTasks = computed(() => {
    if (!props.template?.tasks?.length || !form.value.startDate) return []
    return [...props.template.tasks]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((t) => {
            const plannedStart = addDays(form.value.startDate, t.startOffset || 0)
            return {
                ...t,
                plannedStart,
                dueDate: addDays(plannedStart, Math.max(1, t.duration || 1) - 1)
            }
        })
})

const depNames = (task) =>
    (task.dependsOn || [])
        .map((key) => props.template?.tasks?.find((t) => t.key === key)?.title)
        .filter(Boolean)

const handleCancel = () => {
    visible.value = false
}

const handleConfirm = async () => {
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return
    emit('submit', {
        name: form.value.name.trim(),
        startDate: form.value.startDate,
        PM: form.value.PM,
        members: [...new Set([form.value.PM, ...form.value.members])].filter(Boolean)
    })
}
</script>

<template>
    <el-dialog title="使用模板创建项目" v-model="visible" width="600px">
        <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
            <el-form-item label="使用模板">
                <span class="template-name">{{ template?.name }}</span>
                <span v-if="template?.projectType" class="template-meta">· {{ template.projectType }}</span>
                <span class="template-meta">· {{ template?.tasks?.length || 0 }} 个任务</span>
            </el-form-item>
            <el-form-item label="项目名称" prop="name">
                <el-input v-model="form.name" placeholder="请输入项目名称" maxlength="30" show-word-limit />
            </el-form-item>
            <el-form-item label="开始日期" prop="startDate">
                <el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD"
                    placeholder="任务日期会以此为基准" style="width: 220px" />
            </el-form-item>
            <el-form-item label="项目负责人" prop="PM">
                <el-select v-model="form.PM" filterable placeholder="请选择负责人" style="width: 220px"
                    :disabled="!!pmLockedTo">
                    <el-option v-for="m in memberStore.memberList" :key="m.id" :label="m.name" :value="m.id"
                        :disabled="m.active === false" />
                </el-select>
                <p v-if="pmLockedTo" class="pm-tip">项目经理创建的项目，负责人固定为自己</p>
            </el-form-item>
            <el-form-item label="项目成员">
                <el-select v-model="form.members" multiple filterable placeholder="选填，负责人会自动加入"
                    style="width: 320px">
                    <el-option v-for="m in memberStore.memberList" :key="m.id" :label="m.name" :value="m.id"
                        :disabled="m.active === false" />
                </el-select>
            </el-form-item>

            <el-divider content-position="left">将生成的任务</el-divider>
            <div class="preview">
                <div v-for="t in previewTasks" :key="t.key" class="preview-item">
                    <div class="preview-main">
                        <span class="preview-title">{{ t.title }}</span>
                        <span class="preview-date">{{ t.plannedStart }} ~ {{ t.dueDate }}</span>
                    </div>
                    <span v-if="depNames(t).length" class="preview-dep">
                        前置：{{ depNames(t).join('、') }}
                    </span>
                </div>
                <p class="preview-tip">生成的任务默认进入「待办」，由成员认领后开始。</p>
            </div>
        </el-form>

        <template #footer>
            <el-button @click="handleCancel">取消</el-button>
            <el-button type="primary" @click="handleConfirm">创建项目</el-button>
        </template>
    </el-dialog>
</template>

<style scoped lang="scss">
.template-name {
    font-size: 13px;
    font-weight: 600;
    color: #1f2430;
}

.template-meta {
    margin-left: 6px;
    font-size: 12px;
    color: #9ca3af;
}

.pm-tip {
    width: 100%;
    margin: 4px 0 0;
    font-size: 11px;
    color: #9ca3af;
}

.preview {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 220px;
    overflow-y: auto;
}

.preview-item {
    padding: 8px 10px;
    background: #f8fafc;
    border: 1px solid #eef2f7;
    border-radius: 8px;

    .preview-main {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
    }

    .preview-title {
        font-size: 12px;
        font-weight: 600;
        color: #1f2430;
    }

    .preview-date {
        font-size: 11px;
        color: #9ca3af;
        white-space: nowrap;
    }

    .preview-dep {
        display: block;
        margin-top: 4px;
        font-size: 11px;
        color: #d97706;
    }
}

.preview-tip {
    margin: 4px 0 0;
    font-size: 11px;
    color: #9ca3af;
}
</style>
