<script setup>
import MemberCard from './card.vue'

const props = defineProps({
    role: { type: String, required: true },
    label: { type: String, required: true },
    desc: { type: String, default: '' },
    members: { type: Array, default: () => [] },
    canEdit: { type: Function, default: () => false }
})

const emit = defineEmits(['open', 'edit'])
</script>

<template>
    <section class="role-lane" :class="`lane-${role}`">
        <header class="lane-head">
            <span class="lane-dot" aria-hidden="true"></span>
            <h2>{{ label }}</h2>
            <span class="lane-count">{{ members.length }}</span>
            <span class="lane-desc">{{ desc }}</span>
        </header>

        <div class="lane-body">
            <MemberCard v-for="m in members" :key="m.id" :member="m" :can-edit="canEdit(m)"
                @open="emit('open', $event)" @edit="emit('edit', $event)" />
            <p v-if="!members.length" class="lane-empty">暂无成员</p>
        </div>
    </section>
</template>

<style scoped lang="scss">
.role-lane {
    --lane: #409eff;
    --lane-soft: rgba(64, 158, 255, 0.1);

    padding: 16px 18px;
    background: #fff;
    border: 1px solid #e8eaef;
    border-left: 3px solid var(--lane);
    border-radius: 12px;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.03);

    .lane-head {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
    }

    .lane-dot {
        width: 8px;
        height: 8px;
        background: var(--lane);
        border-radius: 50%;
    }

    h2 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        color: #1f2430;
    }

    .lane-count {
        padding: 1px 8px;
        font-size: 11px;
        font-weight: 600;
        color: var(--lane);
        background: var(--lane-soft);
        border-radius: 999px;
    }

    .lane-desc {
        margin-left: auto;
        font-size: 12px;
        color: #9ca3af;
    }

    .lane-body {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 14px;

        // 卡片固定宽度，整行（包括最后一行）都居中
        :deep(.member-card) {
            width: 170px;
            flex: 0 0 170px;
        }
    }

    .lane-empty {
        flex: 1 0 100%;
        margin: 0;
        padding: 18px 0;
        text-align: center;
        font-size: 12px;
        color: #b0b7c3;
    }
}

.lane-admin {
    --lane: #f43f5e;
    --lane-soft: rgba(244, 63, 94, 0.1);
}

.lane-pm {
    --lane: #409eff;
    --lane-soft: rgba(64, 158, 255, 0.1);
}

.lane-member {
    --lane: #37c76e;
    --lane-soft: rgba(55, 199, 110, 0.12);
}

@media (max-width: 640px) {
    .lane-desc {
        display: none;
    }
}
</style>
