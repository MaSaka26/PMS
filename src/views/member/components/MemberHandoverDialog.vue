<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useMemberStore } from '@/stores/memberStore'
import { useProjectStore } from '@/stores/projectStore'
import { useTaskStore } from '@/stores/taskStore'

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    member: { type: Object, default: null }
})
const emit = defineEmits(['update:modelValue', 'done'])

const memberStore = useMemberStore()
const projectStore = useProjectStore()
const taskStore = useTaskStore()

const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

const loading = ref(false)
const busy = ref(false)
const pmSuccessor = ref('')
const taskSuccessor = ref('')
const errorText = ref('')

// 仍在负责的项目（归档项目不影响停用，所以不列）
const pmProjects = computed(() =>
    projectStore.projectList.filter((p) => p.PM === props.member?.id && p.status !== 'archived')
)

// 名下未完成的任务（已验收 / 已取消不算）
const pendingTasks = computed(() => {
    const out = []
    for (const [projectId, list] of Object.entries(taskStore.taskMap || {})) {
        for (const t of list || []) {
            if (t.deletedAt) continue
            if (t.assignee !== props.member?.id) continue
            if (['accepted', 'canceled'].includes(t.status)) continue
            out.push({ ...t, projectId })
        }
    }
    return out
})

const needsPM = computed(() => pmProjects.value.length > 0)
const needsTask = computed(() => pendingTasks.value.length > 0)

// 接任人只能是启用中的其他人
const candidates = computed(() =>
    memberStore.memberList.filter((m) => m.active !== false && m.id !== props.member?.id)
)

const projectTitle = (id) => projectStore.projectList.find((p) => p.id === id)?.title || id

const reset = () => {
    pmSuccessor.value = ''
    taskSuccessor.value = ''
    errorText.value = ''
}

watch(visible, async (open) => {
    if (!open) return
    reset()
    loading.value = true
    try {
        await Promise.all([
            memberStore.initMembers().catch(() => {}),
            projectStore.initProjects().catch(() => {}),
            taskStore.initAll().catch(() => {})
        ])
    } finally {
        loading.value = false
    }
})

// 接任人可能不在某个项目里，先补进成员名单，否则转派会被「不是该项目成员」拦住
const ensureProjectMember = async (projectId, personId) => {
    const project = projectStore.getById(projectId)
    if (!project) return
    const members = project.members || []
    if (members.includes(personId)) return
    await projectStore.updateProject(projectId, { members: [...members, personId] })
}

const submit = async () => {
    errorText.value = ''
    if (needsPM.value && !pmSuccessor.value) {
        errorText.value = '请先选择接任的项目负责人'
        return
    }
    if (needsTask.value && !taskSuccessor.value) {
        errorText.value = '请先选择任务的接任人'
        return
    }
    const member = props.member
    const reason = `成员「${member?.name}」停用，负责人移交`
    const failed = []
    busy.value = true
    try {
        for (const p of [...pmProjects.value]) {
            try {
                await projectStore.updateProject(p.id, { PM: pmSuccessor.value, pmChangeReason: reason })
            } catch (e) {
                failed.push(`${p.title}：${e.message || '移交失败'}`)
            }
        }
        for (const t of [...pendingTasks.value]) {
            try {
                await ensureProjectMember(t.projectId, taskSuccessor.value)
                await taskStore.updateTask(t.id, { assignee: taskSuccessor.value }, t.projectId)
            } catch (e) {
                failed.push(`${t.title}：${e.message || '转派失败'}`)
            }
        }
    } finally {
        busy.value = false
    }
    if (failed.length) {
        const head = failed.slice(0, 3).join('；')
        errorText.value = `${failed.length} 项没有移交成功：${head}${failed.length > 3 ? ' …' : ''}`
        return
    }
    ElMessage.success('移交完成')
    visible.value = false
    emit('done', member)
}
</script>

<template>
    <el-dialog v-model="visible" title="移交负责人与任务" width="560px">
        <div v-loading="loading" class="handover">
            <el-alert type="info" :closable="false" show-icon>
                停用前需要先把「{{ member?.name }}」手上的事情交出去。
                移交会写入项目动态，之后能查到是谁在什么时候接的。
            </el-alert>

            <section v-if="needsPM" class="block">
                <h4>他负责的项目（{{ pmProjects.length }}）</h4>
                <ul class="item-list">
                    <li v-for="p in pmProjects" :key="p.id">
                        <span class="item-name">{{ p.title }}</span>
                        <span class="item-meta">{{ p.type }}</span>
                    </li>
                </ul>
                <div class="picker">
                    <span class="picker-label">接任负责人</span>
                    <el-select v-model="pmSuccessor" placeholder="选择成员" size="small" style="width: 220px">
                        <el-option v-for="m in candidates" :key="m.id" :label="m.name + '（' + (m.position || m.role) + '）'"
                            :value="m.id" />
                    </el-select>
                </div>
            </section>

            <section v-if="needsTask" class="block">
                <h4>他名下未完成的任务（{{ pendingTasks.length }}）</h4>
                <ul class="item-list">
                    <li v-for="t in pendingTasks.slice(0, 6)" :key="t.id">
                        <span class="item-name">{{ t.title }}</span>
                        <span class="item-meta">{{ projectTitle(t.projectId) }}</span>
                    </li>
                    <li v-if="pendingTasks.length > 6" class="more">
                        还有 {{ pendingTasks.length - 6 }} 条 …
                    </li>
                </ul>
                <div class="picker">
                    <span class="picker-label">任务接任人</span>
                    <el-select v-model="taskSuccessor" placeholder="选择成员" size="small" style="width: 220px">
                        <el-option v-for="m in candidates" :key="m.id" :label="m.name + '（' + (m.position || m.role) + '）'"
                            :value="m.id" />
                    </el-select>
                </div>
            </section>

            <p v-if="errorText" class="err">{{ errorText }}</p>
        </div>

        <template #footer>
            <el-button @click="visible = false">取消</el-button>
            <el-button type="primary" :loading="busy" @click="submit">移交并停用</el-button>
        </template>
    </el-dialog>
</template>

<style scoped lang="scss">
.handover {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.block {
    h4 {
        margin: 0 0 8px;
        font-size: 13px;
        font-weight: 600;
        color: #1f2430;
    }
}

.item-list {
    margin: 0 0 10px;
    padding: 10px 12px;
    list-style: none;
    background: #f8fafc;
    border: 1px solid #eceff4;
    border-radius: 10px;

    li {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        font-size: 13px;
        line-height: 1.9;
    }

    .item-name {
        color: #1f2430;
    }

    .item-meta {
        flex-shrink: 0;
        font-size: 12px;
        color: #9ca3af;
    }

    .more {
        color: #9ca3af;
        font-size: 12px;
    }
}

.picker {
    display: flex;
    align-items: center;
    gap: 10px;

    .picker-label {
        font-size: 13px;
        color: #6b7280;
    }
}

.err {
    margin: 0;
    font-size: 12px;
    color: #be123c;
}
</style>
