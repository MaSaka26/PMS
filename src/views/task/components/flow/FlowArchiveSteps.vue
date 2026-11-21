<script setup>
import FlowNote from './FlowNote.vue'
</script>

<template>
    <div>
        <div class="archive-card">
            <div class="archive-step">
                <span class="step-no">1</span>
                <div>
                    <h4>关闭项目</h4>
                    <p>PM 或 admin 在项目看板执行「关闭并归档」，项目从看板移除。</p>
                </div>
            </div>
            <div class="archive-step">
                <span class="step-no">2</span>
                <div>
                    <h4>归档只读</h4>
                    <p>项目进入「项目归档」页，所有任务、事件与时间线完整保留，但不可再编辑。</p>
                </div>
            </div>
            <div class="archive-step">
                <span class="step-no">3</span>
                <div>
                    <h4>撤销归档</h4>
                    <p>需要继续推进时，PM / admin 可撤销归档，项目恢复编辑，并按当前任务重新推导阶段（不再固定回执行中），操作记入项目事件。</p>
                </div>
            </div>
        </div>
        <FlowNote>
            归档不是删除，也不是把数据搬走，只是同一份数据在<b>另一个筛选视图</b>里展示；撤销归档不会恢复已软删除的任务。
        </FlowNote>
    </div>
</template>

<style scoped lang="scss">
.archive-card {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;

    .archive-step {
        display: flex;
        gap: 10px;
        padding: 16px;
        background: #fff;
        border: 1px solid #e8eaef;
        border-radius: 12px;

        .step-no {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            flex-shrink: 0;
            font-size: 12px;
            font-weight: 700;
            color: #fff;
            background: linear-gradient(135deg, #3b82f6, #60a5fa);
            border-radius: 50%;
        }

        h4 {
            margin: 0 0 4px;
            font-size: 13px;
            color: #1f2430;
        }

        p {
            margin: 0;
            font-size: 12px;
            line-height: 1.65;
            color: #6b7280;
        }
    }
}

@media (max-width: 1200px) {
    .archive-card {
        grid-template-columns: 1fr;
    }
}
</style>
