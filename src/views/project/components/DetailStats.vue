<script setup>
import { WarningFilled } from '@element-plus/icons-vue'

defineProps({
    stats: { type: Object, required: true }
})
const emit = defineEmits(['select'])
</script>

<template>
    <section class="stat-grid">
        <div class="stat-card" @click="emit('select', 'all')">
            <span class="stat-label">任务总数</span>
            <span class="stat-value">{{ stats.total }}</span>
        </div>
        <div class="stat-card tone-doing" @click="emit('select', 'doing')">
            <span class="stat-label">进行中</span>
            <span class="stat-value">{{ stats.byStatus.doing }}</span>
        </div>
        <div class="stat-card tone-done" @click="emit('select', 'done')">
            <span class="stat-label">待验收</span>
            <span class="stat-value">{{ stats.byStatus.done }}</span>
        </div>
        <div class="stat-card tone-blocked" :class="{ alert: stats.blocked > 0 }" @click="emit('select', 'all')">
            <span class="stat-label">
                <el-icon><WarningFilled /></el-icon>阻塞
            </span>
            <span class="stat-value">{{ stats.blocked }}</span>
        </div>
        <div class="stat-card tone-overdue" :class="{ alert: stats.overdue > 0 }" @click="emit('select', 'all')">
            <span class="stat-label">逾期</span>
            <span class="stat-value">{{ stats.overdue }}</span>
        </div>
        <div class="stat-card tone-progress">
            <span class="stat-label">完成率</span>
            <span class="stat-value">{{ stats.progress }}%</span>
            <el-progress :percentage="stats.progress" :show-text="false" :stroke-width="4" />
        </div>
    </section>
</template>

<style scoped lang="scss">
.stat-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 12px;
    margin-top: 16px;

    .stat-card {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 14px 16px;
        background: #fff;
        border: 1px solid #e8eaef;
        border-radius: 12px;
        cursor: pointer;
        transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;

        &:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 18px -10px rgba(16, 24, 40, 0.3);
        }

        .stat-label {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            color: #6b7280;
        }

        .stat-value {
            font-size: 22px;
            font-weight: 700;
            color: #1f2430;
            line-height: 1.2;
        }

        &.tone-doing .stat-value { color: #409eff; }
        &.tone-done .stat-value { color: #e6a23c; }
        &.tone-blocked .stat-value { color: #f43f5e; }
        &.tone-overdue .stat-value { color: #b45309; }
        &.tone-progress .stat-value { color: #67c23a; }

        &.alert {
            border-color: #fecdd3;
            background: #fff8f9;
        }

        :deep(.el-progress) {
            margin-top: 2px;
        }
    }
}

@media (max-width: 1200px) {
    .stat-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }
}

@media (max-width: 720px) {
    .stat-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}
</style>
