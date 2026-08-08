/**
 * 波幅探长 - 购买套餐组件
 * - 优惠码 / 游客支付即注册 严格跟随后台 publicSettings
 * - 定制监控：提交时带上 sessionStorage 中的 pending_custom_items
 * js/components/index/Plan.js
 */
import { store } from "../../store.js";
import { planApi } from "../../api/plan.js";
import { CONFIG } from "../../config.js";

const { ref, reactive, computed, watch, onMounted } = Vue;

function settingOn(val) {
  return val === "1" || val === 1 || val === true || val === "true";
}

export default {
  name: "Plan",
  setup() {
    const plans = ref([]);
    const loading = ref(false);
    const planTab = ref("shared"); // 'shared' | 'custom'

    const topUpForm = reactive({
      planId: "",
      amount: 0,
      originalAmount: 0,
      floatingAmount: "0.00",
      txId: "",
      orderType: "vip",
    });

    const promoInput = ref("");
    const promoChecking = ref(false);
    const promoValid = ref(false);
    const promoMessage = ref("");

    const payChannel = ref(
      (CONFIG.DEFAULT_PUBLIC_SETTINGS.default_pay_channel || "wechat") === "alipay"
        ? "alipay"
        : "wechat"
    );
    const showManualInput = ref(false);
    const submitLoading = ref(false);

    const payRegister = reactive({
      username: "",
      password: "",
      refCode: "",
    });

    // 从个人中心带过来的待购定制标的
    const pendingCustomItems = ref([]);

    const settings = computed(() => store.state.publicSettings || {});
    const promoEnabled = computed(() => settingOn(settings.value.promo_enabled));
    const payRegisterEnabled = computed(() => settingOn(settings.value.pay_register_enabled));

    const isImageUrl = (url) => {
      if (!url || typeof url !== "string") return false;
      const u = url.trim().toLowerCase();
      return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(u);
    };

    const linkToQrSrc = (url) => {
      if (!url) return "";
      return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(
        url.trim()
      )}`;
    };

    const currentPayQrSrc = computed(() => {
      const raw =
        payChannel.value === "wechat"
          ? settings.value.wechat_qr_url || ""
          : settings.value.alipay_qr_url || "";
      if (!raw || !String(raw).trim()) return "";
      const url = String(raw).trim();
      return isImageUrl(url) ? url : linkToQrSrc(url);
    });

    const displayPlans = computed(() => {
      if (planTab.value === "custom") {
        return plans.value.filter((p) => p.plan_type === "custom" || p.plan_type === "both");
      }
      return plans.value.filter(
        (p) => p.plan_type === "shared" || p.plan_type === "both" || !p.plan_type
      );
    });

    const pickDefaultPlan = (list) => {
      if (!list || !list.length) return null;
      const byName = list.find((p) => /月/.test(String(p.name || "")));
      if (byName) return byName;
      const byDays = list.find((p) => {
        const d = Number(p.days);
        return d >= 28 && d <= 31;
      });
      if (byDays) return byDays;
      return [...list].sort((a, b) => Number(a.days) - Number(b.days))[0];
    };

    const planTypeLabel = () => {
      if (planTab.value === "custom") return "定制监控";
      return "通用监控 VIP";
    };

    const planBenefits = (plan) => {
      const days = Number(plan.days) || 0;
      if (planTab.value === "custom") {
        const maxN = settings.value.custom_max_symbols || 3;
        return [
          `有效期 ${days} 天`,
          `最多可监控约 ${maxN} 只自选标的`,
          "与通用监控相互独立",
          "不解锁通用看板图表权限",
        ];
      }
      return [
        `有效期 ${days} 天`,
        "解锁通用监控全部图表",
        "支持日线 / 半日线 / 周线查看",
        "适合跟踪全市场波幅标的",
      ];
    };

    const generateFloatingAmount = (base) => {
      const cents = (Math.floor(Math.random() * 5) + 1) / 100;
      return (Number(base) + cents).toFixed(2);
    };

    const selectPlan = (plan) => {
      if (!plan) return;
      topUpForm.planId = plan.id;
      topUpForm.amount = Number(plan.price);
      topUpForm.originalAmount = Number(plan.price);
      topUpForm.floatingAmount = generateFloatingAmount(plan.price);
      topUpForm.orderType = planTab.value === "custom" ? "custom_watchlist" : "vip";
      promoValid.value = false;
      promoMessage.value = "";
      promoInput.value = "";
    };

    const loadPlans = async () => {
      loading.value = true;
      try {
        const res = await planApi.fetchPlans();
        plans.value = res.data || [];
        const def = pickDefaultPlan(displayPlans.value);
        if (def) selectPlan(def);
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    watch(planTab, () => {
      const def = pickDefaultPlan(displayPlans.value);
      if (def) selectPlan(def);
    });

    const applyPromo = async () => {
      if (!promoEnabled.value) {
        store.showToast("优惠码功能未开启", "error");
        return;
      }
      if (!promoInput.value.trim()) {
        store.showToast("请输入优惠码", "error");
        return;
      }
      if (!topUpForm.planId) {
        store.showToast("请先选择套餐", "error");
        return;
      }
      promoChecking.value = true;
      try {
        const res = await planApi.checkPromo(topUpForm.planId, promoInput.value.trim());
        if (res.success) {
          promoValid.value = true;
          topUpForm.amount = res.amount;
          topUpForm.floatingAmount = generateFloatingAmount(res.amount);
          promoMessage.value = `已享受优惠，折后金额 ¥${res.amount}`;
        } else {
          promoValid.value = false;
          promoMessage.value = res.error || "优惠码无效";
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

    /** 读取个人中心带来的定制标的草稿 */
    const loadPendingCustomItems = () => {
      try {
        const raw = sessionStorage.getItem("pending_custom_items");
        if (!raw) {
          pendingCustomItems.value = [];
          return;
        }
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) {
          pendingCustomItems.value = [];
          return;
        }
        pendingCustomItems.value = arr
          .map((it) => ({
            etf_code: String(it.etf_code || it.code || "")
              .trim()
              .toUpperCase(),
            etf_name: String(it.etf_name || it.name || "").trim(),
          }))
          .filter((it) => /^\d{6}$/.test(it.etf_code));
      } catch {
        pendingCustomItems.value = [];
      }
    };

    const submitOrder = async () => {
      if (!topUpForm.planId) {
        store.showToast("请先选择套餐", "error");
        return;
      }
      if (!/^\d{6}$/.test(topUpForm.txId)) {
        store.showToast("请填写 6 位数字单号凭证", "error");
        return;
      }

      // 定制套餐必须带标的
      if (topUpForm.orderType === "custom_watchlist") {
        loadPendingCustomItems();
        if (!pendingCustomItems.value.length) {
          store.showToast("请先在个人中心添加定制标的后再购买", "error");
          return;
        }
      }

      if (!store.state.isLoggedIn) {
        if (!payRegisterEnabled.value) {
          store.showToast("请先登录后再购买", "error");
          openLogin();
          return;
        }
        if (!payRegister.username || !payRegister.password) {
          store.showToast("请填写自动注册账号与密码", "error");
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
          // ★ 关键：把定制标的传给后端
          customItems:
            topUpForm.orderType === "custom_watchlist" ? pendingCustomItems.value : undefined,
          registerUsername: !store.state.isLoggedIn ? payRegister.username : undefined,
          registerPassword: !store.state.isLoggedIn ? payRegister.password : undefined,
          refCode: !store.state.isLoggedIn ? payRegister.refCode : undefined,
        });

        store.showToast("订单已提交，请等待审核开通！");
        topUpForm.txId = "";

        // 提交成功后清草稿，避免重复提交
        if (topUpForm.orderType === "custom_watchlist") {
          sessionStorage.removeItem("pending_custom_items");
          sessionStorage.removeItem("draft_custom_symbols");
          pendingCustomItems.value = [];
        }
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        submitLoading.value = false;
      }
    };

    onMounted(() => {
      const preferTab = sessionStorage.getItem("prefer_plan_tab");
      if (preferTab === "custom") {
        planTab.value = "custom";
        sessionStorage.removeItem("prefer_plan_tab");
      }

      loadPendingCustomItems();

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
      topUpForm,
      promoInput,
      promoChecking,
      promoValid,
      promoMessage,
      payChannel,
      showManualInput,
      submitLoading,
      payRegister,
      pendingCustomItems,
      currentPayQrSrc,
      planTypeLabel,
      planBenefits,
      selectPlan,
      applyPromo,
      submitOrder,
      openLogin,
      loading,
    };
  },
  template: `
    <div class="max-w-5xl mx-auto space-y-6 select-none">
      <div>
        <h2 class="text-2xl font-bold text-slate-800">选择服务套餐</h2>
        <p class="text-xs text-slate-400 mt-1">
          通用监控解锁全市场图表；定制监控针对您自选标的。支付后请提交凭证，管理员审核后自动开通。
        </p>
      </div>

      <div class="flex gap-2 text-sm">
        <button @click="planTab='shared'" class="px-5 py-2.5 rounded-lg border transition-all"
                :class="planTab==='shared'?'theme-bg text-white border-transparent font-bold shadow-sm':'bg-white text-slate-600 hover:bg-slate-50'">
          通用监控
        </button>
        <button @click="planTab='custom'" class="px-5 py-2.5 rounded-lg border transition-all"
                :class="planTab==='custom'?'theme-bg text-white border-transparent font-bold shadow-sm':'bg-white text-slate-600 hover:bg-slate-50'">
          定制监控
        </button>
      </div>

      <!-- 定制标的草稿提示 -->
      <div v-if="planTab==='custom' && pendingCustomItems.length"
           class="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-xs text-emerald-800">
        <i class="fa-solid fa-circle-check mr-1"></i>
        已选择 <strong>{{ pendingCustomItems.length }}</strong> 只定制标的：
        <span class="font-mono">
          {{ pendingCustomItems.map(i => i.etf_code).join('、') }}
        </span>
        ，提交订单后将一并开通。
      </div>
      <div v-else-if="planTab==='custom' && !pendingCustomItems.length"
           class="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-800">
        <i class="fa-solid fa-triangle-exclamation mr-1"></i>
        尚未选择定制标的。请先到
        <a href="#/profile" class="underline font-bold">个人中心 → 添加标的</a>
        后再购买定制套餐。
      </div>

      <div v-if="loading" class="text-center py-10 text-slate-400 text-sm">
        <i class="fa-solid fa-spinner animate-spin mr-2"></i>加载套餐中...
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="plan in displayPlans" :key="plan.id" @click="selectPlan(plan)"
             class="bg-white rounded-xl shadow-sm border-2 p-5 cursor-pointer relative transition-all flex flex-col"
             :class="topUpForm.planId === plan.id ? 'theme-border ring-2 ring-[#4da6a0]/20' : 'border-slate-100 hover:border-slate-200'">

          <div v-if="plan.tag" class="absolute top-0 right-0 bg-orange-500 text-white text-[10px] px-2.5 py-0.5 rounded-bl font-bold">
            {{ plan.tag }}
          </div>

          <div class="flex-1">
            <div class="text-slate-600 text-sm mb-1 font-bold">{{ plan.name }}</div>
            <div class="text-3xl font-light text-slate-800 mb-1">
              <span class="text-base text-slate-400">¥</span> {{ plan.price }}
            </div>
            <div class="text-[11px] text-slate-400 mb-3">
              开通后计入：<strong class="theme-text">{{ planTypeLabel() }}</strong>
            </div>
            <ul class="space-y-1.5 text-xs text-slate-500">
              <li v-for="(tip, i) in planBenefits(plan)" :key="i" class="flex items-start gap-1.5">
                <i class="fa-solid fa-check text-emerald-500 mt-0.5 text-[10px]"></i>
                <span>{{ tip }}</span>
              </li>
            </ul>
          </div>

          <button class="w-full mt-5 py-2 rounded-lg text-xs font-bold transition-colors"
                  :class="topUpForm.planId === plan.id ? 'theme-bg text-white' : 'bg-slate-100 text-slate-600'">
            {{ topUpForm.planId === plan.id ? '已选中' : '选择套餐' }}
          </button>
        </div>
      </div>

      <div v-if="!loading && topUpForm.planId" class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 max-w-2xl mx-auto space-y-5">
        <div class="text-center">
          <div class="inline-flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full mb-3 border border-amber-200">
            <i class="fa-solid fa-triangle-exclamation"></i> 请严格支付下方精准金额（勿改金额）
          </div>
          <h3 class="text-lg font-bold text-slate-800">扫码精准支付</h3>
          <div class="mt-2 flex items-baseline justify-center gap-1 flex-wrap">
            <span class="text-sm text-slate-500">需支付:</span>
            <span class="text-3xl font-extrabold text-red-500 font-mono">¥ {{ topUpForm.floatingAmount }}</span>
            <span v-if="promoValid && topUpForm.originalAmount" class="text-sm text-slate-400 line-through ml-1">¥ {{ topUpForm.originalAmount }}</span>
          </div>
        </div>

        <div class="flex justify-center gap-2 text-xs">
          <button @click="payChannel='wechat'" class="px-4 py-1.5 rounded-full border"
                  :class="payChannel==='wechat'?'theme-bg text-white border-transparent font-bold':'bg-white'">微信支付</button>
          <button @click="payChannel='alipay'" class="px-4 py-1.5 rounded-full border"
                  :class="payChannel==='alipay'?'theme-bg text-white border-transparent font-bold':'bg-white'">支付宝</button>
        </div>

        <div class="flex flex-col items-center">
          <div class="w-56 h-56 bg-slate-50 rounded-2xl p-3 border-2 border-dashed border-slate-200 mb-2 flex items-center justify-center shadow-inner">
            <img v-if="currentPayQrSrc" :src="currentPayQrSrc" class="w-full h-full object-contain rounded-xl" alt="收款码">
            <span v-else class="text-xs text-slate-400 text-center px-4 leading-relaxed">
              请在后台设置<br>
              <strong>{{ payChannel === 'wechat' ? '微信' : '支付宝' }}收款码 URL</strong><br>
              （支持图片直链或支付网址）
            </span>
          </div>
          <div class="text-[11px] text-slate-400 text-center">长按保存二维码或扫码完成支付</div>
        </div>

        <div v-if="promoEnabled" class="border border-slate-100 rounded-xl p-4 bg-slate-50/60">
          <label class="text-xs font-bold text-slate-600 mb-2 block">优惠码 (选填)</label>
          <div class="flex gap-2">
            <input v-model="promoInput" type="text" placeholder="输入优惠码"
                   class="flex-1 px-3 py-2 border rounded-lg text-sm font-mono uppercase focus:theme-border outline-none bg-white">
            <button @click="applyPromo" :disabled="promoChecking"
                    class="px-4 py-2 theme-bg text-white rounded-lg text-xs font-bold disabled:opacity-50">使用</button>
          </div>
          <p v-if="promoMessage" class="text-xs mt-2 font-medium" :class="promoValid ? 'text-emerald-600' : 'text-red-500'">
            {{ promoMessage }}
          </p>
        </div>

        <div v-if="!store.isLoggedIn && payRegisterEnabled"
             class="bg-amber-50/60 border border-amber-100 rounded-xl p-4 space-y-3">
          <div class="text-xs font-bold text-amber-800">
            <i class="fa-solid fa-user-plus mr-1"></i>
            未登录：支付成功并审核通过后，将使用下方账号自动注册并开通
          </div>
          <input v-model="payRegister.username" type="text" placeholder="设置登录账号（建议邮箱）"
                 class="w-full px-3 py-2 border rounded-lg text-sm focus:theme-border outline-none bg-white">
          <input v-model="payRegister.password" type="password" placeholder="设置密码（至少 6 位）"
                 class="w-full px-3 py-2 border rounded-lg text-sm focus:theme-border outline-none bg-white">
          <input v-model="payRegister.refCode" type="text" placeholder="推荐码（选填）"
                 class="w-full px-3 py-2 border rounded-lg text-sm focus:theme-border outline-none bg-white">
        </div>

        <div v-else-if="!store.isLoggedIn && !payRegisterEnabled"
             class="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center space-y-2">
          <p class="text-xs text-slate-600">当前需登录后才能购买套餐</p>
          <button type="button" @click="openLogin"
                  class="px-5 py-2 theme-bg text-white rounded-lg text-xs font-bold">
            去登录
          </button>
        </div>

        <div class="max-w-xs mx-auto text-center space-y-3 pt-2">
          <button @click="showManualInput = !showManualInput" class="text-xs text-slate-400 hover:theme-text underline">
            {{ showManualInput ? '收起单号输入' : '手动提交支付单号后 6 位' }}
          </button>
          <div v-if="showManualInput" class="space-y-2">
            <input v-model="topUpForm.txId" type="text" maxlength="6" placeholder="支付凭证后 6 位数字"
                   class="w-full px-4 py-2 border rounded-lg text-center font-mono text-sm focus:theme-border outline-none">
            <button @click="submitOrder" :disabled="submitLoading"
                    class="w-full py-2.5 theme-bg text-white rounded-lg text-xs font-bold disabled:opacity-50 shadow-sm">
              {{ submitLoading ? '提交中...' : '提交凭证开通' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
};
