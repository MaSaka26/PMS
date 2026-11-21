<script setup>
import TaskCard from './TaskCard.vue'

defineProps({
    column: { type: Object, required: true },
    tasks: { type: Array, default: () => [] },
    canClaim: { type: Boolean, default: false },
    canReview: { type: Boolean, default: false },
    canAssignTask: { type: Function, required: true },
    canOperateTask: { type: Function, required: true },
    canCancelTask: { type: Function, required: true },
    canEditTask: { type: Function, required: true },
    canDeleteTask: { type: Function, required: true },
    depsInfoOf: { type: Function, required: true }
})
defineEmits([
    'open', 'edit', 'delete', 'claim', 'assign', 'advance',
    'reject', 'reopen', 'restore', 'block', 'unblock', 'cancel'
])
</script>

<template>
    <div class="column" :class="`col-${column.status}`">
        <header class="col-header">
            <span class="col-title">{{ column.label }}</span>
            <span class="col-count">{{ tasks.length }}</span>
        </header>
        <p class="col-hint">{{ column.hint }}</p>
        <div class="col-body">
            <TaskCard v-for="t in tasks" :key="t.id" :task="t" :can-claim="canClaim"
                :can-assign="canAssignTask(t)" :can-submit="canOperateTask(t)" :can-review="canReview"
                :can-block="canOperateTask(t)" :can-cancel="canCancelTask(t)" :can-edit="canEditTask(t)"
                :can-delete="canDeleteTask(t)" :deps="depsInfoOf(t)" @open="$emit('open', $event)"
                @edit="$emit('edit', $event)" @delete="$emit('delete', $event)"
                @claim="$emit('claim', $event)" @assign="$emit('assign', $event)"
                @advance="$emit('advance', $event)" @reject="$emit('reject', $event)"
                @reopen="$emit('reopen', $event)" @restore="$emit('restore', $event)"
                @block="$emit('block', $event)" @unblock="$emit('unblock', $event)"
                @cancel="$emit('cancel', $event)" />
        </div>
    </div>
</template>

<style scoped lang="scss">
.column {
    display: flex;
    flex-direction: column;
    background: #f1f1f1;
    border: 1px solid #cfcfcf;
    border-radius: 14px;
    padding: 14px 12px;
    // 列高锁定在视口内，任务变多时列内滚动，不再撑长整页
    height: calc(100vh - 220px);
    min-height: 380px;
    box-sizing: border-box;
    position: relative;

    .col-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 2px;

        .col-title {
            font-size: 14px;
            font-weight: 600;
            color: #1f2430;
        }

        .col-count {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 20px;
            height: 20px;
            font-size: 11px;
            font-weight: 600;
            color: #fff;
            background: #d1d5db;
            border-radius: 999px;
            padding: 0 6px;
        }
    }

    .col-hint {
        font-size: 11px;
        color: #9ca3af;
        margin: 0 0 12px;
    }

    .col-body {
        display: flex;
        flex-direction: column;
        gap: 10px;
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        padding-right: 4px;
        scrollbar-width: thin;
        scrollbar-color: #d1d5db transparent;

        &::-webkit-scrollbar {
            width: 6px;
        }

        &::-webkit-scrollbar-thumb {
            background: #d1d5db;
            border-radius: 3px;
        }

        &::-webkit-scrollbar-track {
            background: transparent;
        }

        // flex 子项默认会被压缩，卡片必须固定自身高度，溢出才能触发滚动
        > * {
            flex: 0 0 auto;
        }
    }
}

// 各列主题色（通过 count 徽章染色列头部）
.col-todo .col-count { background: #909399; }
.col-doing .col-count { background: #409eff; }
.col-done .col-count { background: #e6a23c; }
.col-accepted .col-count { background: #67c23a; }

@media (max-width: 720px) {
    // 窄屏单列堆叠，列内滚动会很难用，恢复自然高度
    .column {
        height: auto;
        min-height: 0;
    }

    .column .col-body {
        overflow-y: visible;
        padding-right: 0;
    }
}
</style>
