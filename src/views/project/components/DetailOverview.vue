<script setup>
import DrilldownPieChart from './DrilldownPieChart.vue'
import DetailActivity from './DetailActivity.vue'

defineProps({
    tasks: { type: Array, default: () => [] },
    activities: { type: Array, default: () => [] },
    memberName: { type: Function, required: true }
})
defineEmits(['open-activity', 'show-tasks', 'show-activity'])
</script>

<template>
    <div class="overview-grid">
        <!-- 任务分布：状态 → 负责人 -->
        <div class="panel">
            <div class="panel-head">
                <h3>任务分布</h3>
                <el-button link type="primary" @click="$emit('show-tasks')">任务列表</el-button>
            </div>
            <DrilldownPieChart :tasks="tasks" dimension="status" />
        </div>

        <!-- 负责人分布：负责人 → 状态 -->
        <div class="panel">
            <div class="panel-head">
                <h3>负责人分布</h3>
                <span class="panel-hint">点击下钻看状态</span>
            </div>
            <DrilldownPieChart :tasks="tasks" dimension="assignee" />
        </div>

        <!-- 最近动态：与前两张图同一行 -->
        <div class="panel recent-panel">
            <div class="panel-head">
                <h3>最近动态</h3>
                <el-button link type="primary" @click="$emit('show-activity')">查看全部</el-button>
            </div>
            <DetailActivity v-if="activities.length" compact :activities="activities"
                :member-name="memberName" @open="$emit('open-activity', $event)" />
            <el-empty v-else description="暂无动态" :image-size="60" />
        </div>
    </div>
</template>

<style scoped lang="scss">
.overview-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    align-items: stretch;
}

.panel {
    display: flex;
    flex-direction: column;
    padding: 16px 18px;
    background: #fff;
    border: 1px solid #e8eaef;
    border-radius: 12px;
    min-width: 0;

    h3 {
        margin: 0 0 12px;
        font-size: 13px;
        font-weight: 600;
        color: #1f2430;
    }
}

.panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;

    h3 {
        margin: 0;
    }
}

.panel-hint {
    font-size: 11px;
    color: #9ca3af;
}

.recent-panel {
    margin-top: 0;
}

// 三栏布局在常规桌面宽度下保持一行；<1100px 折成两栏，<720px 折成单栏
@media (max-width: 1100px) {
    .overview-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .recent-panel {
        grid-column: span 2;
    }
}

@media (max-width: 720px) {
    .overview-grid {
        grid-template-columns: 1fr;
    }

    .recent-panel {
        grid-column: auto;
    }
}
</style>
