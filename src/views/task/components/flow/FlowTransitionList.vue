<script setup>
import { ArrowRight } from '@element-plus/icons-vue'
import { TRANSITIONS } from '@/constants/taskFlow'
</script>

<template>
    <div class="transition-list">
        <article v-for="t in TRANSITIONS" :key="t.no" class="transition-card" :class="`tone-${t.tone}`">
            <div class="t-head">
                <span class="t-no">{{ t.no }}</span>
                <div class="t-route">
                    <span class="t-from">{{ t.from }}</span>
                    <el-icon class="t-arrow"><ArrowRight /></el-icon>
                    <span class="t-to">{{ t.to }}</span>
                </div>
                <span class="t-name">{{ t.name }}</span>
            </div>
            <div class="t-meta">
                <span><em>操作人</em>{{ t.who }}</span>
                <span><em>触发方式</em>{{ t.trigger }}</span>
            </div>
            <ul class="t-rules">
                <li v-for="r in t.rules" :key="r">{{ r }}</li>
            </ul>
        </article>
    </div>
</template>

<style scoped lang="scss">
.transition-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
}

.transition-card {
    --c: #409eff;

    padding: 16px 18px;
    background: #fff;
    border: 1px solid #e8eaef;
    border-left: 3px solid var(--c);
    border-radius: 12px;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
    transition: box-shadow 0.18s ease, transform 0.18s ease;

    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px -8px rgba(16, 24, 40, 0.18);
    }

    &.tone-success { --c: #67c23a; }
    &.tone-warning { --c: #e6a23c; }
    &.tone-danger { --c: #f43f5e; }

    .t-head {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
        flex-wrap: wrap;
    }

    .t-no {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        font-size: 11px;
        font-weight: 700;
        color: #fff;
        background: var(--c);
        border-radius: 7px;
    }

    .t-route {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 13px;
        font-weight: 600;
        color: #1f2430;
    }

    .t-arrow {
        font-size: 13px;
        color: var(--c);
    }

    .t-name {
        margin-left: auto;
        padding: 2px 10px;
        font-size: 11px;
        font-weight: 600;
        color: var(--c);
        background: color-mix(in srgb, var(--c) 10%, #fff);
        border-radius: 999px;
    }

    .t-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 18px;
        margin-bottom: 10px;
        font-size: 12px;
        color: #4b5563;

        em {
            font-style: normal;
            margin-right: 6px;
            color: #9ca3af;
        }
    }

    .t-rules {
        margin: 0;
        padding-left: 16px;
        display: flex;
        flex-direction: column;
        gap: 5px;
        font-size: 12px;
        line-height: 1.6;
        color: #6b7280;

        li::marker {
            color: var(--c);
        }
    }
}

@media (max-width: 1200px) {
    .transition-list {
        grid-template-columns: 1fr;
    }
}

@media (prefers-reduced-motion: reduce) {
    .transition-card:hover {
        transform: none;
    }
}
</style>
