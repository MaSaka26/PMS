<script setup>
import { computed } from 'vue'
import { getEventMeta } from '@/constants/event'
import { PROJECT_STATUS_LABEL } from '@/constants/status'

const props = defineProps({
    // 原始动态列表（已按时间倒序）
    activities: { type: Array, default: () => [] },
    // compact：概览里的最近动态；否则是完整动态页
    compact: { type: Boolean, default: false },
    total: { type: Number, default: 0 },
    size: { type: Number, default: 30 },
    page: { type: Number, default: 1 },
    loading: { type: Boolean, default: false },
    includeEdited: { type: Boolean, default: false },
    memberName: { type: Function, required: true }
})
const emit = defineEmits(['open', 'update:page', 'update:includeEdited'])

const pad = (n) => String(n).padStart(2, '0')
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const timeText = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

const dayLabel = (d) => {
    const now = new Date()
    const yesterday = new Date()
    yesterday.setDate(now.getDate() - 1)
    if (dateKey(d) === dateKey(now)) return '今天'
    if (dateKey(d) === dateKey(yesterday)) return '昨天'
    return dateKey(d)
}

const itemText = (ev) => {
    const meta = getEventMeta(ev.type)
    if (ev.type === 'project_status' && ev.from && ev.to) {
        return `项目阶段：${PROJECT_STATUS_LABEL[ev.from] || ev.from} → ${PROJECT_STATUS_LABEL[ev.to] || ev.to}`
    }
    if (ev.type === 'edited' && Array.isArray(ev.changes) && ev.changes.length) {
        return ev.changes
            .map((c) => (c.textOnly ? `修改了${c.label}` : `修改${c.label}`))
            .join('、')
    }
    return meta.label
}

const initial = (id) => (props.memberName(id) || '?').trim().charAt(0).toUpperCase()

// 概览：只展示最近 5 条
const miniItems = computed(() => props.activities.slice(0, 5))

// 完整动态：按天分组
const activityGroups = computed(() => {
    const groups = []
    let current = null
    for (const ev of props.activities) {
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
            text: itemText(ev)
        })
    }
    return groups
})

const pageValue = computed({
    get: () => props.page,
    set: (value) => emit('update:page', value)
})

const includeEditedValue = computed({
    get: () => props.includeEdited,
    set: (value) => emit('update:includeEdited', value)
})
</script>

<template>
    <!-- 概览：最近动态（紧凑） -->
    <div v-if="compact" class="activity-mini">
        <div v-for="ev in miniItems" :key="ev.id" class="mini-item"
            :class="`tone-${getEventMeta(ev.type).tone}`" @click="emit('open', ev)">
            <span class="mini-dot"></span>
            <span class="mini-actor">{{ memberName(ev.by) }}</span>
            <span class="mini-text">{{ itemText(ev) }}</span>
            <span v-if="ev.taskTitle" class="mini-task">「{{ ev.taskTitle }}」</span>
            <span class="mini-time">{{ new Date(ev.at).toLocaleString() }}</span>
        </div>
    </div>

    <!-- 完整动态 -->
    <div v-else class="activity-wrap">
        <div class="activity-toolbar">
            <el-checkbox v-model="includeEditedValue" size="small">显示编辑记录</el-checkbox>
            <span class="toolbar-tip">默认只显示状态流转类事件，编辑类默认折叠</span>
        </div>

        <div v-loading="loading" class="activity-list">
            <template v-if="activityGroups.length">
                <div v-for="group in activityGroups" :key="group.key" class="day-group">
                    <div class="day-label">{{ group.label }}</div>
                    <div v-for="ev in group.items" :key="ev.id" class="activity-item"
                        :class="`tone-${ev.meta.tone}`" @click="emit('open', ev)">
                        <span class="activity-dot" aria-hidden="true"></span>
                        <div class="activity-main">
                            <div class="activity-head">
                                <span class="actor">
                                    <span class="mini-avatar">{{ initial(ev.by) }}</span>
                                    {{ memberName(ev.by) }}
                                </span>
                                <span class="activity-time">{{ ev.time }}</span>
                            </div>
                            <p class="activity-text">
                                {{ ev.text }}
                                <span v-if="ev.taskTitle" class="task-chip">「{{ ev.taskTitle }}」</span>
                            </p>
                            <p v-if="ev.reason" class="activity-reason">原因：{{ ev.reason }}</p>
                        </div>
                    </div>
                </div>
                <div v-if="total > size" class="activity-pagination">
                    <el-pagination background layout="prev, pager, next" :total="total" :page-size="size"
                        :current-page="pageValue" @current-change="pageValue = $event" />
                </div>
            </template>
            <el-empty v-else description="暂无动态" :image-size="80" />
        </div>
    </div>
</template>

<style scoped lang="scss">
// 紧凑模式：概览里的最近动态
.activity-mini {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 300px;
    overflow-y: auto;
    padding-right: 4px;
}

.mini-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #4b5563;
    flex-wrap: wrap;
    cursor: pointer;

    &:hover .mini-text {
        color: #1f2430;
    }

    .mini-dot {
        width: 7px;
        height: 7px;
        flex-shrink: 0;
        background: #94a3b8;
        border-radius: 50%;
    }

    &.tone-primary .mini-dot { background: #409eff; }
    &.tone-success .mini-dot { background: #67c23a; }
    &.tone-warning .mini-dot { background: #e6a23c; }
    &.tone-danger .mini-dot { background: #f43f5e; }

    .mini-actor {
        font-weight: 600;
        color: #1f2430;
    }

    .mini-task {
        color: #409eff;
    }

    .mini-time {
        margin-left: auto;
        font-size: 11px;
        color: #9ca3af;
    }
}

.mini-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 600;
    color: #fff;
    background: linear-gradient(135deg, #60a5fa, #3b82f6);
    border-radius: 50%;

    &.empty {
        color: #9ca3af;
        background: #eef1f5;
    }
}

// 完整模式
.activity-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    flex-wrap: wrap;

    .toolbar-tip {
        font-size: 12px;
        color: #9ca3af;
    }
}

.activity-list {
    min-height: 160px;
}

.day-group + .day-group {
    margin-top: 16px;
}

.day-label {
    margin-bottom: 10px;
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
}

.activity-item {
    --c: #94a3b8;

    position: relative;
    display: flex;
    gap: 10px;
    padding-bottom: 14px;
    cursor: pointer;

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

    .activity-dot {
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

    .activity-main {
        flex: 1;
        min-width: 0;
    }

    .activity-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 3px;
    }

    .actor {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 600;
        color: #1f2430;
    }

    .activity-time {
        font-size: 11px;
        color: #9ca3af;
        font-variant-numeric: tabular-nums;
    }

    .activity-text {
        margin: 0;
        font-size: 12px;
        line-height: 1.6;
        color: #4b5563;

        .task-chip {
            color: #409eff;
        }
    }

    .activity-reason {
        margin: 6px 0 0;
        padding: 6px 10px;
        font-size: 12px;
        line-height: 1.6;
        color: #92400e;
        background: #fffbeb;
        border-radius: 6px;
    }
}

.activity-pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
}
</style>
