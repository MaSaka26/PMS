// api/userAPI.js
import request from './request'

// 登录
export function login(data){
    return request({
        url:'/login',
        method:'post',
        data
    })
}

// 获取用户信息
export function getInfo(){
    return request({
        url:'/info',
        method:'get'
    })
}

// 获取用户列表
export function getUserList(params){
    return request({
        url:'/api/user/list',
        method:'get',
        params
    })
}

// 新增用户
export function createUser(data){
    return request({
        url:'/api/user',
        method:'post',
        data
    })
}

// 编辑用户
export function updateUser(id, data){
    return request({
        url:'/api/user/edit',
        method:'put',
        params: { id },
        data
    })
}

// 删除用户
export function deleteUser(id){
    return request({
        url:'/api/user/delete',
        method:'delete',
        params: { id }
    })
}