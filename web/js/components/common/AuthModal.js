/**
 * 波幅探长 - 登录 / 免费注册 / 忘记密码弹窗 (v5.0)
 * - 移除邀请码及赠送天数逻辑
 * - 支持注册时直接设置用户名昵称（用于赞助标的展示），也可在个人中心随时修改
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

    const resetStep = ref("account");
    const resetLoading = ref(false);
    const resetForm = reactive({
      username: "",
      challengeId: "",
      questions: [],
      answers: {},
      newPassword: "",
      confirmPassword: "",
    });

    const closeModal = () => {
      store.state.authModalVisible = false;
    };

    const switchMode = (mode) => {
      store.state.authMode = mode;
      form.password = "";
      form.emailCode = "";
      form.turnstileToken = "";
      if (mode === "register") {
        renderTurnstile();
      }
      if (mode === "forgot") {
        resetStep.value = "account";
        resetForm.challengeId = "";
        resetForm.questions = [];
        resetForm.answers = {};
        resetForm.newPassword = "";
        resetForm.confirmPassword = "";
        if (!resetForm.username && form.username) {
          resetForm.username = form.username;
        }
      }
    };

    const openForgot = () => {
      resetForm.username = form.username || resetForm.username || "";
      switchMode("forgot");
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
                callback: (token) => {
                  form.turnstileToken = token;
                },
                "expired-callback": () => {
                  form.turnstileToken = "";
                },
              });
            } catch (e) {
              console.error("Turnstile render error:", e);
            }
          }
        }, 150);
      });
    };

    const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());

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
          store.showToast(res.msg || res.message || "验证码已发送至您的邮箱");
          countdown.value = 60;
          const timer = setInterval(() => {
            countdown.value--;
            if (countdown.value <= 0) {
              clearInterval(timer);
              if (window.turnstile) window.turnstile.reset("#turnstile-container");
            }
          }, 1000);
        } else {
          store.showToast(res.msg || res.message || "验证码发送失败", "error");
          if (window.turnstile) window.turnstile.reset("#turnstile-container");
        }
      } catch (err) {
        const msg = (err.message || "").toLowerCase().includes("fetch")
          ? "验证码服务暂时不可用，请检查网络或稍后重试"
          : err.message || "网络请求错误";
        store.showToast(msg, "error");
        if (window.turnstile) window.turnstile.reset("#turnstile-container");
      } finally {
        sendCodeLoading.value = false;
      }
    };

    const submit = async () => {
      if (!form.username || !form.password) {
        store.showToast("邮箱账号和密码不能为空", "error");
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
            emailCode: form.emailCode,
            nickname: form.nickname,
          });
          store.showToast(
            (res.message || "注册成功") + "！请登录并在个人中心设置安全问题"
          );
          switchMode("login");
        } else {
          const data = await authApi.login(form.username, form.password);
          store.setUserState({
            token: data.token,
            username: data.username || form.username.trim(),
            nickname: data.nickname || "",
            securitySet: data.security_set,
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

    const startReset = async () => {
      if (!String(resetForm.username || "").trim()) {
        store.showToast("请输入注册邮箱或账号", "error");
        return;
      }
      resetLoading.value = true;
      try {
        const res = await authApi.passwordResetStart(resetForm.username.trim());
        const data = res.data || res;
        resetForm.challengeId = data.challenge_id;
        resetForm.questions = data.questions || [];
        resetForm.answers = {};
        resetForm.questions.forEach((q) => {
          resetForm.answers[q.id] = "";
        });
        resetForm.newPassword = "";
        resetForm.confirmPassword = "";
        resetStep.value = "questions";
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        resetLoading.value = false;
      }
    };

    const confirmReset = async () => {
      if (!resetForm.newPassword || String(resetForm.newPassword).length < 6) {
        store.showToast("新密码至少 6 位", "error");
        return;
      }
      if (resetForm.newPassword !== resetForm.confirmPassword) {
        store.showToast("两次密码不一致", "error");
        return;
      }
      const answers = (resetForm.questions || []).map((q) => ({
        id: q.id,
        answer: resetForm.answers[q.id] || "",
      }));
      if (answers.some((a) => !String(a.answer).trim())) {
        store.showToast("请回答全部安全问题", "error");
        return;
      }

      resetLoading.value = true;
      try {
        await authApi.passwordResetConfirm({
          challengeId: resetForm.challengeId,
          answers,
          newPassword: resetForm.newPassword,
        });
        store.showToast("密码已重置，请使用新密码登录");
        form.username = resetForm.username;
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
        if (visible && mode === "register") {
          renderTurnstile();
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
      resetStep,
      resetLoading,
      resetForm,
      startReset,
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

        <!-- 顶栏切换 -->
        <div class="flex border-b border-slate-100">
          <template v-if="store.authMode !== 'forgot'">
            <button @click="switchMode('login')" class="flex-1 py-4 text-sm font-medium transition-colors"
                    :class="store.authMode==='login'?'theme-text border-b-2 theme-border font-bold':'text-slate-400'">账号登录</button>
            <button @click="switchMode('register')" class="flex-1 py-4 text-sm font-medium transition-colors"
                    :class="store.authMode==='register'?'theme-text border-b-2 theme-border font-bold':'text-slate-400'">免费注册</button>
          </template>
          <template v-else>
            <div class="flex-1 py-4 text-sm font-bold theme-text text-center border-b-2 theme-border">找回密码</div>
          </template>
        </div>

        <!-- 登录 / 注册 -->
        <div v-if="store.authMode !== 'forgot'" class="p-6 space-y-3.5">
          <div class="bg-emerald-50 text-emerald-700 text-xs p-2.5 rounded-xl text-center border border-emerald-100 leading-relaxed">
            <i class="fa-solid fa-circle-check mr-1"></i>注册登录即可<strong>免费查看全部标的波幅数据与多周期图表</strong>
          </div>

          <input v-model="form.username" type="email" :placeholder="store.authMode==='register'?'请输入注册电子邮箱':'请输入注册邮箱 / 账号'"
                 class="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none"
                 @keyup.enter="store.authMode==='login' && submit()">

          <div v-if="store.authMode==='register'">
            <input v-model="form.nickname" type="text" maxlength="16" placeholder="设置您的昵称（选填，用于赞助标的展示）"
                   class="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">
            <p class="text-[11px] text-slate-400 mt-1">设置昵称后，您赞助的标的将在数据看板展示您的昵称（注册后也可随时修改）</p>
          </div>

          <div v-show="store.authMode==='register'" class="flex justify-center min-h-[65px]">
            <div id="turnstile-container"></div>
          </div>

          <div v-if="store.authMode==='register'" class="flex gap-2">
            <input v-model="form.emailCode" type="text" maxlength="6" placeholder="6位邮箱验证码"
                   class="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm font-mono">
            <button @click="sendEmailCode" type="button" :disabled="sendCodeLoading||countdown>0"
                    class="px-3 py-2 text-xs theme-bg text-white rounded-lg disabled:opacity-50 whitespace-nowrap font-bold">
              {{ countdown > 0 ? countdown + 's' : (sendCodeLoading ? '发送中...' : '获取验证码') }}
            </button>
          </div>

          <p v-if="store.authMode==='register'" class="text-[11px] text-slate-400 leading-relaxed">
            若收件箱未收到验证码，请查看邮箱的<strong class="text-slate-600">垃圾箱 / 广告邮件</strong>。
          </p>

          <input v-model="form.password" type="password" :placeholder="store.authMode==='register'?'设置登录密码（至少6位）':'输入登录密码'"
                 class="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none"
                 @keyup.enter="submit">

          <div v-if="store.authMode==='login'" class="flex justify-between items-center text-xs pt-0.5">
            <button type="button" @click="switchMode('register')" class="theme-text font-medium hover:underline">
              还没有账号？免费注册
            </button>
            <button type="button" @click="openForgot" class="text-slate-400 hover:theme-text">
              忘记密码？
            </button>
          </div>

          <button @click="submit" :disabled="loading"
                  class="w-full theme-bg text-white font-bold py-2.5 rounded-lg text-sm disabled:opacity-50 hover:opacity-90 flex justify-center items-center shadow-sm">
            <i v-if="loading" class="fa-solid fa-circle-notch animate-spin mr-2"></i>
            {{ store.authMode === 'login' ? '立即登录' : '立即免费注册' }}
          </button>
        </div>

        <!-- 忘记密码 -->
        <div v-else class="p-6 space-y-3.5">
          <p class="text-[11px] text-slate-400 leading-relaxed text-center">
            通过您在个人中心设置的安全问题重置密码
          </p>

          <template v-if="resetStep === 'account'">
            <input v-model="resetForm.username" type="text" placeholder="请输入注册邮箱或账号"
                   class="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none"
                   @keyup.enter="startReset">
            <button @click="startReset" :disabled="resetLoading"
                    class="w-full theme-bg text-white font-bold py-2.5 rounded-lg text-sm disabled:opacity-50 hover:opacity-90 flex justify-center items-center">
              <i v-if="resetLoading" class="fa-solid fa-circle-notch animate-spin mr-2"></i>
              {{ resetLoading ? '验证中...' : '下一步' }}
            </button>
          </template>

          <template v-else-if="resetStep === 'questions'">
            <div v-for="q in resetForm.questions" :key="q.id" class="space-y-1">
              <label class="text-xs font-medium text-slate-600 block">{{ q.question }}</label>
              <input v-model="resetForm.answers[q.id]" type="text" placeholder="请输入答案"
                     class="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">
            </div>

            <div class="border-t border-slate-100 pt-3 space-y-3">
              <input v-model="resetForm.newPassword" type="password" placeholder="新密码（至少6位）"
                     class="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">
              <input v-model="resetForm.confirmPassword" type="password" placeholder="再次输入新密码"
                     class="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none"
                     @keyup.enter="confirmReset">
            </div>

            <button @click="confirmReset" :disabled="resetLoading"
                    class="w-full theme-bg text-white font-bold py-2.5 rounded-lg text-sm disabled:opacity-50 hover:opacity-90 flex justify-center items-center">
              <i v-if="resetLoading" class="fa-solid fa-circle-notch animate-spin mr-2"></i>
              {{ resetLoading ? '提交中...' : '确认重置密码' }}
            </button>
          </template>

          <button type="button" @click="switchMode('login')"
                  class="w-full text-xs text-slate-400 hover:theme-text pt-1">
            返回登录
          </button>
        </div>
      </div>
    </div>
  `,
};
