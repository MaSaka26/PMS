<script setup>
import { ref, watch } from 'vue'
import { WarningFilled, Grid, Menu } from '@element-plus/icons-vue'

defineProps({
    stats: { type: Object, required: true }
})
const emit = defineEmits(['select'])

// 布局偏好：一行八列（wide） / 两行四列（compact），记在本地，下次进来还是这个排法
const LAYOUT_KEY = 'pm_stat_layout'
const layout = ref(localStorage.getItem(LAYOUT_KEY) === 'compact' ? 'compact' : 'wide')
watch(layout, (value) => localStorage.setItem(LAYOUT_KEY, value))
const toggleLayout = () => {
    layout.value = layout.value === 'wide' ? 'compact' : 'wide'
}

// 点卡片进入任务 tab，并带上对应筛选；只看成员时切到成员 tab
const goTasks = (patch = {}) => {
    emit('select', {
        tab: 'tasks',
        status: 'all',
        assignee: 'all',
        onlyBlocked: false,
        onlyOverdue: false,
        ...patch
    })
}
const goMembers = () => emit('select', { tab: 'members' })
</script>

<template>
    <section class="stat-section">
        <div class="stat-head">
            <span class="stat-hint">点击卡片查看对应的任务 / 成员</span>
            <el-button size="small" text class="layout-btn" @click="toggleLayout">
                <el-icon>
                    <Menu v-if="layout === 'wide'" />
                    <Grid v-else />
                </el-icon>
                {{ layout === 'wide' ? '两行' : '一行' }}
            </el-button>
        </div>

        <div class="stat-grid" :class="`layout-${layout}`">
            <div class="stat-card" @click="goTasks()">
                <span class="stat-label">任务总数</span>
                <span class="stat-value">{{ stats.total }}</span>
            </div>
            <div class="stat-card tone-doing" @click="goTasks({ status: 'doing' })">
                <span class="stat-label">进行中</span>
                <span class="stat-value">{{ stats.byStatus.doing }}</span>
            </div>
            <div class="stat-card tone-done" @click="goTasks({ status: 'done' })">
                <span class="stat-label">待验收</span>
                <span class="stat-value">{{ stats.byStatus.done }}</span>
            </div>
            <div class="stat-card tone-accepted" @click="goTasks({ status: 'accepted' })">
                <span class="stat-label">已验收</span>
                <span class="stat-value">{{ stats.byStatus.accepted }}</span>
            </div>
            <div class="stat-card tone-blocked" :class="{ alert: stats.blocked > 0 }"
                @click="goTasks({ onlyBlocked: true })">
                <span class="stat-label">
                    <el-icon><WarningFilled /></el-icon>阻塞
                </span>
                <span class="stat-value">{{ stats.blocked }}</span>
            </div>
            <div class="stat-card tone-overdue" :class="{ alert: stats.overdue > 0 }"
                @click="goTasks({ onlyOverdue: true })">
                <span class="stat-label">逾期</span>
                <span class="stat-value">{{ stats.overdue }}</span>
            </div>
            <div class="stat-card tone-members" @click="goMembers()">
                <span class="stat-label">成员数</span>
                <span class="stat-value">{{ stats.members }}</span>
            </div>
            <div class="stat-card tone-progress is-static">
                <span class="stat-label">完成率</span>
                <span class="stat-value">{{ stats.progress }}%</span>
                <el-progress :percentage="stats.progress" :show-text="false" :stroke-width="4" />
            </div>
        </div>
    </section>
</template>

<style scoped lang="scss">
.stat-section {
    margin-top: 16px;
}

.stat-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;

    .stat-hint {
        font-size: 12px;
        color: #9ca3af;
    }

    .layout-btn {
        color: #6b7280;

        &:hover {
            color: #409eff;
        }
    }
}

.stat-grid {
    display: grid;
    gap: 12px;

    &.layout-wide {
        grid-template-columns: repeat(8, minmax(0, 1fr));
    }

    &.layout-compact {
        grid-template-columns: repeat(4, minmax(0, 1fr));
    }

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

        &.is-static {
            cursor: default;

            &:hover {
                transform: none;
                box-shadow: none;
            }
        }

        .stat-label {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            color: #6b7280;
            white-space: nowrap;
        }

        .stat-value {
            font-size: 22px;
            font-weight: 700;
            color: #1f2430;
            line-height: 1.2;
        }

        &.tone-doing .stat-value { color: #409eff; }
        &.tone-done .stat-value { color: #e6a23c; }
        &.tone-accepted .stat-value { color: #67c23a; }
        &.tone-blocked .stat-value { color: #f43f5e; }
        &.tone-overdue .stat-value { color: #b45309; }
        &.tone-members .stat-value { color: #6366f1; }
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

@media (max-width: 1280px) {
    // 这个宽度下 wide 和 compact 都是四列，切换按钮点了也没有视觉变化，直接隐藏
    .layout-btn {
        display: none;
    }

    .stat-grid.layout-wide {
        grid-template-columns: repeat(4, minmax(0, 1fr));
    }
}

@media (max-width: 720px) {
    .stat-grid.layout-wide,
    .stat-grid.layout-compact {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}
</style>
