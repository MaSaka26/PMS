<script setup>
import { computed } from 'vue'
import { WarningFilled } from '@element-plus/icons-vue'
import { TASK_STATUS_LABEL } from '@/constants/status'
import DueBadge from '@/components/DueBadge.vue'

const props = defineProps({
    tasks: { type: Array, default: () => [] },
    // 项目成员：[{ id, name }]
    members: { type: Array, default: () => [] },
    status: { type: String, default: 'all' },
    assignee: { type: String, default: 'all' },
    onlyBlocked: { type: Boolean, default: false },
    memberName: { type: Function, required: true }
})
const emit = defineEmits(['update:status', 'update:assignee', 'update:onlyBlocked', 'open-task'])

const statusOptions = [
    { value: 'todo', label: '待办' },
    { value: 'doing', label: '进行中' },
    { value: 'done', label: '待验收' },
    { value: 'accepted', label: '已验收' },
    { value: 'canceled', label: '已取消' }
]

const statusValue = computed({
    get: () => props.status,
    set: (value) => emit('update:status', value)
})
const assigneeValue = computed({
    get: () => props.assignee,
    set: (value) => emit('update:assignee', value)
})
const onlyBlockedValue = computed({
    get: () => props.onlyBlocked,
    set: (value) => emit('update:onlyBlocked', value)
})

const filteredTasks = computed(() => {
    return props.tasks.filter((t) => {
        if (statusValue.value !== 'all' && t.status !== statusValue.value) return false
        if (assigneeValue.value !== 'all') {
            if (assigneeValue.value === 'unassigned') {
                if (t.assignee) return false
            } else if (t.assignee !== assigneeValue.value) {
                return false
            }
        }
        if (onlyBlockedValue.value && !t.blocked) return false
        return true
    })
})
</script>

<template>
    <div>
        <div class="task-toolbar">
            <el-select v-model="statusValue" size="small" style="width: 140px">
                <el-option label="全部状态" value="all" />
                <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
            </el-select>
            <el-select v-model="assigneeValue" size="small" style="width: 160px">
                <el-option label="全部负责人" value="all" />
                <el-option label="待认领" value="unassigned" />
                <el-option v-for="m in members" :key="m.id" :label="m.name" :value="m.id" />
            </el-select>
            <el-checkbox v-model="onlyBlockedValue" size="small">仅看阻塞</el-checkbox>
            <span class="toolbar-count">共 {{ filteredTasks.length }} 条</span>
        </div>

        <el-table :data="filteredTasks" stripe style="width: 100%" empty-text="暂无任务" row-class-name="task-row"
            @row-click="emit('open-task', $event)">
            <el-table-column label="任务" min-width="240">
                <template #default="{ row }">
                    <div class="task-title-cell">
                        <span class="task-name">{{ row.title }}</span>
                        <span v-if="row.blocked" class="blocked-tag">
                            <el-icon><WarningFilled /></el-icon>阻塞
                        </span>
                    </div>
                </template>
            </el-table-column>
            <el-table-column label="负责人" width="120">
                <template #default="{ row }">
                    <span v-if="row.assignee">{{ memberName(row.assignee) }}</span>
                    <span v-else class="muted">待认领</span>
                </template>
            </el-table-column>
            <el-table-column label="状态" width="110">
                <template #default="{ row }">
                    <span class="status-text" :class="`st-${row.status}`">
                        {{ TASK_STATUS_LABEL[row.status] || row.status }}
                    </span>
                </template>
            </el-table-column>
            <el-table-column label="优先级" width="90">
                <template #default="{ row }">{{ row.priority || '—' }}</template>
            </el-table-column>
            <el-table-column label="截止日期" width="150">
                <template #default="{ row }">
                    <span v-if="row.dueDate" class="due-cell">
                        {{ row.dueDate }}
                        <DueBadge :due-date="row.dueDate" :status="row.status" />
                    </span>
                    <span v-else class="muted">—</span>
                </template>
            </el-table-column>
        </el-table>
    </div>
</template>

<style scoped lang="scss">
.task-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    flex-wrap: wrap;

    .toolbar-count {
        font-size: 12px;
        color: #9ca3af;
    }
}

:deep(.task-row) {
    cursor: pointer;
}

.task-title-cell {
    display: flex;
    align-items: center;
    gap: 8px;

    .task-name {
        font-weight: 500;
        color: #1f2430;
    }

    .blocked-tag {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 1px 7px;
        font-size: 11px;
        color: #be123c;
        background: #fff1f2;
        border-radius: 999px;
    }
}

.status-text {
    font-size: 12px;

    &.st-todo { color: #909399; }
    &.st-doing { color: #409eff; }
    &.st-done { color: #e6a23c; }
    &.st-accepted { color: #67c23a; }
    &.st-canceled { color: #9ca3af; }
}

.due-cell {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.muted {
    color: #9ca3af;
    font-style: italic;
}
</style>
