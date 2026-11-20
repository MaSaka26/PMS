<script setup>
import { computed, nextTick, ref, watch } from 'vue'

const ROLE_LABEL = {
    admin: '管理员',
    pm: '项目经理',
    member: '成员'
}
const ROLE_ORDER = ['admin', 'pm', 'member']
const roleLabel = (role) => ROLE_LABEL[role] || role || '成员'

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    // null 表示新增，传成员对象表示编辑
    member: { type: Object, default: null },
    // 只有管理员能改角色
    canAssignRole: { type: Boolean, default: false },
    // 只有管理员能开通登录账号 / 重置密码
    canManageAccount: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'submit'])

const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

const isEdit = computed(() => !!props.member)
const dialogTitle = computed(() => (isEdit.value ? '编辑成员' : '新增成员'))

const emptyForm = () => ({
    name: '',
    role: 'member',
    position: '',
    email: '',
    username: '',
    password: '',
    enableAccount: false
})
const form = ref(emptyForm())
const formRef = ref(null)

const hasAccount = computed(() => !!props.member?.username)
const accountActive = computed(
    () => props.canManageAccount && (form.value.enableAccount || hasAccount.value)
)

const validateUsername = (rule, value, callback) => {
    if (!accountActive.value) return callback()
    if (!String(value || '').trim()) return callback(new Error('请输入登录用户名'))
    callback()
}

const validatePassword = (rule, value, callback) => {
    if (!accountActive.value) return callback()
    const password = String(value || '')
    if (hasAccount.value) {
        if (password && password.length < 4) {
            return callback(new Error('密码至少 4 位'))
        }
        return callback()
    }
    if (!password) return callback(new Error('请输入初始密码'))
    if (password.length < 4) return callback(new Error('初始密码至少 4 位'))
    callback()
}

const rules = {
    name: [{ required: true, message: '请输入成员姓名', trigger: 'blur' }],
    role: [{ required: true, message: '请选择角色', trigger: 'change' }],
    username: [{ validator: validateUsername, trigger: 'blur' }],
    password: [{ validator: validatePassword, trigger: 'blur' }]
}

// 非管理员新增时只能选普通成员；编辑时展示原角色但不可改
const roleOptions = computed(() => {
    if (!props.canAssignRole && !isEdit.value) return ['member']
    return ROLE_ORDER
})

watch(
    () => [props.modelValue, props.member],
    ([open]) => {
        if (!open) return
        if (props.member) {
            form.value = {
                name: props.member.name || '',
                role: props.member.role || 'member',
                position: props.member.position || '',
                email: props.member.email || '',
                username: props.member.username || '',
                password: '',
                enableAccount: !!props.member.username
            }
        } else {
            form.value = emptyForm()
        }
        nextTick(() => formRef.value?.clearValidate())
    }
)

const handleConfirm = async () => {
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return
    const payload = {
        name: form.value.name.trim(),
        role: form.value.role,
        position: form.value.position.trim(),
        email: form.value.email.trim()
    }
    if (accountActive.value) {
        payload.username = form.value.username.trim()
        if (form.value.password) payload.password = form.value.password
    }
    emit('submit', payload)
}
</script>

<template>
    <el-dialog :title="dialogTitle" v-model="visible" width="440px" destroy-on-close>
        <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
            <el-form-item label="姓名" prop="name">
                <el-input v-model="form.name" placeholder="请输入姓名" maxlength="20" show-word-limit />
            </el-form-item>
            <el-form-item label="角色" prop="role">
                <el-select v-model="form.role" placeholder="请选择角色" style="width: 100%"
                    :disabled="!canAssignRole">
                    <el-option v-for="r in roleOptions" :key="r" :label="roleLabel(r)" :value="r" />
                </el-select>
                <p v-if="!canAssignRole" class="form-tip">角色由管理员分配，这里不可修改</p>
            </el-form-item>
            <el-form-item label="岗位">
                <el-input v-model="form.position" placeholder="例如：前端 / 测试 / 运营" maxlength="20"
                    show-word-limit />
                <p class="form-tip">仅用于展示，不参与权限判断</p>
            </el-form-item>
            <el-form-item label="邮箱">
                <el-input v-model="form.email" placeholder="选填" clearable />
            </el-form-item>

            <template v-if="canManageAccount">
                <el-divider content-position="left">登录账号</el-divider>
                <el-form-item v-if="!hasAccount" label="开通登录">
                    <el-checkbox v-model="form.enableAccount">为该成员创建登录账号</el-checkbox>
                </el-form-item>
                <template v-if="form.enableAccount || hasAccount">
                    <el-form-item label="用户名" prop="username">
                        <el-input v-model="form.username" :disabled="hasAccount" placeholder="用于登录"
                            maxlength="20" />
                        <p v-if="hasAccount" class="form-tip">用户名创建后不可修改</p>
                    </el-form-item>
                    <el-form-item :label="hasAccount ? '重置密码' : '初始密码'" prop="password">
                        <el-input v-model="form.password" type="password" show-password
                            :placeholder="hasAccount ? '留空则不修改' : '至少 4 位'" />
                    </el-form-item>
                </template>
                <p v-else class="form-tip">不创建账号时，该成员只用于项目分工，无法登录系统。</p>
            </template>
        </el-form>
        <template #footer>
            <el-button @click="visible = false">取消</el-button>
            <el-button type="primary" @click="handleConfirm">确定</el-button>
        </template>
    </el-dialog>
</template>

<style scoped lang="scss">
.form-tip {
    width: 100%;
    margin: 4px 0 0;
    font-size: 11px;
    line-height: 1.5;
    color: #9ca3af;
}
</style>
