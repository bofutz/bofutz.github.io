/* ========================= FILE: .\js\components\common\AuthModal.js ========================= */

/**
 * 波幅探长 - 微信公众号动态直登与全设备唯一绑定弹窗
 * js/components/common/AuthModal.js
 */
import { store } from "../../store.js";
import { authApi } from "../../api/auth.js";

const { reactive, computed, onMounted, watch, ref } = Vue;

const STORAGE_NICKNAME_KEY = "bofutz_last_nickname";
const GZH_QR_DEFAULT = "https://bofutz.github.io/webpic/gzh_qr.jpg";

export default {
  name: "AuthModal",
  setup() {
    const loading = ref(false);

    const wechatForm = reactive({
      verifyCode: "", // 必须输入公众号动态返回的 6 位验证码或专属口令
      nickname: "",   // 用户的微信/炒股专属代号
      refCode: "",
    });

    const settings = computed(() => store.state.publicSettings || {});
    const gzhQrCode = computed(() => {
      const u = settings.value.gzh_qr_url || settings.value.wechat_qr_url || GZH_QR_DEFAULT;
      return String(u).trim();
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

      if (!code) {
        store.showToast("请输入公众号发送给您的验证码/口令", "error");
        return;
      }
      if (!nickname) {
        store.showToast("请设置您的专属微信昵称", "error");
        return;
      }
      if (nickname.length < 2 || nickname.length > 20) {
        store.showToast("昵称长度需在 2~20 个字符之间", "error");
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
          localStorage.setItem(STORAGE_NICKNAME_KEY, data.username || nickname);
        } catch (_) {}

        store.setUserState({
          token: data.token,
          username: data.username || nickname,
          referralCode: data.referral_code,
          vipDaysLeft: data.shared_vip_days ?? data.vip_days_left ?? 3,
          vipLevel: data.vip_level ?? 0,
        });

        store.showToast(`验证成功！已连接微信账号：${data.username || nickname}`);
        closeModal();
      } catch (err) {
        store.showToast(err.message || "口令无效或已过期，请重新向公众号获取", "error");
      } finally {
        loading.value = false;
      }
    };

    onMounted(() => {
      extractRefFromUrl();
      loadLocalNickname();
    });

    watch(
      () => store.state.authModalVisible,
      (visible) => {
        if (visible) {
          extractRefFromUrl();
          loadLocalNickname();
          wechatForm.verifyCode = ""; // 每次打开均清空，确保安全验证
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
            <i class="fa-brands fa-weixin text-emerald-500 text-lg"></i> 微信扫码一键登录 / 注册
          </div>
        </div>

        <div class="p-6 space-y-4 text-center">
          <div class="bg-emerald-50 text-emerald-700 text-xs p-2.5 rounded-lg border border-emerald-100 leading-relaxed text-left">
            🎁 微信扫码直连，全设备数据实时同步，初次体验即送 <strong>3 天 VIP 时长</strong>！
          </div>

          <div class="flex flex-col items-center">
            <div class="w-36 h-36 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-1.5 flex items-center justify-center relative overflow-hidden">
              <img :src="gzhQrCode" class="w-full h-full object-contain rounded-lg relative z-10" alt="公众号二维码"
                   @error="$event.target.src='https://bofutz.github.io/gzh_qr.jpg'">
            </div>
            <p class="text-[11px] text-slate-500 mt-2 leading-relaxed">
              微信扫码关注公众号，回复【<strong class="theme-text">666</strong>】或【<strong class="theme-text">登录</strong>】获取专属验证码
            </p>
          </div>

          <div class="space-y-2.5 text-left">
            <div>
              <label class="text-[11px] font-bold text-slate-600 block mb-1">专属昵称（与微信号绑定，全设备通用）</label>
              <input v-model="wechatForm.nickname" type="text" maxlength="20" placeholder="例如：波段老李"
                     class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:theme-border outline-none">
            </div>

            <div>
              <label class="text-[11px] font-bold text-slate-600 block mb-1">公众号返回的动态验证码 / 口令</label>
              <input v-model="wechatForm.verifyCode" type="text" maxlength="12" placeholder="请输入公众号返回的验证码"
                     class="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm uppercase text-center tracking-widest focus:theme-border outline-none">
            </div>

            <div>
              <input v-model="wechatForm.refCode" type="text" placeholder="邀请码（选填，立领更多加赠天数）"
                     class="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono uppercase text-center focus:theme-border outline-none">
            </div>
          </div>

          <button type="button" @click="submitWechatLogin" :disabled="loading || !wechatForm.nickname || !wechatForm.verifyCode"
                  class="w-full theme-bg text-white py-2.5 rounded-lg text-sm font-bold shadow-sm disabled:opacity-50 hover:opacity-90">
            {{ loading ? '验证连接中...' : '确认登录 / 同步全端' }}
          </button>
        </div>
      </div>
    </div>
  `,
};
