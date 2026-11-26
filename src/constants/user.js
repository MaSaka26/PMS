// 全局身份只有三种；role 是全局身份，PM 是项目内授权（见 utils/permissions.js）
export const ROLE = {
    ADMIN: 'admin',
    PM: 'pm',
    MEMBER: 'member',
}

export const ROLES = Object.values(ROLE)

// 登录态在 localStorage 中的键名；前端与 mock 共用
export const TOKEN_KEY = 'pm_token'
