import { authors as gitAuthors } from './gitSeed.js'

export const members = [
    { id: 'u1', name: '老板', role: 'admin', position: '总经理', active: true },
    { id: 'u2', name: '张经理', role: 'pm', position: '项目经理', active: true },
    { id: 'u3', name: '李员工', role: 'member', position: '前端工程师', active: true },
    // Agent：演示用成员，当前没有分配任务，可手工派发
    { id: 'u4', name: 'Agent', role: 'member', position: 'AI 执行者', active: true },
    // 由 git log 的提交作者生成
    ...gitAuthors.map((a) => ({
        id: a.id,
        name: a.name,
        role: 'member',
        position: '开发者',
        active: true,
    })),
]

// 登录账号（密码明文，仅测试用）
export const users = [
    { id: 'u1', username: 'admin',   password: 'admin',   name: '老板',   role: 'admin' },
    { id: 'u2', username: 'pm',      password: 'pm',      name: '张经理', role: 'pm' },
    { id: 'u3', username: 'member',  password: 'member',  name: '李员工', role: 'member' },
    { id: 'u4', username: 'agent',   password: 'agent',   name: 'Agent',  role: 'member' },
]
