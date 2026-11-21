<script setup>
import { Folder } from '@element-plus/icons-vue'
import { PROJECT_NOTES } from '@/constants/projectFlow'
import ProjectStageFlow from './components/flow/ProjectStageFlow.vue'
import ProjectArchiveFlow from './components/flow/ProjectArchiveFlow.vue'
import ProjectPermissionMatrix from './components/flow/ProjectPermissionMatrix.vue'
</script>

<template>
    <div class="flow-page">
        <!-- 顶部说明 -->
        <section class="hero">
            <div class="hero-text">
                <h1>项目生命周期</h1>
                <p>从立项到收尾：阶段如何推导、谁能管理项目、归档后数据去了哪里。</p>
            </div>
            <div class="hero-badge">
                <el-icon><Folder /></el-icon>
                <span>5 个项目阶段 · 3 步收尾归档 · 8 项权限</span>
            </div>
        </section>

        <!-- 项目阶段 -->
        <section class="section">
            <h2 class="section-title">五个阶段：由任务自动汇总</h2>
            <ProjectStageFlow />
        </section>

        <!-- 关闭与归档 -->
        <section class="section">
            <h2 class="section-title">项目关闭与归档</h2>
            <ProjectArchiveFlow />
        </section>

        <!-- 权限矩阵 -->
        <section class="section">
            <h2 class="section-title">项目动作权限矩阵</h2>
            <ProjectPermissionMatrix />
        </section>

        <!-- 设计说明 -->
        <section class="section">
            <h2 class="section-title">四条设计原则</h2>
            <div class="note-grid">
                <article v-for="n in PROJECT_NOTES" :key="n.title" class="note-card">
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
        linear-gradient(135deg, #312e81, #6366f1 60%, #818cf8);
    box-shadow: 0 12px 28px -12px rgba(79, 70, 229, 0.6);

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
    border-left: 3px solid #6366f1;
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
        border-color: #c7d2fe;
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
        color: #6366f1;
        background: rgba(99, 102, 241, 0.1);
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
    .note-card:hover {
        transform: none;
    }
}
</style>
