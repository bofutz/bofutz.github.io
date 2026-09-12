/* ========================= FILE: .\js\components\index\Plan.js ========================= */

/**
 * 波幅探长 - 会员套餐与收银中心
 * js/components/index/Plan.js
 */
import { store } from "../../store.js";
import { planApi } from "../../api/plan.js";
import { request } from "../../api/http.js";

const { ref, reactive, computed, onMounted } = Vue;

// 固定的微信收款二维码地址
const WECHAT_PAY_QR = "https://bofutz.github.io/webpic/wechatpay.jpg";

export default {
  name: "Plan",
  setup() {
    const loading = ref(false);
    const submitting = ref(false);
    const allPlansList = ref([]);
    const currentTab = ref("vip"); // vip | credit

    const selectedPlan = ref(null);
    const promoCode = ref("");
    const txIdLast6 = ref("");
    const dynamicSettings = ref({});

    const settings = computed(() => {
      return Object.keys(dynamicSettings.value).length ? dynamicSettings.value : (store.state.publicSettings || {});
    });

    const activeQrUrl = computed(() => {
      const s = settings.value || {};
      return s.wechat_qr_url || s.alipay_qr_url || WECHAT_PAY_QR;
    });

    const parseResponseData = (res) => {
      if (!res) return [];
      if (Array.isArray(res)) return res;
      if (Array.isArray(res.data)) return res.data;
      if (Array.isArray(res.plans)) return res.plans;
      if (Array.isArray(res.items)) return res.items;
      return [];
    };

    const loadData = async () => {
      loading.value = true;
      try {
        const [plansRes, settingsRes] = await Promise.all([
          planApi.fetchPlans().catch(() => []),
          request("/api/public-settings").catch(() => ({})),
        ]);

        if (settingsRes?.settings || settingsRes?.data) {
          dynamicSettings.value = settingsRes.settings || settingsRes.data;
        }

        const rawList = parseResponseData(plansRes);
        allPlansList.value = rawList;

        const vips = rawList.filter(p => (p.order_type || p.plan_type || "vip") === "vip");
        if (vips.length) {
          selectedPlan.value = vips.find(p => p.is_hot || p.tag) || vips[0];
        } else if (rawList.length) {
          selectedPlan.value = rawList[0];
        }
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    const displayPlans = computed(() => {
      const list = allPlansList.value || [];
      if (!list.length) return [];
      return list.filter(item => {
        const type = item.order_type || item.plan_type || (item.credits ? "credit" : "vip");
        return currentTab.value === "vip" ? type === "vip" : (type === "credit" || type === "chart_credits");
      });
    });

    const selectPlan = (plan) => {
      selectedPlan.value = plan;
    };

    const calcPerDay = (plan) => {
      if (!plan) return "0.0";
      const days = Number(plan.days || plan.vip_days || plan.duration_days || 0);
      const price = Number(plan.price || plan.amount || 0);
      if (!days || !price) return "0.0";
      return (price / days).toFixed(1);
    };

    const submitOrder = async () => {
      if (!store.state.isLoggedIn) {
        store.showToast("请先在右上角微信快捷登录", "error");
        store.state.authModalVisible = true;
        return;
      }
      if (!selectedPlan.value) {
        store.showToast("请选择需要开通的套餐", "error");
        return;
      }
      const tx6 = String(txIdLast6.value || "").trim();
      if (!/^\d{4,8}$/.test(tx6)) {
        store.showToast("请输入转账单号后 6 位数字", "error");
        return;
      }

      submitting.value = true;
      try {
        const payload = {
          plan_id: selectedPlan.value.id || selectedPlan.value.plan_id,
          amount: selectedPlan.value.price || selectedPlan.value.amount,
          tx_id_last6: tx6,
          order_type: currentTab.value === "vip" ? "vip" : "chart_credits",
          promo_code: promoCode.value.trim() || undefined,
        };

        await planApi.createOrder(payload);
        store.showToast("订单凭证提交成功！系统核销后即刻到账", "success");
        txIdLast6.value = "";
        promoCode.value = "";
        setTimeout(() => {
          window.location.hash = "#/profile";
        }, 1200);
      } catch (err) {
        store.showToast(err.message || "提交失败，请重试", "error");
      } finally {
        submitting.value = false;
      }
    };

    onMounted(() => {
      loadData();
    });

    return {
      store: store.state,
      loading,
      submitting,
      currentTab,
      displayPlans,
      selectedPlan,
      promoCode,
      txIdLast6,
      activeQrUrl,
      selectPlan,
      calcPerDay,
      submitOrder,
    };
  },
  template: `
    <div class="max-w-4xl mx-auto space-y-5 select-none pb-12">
      <!-- 促单横幅 -->
      <div class="bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 text-white p-3.5 rounded-2xl shadow-md flex items-center justify-between text-xs sm:text-sm font-medium">
        <div class="flex items-center gap-2">
          <span class="bg-white text-red-600 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase shadow-sm">限时福利</span>
          <span>开通<strong>季度及以上套餐</strong>，系统自动加赠 <strong>7 个交易日</strong> 会员时长！</span>
        </div>
        <div class="hidden sm:block text-xs font-mono opacity-90">
          今日名额剩余：3 位
        </div>
      </div>

      <!-- 分类切换 -->
      <div class="flex bg-slate-100 p-1 rounded-xl max-w-xs mx-auto border border-slate-200/60">
        <button type="button" @click="currentTab='vip'"
                class="flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all"
                :class="currentTab==='vip' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
          <i class="fa-solid fa-crown text-amber-500 mr-1"></i> 多空监控 VIP
        </button>
        <button type="button" @click="currentTab='credit'"
                class="flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all"
                :class="currentTab==='credit' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
          <i class="fa-solid fa-bolt text-teal-500 mr-1"></i> 自选出图次数
        </button>
      </div>

      <!-- 加载中状态 -->
      <div v-if="loading" class="text-center py-12 text-slate-400">
        <i class="fa-solid fa-spinner animate-spin text-2xl theme-text"></i>
        <p class="mt-2 text-sm">读取量化配置套餐中...</p>
      </div>

      <!-- 套餐卡片网格 -->
      <div v-else-if="displayPlans.length" class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div v-for="plan in displayPlans" :key="plan.id || plan.plan_id"
             @click="selectPlan(plan)"
             class="cursor-pointer rounded-2xl p-4 sm:p-5 border transition-all relative overflow-hidden flex flex-col justify-between"
             :class="selectedPlan?.id === plan.id
               ? 'bg-gradient-to-b from-amber-50/60 to-white border-amber-400 shadow-md ring-2 ring-amber-400/20'
               : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm'">

          <div v-if="plan.tag || plan.badge" class="absolute top-0 right-0 text-[10px] font-extrabold px-2.5 py-0.5 rounded-bl-lg text-white shadow-sm bg-gradient-to-r from-red-500 to-amber-500">
            {{ plan.tag || plan.badge }}
          </div>

          <div>
            <div class="text-sm sm:text-base font-bold text-slate-800">{{ plan.name || plan.title }}</div>
            <div class="text-[11px] text-slate-400 mt-0.5">
              {{ plan.days || plan.vip_days }} 个交易日监控
            </div>

            <div class="my-3">
              <span class="text-xs font-bold text-red-500 font-mono">¥</span>
              <span class="text-2xl sm:text-3xl font-extrabold text-red-500 font-mono tracking-tight">{{ plan.price || plan.amount }}</span>
            </div>
          </div>

          <div class="pt-2 border-t border-slate-100/80">
            <div class="text-[11px] text-amber-600 font-medium">
              折合仅 <strong class="font-mono text-sm">¥{{ calcPerDay(plan) }}</strong>/天
            </div>
          </div>
        </div>
      </div>

      <div v-else class="text-center py-10 bg-white rounded-2xl border text-slate-400 text-sm">
        暂无此类套餐，请在后台配置。
      </div>

      <!-- 会员权益矩阵 -->
      <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm space-y-3">
        <div class="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <i class="fa-solid fa-shield-halved text-emerald-500"></i> 会员尊享权益：
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600">
          <div class="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <i class="fa-solid fa-chart-line text-emerald-500"></i>
            <span>50+ 热门 ETF 多周期通道全量解锁</span>
          </div>
          <div class="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <i class="fa-solid fa-bell text-amber-500"></i>
            <span>盘中 11:30 异常波幅极值抢先监控</span>
          </div>
          <div class="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <i class="fa-solid fa-headset text-blue-500"></i>
            <span>专属客服答疑与标的票选入池权</span>
          </div>
        </div>
      </div>

      <!-- 支付核销收银台 -->
      <div class="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-sm flex flex-col sm:flex-row gap-6 items-center justify-between">
        <div class="flex flex-col items-center shrink-0">
          <div class="w-44 h-44 p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center shadow-sm">
            <img :src="activeQrUrl" class="w-full h-full object-contain rounded-lg" alt="微信收款二维码"
                 @error="$event.target.src='https://bofutz.github.io/webpic/wechatpay.jpg'">
          </div>
          <p class="text-xs text-slate-600 mt-2 font-bold flex items-center gap-1">
            <i class="fa-brands fa-weixin text-emerald-500 text-sm"></i> 微信扫码快捷支付
          </p>
        </div>

        <div class="flex-1 w-full space-y-3.5">
          <div class="flex items-center justify-between border-b border-slate-100 pb-2">
            <div class="text-xs text-slate-500">充值开通账号：<strong class="text-slate-800">{{ store.username || '未登录' }}</strong></div>
            <div class="text-right">
              <span class="text-xs text-slate-400">应付金额：</span>
              <span class="text-xl font-extrabold text-red-500 font-mono">¥ {{ selectedPlan?.price || selectedPlan?.amount || '0.0' }}</span>
            </div>
          </div>

          <div class="space-y-2">
            <div>
              <label class="text-[11px] font-bold text-slate-600 block mb-1">转账单号后 6 位数字（用于秒级自动核销）</label>
              <input v-model="txIdLast6" type="text" maxlength="8" placeholder="微信支付账单详情中的后 6 位"
                     class="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm tracking-wider focus:theme-border outline-none">
            </div>

            <div>
              <input v-model="promoCode" type="text" placeholder="优惠代码（选填）"
                     class="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono uppercase focus:theme-border outline-none">
            </div>
          </div>

          <button type="button" @click="submitOrder" :disabled="submitting || !selectedPlan"
                  class="w-full theme-bg text-white py-2.5 rounded-xl text-sm font-bold shadow-md hover:opacity-90 disabled:opacity-50 transition-opacity">
            {{ submitting ? '提交核销中...' : '提交凭证 · 立即开通' }}
          </button>
        </div>
      </div>
    </div>
  `,
};
