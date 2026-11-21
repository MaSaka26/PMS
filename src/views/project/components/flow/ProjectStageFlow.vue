<script setup>
import { ArrowRight } from '@element-plus/icons-vue'
import { PROJECT_STAGES } from '@/constants/projectFlow'
import FlowNote from '@/components/FlowNote.vue'
</script>

<template>
    <div>
        <div class="stage-strip">
            <template v-for="(s, i) in PROJECT_STAGES" :key="s.key">
                <div class="stage-card" :class="`stage-${s.key}`">
                    <span class="stage-no">{{ i + 1 }}</span>
                    <h3>{{ s.label }}</h3>
                    <p class="stage-short">{{ s.short }}</p>
                    <dl>
                        <div>
                            <dt>判定</dt>
                            <dd>{{ s.rule }}</dd>
                        </div>
                        <div>
                            <dt>进入</dt>
                            <dd>{{ s.enter }}</dd>
                        </div>
                        <div>
                            <dt>离开</dt>
                            <dd>{{ s.exit }}</dd>
                        </div>
                        <div>
                            <dt>主导人</dt>
                            <dd>{{ s.who }}</dd>
                        </div>
                    </dl>
                </div>
                <el-icon v-if="i < PROJECT_STAGES.length - 1" class="flow-arrow">
                    <ArrowRight />
                </el-icon>
            </template>
        </div>
        <FlowNote>
            阶段由任务状态<b>自动推导</b>，不需要手动维护；推导结果与当前阶段比较后<b>只进不退</b>，
            新增待办或取消任务都不会让项目回退。进入收尾后，仍需要手动执行「关闭并归档」。
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
    min-width: 200px;
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

    .stage-short {
        margin: 0 0 10px;
        font-size: 12px;
        line-height: 1.5;
        color: var(--c);
    }

    dl {
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;

        div {
            display: flex;
            gap: 6px;
            font-size: 11px;
            line-height: 1.5;
        }

        dt {
            flex-shrink: 0;
            color: #9ca3af;
        }

        dd {
            margin: 0;
            color: #6b7280;
        }
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

@media (max-width: 1200px) {
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
