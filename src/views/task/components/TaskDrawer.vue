<script setup>
import { computed, ref, watch } from 'vue'
import { useTaskStore } from '@/stores/taskStore'
import { useMemberStore } from '@/stores/memberStore'
import { useFieldStore } from '@/stores/fieldStore'
import { TASK_STATUS_LABEL } from '@/constants/status'
import { getEventMeta } from '@/constants/event'
import { Calendar, Clock, Link, User, WarningFilled } from '@element-plus/icons-vue'
import DueBadge from '@/components/DueBadge.vue'

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    taskId: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const visible = computed({
    get: () => props.modelValue,
    set: (v) => emit('update:modelValue', v)
})

const taskStore = useTaskStore()
const memberStore = useMemberStore()
const fieldStore = useFieldStore()

const loading = ref(false)
const tab = ref('detail')

const detail = computed(() => taskStore.taskDetail)

const memberName = (id) => memberStore.memberName(id)
const initial = (id) => (memberName(id) || '?').trim().charAt(0).toUpperCase()

const statusText = computed(() => TASK_STATUS_LABEL[detail.value?.status] || detail.value?.status || '')

// 依赖任务名与完成情况（依赖详情里只有 id）
const depList = computed(() => {
    const d = detail.value
    if (!d?.dependsOn?.length) return []
    const list = taskStore.taskMap?.[d.projectId] || []
    return d.dependsOn.map((id) => {
        const t = list.find((x) => x.id === id)
        const status = t?.status || ''
        return {
            id,
            title: t?.title || id,
            done: ['done', 'accepted'].includes(status),
            statusText: TASK_STATUS_LABEL[status] || status
        }
    })
})

// 自定义字段：已填写的都展示；停用字段若曾有值也保留展示（标记“已停用”）
const formatExtra = (value) => {
    if (value === undefined || value === null || value === '') return '—'
    if (Array.isArray(value)) return value.length ? value.join('、') : '—'
    return String(value)
}

const extraRows = computed(() => {
    const extra = detail.value?.extra || {}
    return fieldStore.fieldList
        .filter((f) => f.targetType === 'task')
        .filter((f) => extra[f.id] !== undefined && extra[f.id] !== '')
        .map((f) => ({
            id: f.id,
            label: f.label,
            enabled: f.enabled,
            value: formatExtra(extra[f.id])
        }))
})

const statusTone = computed(() => {
    const map = {
        todo: 'is-todo',
        doing: 'is-doing',
        done: 'is-done',
        accepted: 'is-accepted',
        canceled: 'is-canceled'
    }
    return map[detail.value?.status] || 'is-todo'
})

// ——— 时间线：事件按天分组，最新在前 ———
const pad = (n) => String(n).padStart(2, '0')
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const timeText = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

const dayLabel = (d) => {
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)
    const key = dateKey(d)
    if (key === dateKey(today)) return '今天'
    if (key === dateKey(yesterday)) return '昨天'
    return key
}

const fieldValue = (field, value) => {
    if (value === '' || value === undefined || value === null) return '空'
    // 负责人存的是 id，展示成姓名；状态存的是英文枚举，展示成中文
    if (field === 'assignee') return memberName(value)
    return TASK_STATUS_LABEL[value] || value
}

const changeText = (change) => {
    if (change.textOnly) return `修改了${change.label}`
    return `${change.label}：${fieldValue(change.field, change.from)} → ${fieldValue(change.field, change.to)}`
}

const eventText = (ev) => {
    const meta = getEventMeta(ev.type)
    if (ev.type === 'edited' && Array.isArray(ev.changes) && ev.changes.length) {
        return `${meta.label}：${ev.changes.map(changeText).join('；')}`
    }
    if ((ev.type === 'rejected' || ev.type === 'reopened' || ev.type === 'canceled') && ev.from && ev.to) {
        return `${meta.label}（${TASK_STATUS_LABEL[ev.from] || ev.from} → ${TASK_STATUS_LABEL[ev.to] || ev.to}）`
    }
    return meta.label
}

const timelineGroups = computed(() => {
    const events = detail.value?.events || []
    const groups = []
    let current = null
    for (const ev of events) {
        const d = new Date(ev.at)
        if (Number.isNaN(d.getTime())) continue
        const key = dateKey(d)
        if (!current || current.key !== key) {
            current = { key, label: dayLabel(d), items: [] }
            groups.push(current)
        }
        current.items.push({
            ...ev,
            time: timeText(d),
            meta: getEventMeta(ev.type),
            text: eventText(ev)
        })
    }
    // 最新的日期、最新的条目排在最前
    groups.reverse()
    groups.forEach((g) => g.items.reverse())
    return groups
})

const load = async () => {
    if (!props.taskId) return
    loading.value = true
    try {
        await Promise.all([
            taskStore.fetchTaskDetail(props.taskId),
            fieldStore.initFields().catch(() => {})
        ])
    } finally {
        loading.value = false
    }
}

watch(
    () => [props.modelValue, props.taskId],
    ([open, id]) => {
        if (open && id) {
            tab.value = 'detail'
            load()
        }
    }
)
</script>

<template>
    <el-drawer v-model="visible" :size="480" :title="detail?.title || '任务详情'" class="task-drawer">
        <div v-loading="loading" class="drawer-body">
            <el-tabs v-model="tab">
                <!-- 详情 -->
                <el-tab-pane label="详情" name="detail">
                    <template v-if="detail">
                        <div class="status-row">
                            <span class="status-pill" :class="statusTone">
                                <span class="dot" aria-hidden="true"></span>{{ statusText }}
                            </span>
                            <span v-if="detail.blocked" class="blocked-pill">
                                <el-icon><WarningFilled /></el-icon>阻塞中
                            </span>
                        </div>

                        <el-alert v-if="detail.blocked" type="warning" :closable="false" show-icon class="reason-alert"
                            :title="`阻塞原因：${detail.blockedReason || '未填写'}`" />
                        <el-alert v-if="detail.canceledReason" type="error" :closable="false" show-icon
                            class="reason-alert" :title="`取消原因：${detail.canceledReason}`" />
                        <el-alert v-if="detail.reopenReason" type="warning" :closable="false" show-icon
                            class="reason-alert" :title="`重开原因：${detail.reopenReason}`" />

                        <p class="desc">{{ detail.desc || '暂无描述' }}</p>

                        <div class="info-grid">
                            <div class="info-item">
                                <span class="label"><el-icon><User /></el-icon>负责人</span>
                                <span v-if="detail.assignee" class="assignee">
                                    <span class="avatar">{{ initial(detail.assignee) }}</span>
                                    {{ memberName(detail.assignee) }}
                                </span>
                                <span v-else class="muted">待认领</span>
                            </div>
                            <div class="info-item">
                                <span class="label">优先级</span>
                                <span class="value">{{ detail.priority || '—' }}</span>
                            </div>
                            <div class="info-item">
                                <span class="label"><el-icon><Calendar /></el-icon>计划开始</span>
                                <span class="value">{{ detail.plannedStart || '未设置' }}</span>
                            </div>
                            <div class="info-item">
                                <span class="label"><el-icon><Calendar /></el-icon>截止日期</span>
                                <span class="value due-value">
                                    {{ detail.dueDate || '未设置' }}
                                    <DueBadge v-if="detail.dueDate" :due-date="detail.dueDate"
                                        :status="detail.status" />
                                </span>
                            </div>
                            <div v-if="depList.length" class="info-item deps-item">
                                <span class="label"><el-icon><Link /></el-icon>前置任务</span>
                                <span class="value dep-tags">
                                    <span v-for="d in depList" :key="d.id" class="dep-tag"
                                        :class="{ done: d.done }">
                                        {{ d.title }} · {{ d.done ? '已完成' : d.statusText }}
                                    </span>
                                </span>
                            </div>
                            <div class="info-item">
                                <span class="label"><el-icon><Clock /></el-icon>创建时间</span>
                                <span class="value">{{ detail.createdAt || '—' }}（{{ detail.createdBy ? memberName(detail.createdBy) : '未知' }}）</span>
                            </div>
                        </div>

                        <!-- 自定义字段 -->
                        <div v-if="extraRows.length" class="extra-block">
                            <div class="extra-title">扩展信息</div>
                            <div class="extra-list">
                                <div v-for="row in extraRows" :key="row.id" class="extra-item">
                                    <span class="extra-label">
                                        {{ row.label }}
                                        <span v-if="!row.enabled" class="extra-off">已停用</span>
                                    </span>
                                    <span class="extra-value">{{ row.value }}</span>
                                </div>
                            </div>
                        </div>
                    </template>
                    <el-empty v-else description="暂无数据" />
                </el-tab-pane>

                <!-- 时间线 -->
                <el-tab-pane :label="`时间线 (${detail?.events?.length || 0})`" name="timeline">
                    <div v-if="timelineGroups.length" class="timeline">
                        <div v-for="group in timelineGroups" :key="group.key" class="day-group">
                            <div class="day-label">{{ group.label }}</div>
                            <div v-for="ev in group.items" :key="ev.id" class="event" :class="`tone-${ev.meta.tone}`">
                                <span class="event-dot" aria-hidden="true"></span>
                                <div class="event-main">
                                    <div class="event-head">
                                        <span class="event-actor">
                                            <span class="avatar">{{ initial(ev.by) }}</span>
                                            {{ memberName(ev.by) }}
                                        </span>
                                        <span class="event-time">{{ ev.time }}</span>
                                    </div>
                                    <p class="event-text">{{ ev.text }}</p>
                                    <p v-if="ev.reason" class="event-reason">原因：{{ ev.reason }}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <el-empty v-else description="暂无事件记录" />
                </el-tab-pane>
            </el-tabs>
        </div>
    </el-drawer>
</template>

<style scoped lang="scss">
.drawer-body {
    min-height: 240px;
    padding: 0 4px;
}

.status-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
}

.status-pill {
    --c: #909399;

    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 10%, #fff);
    border-radius: 999px;

    .dot {
        width: 6px;
        height: 6px;
        background: var(--c);
        border-radius: 50%;
    }

    &.is-todo { --c: #909399; }
    &.is-doing { --c: #409eff; }
    &.is-done { --c: #e6a23c; }
    &.is-accepted { --c: #67c23a; }
    &.is-canceled { --c: #f56c6c; }
}

.blocked-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 600;
    color: #f43f5e;
    background: rgba(244, 63, 94, 0.08);
    border-radius: 999px;
}

.reason-alert {
    margin-bottom: 10px;
}

.desc {
    margin: 14px 0;
    padding: 12px 14px;
    font-size: 13px;
    line-height: 1.7;
    color: #4b5563;
    background: #f8fafc;
    border-radius: 10px;
    white-space: pre-wrap;
    word-break: break-word;
}

.info-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .info-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        font-size: 13px;
    }

    .label {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        color: #9ca3af;
        flex-shrink: 0;
    }

    .value {
        color: #1f2430;
        text-align: right;
        word-break: break-word;
    }

    .due-value {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }

    .assignee {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #1f2430;
    }

    .muted {
        color: #9ca3af;
        font-style: italic;
    }

    .deps-item {
        align-items: flex-start;

        .label {
            padding-top: 2px;
        }
    }

    .dep-tags {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 6px;
    }

    .dep-tag {
        padding: 2px 8px;
        font-size: 12px;
        color: #b45309;
        background: #fffbeb;
        border: 1px solid #fde68a;
        border-radius: 6px;

        &.done {
            color: #15803d;
            background: #f0fdf4;
            border-color: #bbf7d0;
        }
    }
}

// 自定义字段
.extra-block {
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px dashed #eceff4;

    .extra-title {
        margin-bottom: 10px;
        font-size: 12px;
        font-weight: 600;
        color: #6b7280;
    }

    .extra-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .extra-item {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        font-size: 13px;
    }

    .extra-label {
        flex-shrink: 0;
        color: #9ca3af;
    }

    .extra-off {
        margin-left: 4px;
        padding: 0 4px;
        font-size: 10px;
        color: #9ca3af;
        background: #f3f4f6;
        border-radius: 4px;
    }

    .extra-value {
        color: #1f2430;
        text-align: right;
        white-space: pre-wrap;
        word-break: break-word;
    }
}

.avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    font-size: 11px;
    font-weight: 600;
    color: #fff;
    background: linear-gradient(135deg, #60a5fa, #3b82f6);
    border-radius: 50%;
}

// 时间线
.timeline {
    padding: 4px 2px;
}

.day-group + .day-group {
    margin-top: 18px;
}

.day-label {
    margin-bottom: 10px;
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
}

.event {
    --c: #909399;

    position: relative;
    display: flex;
    gap: 10px;
    padding: 0 0 16px 0;

    // 竖线
    &::before {
        content: '';
        position: absolute;
        left: 4px;
        top: 12px;
        bottom: 0;
        width: 1px;
        background: #eef1f5;
    }

    &:last-child::before {
        display: none;
    }

    &.tone-primary { --c: #409eff; }
    &.tone-success { --c: #67c23a; }
    &.tone-warning { --c: #e6a23c; }
    &.tone-danger { --c: #f43f5e; }
    &.tone-neutral { --c: #94a3b8; }

    .event-dot {
        position: relative;
        z-index: 1;
        width: 9px;
        height: 9px;
        margin-top: 5px;
        flex-shrink: 0;
        background: var(--c);
        border-radius: 50%;
        box-shadow: 0 0 0 3px #fff;
    }

    .event-main {
        flex: 1;
        min-width: 0;
    }

    .event-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 3px;
    }

    .event-actor {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 600;
        color: #1f2430;
    }

    .event-time {
        font-size: 11px;
        color: #9ca3af;
        font-variant-numeric: tabular-nums;
    }

    .event-text {
        margin: 0;
        font-size: 12px;
        line-height: 1.6;
        color: #4b5563;
    }

    .event-reason {
        margin: 6px 0 0;
        padding: 6px 10px;
        font-size: 12px;
        line-height: 1.6;
        color: #92400e;
        background: #fffbeb;
        border-radius: 6px;
    }
}
</style>
