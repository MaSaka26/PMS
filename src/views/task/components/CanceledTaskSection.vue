<script setup>
import { computed } from 'vue'
import TaskCard from './TaskCard.vue'

const props = defineProps({
    tasks: { type: Array, default: () => [] },
    open: { type: Boolean, default: false },
    canReview: { type: Boolean, default: false },
    canEditTask: { type: Function, required: true },
    canDeleteTask: { type: Function, required: true },
    depsInfoOf: { type: Function, required: true },
    highlightId: { type: String, default: '' }
})
const emit = defineEmits(['update:open', 'open-task', 'edit', 'delete', 'restore'])

const opened = computed({
    get: () => props.open,
    set: (value) => emit('update:open', value)
})
</script>

<template>
    <section class="canceled-section" :class="{ open: opened }">
        <button type="button" class="canceled-head" @click="opened = !opened">
            <span class="canceled-title">
                已取消
                <span class="canceled-count">{{ tasks.length }}</span>
            </span>
            <span class="canceled-toggle">{{ opened ? '收起' : '展开' }}</span>
        </button>
        <div v-if="opened" class="canceled-body">
            <TaskCard v-for="t in tasks" :key="t.id" :task="t" :can-claim="false" :can-review="canReview"
                :can-block="false" :can-cancel="false" :can-edit="canEditTask(t)"
                :can-delete="canDeleteTask(t)" :deps="depsInfoOf(t)"
                :highlight="highlightId === t.id" @open="$emit('open-task', $event)"
                @edit="$emit('edit', $event)" @delete="$emit('delete', $event)"
                @restore="$emit('restore', $event)" />
        </div>
    </section>
</template>

<style scoped lang="scss">
// 已取消：默认折叠，点开才展开
.canceled-section {
    margin-top: 16px;
    background: #f7f8fa;
    border: 1px dashed #dfe3ea;
    border-radius: 12px;
    overflow: hidden;

    .canceled-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 10px 16px;
        font-family: inherit;
        background: transparent;
        border: none;
        cursor: pointer;
        transition: background 0.15s ease;

        &:hover {
            background: #f0f2f5;
        }
    }

    .canceled-title {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 600;
        color: #4b5563;
    }

    .canceled-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        font-size: 11px;
        font-weight: 600;
        color: #6b7280;
        background: #e5e7eb;
        border-radius: 999px;
    }

    .canceled-toggle {
        font-size: 12px;
        color: #9ca3af;
    }

    .canceled-body {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        padding: 0 16px 16px;
    }
}

@media (max-width: 1200px) {
    .canceled-section .canceled-body {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 720px) {
    .canceled-section .canceled-body {
        grid-template-columns: 1fr;
    }
}
</style>
