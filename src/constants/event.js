// 事件类型 → 展示元信息（时间线用）
// tone 决定时间线圆点和文字颜色：primary 推进 / success 完成 / warning 回退或阻塞 / danger 取消 / neutral 记录
export const EVENT_META = {
  created:        { label: '创建了任务', tone: 'neutral', icon: 'Document' },
  claimed:        { label: '认领了任务', tone: 'primary', icon: 'User' },
  assigned:       { label: '指派了任务', tone: 'primary', icon: 'User' },
  submitted:      { label: '提交了验收', tone: 'primary', icon: 'Check' },
  accepted:       { label: '验收通过',   tone: 'success', icon: 'CircleCheck' },
  rejected:       { label: '驳回',       tone: 'warning', icon: 'RefreshLeft' },
  reopened:       { label: '重开任务',   tone: 'warning', icon: 'RefreshLeft' },
  blocked:        { label: '标记阻塞',   tone: 'warning', icon: 'WarningFilled' },
  unblocked:      { label: '解除阻塞',   tone: 'success', icon: 'CircleCheck' },
  canceled:       { label: '取消任务',   tone: 'danger',  icon: 'CircleClose' },
  restored:       { label: '恢复任务',   tone: 'primary', icon: 'RefreshLeft' },
  edited:         { label: '编辑任务',   tone: 'neutral', icon: 'Edit' },
  deleted:        { label: '删除任务',   tone: 'danger',  icon: 'Delete' },
  status_changed: { label: '状态变更',   tone: 'neutral', icon: 'Sort' },
  project_status:   { label: '项目阶段推进', tone: 'primary', icon: 'Sort' },
  project_closed:   { label: '关闭了项目', tone: 'danger',  icon: 'SwitchButton' },
  project_reopened: { label: '撤销归档',   tone: 'primary', icon: 'RefreshLeft' },
  pm_changed:       { label: '负责人交接', tone: 'warning', icon: 'SwitchButton' },
}

export const getEventMeta = (type) =>
  EVENT_META[type] || { label: '状态变更', tone: 'neutral', icon: 'Sort' }
