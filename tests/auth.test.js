import test from 'node:test'
import assert from 'node:assert/strict'

// db.js 在模块加载时读取 localStorage，这里先提供最小实现
const storage = new Map()
globalThis.localStorage = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear()
}

const { db } = await import('../src/mock/db/index.js')
const { authenticate, getCurrentUser } = await import('../src/mock/services/auth.js')

test('停用成员无法登录，也无法通过 token 读取当前用户', () => {
    const member = db.members.find((m) => m.id === 'u3')
    member.active = false

    const login = authenticate('member', 'member')
    assert.equal(login.code, 403)
    assert.equal(login.msg, '账号已停用，请联系管理员')

    localStorage.setItem('pm_token', 'token_u3_123456')
    assert.equal(getCurrentUser(), null)

    member.active = true
    localStorage.removeItem('pm_token')
})

test('登录身份以成员表为准，且不返回密码', () => {
    const member = db.members.find((m) => m.id === 'u3')
    member.name = '李小组'
    member.role = 'pm'

    const login = authenticate('member', 'member')
    assert.equal(login.user.name, '李小组')
    assert.equal(login.user.role, 'pm')
    assert.equal(login.user.password, undefined)

    localStorage.setItem('pm_token', 'token_u3_654321')
    assert.equal(getCurrentUser().role, 'pm')

    member.name = '李员工'
    member.role = 'member'
    localStorage.removeItem('pm_token')
})

test('错误密码返回 401', () => {
    const login = authenticate('member', 'wrong-password')
    assert.equal(login.code, 401)
})

test('新增成员账号可以登录，停用后拒绝', () => {
    const member = {
        id: 'member_1',
        name: '新成员',
        role: 'member',
        position: '测试',
        active: true
    }
    const account = {
        id: 'member_1',
        username: 'newbie',
        password: 'pass1234',
        name: '新成员',
        role: 'member'
    }
    db.members.push(member)
    db.users.push(account)

    const login = authenticate('newbie', 'pass1234')
    assert.equal(login.user.name, '新成员')
    assert.equal(login.user.role, 'member')

    localStorage.setItem('pm_token', 'token_member_1_123456')
    assert.equal(getCurrentUser().id, 'member_1')

    member.active = false
    assert.equal(authenticate('newbie', 'pass1234').code, 403)
    assert.equal(getCurrentUser(), null)

    db.members = db.members.filter((m) => m.id !== 'member_1')
    db.users = db.users.filter((u) => u.id !== 'member_1')
    localStorage.removeItem('pm_token')
})
