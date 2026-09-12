/* ========================= FILE: .\js\components\common\AuthModal.js ========================= */

/**
 * 波幅探长 - 认证与注册弹窗（微信公众号口令直登优化版）
 * 1. 默认展示微信免密直登，支持输入专属品牌口令 bofutz
 * 2. 自动从 URL 提取 ?ref= 邀请参数
 * 3. 保留传统账号密码登录备用
 */
import { store } from "../../store.js";
import { authApi } from "../../api/auth.js";

const { ref, reactive, computed, onMounted, watch } = Vue;

export default {
  name: "AuthModal",
  setup() {
    const loading = ref(false);
    // 选项卡：wechat (微信公众号免密) | password (传统账密)
    const authTab = ref("wechat");

    const wechatForm = reactive({
      verifyCode: "",
      refCode: "",
    });

    const pwdForm = reactive({
      username: "",
      password: "",
    });

    const settings = computed(() => store.state.publicSettings || {});

    // 公众号关注二维码直链（优先从后台配置中获取）
    const gzhQrCode = computed(() => {
      const u = settings.value.gzh_qr_url || settings.value.wechat_qr_url || "";
      return String(u).trim();
    });

    // 自动抓取 URL 中的邀请码 (?ref=BOFUTZ-001)
    const extractRefFromUrl = () => {
      try {
        const query = window.location.search || window.location.hash.split("?")[1];
        if (query) {
          const urlParams = new URLSearchParams(query);
          const refCode = urlParams.get("ref") || urlParams.get("invite");
          if (refCode) {
            wechatForm.refCode = refCode.trim().toUpperCase();
          }
        }
      } catch (_) {}
    };

    const closeModal = () => {
      store.state.authModalVisible = false;
    };

    // 提交微信口令免密直登 / 静默注册
    const submitWechatLogin = async () => {
      const code = wechatForm.verifyCode.trim();
      // 支持 4~12 位英文与数字（支持 bofutz 口令）
      if (!/^[a-zA-Z0-9]{4,12}$/.test(code)) {
        store.showToast("请输入正确的公众号口令（如 bofutz）", "error");
        return;
      }

      loading.value = true;
      try {
        const res = await authApi.wechatLogin({
          code,
          refCode: wechatForm.refCode,
        });

        const data = res.data || res;
        store.setUserState({
          token: data.token,
          username: data.username || `wx_${code.toLowerCase()}`,
          referralCode: data.referral_code,
          vipDaysLeft: data.shared_vip_days ?? data.vip_days_left ?? 3,
          vipLevel: data.vip_level ?? 0,
        });

        store.showToast("登录成功，已为您开通 3 天 VIP 体验！");
        closeModal();
      } catch (err) {
        store.showToast(err.message || "口令校验失败，请核对公众号回复", "error");
      } finally {
        loading.value = false;
      }
    };

    // 传统账号密码登录（备用）
    const submitPwdLogin = async () => {
      if (!pwdForm.username || !pwdForm.password) {
        store.showToast("请输入账号与密码", "error");
        return;
      }
      loading.value = true;
      try {
        const data = await authApi.login(pwdForm.username, pwdForm.password);
        store.setUserState({
          token: data.token,
          username: pwdForm.username.trim(),
          referralCode: data.referral_code,
          vipDaysLeft: data.shared_vip_days ?? data.vip_days_left ?? 0,
          vipLevel: data.vip_level ?? 0,
        });
        store.showToast("登录成功");
        closeModal();
      } catch (err) {
        store.showToast(err.message || "登录失败", "error");
      } finally {
        loading.value = false;
      }
    };

    onMounted(() => {
      extractRefFromUrl();
    });

    watch(
      () => store.state.authModalVisible,
      (visible) => {
        if (visible) {
          extractRefFromUrl();
          wechatForm.verifyCode = "";
          authTab.value = "wechat"; // 确保每次弹窗默认进入微信免密
        }
      }
    );

    return {
      store: store.state,
      settings,
      authTab,
      wechatForm,
      pwdForm,
      gzhQrCode,
      loading,
      closeModal,
      submitWechatLogin,
      submitPwdLogin,
    };
  },
  template: `
    <div v-if="store.authModalVisible" class="fixed inset-0 modal-overlay z-[200] flex items-center justify-center p-4" @click.self="closeModal">
      <div class="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative">
        <button type="button" @click="closeModal" class="absolute top-3 right-3 text-slate-400 hover:text-slate-600 z-10 p-1">
          <i class="fa-solid fa-xmark text-lg"></i>
        </button>

        <div class="flex border-b border-slate-100">
          <button type="button" @click="authTab='wechat'" class="flex-1 py-3.5 text-sm font-bold transition-colors"
                  :class="authTab==='wechat' ? 'theme-text border-b-2 theme-border' : 'text-slate-400'">
            <i class="fa-brands fa-weixin text-emerald-500 mr-1 text-base"></i> 微信免密直登
          </button>
          <button type="button" @click="authTab='password'" class="flex-1 py-3.5 text-sm font-medium transition-colors"
                  :class="authTab==='password' ? 'theme-text border-b-2 theme-border' : 'text-slate-400'">
            账号密码登录
          </button>
        </div>

        <!-- 方案 A：微信公众号口令直登 -->
        <div v-if="authTab==='wechat'" class="p-6 space-y-4 text-center">
          <div class="bg-emerald-50 text-emerald-700 text-xs p-2.5 rounded-lg border border-emerald-100 leading-relaxed">
            🎁 微信免密快捷登录，新用户自动注册并<strong>获赠 3 天 VIP 体验</strong>！
          </div>

          <div class="flex flex-col items-center">
            <div class="w-40 h-40 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-2 flex items-center justify-center">
              <img v-if="gzhQrCode" :src="gzhQrCode" class="w-full h-full object-contain rounded-lg" alt="公众号二维码">
              <div v-else class="text-xs text-slate-400 text-center">
                <i class="fa-solid fa-qrcode text-3xl mb-1 text-slate-300"></i>
                <p>请在后台配置公众号二维码</p>
              </div>
            </div>
            <p class="text-xs text-slate-500 mt-2 font-medium leading-relaxed">
              1. 微信扫一扫上方二维码，关注公众号<br>
              2. 打开“私信”，点击左下方点击输入框<br>
              3. 回复数字<strong class="theme-text text-sm">666</strong>或「<strong>登录</strong>」获取口令
            </p>
          </div>

          <div class="space-y-2">
            <input v-model="wechatForm.verifyCode" type="text" maxlength="12" placeholder="在此输入口令（如 bofutz）"
                   class="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-center font-mono text-base font-bold tracking-widest focus:theme-border outline-none">

            <input v-model="wechatForm.refCode" type="text" placeholder="邀请码（选填，立领更多权益）"
                   class="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono uppercase text-center focus:theme-border outline-none">
          </div>

          <button type="button" @click="submitWechatLogin" :disabled="loading || !wechatForm.verifyCode"
                  class="w-full theme-bg text-white py-2.5 rounded-lg text-sm font-bold shadow-sm disabled:opacity-50 hover:opacity-90">
            {{ loading ? '校验中...' : '确认登录 / 自动注册' }}
          </button>
        </div>

        <!-- 传统账号密码登录（备用） -->
        <div v-else class="p-6 space-y-3.5">
          <input v-model="pwdForm.username" type="text" placeholder="注册账号"
                 class="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">
          <input v-model="pwdForm.password" type="password" placeholder="登录密码"
                 class="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">

          <button type="button" @click="submitPwdLogin" :disabled="loading"
                  class="w-full theme-bg text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-50 hover:opacity-90 flex justify-center items-center">
            {{ loading ? '登录中...' : '立即登录' }}
          </button>
        </div>
      </div>
    </div>
  `,
};
