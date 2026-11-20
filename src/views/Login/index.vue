<script setup>
import { ref, reactive } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { ElMessage } from 'element-plus'

const userStore = useUserStore()

const loading = ref(false)
const form = reactive({
  username: 'admin',
  password: 'admin'
})

const credentials = [
  { username: 'admin',  password: 'admin',  label: 'admin / admin',  desc: '老板（admin）' },
  { username: 'pm',     password: 'pm',     label: 'pm / pm',         desc: '张经理（pm）' },
  { username: 'member', password: 'member', label: 'member / member', desc: '李员工（member）' }
]

const fillCredentials = (c) => {
  form.username = c.username
  form.password = c.password
}

const handleLogin = async () => {
  if (!form.username.trim()) {
    ElMessage.warning('请输入账号')
    return
  }
  if (!form.password.trim()) {
    ElMessage.warning('请输入密码')
    return
  }
  loading.value = true
  try {
    await userStore.login(form.username.trim(), form.password.trim())
  } catch (error) {
    ElMessage.error(error.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
    <div class="login-page">
        <div class="login-bg"></div>
        <div class="login-glass">
            <div class="login-card">
                <header class="login-header">
                    <div class="logo">
                        <svg viewBox="0 0 48 48" fill="none">
                            <rect x="4" y="4" width="18" height="18" rx="4" fill="currentColor" />
                            <rect x="26" y="4" width="18" height="18" rx="4" fill="currentColor" opacity="0.6" />
                            <rect x="4" y="26" width="18" height="18" rx="4" fill="currentColor" opacity="0.6" />
                            <rect x="26" y="26" width="18" height="18" rx="4" fill="currentColor" opacity="0.3" />
                        </svg>
                    </div>
                    <h1>PMS 项目管理系统</h1>
                    <p>登录后开始管理你的项目、任务和团队</p>
                </header>

                <form class="login-form" @submit.prevent="handleLogin">
                    <div class="form-item">
                        <label>账号</label>
                        <input
                            v-model="form.username"
                            type="text"
                            placeholder="请输入账号"
                            autocomplete="username"
                            :disabled="loading"
                        />
                    </div>
                    <div class="form-item">
                        <label>密码</label>
                        <input
                            v-model="form.password"
                            type="password"
                            placeholder="请输入密码"
                            autocomplete="current-password"
                            :disabled="loading"
                            @keyup.enter="handleLogin"
                        />
                    </div>
                    <button type="submit" class="login-btn" :disabled="loading">
                        <span v-if="loading">登录中…</span>
                        <span v-else>登 录</span>
                    </button>
                </form>

                <div class="quick-access">
                    <div class="qa-title">测试账号（点击自动填入）</div>
                    <div class="qa-list">
                        <button
                            v-for="c in credentials"
                            :key="c.username"
                            type="button"
                            class="qa-btn"
                            @click="fillCredentials(c)"
                        >
                            <span class="qa-label">{{ c.label }}</span>
                            <span class="qa-desc">{{ c.desc }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.login-page {
    position: relative;
    min-height: 100vh;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;

    .login-bg {
        position: absolute;
        inset: 0;
        background:
            radial-gradient(1200px 600px at 20% 10%, rgba(64, 158, 255, 0.25), transparent 60%),
            radial-gradient(900px 500px at 80% 85%, rgba(244, 63, 94, 0.2), transparent 55%),
            radial-gradient(700px 400px at 60% 30%, rgba(103, 194, 58, 0.15), transparent 50%),
            linear-gradient(135deg, #0f172a, #1e293b 50%, #0f172a);
        z-index: 0;
    }

    .login-glass {
        position: relative;
        z-index: 1;
        width: 420px;
        max-width: calc(100vw - 32px);
        padding: 40px 36px;
        background: rgba(255, 255, 255, 0.92);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        border-radius: 20px;
        box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.4),
            0 30px 60px -15px rgba(0, 0, 0, 0.4);
    }

    .login-header {
        text-align: center;
        margin-bottom: 28px;

        .logo {
            width: 56px;
            height: 56px;
            margin: 0 auto 14px;
            color: #409eff;
            display: flex;
            align-items: center;
            justify-content: center;

            svg {
                width: 100%;
                height: 100%;
            }
        }

        h1 {
            font-size: 22px;
            font-weight: 700;
            color: #0f172a;
            margin: 0 0 6px;
            letter-spacing: -0.3px;
        }

        p {
            font-size: 13px;
            color: #64748b;
            margin: 0;
        }
    }

    .login-form {
        display: flex;
        flex-direction: column;
        gap: 14px;

        .form-item {
            display: flex;
            flex-direction: column;
            gap: 6px;

            label {
                font-size: 12px;
                font-weight: 500;
                color: #475569;
            }

            input {
                height: 42px;
                padding: 0 14px;
                font-size: 14px;
                color: #0f172a;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                outline: none;
                transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;

                &::placeholder {
                    color: #94a3b8;
                }

                &:focus {
                    border-color: #409eff;
                    background: #fff;
                    box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.12);
                }

                &:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
            }
        }

        .login-btn {
            height: 44px;
            margin-top: 6px;
            font-size: 15px;
            font-weight: 600;
            color: #fff;
            background: linear-gradient(135deg, #409eff, #2a7dff);
            border: none;
            border-radius: 10px;
            cursor: pointer;
            transition: filter 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;

            &:hover:not(:disabled) {
                filter: brightness(1.05);
                box-shadow: 0 6px 20px rgba(64, 158, 255, 0.35);
            }

            &:active:not(:disabled) {
                transform: translateY(1px);
            }

            &:disabled {
                opacity: 0.7;
                cursor: not-allowed;
            }
        }
    }

    .quick-access {
        margin-top: 22px;
        padding-top: 20px;
        border-top: 1px dashed #e2e8f0;

        .qa-title {
            font-size: 12px;
            color: #94a3b8;
            margin-bottom: 10px;
            text-align: center;
        }

        .qa-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .qa-btn {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            padding: 9px 12px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            cursor: pointer;
            transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
            font-family: inherit;

            &:hover {
                border-color: #409eff;
                background: #eff6ff;
                transform: translateY(-1px);
            }

            &:active {
                transform: translateY(0);
            }

            .qa-label {
                font-size: 13px;
                font-weight: 500;
                color: #0f172a;
                font-variant-numeric: tabular-nums;
            }

            .qa-desc {
                font-size: 11px;
                color: #64748b;
            }
        }
    }
}

@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        transition: none !important;
    }
}
</style>
