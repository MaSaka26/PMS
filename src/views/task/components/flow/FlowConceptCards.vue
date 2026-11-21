<script setup>
import FlowNote from './FlowNote.vue'
</script>

<template>
    <div>
        <div class="extra-grid">
            <article class="extra-card tone-block">
                <h3>阻塞：是标记，不是状态</h3>
                <p class="extra-desc">
                    任务仍在原泳道（比如"进行中"），额外挂一个阻塞标记。典型场景：前端页面做完，等待后端接口联调。
                </p>
                <ul>
                    <li>必须填写阻塞原因，解除时记录解除事件</li>
                    <li>仅「待办 / 进行中」可标记阻塞；待验收发现问题请走驳回</li>
                    <li>阻塞中的任务不能提交验收，界面会提示「解除阻塞并提交」</li>
                    <li>看板顶部可筛选「仅看阻塞」，卡片带红色标记</li>
                    <li>不新增泳道，避免"恢复时不知道该回哪一列"</li>
                </ul>
            </article>
            <article class="extra-card tone-cancel">
                <h3>取消：是真终态，与"完成"区分</h3>
                <p class="extra-desc">
                    取消表示"这件事不再需要做了"（需求砍了、重复、方案作废），与"已验收"是两个不同的结论。
                </p>
                <ul>
                    <li>待办 / 进行中 / 待验收都能取消，必须填写原因</li>
                    <li>出现在看板底部「已取消」折叠区，默认收起</li>
                    <li>不计入完成率；统计口径与已验收严格分开</li>
                    <li>PM / admin / 任务创建人可取消，PM / admin 可恢复回待办</li>
                </ul>
            </article>
        </div>
        <FlowNote>
            已验收不能取消；如需返工请使用<b>重开</b>回到进行中。已取消不能直接验收，需先<b>恢复</b>。
        </FlowNote>
    </div>
</template>

<style scoped lang="scss">
.extra-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;

    .extra-card {
        --c: #409eff;

        padding: 16px 18px;
        background: #fff;
        border: 1px solid #e8eaef;
        border-top: 3px solid var(--c);
        border-radius: 12px;

        &.tone-block {
            --c: #f43f5e;
        }

        &.tone-cancel {
            --c: #94a3b8;
        }

        h3 {
            margin: 0 0 6px;
            font-size: 14px;
            color: #1f2430;
        }

        .extra-desc {
            margin: 0 0 10px;
            font-size: 12px;
            line-height: 1.65;
            color: #6b7280;
        }

        ul {
            margin: 0;
            padding-left: 16px;
            display: flex;
            flex-direction: column;
            gap: 5px;
            font-size: 12px;
            line-height: 1.6;
            color: #4b5563;

            li::marker {
                color: var(--c);
            }
        }
    }
}

@media (max-width: 720px) {
    .extra-grid {
        grid-template-columns: 1fr;
    }
}
</style>
