<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getDueLevel } from '@/utils/due'

const props = defineProps({
    dueDate: { type: String, default: '' },
    status: { type: String, default: '' }
})

// 每 60 秒刷新一次“今天”，避免页面开过夜后徽标还停留在昨天
const now = ref(new Date())
let timer = null

const refresh = () => {
    now.value = new Date()
}

const info = computed(() => getDueLevel(props.dueDate, props.status, now.value))

onMounted(() => {
    timer = window.setInterval(refresh, 60 * 1000)
    document.addEventListener('visibilitychange', refresh)
})

onBeforeUnmount(() => {
    if (timer) window.clearInterval(timer)
    document.removeEventListener('visibilitychange', refresh)
})
</script>

<template>
    <span v-if="info" class="due-badge" :class="`is-${info.level}`" :title="info.text" :aria-label="info.text">
        {{ info.char }}
    </span>
</template>

<style scoped lang="scss">
.due-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    color: #fff;
    border-radius: 50%;
    cursor: default;
    user-select: none;

    &.is-safe {
        background: #22c55e;
    }

    &.is-soon {
        background: #f59e0b;
    }

    &.is-urgent {
        background: #ef4444;
    }

    // 逾期：更深 + 外圈，压过“急”
    &.is-overdue {
        background: #b91c1c;
        box-shadow: 0 0 0 2px rgba(185, 28, 28, 0.2);
    }
}
</style>
