/* ========================= FILE: .\js\components\common\AuthModal.js ========================= */

/**
 * 波幅探长 - 纯微信免密直登专属弹窗（彻底杜绝加载卡死版）
 * js/components/common/AuthModal.js
 */
import { store } from "../../store.js";
import { authApi } from "../../api/auth.js";
import { request } from "../../api/http.js";

const { reactive, computed, onMounted, watch, ref } = Vue;

const STORAGE_NICKNAME_KEY = "bofutz_last_nickname";

// 【关键保底】如果你后台拿不到，直接使用这个固定的公众号二维码链接（请把这里换成你的 R2 或图床二维码直链）
const FALLBACK_QR_URL = "https://pub-973330e118204686a625fe51431d4336.r2.dev/gzh_qr.png";

export default {
  name: "AuthModal",
  setup() {
    const loading = ref(false);
    const dynamicQr = ref("");

    const wechatForm = reactive({
      verifyCode: "bofutz",
      nickname: "",
      refCode: "",
    });

    const settings = computed(() => store.state.publicSettings || {});

    // 主动拉取配置，全面兼容各种可能的字段嵌套
    const fetchQrDirectly = async () => {
      try {
        const res = await request("/api/public-settings");
        // 兼容 res.settings, res.data, res 本身
        const d = res?.settings || res?.data || res || {};
        const url = d.gzh_qr_url || d.wechat_qr_url || d.tip_wechat_qr_url || "";
        if (url && typeof url === "string") {
          dynamicQr.value = url.trim();
        }
      } catch (e) {
        console.warn("二维码拉取使用兜底配置", e);
      }
    };

    // 最终展示的二维码：后端拉取 > store 缓存 > 静态保底 URL
    const gzhQrCode = computed(() => {
      const s = settings.value || {};
      const target = dynamicQr.value || s.gzh_qr_url || s.wechat_qr_url || s.tip_wechat_qr_url || FALLBACK_QR_URL;
      return String(target || "").trim();
    });

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

    const loadLocalNickname = () => {
      try {
        const saved = localStorage.getItem(STORAGE_NICKNAME_KEY);
        if (saved && !wechatForm.nickname) {
          wechatForm.nickname = saved.trim();
        }
      } catch (_) {}
    };

    const closeModal = () => {
      store.state.authModalVisible = false;
    };

    const submitWechatLogin = async () => {
      const code = wechatForm.verifyCode.trim();
      const nickname = wechatForm.nickname.trim();

      if (!/^[a-zA-Z0-9]{4,12}$/.test(code)) {
        store.showToast("请输入正确的公众号口令（如 bofutz）", "error");
        return;
      }
      if (!nickname) {
        store.showToast("请设置您的专属昵称（微信名或代号）", "error");
        return;
      }
      if (nickname.length < 2 || nickname.length > 20) {
        store.showToast("昵称长度建议在 2~20 个字符之间", "error");
        return;
      }

      loading.value = true;
      try {
        const res = await authApi.wechatLogin({
          code,
          nickname,
          refCode: wechatForm.refCode,
        });

        const data = res.data || res;
        try {
          localStorage.setItem(STORAGE_NICKNAME_KEY, nickname);
        } catch (_) {}

        store.setUserState({
          token: data.token,
          username: data.username || nickname,
          referralCode: data.referral_code,
          vipDaysLeft: data.shared_vip_days ?? data.vip_days_left ?? 3,
          vipLevel: data.vip_level ?? 0,
        });

        store.showToast(`欢迎，${data.username || nickname}！VIP 体验期已激活`);
        closeModal();
      } catch (err) {
        store.showToast(err.message || "登录失败，请检查口令", "error");
      } finally {
        loading.value = false;
      }
    };

    onMounted(() => {
      extractRefFromUrl();
      loadLocalNickname();
      fetchQrDirectly();
    });

    watch(
      () => store.state.authModalVisible,
      (visible) => {
        if (visible) {
          extractRefFromUrl();
          loadLocalNickname();
          fetchQrDirectly();
          if (!wechatForm.verifyCode) wechatForm.verifyCode = "bofutz";
        }
      }
    );

    return {
      store: store.state,
      wechatForm,
      gzhQrCode,
      loading,
      closeModal,
      submitWechatLogin,
    };
  },
  template: `
    <div v-if="store.authModalVisible" class="fixed inset-0 modal-overlay z-[200] flex items-center justify-center p-4" @click.self="closeModal">
      <div class="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative">
        <button type="button" @click="closeModal" class="absolute top-3 right-3 text-slate-400 hover:text-slate-600 z-10 p-1">
          <i class="fa-solid fa-xmark text-lg"></i>
        </button>

        <div class="px-6 pt-5 pb-2 text-center border-b border-slate-50">
          <div class="text-base font-bold text-slate-800 flex items-center justify-center gap-1.5">
            <i class="fa-brands fa-weixin text-emerald-500 text-lg"></i> 微信免密快捷开户
          </div>
        </div>

        <div class="p-6 space-y-4 text-center">
          <div class="bg-emerald-50 text-emerald-700 text-xs p-2.5 rounded-lg border border-emerald-100 leading-relaxed text-left">
            🎁 关注公众号获取口令，设置昵称即送 <strong>3 天 VIP 体验</strong>！
          </div>

          <div class="flex flex-col items-center">
            <div class="w-36 h-36 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-1.5 flex items-center justify-center relative overflow-hidden">
              <img :src="gzhQrCode" class="w-full h-full object-contain rounded-lg relative z-10" alt="公众号二维码"
                   @error="$event.target.src='https://pub-973330e118204686a625fe51431d4336.r2.dev/gzh_qr.png'">
            </div>
            <p class="text-[11px] text-slate-500 mt-2 leading-relaxed">
              微信扫一扫关注公众号，回复【<strong class="theme-text">666</strong>】或【<strong class="theme-text">登录</strong>】获取口令
            </p>
          </div>

          <div class="space-y-2.5 text-left">
            <div>
              <label class="text-[11px] font-bold text-slate-600 block mb-1">专属昵称（您的微信号/炒股代号，跨设备登录唯一标识）</label>
              <input v-model="wechatForm.nickname" type="text" maxlength="20" placeholder="例如：波段小李、TomQuant"
                     class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:theme-border outline-none">
            </div>

            <div>
              <label class="text-[11px] font-bold text-slate-600 block mb-1">公众号口令</label>
              <input v-model="wechatForm.verifyCode" type="text" maxlength="12" placeholder="公众号回复的口令（如 bofutz）"
                     class="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm uppercase text-center tracking-widest focus:theme-border outline-none">
            </div>

            <div>
              <input v-model="wechatForm.refCode" type="text" placeholder="邀请码（选填，立领更多权益）"
                     class="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono uppercase text-center focus:theme-border outline-none">
            </div>
          </div>

          <button type="button" @click="submitWechatLogin" :disabled="loading || !wechatForm.nickname || !wechatForm.verifyCode"
                  class="w-full theme-bg text-white py-2.5 rounded-lg text-sm font-bold shadow-sm disabled:opacity-50 hover:opacity-90">
            {{ loading ? '进入中...' : '确认进入系统' }}
          </button>
        </div>
      </div>
    </div>
  `,
};
