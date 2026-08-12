/**
 * 波幅探长 - 购买套餐
 * 监控 VIP（按天）+ 图表查询次数包（按次）
 * 已移除定制监控
 */
import { store } from "../../store.js";
import { planApi } from "../../api/plan.js";
import { chartQueryApi } from "../../api/chartQuery.js";
import { CONFIG } from "../../config.js";

const { ref, reactive, computed, watch, onMounted } = Vue;

function settingOn(val) {
  return val === "1" || val === 1 || val === true || val === "true";
}

export default {
  name: "Plan",
  setup() {
    const planTab = ref("vip"); // vip | credits
    const vipPlans = ref([]);
    const creditPlans = ref([]);
    const loading = ref(false);

    const topUpForm = reactive({
      planId: "",
      unitPrice: 0,
      amount: 0,
      originalAmount: 0,
      floatingAmount: "0.00",
      txId: "",
      orderType: "vip",
      credits: 0,
    });

    const promoInput = ref("");
    const promoChecking = ref(false);
    const promoValid = ref(false);
    const promoMessage = ref("");
    const payChannel = ref("wechat");
    const showManualInput = ref(false);
    const submitLoading = ref(false);
    const payRegister = reactive({ username: "", password: "", refCode: "" });
    const usernameCheck = reactive({ checking: false, available: null, msg: "" });

    const settings = computed(() => store.state.publicSettings || {});
    const promoEnabled = computed(() => settingOn(settings.value.promo_enabled));
    const payRegisterEnabled = computed(() => settingOn(settings.value.pay_register_enabled));

    const isImageUrl = (url) => {
      if (!url || typeof url !== "string") return false;
      return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url.trim().toLowerCase());
    };
    const linkToQrSrc = (url) =>
      `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(String(url).trim())}`;
    const currentPayQrSrc = computed(() => {
      const raw =
        payChannel.value === "wechat"
          ? settings.value.wechat_qr_url || ""
          : settings.value.alipay_qr_url || "";
      if (!raw.trim()) return "";
      return isImageUrl(raw) ? raw.trim() : linkToQrSrc(raw);
    });

    const displayPlans = computed(() =>
      planTab.value === "credits" ? creditPlans.value : vipPlans.value
    );

    const generateFloatingAmount = (base) => {
      const cents = (Math.floor(Math.random() * 5) + 1) / 100;
      return (Number(base) + cents).toFixed(2);
    };

    const selectPlan = (plan) => {
      if (!plan) return;
      topUpForm.planId = plan.id;
      topUpForm.unitPrice = Number(plan.price);
      topUpForm.orderType = planTab.value === "credits" ? "chart_credits" : "vip";
      topUpForm.credits = Number(plan.credits || 0);
      promoValid.value = false;
      promoMessage.value = "";
      promoInput.value = "";
      const base = Number(plan.price);
      topUpForm.originalAmount = base;
      topUpForm.amount = base;
      topUpForm.floatingAmount = generateFloatingAmount(base);
    };

    const loadPlans = async () => {
      loading.value = true;
      try {
        const [vipRes, creditRes] = await Promise.all([
          planApi.fetchPlans().catch(() => ({ data: [] })),
          chartQueryApi.fetchCreditPlans().catch(() => ({ data: [] })),
        ]);
        const all = vipRes.data || [];
        // 监控套餐：shared / both，排除旧 custom-only
        vipPlans.value = all.filter(
          (p) => p.enabled !== 0 && p.plan_type !== "custom" && p.plan_type !== "chart"
        );
        creditPlans.value = creditRes.data || creditRes || [];
        const list = displayPlans.value;
        if (list.length) selectPlan(list[0]);
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    watch(planTab, () => {
      const list = displayPlans.value;
      if (list.length) selectPlan(list[0]);
      else {
        topUpForm.planId = "";
      }
    });

    let userCheckTimer = null;
    const onRegisterUsernameInput = () => {
      usernameCheck.available = null;
      usernameCheck.msg = "";
      if (userCheckTimer) clearTimeout(userCheckTimer);
      const u = payRegister.username.trim();
      if (!u) return;
      if (!CONFIG.USERNAME_PATTERN.test(u) || u.length < CONFIG.USERNAME_MIN) {
        usernameCheck.available = false;
        usernameCheck.msg = `账号需 ${CONFIG.USERNAME_MIN}～${CONFIG.USERNAME_MAX} 位字母或数字`;
        return;
      }
      userCheckTimer = setTimeout(async () => {
        usernameCheck.checking = true;
        try {
          const { authApi } = await import("../../api/auth.js");
          const res = await authApi.checkUsername(u);
          usernameCheck.available = !!res.available;
          usernameCheck.msg = res.available ? "账号可用" : res.error || "账号已被占用";
        } catch (e) {
          usernameCheck.msg = e.message || "校验失败";
        } finally {
          usernameCheck.checking = false;
        }
      }, 400);
    };

    const applyPromo = async () => {
      if (!promoEnabled.value || !promoInput.value.trim() || !topUpForm.planId) return;
      promoChecking.value = true;
      try {
        const res = await planApi.checkPromo(topUpForm.planId, promoInput.value.trim(), 1);
        if (res.success) {
          promoValid.value = true;
          topUpForm.amount = res.amount;
          topUpForm.floatingAmount = generateFloatingAmount(res.amount);
          promoMessage.value = `已优惠，折后 ¥${res.amount}`;
        } else {
          promoValid.value = false;
          promoMessage.value = res.error || "无效";
        }
      } catch (err) {
        promoValid.value = false;
        promoMessage.value = err.message || "校验失败";
      } finally {
        promoChecking.value = false;
      }
    };

    const openLogin = () => {
      store.state.authMode = "login";
      store.state.authModalVisible = true;
    };

    const txIdValid = computed(() => /^\d{6}$/.test(String(topUpForm.txId || "").trim()));

    const submitOrder = async () => {
      if (!topUpForm.planId) {
        store.showToast("请选择套餐", "error");
        return;
      }
      if (!/^\d{6}$/.test(topUpForm.txId)) {
        store.showToast("请填写 6 位数字凭证", "error");
        return;
      }
      if (!store.state.isLoggedIn) {
        if (!payRegisterEnabled.value) {
          store.showToast("请先登录", "error");
          openLogin();
          return;
        }
        if (!payRegister.username || !payRegister.password) {
          store.showToast("请填写注册账号与密码", "error");
          return;
        }
        if (!CONFIG.USERNAME_PATTERN.test(payRegister.username.trim())) {
          store.showToast("账号仅限字母与数字", "error");
          return;
        }
        if (usernameCheck.available === false) {
          store.showToast("请更换未被占用的账号", "error");
          return;
        }
        if (String(payRegister.password).length < 6) {
          store.showToast("密码至少 6 位", "error");
          return;
        }
      }

      submitLoading.value = true;
      try {
        await planApi.submitOrder({
          planId: topUpForm.planId,
          amount: topUpForm.floatingAmount,
          txId: topUpForm.txId,
          promoCode: promoEnabled.value && promoValid.value ? promoInput.value : undefined,
          orderType: topUpForm.orderType,
          registerUsername: !store.state.isLoggedIn ? payRegister.username : undefined,
          registerPassword: !store.state.isLoggedIn ? payRegister.password : undefined,
          refCode: !store.state.isLoggedIn ? payRegister.refCode : undefined,
        });
        store.showToast("订单已提交，审核通过后自动到账");
        topUpForm.txId = "";
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        submitLoading.value = false;
      }
    };

    onMounted(() => {
      const ch = settings.value.default_pay_channel || "wechat";
      payChannel.value = ch === "alipay" ? "alipay" : "wechat";
      loadPlans();
    });

    return {
      store: store.state,
      settings,
      promoEnabled,
      payRegisterEnabled,
      planTab,
      displayPlans,
      loading,
      topUpForm,
      promoInput,
      promoChecking,
      promoValid,
      promoMessage,
      payChannel,
      showManualInput,
      submitLoading,
      payRegister,
      usernameCheck,
      currentPayQrSrc,
      selectPlan,
      applyPromo,
      submitOrder,
      txIdValid,
      openLogin,
      onRegisterUsernameInput,
    };
  },
  template: `
    <div class="max-w-5xl mx-auto space-y-6 select-none">
      <div>
        <h2 class="text-2xl font-bold text-slate-800">开通服务</h2>
        <p class="text-xs text-slate-400 mt-1">
          <strong>监控 VIP</strong>按时间解锁看板全量图表；
          <strong>图表查询次数</strong>用于「自主查询」任意标的出图（按次消耗）。
        </p>
      </div>

      <div class="flex gap-2 text-sm">
        <button @click="planTab='vip'" class="px-5 py-2.5 rounded-lg border transition-all"
                :class="planTab==='vip'?'theme-bg text-white border-transparent font-bold':'bg-white text-slate-600'">
          监控 VIP
        </button>
        <button @click="planTab='credits'" class="px-5 py-2.5 rounded-lg border transition-all"
                :class="planTab==='credits'?'theme-bg text-white border-transparent font-bold':'bg-white text-slate-600'">
          图表查询次数
        </button>
      </div>

      <div v-if="store.isLoggedIn && planTab==='credits'" class="text-xs text-slate-500">
        当前剩余查询次数：<strong class="theme-text text-base font-mono">{{ store.chartCredits ?? 0 }}</strong>
      </div>

      <div v-if="loading" class="text-center py-10 text-slate-400 text-sm">加载中…</div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="plan in displayPlans" :key="plan.id" @click="selectPlan(plan)"
             class="bg-white rounded-xl border-2 p-5 cursor-pointer relative transition-all"
             :class="topUpForm.planId===plan.id?'theme-border ring-2 ring-[#4da6a0]/20':'border-slate-100'">
          <div v-if="plan.tag" class="absolute top-0 right-0 bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-bl font-bold">{{ plan.tag }}</div>
          <div class="text-slate-600 text-sm font-bold mb-1">{{ plan.name }}</div>
          <div class="text-3xl font-light text-slate-800 mb-2">
            <span class="text-base text-slate-400">¥</span> {{ plan.price }}
          </div>
          <ul class="text-xs text-slate-500 space-y-1">
            <li v-if="planTab==='vip'">有效期 {{ plan.days }} 天 · 解锁监控看板图表</li>
            <li v-else>到账 <strong class="theme-text">{{ plan.credits }}</strong> 次自主查询</li>
          </ul>
          <button class="w-full mt-4 py-2 rounded-lg text-xs font-bold"
                  :class="topUpForm.planId===plan.id?'theme-bg text-white':'bg-slate-100 text-slate-600'">
            {{ topUpForm.planId===plan.id?'已选中':'选择' }}
          </button>
        </div>
      </div>

      <div v-if="!loading && topUpForm.planId" class="bg-white rounded-2xl border border-slate-100 p-6 max-w-2xl mx-auto space-y-5">
        <div class="text-center">
          <div class="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full inline-block mb-2 border border-amber-200">请支付下方精准金额</div>
          <div class="text-3xl font-extrabold text-red-500 font-mono">¥ {{ topUpForm.floatingAmount }}</div>
        </div>
        <div class="flex justify-center gap-2 text-xs">
          <button @click="payChannel='wechat'" class="px-4 py-1.5 rounded-full border" :class="payChannel==='wechat'?'theme-bg text-white border-transparent':''">微信</button>
          <button @click="payChannel='alipay'" class="px-4 py-1.5 rounded-full border" :class="payChannel==='alipay'?'theme-bg text-white border-transparent':''">支付宝</button>
        </div>
        <div class="flex flex-col items-center">
          <div class="w-52 h-52 bg-slate-50 rounded-2xl p-3 border-2 border-dashed border-slate-200 flex items-center justify-center">
            <img v-if="currentPayQrSrc" :src="currentPayQrSrc" class="w-full h-full object-contain" alt="收款码">
            <span v-else class="text-xs text-slate-400 text-center">请在后台配置收款码</span>
          </div>
        </div>

        <div v-if="promoEnabled" class="border rounded-xl p-4 bg-slate-50/60">
          <div class="flex gap-2">
            <input v-model="promoInput" placeholder="优惠码" class="flex-1 border rounded-lg px-3 py-2 text-sm font-mono uppercase">
            <button @click="applyPromo" :disabled="promoChecking" class="theme-bg text-white px-4 py-2 rounded-lg text-xs font-bold">使用</button>
          </div>
          <p v-if="promoMessage" class="text-xs mt-2" :class="promoValid?'text-emerald-600':'text-red-500'">{{ promoMessage }}</p>
        </div>

        <div v-if="!store.isLoggedIn && payRegisterEnabled" class="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-2">
          <div class="text-xs font-bold text-amber-800">支付审核通过后将使用以下账号自动注册</div>
          <input v-model="payRegister.username" @input="onRegisterUsernameInput" placeholder="账号（字母/数字）" class="w-full border rounded-lg px-3 py-2 text-sm">
          <p v-if="usernameCheck.msg" class="text-[11px]" :class="usernameCheck.available?'text-emerald-600':'text-red-500'">{{ usernameCheck.msg }}</p>
          <input v-model="payRegister.password" type="password" placeholder="密码至少6位" class="w-full border rounded-lg px-3 py-2 text-sm">
          <input v-model="payRegister.refCode" placeholder="邀请码（选填）" class="w-full border rounded-lg px-3 py-2 text-sm">
        </div>
        <div v-else-if="!store.isLoggedIn" class="text-center text-xs">
          <button type="button" @click="openLogin" class="theme-bg text-white px-5 py-2 rounded-lg font-bold">去登录</button>
        </div>

        <div class="max-w-xs mx-auto text-center space-y-2">
          <button @click="showManualInput=!showManualInput" class="text-xs text-slate-400 underline">{{ showManualInput?'收起':'提交支付凭证后6位' }}</button>
          <div v-if="showManualInput" class="space-y-2">
            <input v-model="topUpForm.txId" maxlength="6" placeholder="6位数字" class="w-full border rounded-lg px-3 py-2 text-center font-mono text-sm">
            <button @click="submitOrder" :disabled="submitLoading||!txIdValid" class="w-full theme-bg text-white py-2.5 rounded-lg text-xs font-bold disabled:opacity-50">
              {{ submitLoading?'提交中…':'提交凭证' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
};
