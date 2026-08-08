/**
 * 波幅探长 - 登录与注册弹窗组件
 * js/components/common/AuthModal.js
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
      password: "",
      emailCode: "",
      refCode: "",
      turnstileToken: "",
    });

    const closeModal = () => {
      store.state.authModalVisible = false;
    };

    const switchMode = (mode) => {
      store.state.authMode = mode;
      form.password = "";
      form.emailCode = "";
      form.turnstileToken = "";
      if (mode === "register") renderTurnstile();
    };

    const renderTurnstile = () => {
      nextTick(() => {
        setTimeout(() => {
          const container = document.getElementById("turnstile-container");
          if (container && window.turnstile) {
            container.innerHTML = "";
            try {
              window.turnstile.render("#turnstile-container", {
                sitekey: CONFIG.TURNSTILE_SITEKEY,
                callback: (token) => { form.turnstileToken = token; },
                "expired-callback": () => { form.turnstileToken = ""; },
              });
            } catch (e) {
              console.error("Turnstile render error:", e);
            }
          }
        }, 150);
      });
    };

    const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

    const sendEmailCode = async () => {
      if (!isEmail(form.username)) {
        store.showToast("请输入有效电子邮箱", "error");
        return;
      }
      if (!form.turnstileToken) {
        store.showToast("请先完成人机验证", "error");
        return;
      }

      sendCodeLoading.value = true;
      try {
        const res = await authApi.sendEmailCode(form.username, form.turnstileToken);
        if (res.success) {
          store.showToast(res.msg || "验证码已发送至您的邮箱");
          countdown.value = 60;
          const timer = setInterval(() => {
            countdown.value--;
            if (countdown.value <= 0) {
              clearInterval(timer);
              if (window.turnstile) window.turnstile.reset("#turnstile-container");
            }
          }, 1000);
        } else {
          store.showToast(res.msg || "验证码发送失败", "error");
          if (window.turnstile) window.turnstile.reset("#turnstile-container");
        }
      } catch (err) {
        store.showToast(err.message || "网络请求错误", "error");
        if (window.turnstile) window.turnstile.reset("#turnstile-container");
      } finally {
        sendCodeLoading.value = false;
      }
    };

    const submit = async () => {
      if (!form.username || !form.password) {
        store.showToast("账号和密码不能为空", "error");
        return;
      }

      if (store.state.authMode === "register") {
        if (!isEmail(form.username)) {
          store.showToast("请填写有效电子邮箱", "error");
          return;
        }
        if (!form.emailCode) {
          store.showToast("请输入 6 位邮箱验证码", "error");
          return;
        }
      }

      loading.value = true;
      try {
        if (store.state.authMode === "register") {
          const res = await authApi.register({
            username: form.username,
            password: form.password,
            refCode: form.refCode,
            emailCode: form.emailCode,
          });
          store.showToast(res.message || "注册成功，请登录！");
          switchMode("login");
        } else {
          const data = await authApi.login(form.username, form.password);
          store.setUserState({
            token: data.token,
            username: form.username.trim(),
            referralCode: data.referral_code,
            vipDaysLeft: data.shared_vip_days ?? data.vip_days_left ?? 0,
          });
          store.showToast("登录成功");
          closeModal();
        }
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    watch(() => store.state.authModalVisible, (visible) => {
      if (visible && store.state.authMode === "register") {
        renderTurnstile();
      }
    });

    return {
      store: store.state,
      settings: store.state.publicSettings,
      form,
      loading,
      sendCodeLoading,
      countdown,
      closeModal,
      switchMode,
      sendEmailCode,
      submit,
    };
  },
  template: `
    <div v-if="store.authModalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="closeModal">
      <div class="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div class="flex border-b border-slate-100">
          <button @click="switchMode('login')" class="flex-1 py-4 text-sm font-medium transition-colors"
                  :class="store.authMode==='login'?'theme-text border-b-2 theme-border font-bold':'text-slate-400'">账号登录</button>
          <button @click="switchMode('register')" class="flex-1 py-4 text-sm font-medium transition-colors"
                  :class="store.authMode==='register'?'theme-text border-b-2 theme-border font-bold':'text-slate-400'">免费注册</button>
        </div>

        <div class="p-6 space-y-3.5">
          <div v-if="store.authMode==='register'" class="bg-emerald-50 text-emerald-600 text-xs p-2 rounded-lg text-center border border-emerald-100">
            新注册即送通用 VIP <strong>{{ settings.gift_register_days || 1 }}</strong> 天
          </div>

          <input v-model="form.username" type="email" :placeholder="store.authMode==='register'?'注册电子邮箱':'你的注册账号'"
                 class="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">

          <div v-show="store.authMode==='register'" class="flex justify-center min-h-[65px]">
            <div id="turnstile-container"></div>
          </div>

          <div v-if="store.authMode==='register'" class="flex gap-2">
            <input v-model="form.emailCode" type="text" placeholder="6位邮箱验证码" class="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm font-mono">
            <button @click="sendEmailCode" type="button" :disabled="sendCodeLoading||countdown>0"
                    class="px-3 py-2 text-xs theme-bg text-white rounded-lg disabled:opacity-50 whitespace-nowrap">
              {{ countdown > 0 ? countdown + 's' : (sendCodeLoading ? '发送中...' : '获取验证码') }}
            </button>
          </div>

          <p v-if="store.authMode==='register'" class="text-[11px] text-slate-400 leading-relaxed">
            验证码可能被拦截，若收件箱没有，请到<strong class="text-slate-500">垃圾邮件</strong>中查看。
          </p>

          <input v-model="form.password" type="password" :placeholder="store.authMode==='register'?'设置密码(至少6位)':'输入密码'"
                 class="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">

          <input v-if="store.authMode==='register'" v-model="form.refCode" type="text" placeholder="推荐码(选填)"
                 class="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">

          <p v-if="store.authMode==='register' && form.refCode" class="text-[11px] text-slate-400">
            填写邀请码后，双方各送 VIP：邀请人 {{ settings.gift_inviter_days || 3 }} 天 · 您 {{ (Number(settings.gift_register_days)||1) + (Number(settings.gift_invitee_days)||2) }} 天（含注册赠送）
          </p>

          <button @click="submit" :disabled="loading" class="w-full theme-bg text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-50 hover:opacity-90 flex justify-center items-center">
            <i v-if="loading" class="fa-solid fa-circle-notch animate-spin mr-2"></i>
            {{ store.authMode === 'login' ? '立即登录' : '注册账号' }}
          </button>
        </div>
      </div>
    </div>
  `,
};
