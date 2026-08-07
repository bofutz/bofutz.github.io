/**
 * 波幅探长 - 购买套餐组件
 * 支持从 Profile 跳转时强制打开「定制监控」标签
 * js/components/index/Plan.js
 */
import { store } from "../../store.js";
import { planApi } from "../../api/plan.js";

const { ref, reactive, computed, watch, onMounted } = Vue;

export default {
  name: "Plan",
  setup() {
    const plans = ref([]);
    const loading = ref(false);
    const planTab = ref("shared"); // 'shared' | 'custom'

    const topUpForm = reactive({
      planId: "",
      amount: 18.8,
      originalAmount: 18.8,
      floatingAmount: "18.82",
      txId: "",
      orderType: "vip",
    });

    const promoInput = ref("");
    const promoChecking = ref(false);
    const promoValid = ref(false);
    const promoMessage = ref("");

    const payChannel = ref("alipay");
    const showManualInput = ref(false);
    const submitLoading = ref(false);

    const payRegister = reactive({
      username: "",
      password: "",
      refCode: "",
    });

    const isImageUrl = (url) => {
      if (!url || typeof url !== "string") return false;
      const u = url.trim().toLowerCase();
      return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(u);
    };

    const linkToQrSrc = (url) => {
      if (!url) return "";
      return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(url.trim())}`;
    };

    const currentPayQrSrc = computed(() => {
      const raw = payChannel.value === "wechat"
        ? (store.state.publicSettings.wechat_qr_url || "")
        : (store.state.publicSettings.alipay_qr_url || "");
      
      if (!raw || !String(raw).trim()) return "";
      const url = String(raw).trim();
      return isImageUrl(url) ? url : linkToQrSrc(url);
    });

    const displayPlans = computed(() => {
      if (planTab.value === "custom") {
        return plans.value.filter((p) => p.plan_type === "custom" || p.plan_type === "both");
      }
      return plans.value.filter((p) => p.plan_type === "shared" || p.plan_type === "both" || !p.plan_type);
    });

    const loadPlans = async () => {
      loading.value = true;
      try {
        const res = await planApi.fetchPlans();
        plans.value = res.data || [];
        if (displayPlans.value.length > 0) {
          selectPlan(displayPlans.value[0]);
        }
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    const generateFloatingAmount = (base) => {
      const cents = (Math.floor(Math.random() * 5) + 1) / 100;
      return (Number(base) + cents).toFixed(2);
    };

    const selectPlan = (plan) => {
      topUpForm.planId = plan.id;
      topUpForm.amount = Number(plan.price);
      topUpForm.originalAmount = Number(plan.price);
      topUpForm.floatingAmount = generateFloatingAmount(plan.price);
      topUpForm.orderType = planTab.value === "custom" ? "custom_watchlist" : "vip";
      promoValid.value = false;
      promoMessage.value = "";
    };

    watch(planTab, () => {
      if (displayPlans.value.length > 0) {
        selectPlan(displayPlans.value[0]);
      }
    });

    const applyPromo = async () => {
      if (!promoInput.value.trim()) {
        store.showToast("请输入优惠码", "error");
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

    const submitOrder = async () => {
      if (!/^\d{6}$/.test(topUpForm.txId)) {
        store.showToast("请填写 6 位数字单号凭证", "error");
        return;
      }

      if (!store.state.isLoggedIn && (!payRegister.username || !payRegister.password)) {
        store.showToast("游客开通请输入自动注册账号与密码", "error");
        return;
      }

      submitLoading.value = true;
      try {
        await planApi.submitOrder({
          planId: topUpForm.planId,
          amount: topUpForm.floatingAmount,
          txId: topUpForm.txId,
          promoCode: promoValid.value ? promoInput.value : undefined,
          orderType: topUpForm.orderType,
          registerUsername: payRegister.username,
          registerPassword: payRegister.password,
          refCode: payRegister.refCode,
        });
        store.showToast("订单已提交，等待审核开通！");
        topUpForm.txId = "";
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        submitLoading.value = false;
      }
    };

    onMounted(() => {
      // 从 Profile 跳转过来时，强制打开「定制监控」标签
      const preferTab = sessionStorage.getItem("prefer_plan_tab");
      if (preferTab === "custom") {
        planTab.value = "custom";
        sessionStorage.removeItem("prefer_plan_tab");
      }
      loadPlans();
    });

    return {
      store: store.state,
      settings: store.state.publicSettings,
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
      currentPayQrSrc,
      selectPlan,
      applyPromo,
      submitOrder,
    };
  },
  template: `
    <div class="max-w-5xl mx-auto space-y-6 select-none">
      <div>
        <h2 class="text-2xl font-bold text-slate-800">选择服务套餐</h2>
        <p class="text-xs text-slate-400 mt-1">请选择您需要购买的服务类型（通用监控 或 定制监控）。</p>
      </div>

      <!-- 分类选项卡 -->
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

      <!-- 套餐列表 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="plan in displayPlans" :key="plan.id" @click="selectPlan(plan)"
             class="bg-white rounded-xl shadow-sm border-2 p-5 cursor-pointer relative transition-all flex flex-col justify-between"
             :class="topUpForm.planId === plan.id ? 'theme-border ring-2 ring-[#4da6a0]/20' : 'border-slate-100 hover:border-slate-200'">
          
          <div v-if="plan.tag" class="absolute top-0 right-0 bg-orange-500 text-white text-[10px] px-2.5 py-0.5 rounded-bl font-bold">
            {{ plan.tag }}
          </div>

          <div>
            <div class="text-slate-500 text-sm mb-2 font-medium">{{ plan.name }}</div>
            <div class="text-3xl font-light text-slate-800 mb-2">¥ {{ plan.price }}</div>
            <div class="text-xs text-slate-400">
              有效期 {{ plan.days }} 天 · 购买后充值至：<strong class="theme-text">{{ planTab === 'custom' ? '定制监控' : '通用监控 VIP' }}</strong>
            </div>
          </div>

          <button class="w-full mt-5 py-2 rounded-lg text-xs font-bold transition-colors"
                  :class="topUpForm.planId === plan.id ? 'theme-bg text-white' : 'bg-slate-100 text-slate-600'">
            {{ topUpForm.planId === plan.id ? '已选中' : '选择套餐' }}
          </button>
        </div>
      </div>

      <!-- 支付及凭证提交卡片 -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 max-w-2xl mx-auto space-y-5">
        <div class="text-center">
          <div class="inline-flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full mb-3 border border-amber-200">
            <i class="fa-solid fa-triangle-exclamation"></i> 请严格支付下方精准金额
          </div>
          <h3 class="text-lg font-bold text-slate-800">扫码精准支付</h3>
          <div class="mt-2 flex items-baseline justify-center gap-1">
            <span class="text-sm text-slate-500">需支付:</span>
            <span class="text-3xl font-extrabold text-red-500 font-mono">¥ {{ topUpForm.floatingAmount }}</span>
            <span v-if="promoValid && topUpForm.originalAmount" class="text-sm text-slate-400 line-through ml-1">¥ {{ topUpForm.originalAmount }}</span>
          </div>
        </div>

        <div class="flex justify-center gap-2 text-xs">
          <button @click="payChannel='alipay'" class="px-4 py-1.5 rounded-full border"
                  :class="payChannel==='alipay'?'theme-bg text-white border-transparent font-bold':'bg-white'">支付宝</button>
          <button @click="payChannel='wechat'" class="px-4 py-1.5 rounded-full border"
                  :class="payChannel==='wechat'?'theme-bg text-white border-transparent font-bold':'bg-white'">微信支付</button>
        </div>

        <!-- 二维码渲染区 -->
        <div class="flex flex-col items-center">
          <div class="w-56 h-56 bg-slate-50 rounded-2xl p-3 border-2 border-dashed border-slate-200 mb-2 flex items-center justify-center shadow-inner">
            <img v-if="currentPayQrSrc" :src="currentPayQrSrc" class="w-full h-full object-contain rounded-xl" alt="收款码">
            <span v-else class="text-xs text-slate-400 text-center px-4 leading-relaxed">
              请在后台设置<br><strong>{{ payChannel === 'alipay' ? '支付宝' : '微信' }}收款码 URL</strong><br>(支持图片直链或支付网址)
            </span>
          </div>
          <div class="text-[11px] text-slate-400 text-center">长按保存二维码或扫码完成支付</div>
        </div>

        <!-- 优惠码区域 -->
        <div v-if="settings.promo_enabled === '1' || settings.promo_enabled === 1 || settings.promo_enabled === true"
             class="border border-slate-100 rounded-xl p-4 bg-slate-50/60">
          <label class="text-xs font-bold text-slate-600 mb-2 block">优惠码 (选填)</label>
          <div class="flex gap-2">
            <input v-model="promoInput" type="text" placeholder="输入优惠码" class="flex-1 px-3 py-2 border rounded-lg text-sm font-mono uppercase focus:theme-border outline-none bg-white">
            <button @click="applyPromo" :disabled="promoChecking" class="px-4 py-2 theme-bg text-white rounded-lg text-xs font-bold disabled:opacity-50">使用</button>
          </div>
          <p v-if="promoMessage" class="text-xs mt-2 font-medium" :class="promoValid ? 'text-emerald-600' : 'text-red-500'">{{ promoMessage }}</p>
        </div>

        <!-- 游客自动注册区域 -->
        <div v-if="!store.isLoggedIn" class="bg-amber-50/60 border border-amber-100 rounded-xl p-4 space-y-3">
          <div class="text-xs font-bold text-amber-800"><i class="fa-solid fa-user-plus mr-1"></i> 未登录：支付成功后将用下方账号自动注册</div>
          <input v-model="payRegister.username" type="text" placeholder="设置登录账号 (不强制邮箱)" class="w-full px-3 py-2 border rounded-lg text-sm focus:theme-border outline-none bg-white">
          <input v-model="payRegister.password" type="password" placeholder="设置密码 (至少 6 位)" class="w-full px-3 py-2 border rounded-lg text-sm focus:theme-border outline-none bg-white">
          <input v-model="payRegister.refCode" type="text" placeholder="推荐码 (选填)" class="w-full px-3 py-2 border rounded-lg text-sm focus:theme-border outline-none bg-white">
        </div>

        <!-- 单号提交输入框 -->
        <div class="max-w-xs mx-auto text-center space-y-3 pt-2">
          <button @click="showManualInput = !showManualInput" class="text-xs text-slate-400 hover:theme-text underline">
            {{ showManualInput ? '收起单号输入' : '手动提交支付单号后 6 位' }}
          </button>
          <div v-if="showManualInput" class="space-y-2">
            <input v-model="topUpForm.txId" type="text" maxlength="6" placeholder="支付凭证后 6 位数字" class="w-full px-4 py-2 border rounded-lg text-center font-mono text-sm focus:theme-border outline-none">
            <button @click="submitOrder" :disabled="submitLoading" class="w-full py-2.5 theme-bg text-white rounded-lg text-xs font-bold disabled:opacity-50 shadow-sm">
              {{ submitLoading ? '提交中...' : '提交凭证开通' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
};
