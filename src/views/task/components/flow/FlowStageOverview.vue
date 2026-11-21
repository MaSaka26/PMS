<script setup>
import { ArrowRight } from '@element-plus/icons-vue'
import { PROJECT_STAGES } from '@/constants/taskFlow'
import FlowNote from './FlowNote.vue'
</script>

<template>
    <div>
        <div class="stage-strip">
            <template v-for="(s, i) in PROJECT_STAGES" :key="s.key">
                <div class="stage-card" :class="`stage-${s.key}`">
                    <span class="stage-no">{{ i + 1 }}</span>
                    <h3>{{ s.label }}</h3>
                    <p>{{ s.rule }}</p>
                </div>
                <el-icon v-if="i < PROJECT_STAGES.length - 1" class="flow-arrow">
                    <ArrowRight />
                </el-icon>
            </template>
        </div>
        <FlowNote>
            阶段<b>只进不退</b>：每次按任务推导后与当前阶段比较，更高才更新。
            新增待办、取消任务都不会让项目回退；项目归档仍由「关闭并归档」手动触发。
        </FlowNote>
    </div>
</template>

<style scoped lang="scss">
.stage-strip {
    display: flex;
    align-items: stretch;
    gap: 4px;
    overflow-x: auto;
    padding-bottom: 4px;
}

.stage-card {
    --c: #909399;

    flex: 1;
    min-width: 160px;
    padding: 14px 16px;
    background: #fff;
    border: 1px solid #e8eaef;
    border-top: 3px solid var(--c);
    border-radius: 12px;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);

    .stage-no {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        margin-bottom: 8px;
        font-size: 11px;
        font-weight: 700;
        color: #fff;
        background: var(--c);
        border-radius: 6px;
    }

    h3 {
        margin: 0 0 4px;
        font-size: 14px;
        color: #1f2430;
    }

    p {
        margin: 0;
        font-size: 12px;
        line-height: 1.5;
        color: #6b7280;
    }
}

.stage-draft { --c: #909399; }
.stage-planning { --c: #409eff; }
.stage-active { --c: #10b981; }
.stage-accepting { --c: #e6a23c; }
.stage-iterating { --c: #8b5cf6; }

.flow-arrow {
    align-self: center;
    flex-shrink: 0;
    font-size: 18px;
    color: #c0c4cc;
}

@media (max-width: 720px) {
    .stage-strip {
        flex-direction: column;
    }

    .flow-arrow {
        align-self: flex-start;
        margin-left: 20px;
        transform: rotate(90deg);
    }
}
</style>
