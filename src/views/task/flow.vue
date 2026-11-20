<script setup>
import {
    ArrowRight, CircleCheck, CircleClose, Document, RefreshLeft,
    User, Check, WarningFilled, InfoFilled
} from '@element-plus/icons-vue'

// 主干四列（泳道），已取消是分支终态，单独展示
const STATUSES = [
    {
        key: 'todo',
        label: '待办',
        short: '有人建了，但还没人接',
        enter: '新建任务时负责人留空',
        exit: '成员认领',
        who: '项目成员'
    },
    {
        key: 'doing',
        label: '进行中',
        short: '已有人负责，正在推进',
        enter: '认领成功 / 新建或编辑时选择负责人',
        exit: '提交验收 / 驳回 / 重开',
        who: '执行人 + 项目成员'
    },
    {
        key: 'done',
        label: '待验收',
        short: '执行人认为完成，等待确认',
        enter: '执行人提交验收',
        exit: '验收通过 / 驳回',
        who: '项目负责人（PM）、admin'
    },
    {
        key: 'accepted',
        label: '已验收',
        short: '确认完成；可因缺陷或变更重开',
        enter: 'PM 验收通过',
        exit: '重开（必须填写原因）',
        who: '项目负责人（PM）、admin'
    }
]

// 分支终态：已取消
const CANCELED_STATUS = {
    key: 'canceled',
    label: '已取消',
    short: '这件事不再需要做了，与「完成」是两个不同的结论',
    enter: '待办 / 进行中 / 待验收 主动取消（必须填原因）',
    exit: '恢复回待办（PM / admin）',
    who: 'PM / admin / 任务创建人'
}

// 项目阶段：由任务状态自动汇总，只进不退
const PROJECT_STAGES = [
    { key: 'draft', label: '项目立项', rule: '还没有未取消任务' },
    { key: 'planning', label: '项目规划', rule: '有任务，但都还在待办' },
    { key: 'active', label: '任务执行', rule: '至少一个任务进行中' },
    { key: 'accepting', label: '任务验收', rule: '没有待办 / 进行中，且至少一个待验收' },
    { key: 'iterating', label: '项目收尾', rule: '全部未取消任务已验收' }
]

// 每一次状态流转
const TRANSITIONS = [
    {
        no: '01',
        from: '待办',
        to: '进行中',
        name: '认领',
        tone: 'primary',
        who: '项目成员 / PM / admin',
        trigger: '卡片上的「认领」按钮',
        rules: [
            '任务必须还没有负责人（待办不挂负责人）',
            '认领人必须是该项目的 members 之一',
            '认领成功后自动进入「进行中」——认领即承诺开始',
            '前置任务未完成时会提示，确认后可以强制认领'
        ]
    },
    {
        no: '02',
        from: '待办',
        to: '进行中',
        name: '指派（Push 派单）',
        tone: 'primary',
        who: '项目负责人（PM） / admin；新建或编辑任务的人也可指定负责人',
        trigger: '待办卡片上的「指派」按钮，或在任务弹窗里选择负责人',
        rules: [
            '被指派人必须是该项目的 members 之一',
            '选负责人即开工：指派后状态直接落为「进行中」，不经过待办',
            '新建弹窗已移除「当前状态」，状态完全由负责人推导：留空 = 待办，选人 = 进行中',
            '待办任务不允许保留负责人；清空非待办任务的负责人会被拒绝',
            '认领只能把任务给自己；把任务交给别人必须使用「指派」'
        ]
    },
    {
        no: '03',
        from: '进行中',
        to: '待验收',
        name: '提交验收',
        tone: 'success',
        who: '任务负责人（PM / admin 可代提交）',
        trigger: '卡片上的「提交验收」按钮',
        rules: [
            '提交只是声明「我认为做完了」，不等于验收通过',
            '任务处于阻塞状态时不能直接提交：界面会提示「解除阻塞并提交」，确认后依次记 unblocked + submitted 两条事件',
            '接口层同样校验，阻塞中直接改状态会返回 400'
        ]
    },
    {
        no: '04',
        from: '待验收',
        to: '已验收',
        name: '验收通过',
        tone: 'success',
        who: '项目负责人（PM） / admin',
        trigger: '卡片上的「验收通过」按钮',
        rules: [
            '执行人不能验收自己提交的任务（职责分离）',
            '非 PM / admin 的卡片上不显示该按钮',
            'mock 接口同样校验，绕过前端也会被 403 拦截'
        ]
    },
    {
        no: '05',
        from: '待验收',
        to: '进行中',
        name: '驳回',
        tone: 'warning',
        who: '项目负责人（PM） / admin',
        trigger: '卡片上的「驳回」按钮（必须填写原因）',
        rules: [
            '驳回原因不能为空，会显示在时间线与卡片详情中',
            '驳回后执行人需要重新处理并再次提交'
        ]
    },
    {
        no: '06',
        from: '已验收',
        to: '进行中',
        name: '重开',
        tone: 'danger',
        who: '项目负责人（PM） / admin',
        trigger: '卡片上的「重开」按钮（必须填写原因）',
        rules: [
            '重开原因不能为空，会写入 reopenReason / reopenAt / reopenBy',
            '卡片上会显示「重开原因」琥珀色提示条，便于追溯',
            '用于验收后发现缺陷、需求变更、返工等真实场景'
        ]
    },
    {
        no: '07',
        from: '待办 / 进行中 / 待验收',
        to: '已取消',
        name: '取消',
        tone: 'danger',
        who: '项目负责人（PM） / admin / 任务创建人',
        trigger: '卡片上的「取消」按钮（必须填写原因）',
        rules: [
            '取消原因不能为空，写入 canceledReason / canceledAt / canceledBy',
            '已验收的任务不能取消——如需返工请使用重开',
            '取消后进入看板底部「已取消」折叠区，不计入完成率',
            '若任务处于阻塞中，取消会同时清掉阻塞标记'
        ]
    },
    {
        no: '08',
        from: '已取消',
        to: '待办',
        name: '恢复',
        tone: 'info',
        who: '项目负责人（PM） / admin',
        trigger: '已取消卡片上的「恢复」按钮',
        rules: [
            '恢复后回到「待办」重新排队，原负责人会被清空，需要重新认领',
            '时间线会记录 restored 事件，取消历史不会被抹掉'
        ]
    }
]

// 权限矩阵
const PERMISSIONS = [
    { action: '认领任务', admin: true, pm: true, member: true, outsider: false },
    { action: '提交验收（负责人本人）', admin: true, pm: true, member: true, outsider: false },
    { action: '验收通过', admin: true, pm: true, member: false, outsider: false },
    { action: '驳回', admin: true, pm: true, member: false, outsider: false },
    { action: '重开已验收任务', admin: true, pm: true, member: false, outsider: false },
    { action: '标记 / 解除阻塞', admin: true, pm: true, member: true, outsider: false },
    { action: '取消任务', admin: true, pm: true, member: true, outsider: false },
    { action: '恢复已取消任务', admin: true, pm: true, member: false, outsider: false }
]

const DESIGN_NOTES = [
    {
        icon: User,
        title: '认领即启动',
        desc: 'Pull 制下「我接了」就意味着「我开始做」，所以认领会自动把任务推进到进行中，避免出现「已认领但永远不动」的僵尸任务。'
    },
    {
        icon: Check,
        title: '提交 ≠ 验收',
        desc: '执行人只能「提交验收」，由 PM 或管理员「验收通过」。自评自过会让质量失控，看板数据也会失真。'
    },
    {
        icon: RefreshLeft,
        title: '终态可回退，但要留痕',
        desc: '已验收不是死路。验收后回归发现缺陷、需求变更都要能重开，但必须填写原因并记录操作人，保证可追溯。'
    },
    {
        icon: WarningFilled,
        title: '双层校验',
        desc: '前端按角色隐藏按钮，mock 接口再按状态机 + 权限二次校验。即使绕过 UI 直接调接口，非法流转也会被拒绝。'
    }
]
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
            <div class="loop-note">
                <el-icon><InfoFilled /></el-icon>
                <span>
                    回退与分支路径共四条：<b>待验收 → 进行中（驳回）</b>、<b>已验收 → 进行中（重开）</b>、
                    <b>任意执行阶段 → 已取消</b>、<b>已取消 → 待办（恢复）</b>，见下方流转明细。
                    另外，<b>待办任务不允许有负责人</b>：选择负责人即视为开工，直接进入进行中。
                </span>
            </div>
        </section>

        <!-- 项目阶段 -->
        <section class="section">
            <h2 class="section-title">项目阶段：由任务自动汇总</h2>
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
            <div class="loop-note">
                <el-icon><InfoFilled /></el-icon>
                <span>
                    阶段<b>只进不退</b>：每次按任务推导后与当前阶段比较，更高才更新。
                    新增待办、取消任务都不会让项目回退；项目归档仍由「关闭并归档」手动触发。
                </span>
            </div>
        </section>

        <!-- 流转明细 -->
        <section class="section">
            <h2 class="section-title">流转明细与校验规则（8 条）</h2>
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
        </section>

        <!-- 权限矩阵 -->
        <section class="section">
            <h2 class="section-title">角色权限矩阵</h2>
            <div class="perm-wrap">
                <table class="perm-table">
                    <thead>
                        <tr>
                            <th>动作</th>
                            <th>admin</th>
                            <th>PM（本项目）</th>
                            <th>项目成员</th>
                            <th>非成员</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="p in PERMISSIONS" :key="p.action">
                            <td class="perm-action">{{ p.action }}</td>
                            <td v-for="key in ['admin', 'pm', 'member', 'outsider']" :key="key">
                                <el-icon v-if="p[key]" class="yes"><CircleCheck /></el-icon>
                                <el-icon v-else class="no"><CircleClose /></el-icon>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p class="perm-tip">
                PM 权限按项目计算：张经理只在「双十一大促」「官网改版」里是验收人，「会员体系升级」的验收人是老板。
                表中「项目成员」一列的阻塞与取消是受限的——只能操作自己负责（或自己创建）的任务。
            </p>
        </section>

        <!-- 额外概念：阻塞与取消 -->
        <section class="section">
            <h2 class="section-title">阻塞与取消：两个容易混淆的概念</h2>
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
            <div class="loop-note">
                <el-icon><InfoFilled /></el-icon>
                <span>已验收不能取消；如需返工请使用<b>重开</b>回到进行中。已取消不能直接验收，需先<b>恢复</b>。</span>
            </div>
        </section>

        <!-- 项目归档 -->
        <section class="section">
            <h2 class="section-title">项目关闭与归档</h2>
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
            <div class="loop-note">
                <el-icon><InfoFilled /></el-icon>
                <span>归档不是删除，也不是把数据搬走，只是同一份数据在<b>另一个筛选视图</b>里展示；撤销归档不会恢复已软删除的任务。</span>
            </div>
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

// 状态总览
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

// 项目阶段
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

.loop-note {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 12px;
    padding: 10px 14px;
    font-size: 12px;
    line-height: 1.6;
    color: #475569;
    background: #f8fafc;
    border: 1px dashed #dbe3ec;
    border-radius: 10px;

    .el-icon {
        margin-top: 2px;
        color: #409eff;
    }

    b {
        color: #1f2430;
    }
}

// 流转明细
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

// 权限矩阵
.perm-wrap {
    overflow-x: auto;
    background: #fff;
    border: 1px solid #e8eaef;
    border-radius: 12px;
}

.perm-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;

    th,
    td {
        padding: 11px 14px;
        text-align: center;
        border-bottom: 1px solid #f0f2f5;
        white-space: nowrap;
    }

    th {
        font-size: 12px;
        font-weight: 600;
        color: #6b7280;
        background: #f8fafc;
    }

    tbody tr:last-child td {
        border-bottom: none;
    }

    .perm-action {
        text-align: left;
        font-weight: 500;
        color: #1f2430;
    }

    .yes {
        font-size: 16px;
        color: #67c23a;
    }

    .no {
        font-size: 16px;
        color: #dcdfe6;
    }
}

.perm-tip {
    margin: 10px 2px 0;
    font-size: 12px;
    color: #9ca3af;
}

// 阻塞与取消
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

// 项目归档
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
    .transition-list {
        grid-template-columns: 1fr;
    }

    .note-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .archive-card {
        grid-template-columns: 1fr;
    }
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

    .note-grid,
    .extra-grid {
        grid-template-columns: 1fr;
    }

    .branch-wrap {
        flex-direction: column;
        align-items: stretch;
    }

    .hero {
        flex-direction: column;
        align-items: flex-start;
    }
}

@media (prefers-reduced-motion: reduce) {
    .flow-page *,
    .flow-page *::before,
    .flow-page *::after {
        transition: none !important;
    }

    .transition-card:hover,
    .note-card:hover {
        transform: none;
    }
}
</style>
