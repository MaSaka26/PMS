<script setup>
import { ArrowRight } from '@element-plus/icons-vue'
import { CANCELED_STATUS, STATUSES } from '@/constants/taskFlow'
import FlowNote from './FlowNote.vue'
</script>

<template>
    <div>
        <div class="flow-strip">
            <template v-for="(s, i) in STATUSES" :key="s.key">
                <div class="flow-node" :class="`node-${s.key}`">
                    <span class="node-dot"></span>
                    <h3>{{ s.label }}</h3>
                    <p class="node-short">{{ s.short }}</p>
                    <dl>
                        <div><dt>进入</dt><dd>{{ s.enter }}</dd></div>
                        <div><dt>离开</dt><dd>{{ s.exit }}</dd></div>
                        <div><dt>主导人</dt><dd>{{ s.who }}</dd></div>
                    </dl>
                </div>
                <el-icon v-if="i < STATUSES.length - 1" class="flow-arrow">
                    <ArrowRight />
                </el-icon>
            </template>
        </div>

        <!-- 分支终态：已取消 -->
        <div class="branch-wrap">
            <span class="branch-label">分支终态</span>
            <div class="flow-node node-canceled branch-node">
                <span class="node-dot"></span>
                <h3>{{ CANCELED_STATUS.label }}</h3>
                <p class="node-short">{{ CANCELED_STATUS.short }}</p>
                <dl>
                    <div><dt>进入</dt><dd>{{ CANCELED_STATUS.enter }}</dd></div>
                    <div><dt>离开</dt><dd>{{ CANCELED_STATUS.exit }}</dd></div>
                    <div><dt>主导人</dt><dd>{{ CANCELED_STATUS.who }}</dd></div>
                </dl>
            </div>
        </div>

        <FlowNote>
            回退与分支路径共四条：<b>待验收 → 进行中（驳回）</b>、<b>已验收 → 进行中（重开）</b>、
            <b>任意执行阶段 → 已取消</b>、<b>已取消 → 待办（恢复）</b>，见下方流转明细。
            另外，<b>待办任务不允许有负责人</b>：选择负责人即视为开工，直接进入进行中。
        </FlowNote>
    </div>
</template>

<style scoped lang="scss">
.flow-strip {
    display: flex;
    align-items: stretch;
    gap: 4px;
    overflow-x: auto;
    padding-bottom: 4px;
}

.flow-node {
    --c: #909399;
    --c-soft: rgba(144, 147, 153, 0.1);

    flex: 1;
    min-width: 200px;
    padding: 16px;
    background: #fff;
    border: 1px solid #e8eaef;
    border-top: 3px solid var(--c);
    border-radius: 12px;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);

    .node-dot {
        display: block;
        width: 10px;
        height: 10px;
        margin-bottom: 10px;
        background: var(--c);
        border-radius: 50%;
        box-shadow: 0 0 0 4px var(--c-soft);
    }

    h3 {
        margin: 0 0 4px;
        font-size: 15px;
        color: #1f2430;
    }

    .node-short {
        margin: 0 0 12px;
        font-size: 12px;
        color: #6b7280;
        line-height: 1.5;
    }

    dl {
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    dl > div {
        display: flex;
        gap: 8px;
        font-size: 12px;
        line-height: 1.5;
    }

    dt {
        flex-shrink: 0;
        width: 36px;
        color: #9ca3af;
    }

    dd {
        margin: 0;
        color: #4b5563;
    }
}

.node-todo { --c: #909399; --c-soft: rgba(144, 147, 153, 0.12); }
.node-doing { --c: #409eff; --c-soft: rgba(64, 158, 255, 0.12); }
.node-done { --c: #e6a23c; --c-soft: rgba(230, 162, 60, 0.14); }
.node-accepted { --c: #67c23a; --c-soft: rgba(103, 194, 58, 0.14); }
.node-canceled { --c: #94a3b8; --c-soft: rgba(148, 163, 184, 0.16); }

// 分支终态：已取消，用虚线区分它不是主干泳道
.branch-wrap {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: 14px;

    .branch-label {
        flex-shrink: 0;
        padding: 3px 10px;
        font-size: 11px;
        color: #9ca3af;
        background: #f8fafc;
        border: 1px dashed #dbe3ec;
        border-radius: 999px;
    }

    .branch-node {
        flex: 0 1 340px;
        min-width: 220px;
        border-style: dashed;

        .node-dot {
            border-radius: 2px;
        }
    }
}

.flow-arrow {
    align-self: center;
    flex-shrink: 0;
    font-size: 18px;
    color: #c0c4cc;
}

@media (max-width: 720px) {
    .flow-strip {
        flex-direction: column;
    }

    .flow-arrow {
        align-self: flex-start;
        margin-left: 20px;
        transform: rotate(90deg);
    }

    .branch-wrap {
        flex-direction: column;
        align-items: stretch;
    }
}
</style>
