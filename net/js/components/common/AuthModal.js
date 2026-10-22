/**
 * 波幅探长 - 邮箱登录 / 注册 / 邮箱验证码找回密码弹窗
 * 1. 注册和登录界面均明确提示使用电子邮箱注册和登录
 * 2. 注册按钮与文案统一为“注册”
 * 3. 找回密码流程：输入注册邮箱 -> 输入邮箱验证码 -> 重新输入密码
 */
import { store } from "../../store.js";
import { authApi } from "../../api/auth.js";
import { CONFIG } from "../../config.js";

const { ref, reactive, nextTick, watch } = Vue;

export default {
  name: "AuthModal",
  setup() {
    const loading = ref(false);
    const sendCodeLoading = ref(false);
    const countdown = ref(0);

    const form = reactive({
      username: "",
      nickname: "",
      password: "",
      emailCode: "",
      turnstileToken: "",
    });

    const resetLoading = ref(false);
    const resetCodeLoading = ref(false);
    const resetCountdown = ref(0);
    const resetForm = reactive({
      email: "",
      emailCode: "",
      newPassword: "",
      turnstileToken: "",
    });

    const closeModal = () => {
      store.state.authModalVisible = false;
    };

    const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());

    const renderTurnstile = (mode) => {
      nextTick(() => {
        setTimeout(() => {
          const containerId =
            mode === "forgot" ? "#turnstile-reset-container" : "#turnstile-container";
          const container = document.querySelector(containerId);
          if (container && window.turnstile) {
            container.innerHTML = "";
            try {
              window.turnstile.render(containerId, {
                sitekey: CONFIG.TURNSTILE_SITEKEY,
                callback: (token) => {
                  if (mode === "forgot") resetForm.turnstileToken = token;
                  else form.turnstileToken = token;
                },
                "expired-callback": () => {
                  if (mode === "forgot") resetForm.turnstileToken = "";
                  else form.turnstileToken = "";
                },
              });
            } catch (e) {
              console.error("Turnstile render error:", e);
            }
          }
        }, 150);
      });
    };

    const switchMode = (mode) => {
      store.state.authMode = mode;
      form.password = "";
      form.emailCode = "";
      form.turnstileToken = "";
      if (mode === "register") renderTurnstile("register");
      if (mode === "forgot") {
        resetForm.email = isEmail(form.username) ? form.username.trim() : resetForm.email;
        resetForm.emailCode = "";
        resetForm.newPassword = "";
        resetForm.turnstileToken = "";
        renderTurnstile("forgot");
      }
    };

    const openForgot = () => {
      switchMode("forgot");
    };

    const sendEmailCode = async () => {
      if (!isEmail(form.username)) {
        store.showToast("请输入有效的注册电子邮箱", "error");
        return;
      }
      if (!form.turnstileToken) {
        store.showToast("请先完成人机安全验证", "error");
        return;
      }

      sendCodeLoading.value = true;
      try {
        const res = await authApi.sendEmailCode(form.username, form.turnstileToken, "register");
        if (res.success) {
          store.showToast(res.msg || res.message || "验证码已发送至您的邮箱");
          countdown.value = 60;
          const timer = setInterval(() => {
            countdown.value--;
            if (countdown.value <= 0) {
              clearInterval(timer);
              if (window.turnstile) {
                try {
                  window.turnstile.reset("#turnstile-container");
                } catch (_) {}
              }
            }
          }, 1000);
        } else {
          store.showToast(res.msg || res.message || "验证码发送失败", "error");
          if (window.turnstile) {
            try {
              window.turnstile.reset("#turnstile-container");
            } catch (_) {}
          }
        }
      } catch (err) {
        store.showToast(err.message || "验证码发送失败", "error");
        if (window.turnstile) {
          try {
            window.turnstile.reset("#turnstile-container");
          } catch (_) {}
        }
      } finally {
        sendCodeLoading.value = false;
      }
    };

    const sendResetEmailCode = async () => {
      if (!isEmail(resetForm.email)) {
        store.showToast("请输入有效的注册电子邮箱", "error");
        return;
      }
      if (!resetForm.turnstileToken) {
        store.showToast("请先完成人机安全验证", "error");
        return;
      }

      resetCodeLoading.value = true;
      try {
        const res = await authApi.sendEmailCode(resetForm.email, resetForm.turnstileToken, "reset");
        if (res.success) {
          store.showToast(res.msg || res.message || "验证码已发送至您的注册邮箱");
          resetCountdown.value = 60;
          const timer = setInterval(() => {
            resetCountdown.value--;
            if (resetCountdown.value <= 0) {
              clearInterval(timer);
              if (window.turnstile) {
                try {
                  window.turnstile.reset("#turnstile-reset-container");
                } catch (_) {}
              }
            }
          }, 1000);
        } else {
          store.showToast(res.msg || res.message || "验证码发送失败", "error");
          if (window.turnstile) {
            try {
              window.turnstile.reset("#turnstile-reset-container");
            } catch (_) {}
          }
        }
      } catch (err) {
        store.showToast(err.message || "验证码发送失败", "error");
        if (window.turnstile) {
          try {
            window.turnstile.reset("#turnstile-reset-container");
          } catch (_) {}
        }
      } finally {
        resetCodeLoading.value = false;
      }
    };

    const submit = async () => {
      if (!isEmail(form.username)) {
        store.showToast("请使用有效的电子邮箱地址", "error");
        return;
      }
      if (!form.password) {
        store.showToast("请输入登录密码", "error");
        return;
      }

      if (store.state.authMode === "register") {
        if (!form.emailCode || form.emailCode.trim().length !== 6) {
          store.showToast("请输入 6 位邮箱验证码", "error");
          return;
        }
        if (form.password.length < 6) {
          store.showToast("登录密码至少需要 6 位", "error");
          return;
        }
      }

      loading.value = true;
      try {
        if (store.state.authMode === "register") {
          const res = await authApi.register({
            username: form.username,
            password: form.password,
            emailCode: form.emailCode,
            nickname: form.nickname,
          });
          store.showToast(res.message || "注册成功，请使用邮箱登录");
          switchMode("login");
        } else {
          const data = await authApi.login(form.username, form.password);
          store.setUserState({
            token: data.token,
            userId: data.user_id || data.id || null,
            username: data.username || form.username.trim(),
            nickname: data.nickname || "",
          });
          store.showToast("登录成功！已为您解锁全量图表");
          closeModal();
        }
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    const confirmReset = async () => {
      if (!isEmail(resetForm.email)) {
        store.showToast("请输入有效的注册电子邮箱", "error");
        return;
      }
      if (!/^\d{6}$/.test(String(resetForm.emailCode || "").trim())) {
        store.showToast("请输入 6 位数字邮箱验证码", "error");
        return;
      }
      if (!resetForm.newPassword || String(resetForm.newPassword).length < 6) {
        store.showToast("新密码至少需要 6 位", "error");
        return;
      }

      resetLoading.value = true;
      try {
        const res = await authApi.resetPasswordByEmail({
          email: resetForm.email.trim(),
          emailCode: resetForm.emailCode.trim(),
          newPassword: resetForm.newPassword,
        });
        store.showToast(res.message || "密码重置成功，请使用新密码登录");
        form.username = resetForm.email.trim();
        form.password = "";
        switchMode("login");
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        resetLoading.value = false;
      }
    };

    watch(
      () => [store.state.authModalVisible, store.state.authMode],
      ([visible, mode]) => {
        if (visible && (mode === "register" || mode === "forgot")) {
          renderTurnstile(mode);
        }
      }
    );

    return {
      store: store.state,
      form,
      loading,
      sendCodeLoading,
      countdown,
      closeModal,
      switchMode,
      openForgot,
      sendEmailCode,
      submit,
      resetLoading,
      resetCodeLoading,
      resetCountdown,
      resetForm,
      sendResetEmailCode,
      confirmReset,
    };
  },
  template: `
    <div v-if="store.authModalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="closeModal">
      <div class="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative">
        <button type="button" @click="closeModal"
                class="absolute top-3 right-3 w-7 h-7 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center z-10">
          <i class="fa-solid fa-xmark"></i>
        </button>

        <div class="flex border-b border-slate-100">
          <template v-if="store.authMode !== 'forgot'">
            <button @click="switchMode('login')" class="flex-1 py-4 text-sm font-medium transition-colors"
                    :class="store.authMode==='login'?'theme-text border-b-2 theme-border font-bold':'text-slate-400'">登录</button>
            <button @click="switchMode('register')" class="flex-1 py-4 text-sm font-medium transition-colors"
                    :class="store.authMode==='register'?'theme-text border-b-2 theme-border font-bold':'text-slate-400'">注册</button>
          </template>
          <template v-else>
            <div class="flex-1 py-4 text-sm font-bold theme-text text-center border-b-2 theme-border">找回密码</div>
          </template>
        </div>

        <!-- 登录 / 注册界面（均提示使用电子邮箱） -->
        <div v-if="store.authMode !== 'forgot'" class="p-5 sm:p-6 space-y-3.5">
          <div class="bg-emerald-50 text-emerald-700 text-xs p-2.5 rounded-xl text-center border border-emerald-100 leading-relaxed">
            <i class="fa-solid fa-envelope-circle-check mr-1"></i>
            请使用<strong>电子邮箱</strong>{{ store.authMode === 'login' ? '登录' : '注册' }}，登录后可查看全部标的波幅数据与多周期图表
          </div>

          <input v-model="form.username" type="email"
                 :placeholder="store.authMode==='register' ? '请输入电子邮箱（用于注册与登录）' : '请输入注册电子邮箱'"
                 class="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none"
                 @keyup.enter="store.authMode==='login' && submit()">

          <div v-if="store.authMode==='register'">
            <input v-model="form.nickname" type="text" maxlength="16" placeholder="设置您的昵称（选填，如：老李）"
                   class="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">
            <p class="text-[11px] text-slate-400 mt-1">设置昵称后，您赞助的标的将在看板展示「(昵称) 赞助」</p>
          </div>

          <div v-show="store.authMode==='register'" class="flex justify-center min-h-[65px]">
            <div id="turnstile-container"></div>
          </div>

          <div v-if="store.authMode==='register'" class="flex gap-2">
            <input v-model="form.emailCode" type="text" maxlength="6" placeholder="请输入 6 位邮箱验证码"
                   class="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm font-mono">
            <button @click="sendEmailCode" type="button" :disabled="sendCodeLoading||countdown>0"
                    class="px-3 py-2 text-xs theme-bg text-white rounded-lg disabled:opacity-50 whitespace-nowrap font-bold">
              {{ countdown > 0 ? countdown + 's' : (sendCodeLoading ? '发送中...' : '获取验证码') }}
            </button>
          </div>

          <p v-if="store.authMode==='register'" class="text-[11px] text-slate-400 leading-relaxed">
            若收件箱未收到验证码，请查看邮箱的<strong class="text-slate-600">垃圾箱 / 广告邮件</strong>。
          </p>

          <input v-model="form.password" type="password" :placeholder="store.authMode==='register'?'设置登录密码（至少6位）':'请输入登录密码'"
                 class="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none"
                 @keyup.enter="submit">

          <div v-if="store.authMode==='login'" class="flex justify-between items-center text-xs pt-0.5">
            <button type="button" @click="switchMode('register')" class="theme-text font-medium hover:underline">
              还没有账号？注册
            </button>
            <button type="button" @click="openForgot" class="text-slate-400 hover:theme-text">
              忘记密码？
            </button>
          </div>

          <button @click="submit" :disabled="loading"
                  class="w-full theme-bg text-white font-bold py-2.5 rounded-lg text-sm disabled:opacity-50 hover:opacity-90 flex justify-center items-center shadow-sm">
            <i v-if="loading" class="fa-solid fa-circle-notch animate-spin mr-2"></i>
            {{ store.authMode === 'login' ? '立即登录' : '注 册' }}
          </button>
        </div>

        <!-- 找回密码界面：输入注册邮箱 -> 输入邮箱验证码 -> 重新输入密码 -->
        <div v-else class="p-5 sm:p-6 space-y-3.5">
          <div class="bg-slate-50 text-slate-600 text-xs p-2.5 rounded-xl text-center border border-slate-100 leading-relaxed">
            输入注册邮箱并验证邮箱验证码，即可重新设置登录密码
          </div>

          <input v-model="resetForm.email" type="email" placeholder="请输入注册电子邮箱"
                 class="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">

          <div class="flex justify-center min-h-[65px]">
            <div id="turnstile-reset-container"></div>
          </div>

          <div class="flex gap-2">
            <input v-model="resetForm.emailCode" type="text" maxlength="6" placeholder="请输入 6 位邮箱验证码"
                   class="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:theme-border outline-none">
            <button @click="sendResetEmailCode" type="button" :disabled="resetCodeLoading || resetCountdown > 0"
                    class="px-3 py-2 text-xs theme-bg text-white rounded-lg disabled:opacity-50 whitespace-nowrap font-bold">
              {{ resetCountdown > 0 ? resetCountdown + 's' : (resetCodeLoading ? '发送中...' : '获取验证码') }}
            </button>
          </div>

          <input v-model="resetForm.newPassword" type="password" placeholder="重新输入新密码（至少6位）"
                 class="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none"
                 @keyup.enter="confirmReset">

          <button @click="confirmReset" :disabled="resetLoading"
                  class="w-full theme-bg text-white font-bold py-2.5 rounded-lg text-sm disabled:opacity-50 hover:opacity-90 flex justify-center items-center shadow-sm">
            <i v-if="resetLoading" class="fa-solid fa-circle-notch animate-spin mr-2"></i>
            {{ resetLoading ? '提交中...' : '确认重置密码' }}
          </button>

          <button type="button" @click="switchMode('login')"
                  class="w-full text-xs text-slate-400 hover:theme-text pt-1">
            返回登录
          </button>
        </div>
      </div>
    </div>
  `,
};
