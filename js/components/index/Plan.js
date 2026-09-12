/* ========================= FILE: .\js\components\index\Plan.js ========================= */
/**
 * 波幅探长 - 购买套餐（高转化优化版）
 * 1. 增设免费版与 VIP 版权益对照表
 * 2. 突出性价比标签，刺激首充转化
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
    const planTab = ref("vip");
    const vipPlans = ref([]);
    const creditPlans = ref([]);
    const loading = ref(false);

    const topUpForm = reactive({
      planId: "",
      unitPrice: 0,
      amount: 0,
      floatingAmount: "0.00",
      txId: "",
      orderType: "vip",
      credits: 0,
    });

    const payChannel = ref("wechat");
    const showManualInput = ref(true);
    const submitLoading = ref(false);

    const settings = computed(() => store.state.publicSettings || {});

    const isImageUrl = (url) => {
      const u = String(url || "").trim();
      return !!(u && /^https?:\/\//i.test(u) && /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(u));
    };

    const currentPayQrSrc = computed(() => {
      const raw = payChannel.value === "wechat" ? settings.value.wechat_qr_url || "" : settings.value.alipay_qr_url || "";
      const u = String(raw).trim();
      return isImageUrl(u) ? u : "";
    });

    const displayPlans = computed(() => (planTab.value === "credits" ? creditPlans.value : vipPlans.value));

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
      const base = Number(plan.price);
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
        vipPlans.value = vipRes.data || [];
        creditPlans.value = creditRes.data || [];
        if (displayPlans.value.length) {
          selectPlan(displayPlans.value[0]);
        }
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    const submitOrder = async () => {
      if (!topUpForm.planId) {
        store.showToast("请选择套餐", "error");
        return;
      }
      if (!/^\d{6}$/.test(topUpForm.txId)) {
        store.showToast("请填写转账凭证后 6 位数字", "error");
        return;
      }
      submitLoading.value = true;
      try {
        await planApi.submitOrder({
          planId: topUpForm.planId,
          amount: topUpForm.floatingAmount,
          txId: topUpForm.txId,
          orderType: topUpForm.orderType,
        });
        store.showToast("订单已提交，审核后自动开通！");
        topUpForm.txId = "";
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        submitLoading.value = false;
      }
    };

    onMounted(() => {
      loadPlans();
    });

    return {
      store: store.state,
      planTab,
      displayPlans,
      loading,
      topUpForm,
      payChannel,
      showManualInput,
      submitLoading,
      currentPayQrSrc,
      selectPlan,
      submitOrder,
    };
  },
  template: `
    <div class="max-w-4xl mx-auto space-y-6 select-none">
      <!-- 价值对比横幅 -->
      <div class="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-md">
        <h2 class="text-xl font-bold">为什么需要【监控 VIP】？</h2>
        <p class="text-xs text-slate-300 mt-1">少亏一手 ETF 的滑点手续费，换一个月客观理性的量化指标护航</p>
        <div class="grid grid-cols-2 gap-4 mt-4 text-xs">
          <div class="bg-white/10 rounded-xl p-3 border border-white/10">
            <div class="font-bold text-slate-400">免费访客权限</div>
            <div class="mt-1 text-slate-300">● 仅限前 3 只热门标的图表</div>
            <div>● 仅提供收盘后常规数据</div>
            <div>● 无法自选标的与投票</div>
          </div>
          <div class="bg-[#4da6a0]/20 rounded-xl p-3 border border-[#4da6a0]/30">
            <div class="font-bold text-emerald-300">监控 VIP 会员</div>
            <div class="mt-1 text-emerald-100">● 50+ 只核心 ETF 全周期图表</div>
            <div>● 盘中半日线（11:30）异常收敛与突破</div>
            <div>● 专属收藏、排序与票选决策权</div>
          </div>
        </div>
      </div>

      <div class="flex gap-2 text-sm">
        <button @click="planTab='vip'" class="px-5 py-2.5 rounded-lg border font-bold"
                :class="planTab==='vip'?'theme-bg text-white border-transparent':'bg-white text-slate-600'">
          开通监控 VIP
        </button>
        <button @click="planTab='credits'" class="px-5 py-2.5 rounded-lg border font-bold"
                :class="planTab==='credits'?'theme-bg text-white border-transparent':'bg-white text-slate-600'">
          购买查询次数
        </button>
      </div>

      <div v-if="loading" class="text-center py-10 text-slate-400 text-sm">加载中…</div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div v-for="plan in displayPlans" :key="plan.id" @click="selectPlan(plan)"
             class="bg-white rounded-xl border-2 p-5 cursor-pointer relative transition-all"
             :class="topUpForm.planId===plan.id?'theme-border ring-2 ring-[#4da6a0]/20 shadow-md':'border-slate-100'">
          <div v-if="plan.tag" class="absolute top-0 right-0 bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-bl font-bold">{{ plan.tag }}</div>
          <div class="text-slate-700 text-sm font-bold mb-1">{{ plan.name }}</div>
          <div class="text-3xl font-bold text-slate-800 mb-2">
            <span class="text-base text-slate-400">¥</span> {{ plan.price }}
          </div>
          <div class="text-xs text-slate-500">
            {{ planTab==='vip' ? plan.days + ' 天监控权限' : plan.credits + ' 次图表查询' }}
          </div>
        </div>
      </div>

      <!-- 支付收银台 -->
      <div v-if="topUpForm.planId" class="bg-white rounded-2xl border border-slate-100 p-6 max-w-lg mx-auto space-y-4 shadow-sm text-center">
        <div>
          <span class="text-xs text-slate-400">请扫码支付精准金额（自动匹配订单）</span>
          <div class="text-3xl font-extrabold text-red-500 font-mono mt-1">¥ {{ topUpForm.floatingAmount }}</div>
        </div>

        <div class="flex justify-center gap-2 text-xs">
          <button @click="payChannel='wechat'" class="px-4 py-1.5 rounded-full border" :class="payChannel==='wechat'?'theme-bg text-white border-transparent':''">微信支付</button>
          <button @click="payChannel='alipay'" class="px-4 py-1.5 rounded-full border" :class="payChannel==='alipay'?'theme-bg text-white border-transparent':''">支付宝</button>
        </div>

        <div class="w-48 h-48 bg-slate-50 rounded-xl p-2 border border-slate-200 mx-auto flex items-center justify-center">
          <img v-if="currentPayQrSrc" :src="currentPayQrSrc" class="w-full h-full object-contain" alt="收款码">
          <span v-else class="text-xs text-slate-400">请在后台配置收款码</span>
        </div>

        <div class="space-y-2 max-w-xs mx-auto text-left pt-2">
          <label class="text-xs text-slate-600 font-bold block">支付凭证（微信/支付宝交易号后 6 位）</label>
          <input v-model="topUpForm.txId" maxlength="6" placeholder="输入 6 位数字" class="w-full border rounded-lg px-3 py-2 text-center font-mono text-sm outline-none focus:theme-border">
          <button @click="submitOrder" :disabled="submitLoading" class="w-full theme-bg text-white py-2.5 rounded-lg text-xs font-bold disabled:opacity-50 shadow-sm hover:opacity-90">
            {{ submitLoading ? '提交中…' : '提交支付凭证' }}
          </button>
        </div>
      </div>
    </div>
  `,
};
