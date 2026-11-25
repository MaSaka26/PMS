<script setup>
import { computed } from 'vue'
import {
    Calendar, Check, CircleCheck, CircleClose, Delete, Edit,
    Link, RefreshLeft, User, UserFilled, VideoPlay, WarningFilled
} from '@element-plus/icons-vue'
import { useMemberStore } from '@/stores/memberStore'
import DueBadge from '@/components/DueBadge.vue'
import DemoViewers from '@/components/DemoViewers.vue'

const props = defineProps({
    task: { type: Object, required: true },
    // 当前用户是否有权认领（项目成员）
    canClaim: { type: Boolean, default: false },
    // 当前用户是否有权指派（项目负责人 / 管理员）
    canAssign: { type: Boolean, default: false },
    // 当前用户是否有权提交验收（负责人本人 / PM / admin）
    canSubmit: { type: Boolean, default: false },
    // 当前用户是否有权验收/驳回/重开/恢复（项目 PM 或 admin）
    canReview: { type: Boolean, default: false },
    // 当前用户是否有权标记/解除阻塞（负责人、PM、admin）
    canBlock: { type: Boolean, default: false },
    // 当前用户是否有权取消（PM、admin、任务创建人）
    canCancel: { type: Boolean, default: false },
    // 依赖信息：{ total, pending, names[] }，由父组件根据项目任务算出
    deps: { type: Object, default: null },
    // 编辑 / 删除权限（由父组件按角色与项目关系计算）
    canEdit: { type: Boolean, default: false },
    canDelete: { type: Boolean, default: false },
    // 从「我的任务」跳过来定位时，短暂高亮这一张
    highlight: { type: Boolean, default: false },
    // 演示用的「谁正在看」实体键（task:xxx），空串则不显示
    // 演示用「谁正在看」：任务就是叶子实体，人头直接挂在这个 taskId 上
    projectId: { type: String, default: '' }
})

const emit = defineEmits([
    'open', 'edit', 'delete',
    'claim', 'assign', 'advance', 'reject', 'reopen', 'restore',
    'block', 'unblock', 'cancel'
])

const memberStore = useMemberStore()

const memberName = (id) => memberStore.memberName(id)

const assigneeInitial = computed(() =>
    props.task.assignee
        ? memberStore.memberName(props.task.assignee).trim().charAt(0).toUpperCase()
        : ''
)

const priorityClass = computed(() => {
    switch (props.task.priority) {
        case '高': return 'pri-high'
        case '中': return 'pri-medium'
        default: return 'pri-low'
    }
})

const hasAssignee = computed(() => !!props.task.assignee)
const isCanceled = computed(() => props.task.status === 'canceled')

// 主操作：推进状态
// todo:     空 assignee → [认领]（Pull 制）
// doing:    项目成员 → [提交验收]
// done:     仅 PM/admin → [验收通过] [驳回]
// accepted: 仅 PM/admin → [重开]
// canceled: 仅 PM/admin → [恢复]
const statusActions = computed(() => {
    const s = props.task.status
    const actions = []
    // 项目负责人 / 管理员可以显式指派给其他成员
    if (s === 'todo' && !props.task.assignee && props.canAssign) {
        actions.push({ key: 'assign', label: '指派', tone: 'primary', icon: UserFilled })
    }
    if (s === 'todo' && !props.task.assignee && props.canClaim) {
        actions.push({ key: 'claim', label: '认领', tone: 'primary', icon: User })
    }
    if (s === 'doing' && props.canSubmit) {
        actions.push({ key: 'advance', label: '提交验收', tone: 'primary', icon: Check })
    }
    if (s === 'done' && props.canReview) {
        actions.push(
            { key: 'advance', label: '验收通过', tone: 'success', icon: Check },
            { key: 'reject', label: '驳回', tone: 'warning', icon: RefreshLeft }
        )
    }
    if (s === 'accepted' && props.canReview) {
        actions.push({ key: 'reopen', label: '重开', tone: 'info', icon: RefreshLeft })
    }
    if (s === 'canceled' && props.canReview) {
        actions.push({ key: 'restore', label: '恢复', tone: 'info', icon: VideoPlay })
    }
    return actions
})

// 辅助操作：阻塞标记 / 取消
// 阻塞只作用于执行阶段（待办 / 进行中）；待验收发现问题请走驳回
const flagActions = computed(() => {
    const s = props.task.status
    if (!['todo', 'doing'].includes(s)) return []
    const actions = []
    if (props.canBlock) {
        actions.push(
            props.task.blocked
                ? {
                    key: 'unblock', label: '解除阻塞', tone: 'info', icon: CircleCheck,
                    hint: '清除阻塞标记，任务恢复正常推进'
                }
                : {
                    key: 'block', label: '标记阻塞', tone: 'warning', icon: WarningFilled,
                    hint: '任务仍留在当前泳道，只标注“暂时推进不了”'
                }
        )
    }
    if (props.canCancel) {
        actions.push({
            key: 'cancel',
            label: '取消任务',
            tone: 'danger',
            icon: CircleClose,
            hint: '停止推进并移入「已取消」区，可随时恢复；不会删除任务'
        })
    }
    return actions
})

// 事件名与 key 一一对应，父组件直接按 key 分发
const onAction = (action) => emit(action.key, props.task)
const onOpen = () => emit('open', props.task)
</script>

<template>
    <div :id="`task-card-${task.id}`" class="task-card"
        :class="[priorityClass, { 'is-blocked': task.blocked, 'is-canceled': isCanceled, 'is-located': highlight }]"
        @click="onOpen">
        <span class="accent" aria-hidden="true"></span>

        <div v-if="canEdit || canDelete" class="card-actions">
            <el-tooltip v-if="canEdit" content="编辑任务内容" placement="top" :show-after="150">
                <button type="button" class="action" aria-label="编辑任务" @click.stop="emit('edit', task)">
                    <el-icon><Edit /></el-icon>
                </button>
            </el-tooltip>
            <span v-if="canEdit && canDelete" class="action-sep" aria-hidden="true"></span>
            <el-tooltip v-if="canDelete" content="删除：移出看板，不可恢复" placement="top" :show-after="150">
                <button type="button" class="action action-danger" aria-label="删除任务"
                    @click.stop="emit('delete', task)">
                    <el-icon><Delete /></el-icon>
                </button>
            </el-tooltip>
        </div>

        <h4 class="title" :title="task.title">
            <span class="prio-tag" :title="`优先级：${task.priority}`">{{ task.priority }}</span>
            <span class="title-text">{{ task.title }}</span>
        </h4>
        <p v-if="task.desc" class="desc">{{ task.desc }}</p>
        <!-- 重开留痕：说明这张卡是从"已验收"退回来的及原因 -->
        <p v-if="task.reopenReason" class="reopen-note" :title="task.reopenReason">
            <el-icon><RefreshLeft /></el-icon>重开原因：{{ task.reopenReason }}
        </p>
        <!-- 阻塞标记：不是状态，是叠加的 flag -->
        <p v-if="task.blocked" class="blocked-note" :title="task.blockedReason">
            <el-icon><WarningFilled /></el-icon>阻塞：{{ task.blockedReason || '未填写原因' }}
        </p>
        <!-- 取消留痕 -->
        <p v-if="isCanceled && task.canceledReason" class="canceled-note" :title="task.canceledReason">
            已取消：{{ task.canceledReason }}
        </p>
        <!-- 依赖提示：前置是否完成 -->
        <p v-if="deps" class="deps-note" :class="{ 'deps-pending': deps.pending > 0 }"
            :title="`前置：${deps.names.join('、') || '—'}`">
            <el-icon><Link /></el-icon>
            {{ deps.pending ? `等待 ${deps.pending} 个前置` : `前置 ${deps.total} 项已完成` }}
        </p>

        <div class="card-foot">
            <!-- 有 assignee：显示头像 + 名字 -->
            <div v-if="hasAssignee" class="assignee" :title="memberName(task.assignee)">
                <span class="avatar">{{ assigneeInitial }}</span>
                <span class="name">{{ memberName(task.assignee) }}</span>
            </div>
            <!-- 无 assignee：显示"待认领"标签（Pull 制） -->
            <span v-else class="unassigned">待认领</span>

            <span class="foot-right">
                <DemoViewers v-if="task.id" :task-id="task.id" :project-id="projectId || task.projectId" />
                <span v-if="task.dueDate" class="due">
                    <el-icon><Calendar /></el-icon>{{ task.dueDate }}
                    <DueBadge :due-date="task.dueDate" :status="task.status" />
                </span>
            </span>
        </div>

        <!-- 状态推进按钮组：每张卡片根据状态 + 当前用户权限显示不同按钮 -->
        <div v-if="statusActions.length" class="status-actions">
            <button
                v-for="a in statusActions"
                :key="a.key + a.label"
                type="button"
                class="status-btn"
                :class="`btn-${a.tone}`"
                @click.stop="onAction(a)"
            >
                <el-icon v-if="a.icon"><component :is="a.icon" /></el-icon>{{ a.label }}
            </button>
        </div>

        <!-- 辅助操作：阻塞标记 / 取消（不会推进状态） -->
        <div v-if="flagActions.length" class="flag-actions">
            <el-tooltip
                v-for="a in flagActions"
                :key="a.key"
                :content="a.hint"
                placement="top"
                :show-after="150"
            >
                <button
                    type="button"
                    class="flag-btn"
                    :class="`flag-${a.tone}`"
                    @click.stop="onAction(a)"
                >
                    <el-icon v-if="a.icon"><component :is="a.icon" /></el-icon>{{ a.label }}
                </button>
            </el-tooltip>
        </div>
    </div>
</template>

<style scoped lang="scss">
.task-card {
    --pri: #409eff;
    --pri-soft: rgba(64, 158, 255, 0.1);

    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    background: #fff;
    border: 1px solid #e8eaef;
    border-radius: 10px;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
    overflow: hidden;
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;

    &:hover {
        border-color: var(--pri);
        box-shadow: 0 2px 4px rgba(16, 24, 40, 0.06), 0 8px 18px rgba(16, 24, 40, 0.1);
        transform: translateY(-2px);

        .card-actions {
            opacity: 1;
            transform: none;
            pointer-events: auto;
        }
    }

    // 键盘 Tab 到卡片内按钮时也显示操作，避免只能靠鼠标
    &:focus-within .card-actions {
        opacity: 1;
        transform: none;
        pointer-events: auto;
    }

    .accent {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, var(--pri), var(--pri-soft));
    }

    .card-actions {
        position: absolute;
        top: 8px;
        right: 8px;
        display: flex;
        gap: 4px;
        align-items: center;
        opacity: 0;
        transform: translateY(-3px);
        pointer-events: none;
        transition: opacity 0.18s ease, transform 0.18s ease;

        .action-sep {
            width: 1px;
            height: 12px;
            background: #e5e7eb;
        }

        .action {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            padding: 0;
            font-size: 12px;
            color: #909399;
            background: #fff;
            border: 1px solid transparent;
            border-radius: 6px;
            cursor: pointer;
            transition: color 0.12s ease, border-color 0.12s ease, background 0.12s ease;

            &:hover {
                color: var(--pri);
                border-color: var(--pri-soft);
                background: var(--pri-soft);
            }

            &.action-danger:hover {
                color: #f56c6c;
                border-color: rgba(245, 108, 108, 0.15);
                background: rgba(245, 108, 108, 0.08);
            }
        }
    }

    .title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
        font-weight: 600;
        color: #1f2430;
        margin: 0;
        padding-right: 40px;
        line-height: 1.4;

        // 优先级用文字标签表达，避免与「轻 / 缓 / 急 / 逾」的日期徽标混淆
        .prio-tag {
            flex-shrink: 0;
            padding: 1px 6px;
            font-size: 10px;
            font-weight: 700;
            line-height: 1.5;
            color: var(--pri);
            background: var(--pri-soft);
            border-radius: 4px;
        }

        .title-text {
            min-width: 0;
        }
    }

    .desc {
        font-size: 12px;
        line-height: 1.5;
        color: #6b7280;
        margin: 0;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .reopen-note {
        display: flex;
        align-items: center;
        gap: 4px;
        margin: 0;
        padding: 4px 8px;
        font-size: 11px;
        color: #b45309;
        background: #fffbeb;
        border-radius: 6px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .blocked-note {
        display: flex;
        align-items: center;
        gap: 4px;
        margin: 0;
        padding: 4px 8px;
        font-size: 11px;
        color: #be123c;
        background: #fff1f2;
        border-radius: 6px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .canceled-note {
        margin: 0;
        padding: 4px 8px;
        font-size: 11px;
        color: #6b7280;
        background: #f3f4f6;
        border-radius: 6px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .deps-note {
        display: flex;
        align-items: center;
        gap: 4px;
        margin: 0;
        padding: 4px 8px;
        font-size: 11px;
        color: #64748b;
        background: #f8fafc;
        border-radius: 6px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        &.deps-pending {
            color: #b45309;
            background: #fffbeb;
        }
    }

    .card-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        margin-top: 4px;
    }

    .assignee {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;

        .avatar {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            flex-shrink: 0;
            font-size: 12px;
            font-weight: 600;
            color: #fff;
            // 头像只代表人，不再随优先级变色
            background: linear-gradient(135deg, #64748b, #94a3b8);
            border-radius: 50%;
        }

        .name {
            font-size: 12px;
            color: #4b5563;
            max-width: 80px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    }

    .unassigned {
        font-size: 12px;
        color: #9ca3af;
        font-style: italic;
    }

    // 右侧一组：演示用「谁在看」+ 截止日期
    .foot-right {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
    }

    .due {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 11px;
        color: #9ca3af;
        flex-shrink: 0;
        font-variant-numeric: tabular-nums;
    }

    // 状态推进按钮组 —— 卡片级动作
    .status-actions {
        display: flex;
        gap: 6px;
        margin-top: 4px;
        padding-top: 8px;
        border-top: 1px dashed #eceff4;

        .status-btn {
            flex: 1;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 3px;
            padding: 5px 6px;
            font-size: 12px;
            font-weight: 500;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            transition: filter 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;

            &:hover {
                filter: brightness(0.95);
                transform: translateY(-1px);
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
            }

            &:active {
                transform: translateY(0);
            }

            &.btn-primary {
                color: #fff;
                background: var(--pri);
            }

            &.btn-success {
                color: #fff;
                background: linear-gradient(135deg, #67c23a, #85ce61);
            }

            &.btn-warning {
                color: #fff;
                background: linear-gradient(135deg, #e6a23c, #ebb563);
            }

            &.btn-info {
                color: #475569;
                background: #f1f5f9;
                border: 1px solid #e2e8f0;
            }
        }
    }

    // 辅助操作：阻塞 / 取消（明确的按钮样式，但比主操作轻）
    .flag-actions {
        display: flex;
        gap: 6px;
        margin-top: -2px;
        flex-wrap: wrap;

        .flag-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            padding: 4px 10px;
            font-size: 12px;
            font-weight: 500;
            color: #475569;
            background: #fff;
            border: 1px solid #dfe3ea;
            border-radius: 6px;
            box-shadow: 0 1px 1px rgba(16, 24, 40, 0.03);
            cursor: pointer;
            transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease,
                box-shadow 0.15s ease, transform 0.15s ease;

            .el-icon {
                font-size: 13px;
            }

            &.flag-warning {
                color: #b45309;
                border-color: #fcd34d;
                background: #fffdf5;
            }

            &.flag-danger {
                color: #b91c1c;
                border-color: #fca5a5;
            }

            &.flag-info {
                color: #0369a1;
                border-color: #7dd3fc;
                background: #f7fdff;
            }

            &:hover {
                transform: translateY(-1px);
                box-shadow: 0 2px 8px rgba(15, 23, 42, 0.1);
            }

            &.flag-warning:hover { background: #fffbeb; }
            &.flag-danger:hover { background: #fef2f2; }
            &.flag-info:hover { background: #f0f9ff; }

            &:active {
                transform: translateY(0);
            }
        }
    }
}

.pri-high {
    --pri: #f43f5e;
    --pri-soft: rgba(244, 63, 94, 0.1);
}

.pri-medium {
    --pri: #409eff;
    --pri-soft: rgba(64, 158, 255, 0.1);
}

.pri-low {
    --pri: #64748b;
    --pri-soft: rgba(100, 116, 139, 0.12);
}

// 阻塞：红边 + 左侧强调，一眼可见但不改变泳道
.task-card.is-blocked {
    border-color: #fecdd3;
    background: linear-gradient(180deg, #fff8f9 0%, #fff 55%);
}

// 从「我的任务」定位过来：亮蓝描边 + 光晕脉冲，2.6 秒后由父组件撤掉
.task-card.is-located {
    border-color: #409eff;
    box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.22), 0 12px 28px -14px rgba(64, 158, 255, 0.75);
    animation: located-pulse 1.15s ease-in-out 2;
}

@keyframes located-pulse {
    0%, 100% { box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.22), 0 12px 28px -14px rgba(64, 158, 255, 0.75); }
    50% { box-shadow: 0 0 0 7px rgba(64, 158, 255, 0.1), 0 12px 28px -14px rgba(64, 158, 255, 0.75); }
}

.task-card.is-canceled {
    opacity: 0.72;
    filter: grayscale(0.4);

    .accent {
        background: #c7cdd6;
    }
}

@media (prefers-reduced-motion: reduce) {

    .task-card,
    .task-card * {
        transition: none !important;
    }

    .task-card:hover {
        transform: none;
    }

    .task-card.is-located {
        animation: none;
    }
}
</style>
