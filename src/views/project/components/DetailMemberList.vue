<script setup>
defineProps({
    // [{ id, name, initial, isPM, count }]
    members: { type: Array, default: () => [] }
})
</script>

<template>
    <div class="member-grid">
        <div v-for="m in members" :key="m.id" class="member-card">
            <span class="member-avatar">{{ m.initial }}</span>
            <div class="member-info">
                <span class="member-name">{{ m.name }}</span>
                <span class="member-role" :class="{ pm: m.isPM }">
                    {{ m.isPM ? '项目负责人' : '成员' }}
                </span>
            </div>
            <span class="member-count">{{ m.count }} 个任务</span>
        </div>
    </div>
</template>

<style scoped lang="scss">
.member-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
}

.member-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    background: #fff;
    border: 1px solid #e8eaef;
    border-radius: 12px;

    .member-avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        flex-shrink: 0;
        font-size: 14px;
        font-weight: 600;
        color: #fff;
        background: linear-gradient(135deg, #60a5fa, #3b82f6);
        border-radius: 50%;
    }

    .member-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }

    .member-name {
        font-size: 13px;
        font-weight: 600;
        color: #1f2430;
    }

    .member-role {
        font-size: 11px;
        color: #9ca3af;

        &.pm {
            color: #409eff;
        }
    }

    .member-count {
        margin-left: auto;
        font-size: 12px;
        color: #6b7280;
        flex-shrink: 0;
    }
}

@media (max-width: 1200px) {
    .member-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 720px) {
    .member-grid {
        grid-template-columns: 1fr;
    }
}
</style>
