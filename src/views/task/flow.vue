<script setup>
import { Document } from '@element-plus/icons-vue'
import { DESIGN_NOTES } from '@/constants/taskFlow'
import FlowStatusOverview from './components/flow/FlowStatusOverview.vue'
import FlowStageOverview from './components/flow/FlowStageOverview.vue'
import FlowTransitionList from './components/flow/FlowTransitionList.vue'
import FlowPermissionMatrix from './components/flow/FlowPermissionMatrix.vue'
import FlowConceptCards from './components/flow/FlowConceptCards.vue'
import FlowArchiveSteps from './components/flow/FlowArchiveSteps.vue'

// 页面文案与规则数据统一放在 @/constants/taskFlow.js
</script>

<template>
    <div class="flow-page">
        <!-- 顶部说明 -->
        <section class="hero">
            <div class="hero-text">
                <h1>任务生命周期</h1>
                <p>从创建到验收的完整流转规则：谁在什么时候能做什么，以及系统如何兜底。</p>
            </div>
            <div class="hero-badge">
                <el-icon><Document /></el-icon>
                <span>5 个任务状态 · 8 条流转 · 5 个项目阶段</span>
            </div>
        </section>

        <!-- 状态总览 -->
        <section class="section">
            <h2 class="section-title">状态总览</h2>
            <FlowStatusOverview />
        </section>

        <!-- 项目阶段 -->
        <section class="section">
            <h2 class="section-title">项目阶段：由任务自动汇总</h2>
            <FlowStageOverview />
        </section>

        <!-- 流转明细 -->
        <section class="section">
            <h2 class="section-title">流转明细与校验规则（8 条）</h2>
            <FlowTransitionList />
        </section>

        <!-- 权限矩阵 -->
        <section class="section">
            <h2 class="section-title">角色权限矩阵</h2>
            <FlowPermissionMatrix />
        </section>

        <!-- 额外概念：阻塞与取消 -->
        <section class="section">
            <h2 class="section-title">阻塞与取消：两个容易混淆的概念</h2>
            <FlowConceptCards />
        </section>

        <!-- 项目归档 -->
        <section class="section">
            <h2 class="section-title">项目关闭与归档</h2>
            <FlowArchiveSteps />
        </section>

        <!-- 设计说明 -->
        <section class="section">
            <h2 class="section-title">四条设计原则</h2>
            <div class="note-grid">
                <article v-for="n in DESIGN_NOTES" :key="n.title" class="note-card">
                    <div class="note-icon">
                        <el-icon><component :is="n.icon" /></el-icon>
                    </div>
                    <h4>{{ n.title }}</h4>
                    <p>{{ n.desc }}</p>
                </article>
            </div>
        </section>
    </div>
</template>

<style scoped lang="scss">
.flow-page {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 28px;
}

.hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 24px 28px;
    border-radius: 14px;
    color: #fff;
    background:
        radial-gradient(600px 200px at 15% 20%, rgba(255, 255, 255, 0.18), transparent 60%),
        linear-gradient(135deg, #1e3a8a, #3b82f6 60%, #60a5fa);
    box-shadow: 0 12px 28px -12px rgba(37, 99, 235, 0.6);

    h1 {
        margin: 0 0 6px;
        font-size: 22px;
        letter-spacing: -0.3px;
    }

    p {
        margin: 0;
        font-size: 13px;
        opacity: 0.85;
    }

    .hero-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
        padding: 8px 14px;
        font-size: 12px;
        font-weight: 500;
        background: rgba(255, 255, 255, 0.16);
        border: 1px solid rgba(255, 255, 255, 0.24);
        border-radius: 999px;
        backdrop-filter: blur(4px);
    }
}

.section-title {
    margin: 0 0 14px;
    font-size: 15px;
    font-weight: 700;
    color: #1f2430;
    padding-left: 10px;
    border-left: 3px solid #409eff;
}

// 设计原则
.note-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
}

.note-card {
    padding: 18px;
    background: #fff;
    border: 1px solid #e8eaef;
    border-radius: 12px;
    transition: border-color 0.18s ease, transform 0.18s ease;

    &:hover {
        border-color: #bfdbfe;
        transform: translateY(-2px);
    }

    .note-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        margin-bottom: 10px;
        font-size: 17px;
        color: #409eff;
        background: rgba(64, 158, 255, 0.1);
        border-radius: 9px;
    }

    h4 {
        margin: 0 0 6px;
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

@media (max-width: 1200px) {
    .note-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 720px) {
    .note-grid {
        grid-template-columns: 1fr;
    }

    .hero {
        flex-direction: column;
        align-items: flex-start;
    }
}

@media (prefers-reduced-motion: reduce) {
    .flow-page :deep(*),
    .flow-page :deep(*::before),
    .flow-page :deep(*::after) {
        transition: none !important;
    }

    .note-card:hover {
        transform: none;
    }
}
</style>
