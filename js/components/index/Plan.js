/* ========================= FILE: .\js\components\index\Plan.js ========================= */

/**
 * 波幅探长 - 会员套餐与收银中心（高转化优化版）
 * js/components/index/Plan.js
 */
import { store } from "../../store.js";
import { planApi } from "../../api/plan.js";

const { ref, reactive, computed, onMounted } = Vue;

export default {
  name: "Plan",
  setup() {
    const loading = ref(false);
    const submitting = ref(false);
    const plans = ref([]);
    const creditPlans = ref([]);
    const currentTab = ref("vip"); // vip (按交易日) | credit (按次包)

    const selectedPlan = ref(null);
    const promoCode = ref("");
    const txIdLast6 = ref("");

    const settings = computed(() => store.state.publicSettings || {});

    // 收银渠道二维码
    const wechatQr = computed(() => {
      const u = settings.value.wechat_qr_url || settings.value.gzh_qr_url || "";
      return String(u).trim();
    });
    const alipayQr = computed(() => {
      const u = settings.value.alipay_qr_url || "";
      return String(u).trim();
    });

    const activeQrUrl = computed(() => wechatQr.value || alipayQr.value || "");

    const loadPlans = async () => {
      loading.value = true;
      try {
        const [pRes, cRes] = await Promise.all([
          planApi.fetchPlans().catch(() => ({ data: [] })),
          planApi.fetchCreditPlans().catch(() => ({ data: [] })),
        ]);

        let rawPlans = pRes.data || pRes || [];
        // 若后台尚未配置套餐，提供一套黄金商业转化默认方案
        if (!rawPlans || !rawPlans.length) {
          rawPlans = [
            { id: "trial_10d", name: "体验周卡", price: 9.9, days: 10, tag: "新手尝鲜", is_hot: false },
            { id: "vip_month", name: "月度VIP", price: 29.9, days: 30, tag: "进阶优选", is_hot: false },
            { id: "vip_quarter", name: "季度VIP", price: 69.9, days: 90, tag: "超值推荐·热销", is_hot: true },
            { id: "vip_year", name: "年度旗舰", price: 199.0, days: 365, tag: "全权尊享", is_hot: false },
          ];
        }
        plans.value = rawPlans;

        let rawCredits = cRes.data || cRes || [];
        if (!rawCredits || !rawCredits.length) {
          rawCredits = [
            { id: "c_10", name: "10次体验包", price: 9.9, credits: 10, tag: "基础" },
            { id: "c_40", name: "40次进阶包", price: 29.9, credits: 40, tag: "赠10次·特惠" },
            { id: "c_100", name: "100次高频包", price: 59.9, credits: 100, tag: "单次0.59元" },
          ];
        }
        creditPlans.value = rawCredits;

        // 默认选中主推热销套餐
        const hot = plans.value.find((p) => p.is_hot || (p.tag && p.tag.includes("热销"))) || plans.value[1] || plans.value[0];
        selectedPlan.value = hot;
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    const selectPlan = (plan) => {
      selectedPlan.value = plan;
    };

    // 每日单价心理锚点计算
    const perDayPrice = (plan) => {
      if (!plan || !plan.days) return "0.0";
      return (Number(plan.price) / Number(plan.days)).toFixed(1);
    };

    // 提交订单凭证
    const submitOrder = async () => {
      if (!store.state.isLoggedIn) {
        store.showToast("请先登录或设置专属昵称", "error");
        store.state.authModalVisible = true;
        return;
      }
      if (!selectedPlan.value) {
        store.showToast("请选择需要开通的套餐", "error");
        return;
      }
      const tx6 = String(txIdLast6.value || "").trim();
      if (!/^\d{4,8}$/.test(tx6)) {
        store.showToast("请输入支付订单号后 6 位数字凭证", "error");
        return;
      }

      submitting.value = true;
      try {
        const payload = {
          plan_id: selectedPlan.value.id,
          amount: selectedPlan.value.price,
          tx_id_last6: tx6,
          order_type: currentTab.value === "vip" ? "vip" : "chart_credits",
          promo_code: promoCode.value.trim() || undefined,
        };

        const res = await planApi.createOrder(payload);
        store.showToast("订单已提交！管理员与 TG 机器人审核后将秒级到账", "success");
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
      loadPlans();
    });

    return {
      store: store.state,
      loading,
      submitting,
      plans,
      creditPlans,
      currentTab,
      selectedPlan,
      promoCode,
      txIdLast6,
      activeQrUrl,
      selectPlan,
      perDayPrice,
      submitOrder,
    };
  },
  template: `
    <div class="max-w-4xl mx-auto space-y-5 select-none pb-12">
      <!-- 促单横幅：新客特惠与限时加赠氛围 -->
      <div class="bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 text-white p-3.5 rounded-2xl shadow-md flex items-center justify-between text-xs sm:text-sm font-medium">
        <div class="flex items-center gap-2">
          <span class="bg-white text-red-600 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase shadow-sm">限时福利</span>
          <span>开通<strong>季度及以上套餐</strong>，系统自动加赠 <strong>7 个交易日</strong> 会员时长！</span>
        </div>
        <div class="hidden sm:block text-xs font-mono opacity-90">
          今日特惠剩余名额：仅 3 位
        </div>
      </div>

      <!-- 套餐类型切换 (监控 VIP vs 自主出图点数) -->
      <div class="flex bg-slate-100 p-1 rounded-xl max-w-xs mx-auto border border-slate-200/60">
        <button type="button" @click="currentTab='vip'; selectedPlan=plans[1] || plans[0]"
                class="flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all"
                :class="currentTab==='vip' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
          <i class="fa-solid fa-crown text-amber-500 mr-1"></i> 多空监控 VIP
        </button>
        <button type="button" @click="currentTab='credit'; selectedPlan=creditPlans[1] || creditPlans[0]"
                class="flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all"
                :class="currentTab==='credit' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
          <i class="fa-solid fa-bolt text-teal-500 mr-1"></i> 自选出图次数
        </button>
      </div>

      <!-- VIP 套餐卡片网格 -->
      <div v-if="currentTab==='vip'" class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div v-for="plan in plans" :key="plan.id"
             @click="selectPlan(plan)"
             class="cursor-pointer rounded-2xl p-4 sm:p-5 border transition-all relative overflow-hidden flex flex-col justify-between"
             :class="selectedPlan?.id === plan.id
               ? 'bg-gradient-to-b from-amber-50/50 to-white border-amber-400 shadow-md ring-2 ring-amber-400/20'
               : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm'">

          <!-- 热门/角标 -->
          <div v-if="plan.tag" class="absolute top-0 right-0 text-[10px] font-extrabold px-2.5 py-0.5 rounded-bl-lg text-white shadow-sm"
               :class="plan.tag.includes('热销') ? 'bg-gradient-to-r from-red-500 to-amber-500' : 'bg-slate-700'">
            {{ plan.tag }}
          </div>

          <div>
            <div class="text-sm font-bold text-slate-800">{{ plan.name }}</div>
            <div class="text-[11px] text-slate-400 mt-0.5">{{ plan.days }} 个交易日监控</div>

            <div class="my-3">
              <span class="text-xs font-bold text-red-500 font-mono">¥</span>
              <span class="text-2xl sm:text-3xl font-extrabold text-red-500 font-mono tracking-tight">{{ plan.price }}</span>
            </div>
          </div>

          <div class="pt-2 border-t border-slate-100/80">
            <div class="text-[11px] text-amber-600 font-medium">
              折合仅 <strong class="font-mono text-sm">¥{{ perDayPrice(plan) }}</strong>/天
            </div>
          </div>
        </div>
      </div>

      <!-- 次数包卡片网格 -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div v-for="cplan in creditPlans" :key="cplan.id"
             @click="selectPlan(cplan)"
             class="cursor-pointer rounded-2xl p-4 sm:p-5 border transition-all relative overflow-hidden flex flex-col justify-between"
             :class="selectedPlan?.id === cplan.id
               ? 'bg-gradient-to-b from-teal-50/40 to-white border-teal-500 shadow-md ring-2 ring-teal-500/20'
               : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm'">

          <div v-if="cplan.tag" class="absolute top-0 right-0 bg-teal-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
            {{ cplan.tag }}
          </div>

          <div>
            <div class="text-sm font-bold text-slate-800">{{ cplan.name }}</div>
            <div class="text-xs text-slate-400 mt-0.5">全市场任意标的自主通道计算</div>

            <div class="my-3">
              <span class="text-xs font-bold text-teal-600 font-mono">¥</span>
              <span class="text-2xl sm:text-3xl font-extrabold text-teal-600 font-mono">{{ cplan.price }}</span>
              <span class="text-xs text-slate-400 ml-1">/ {{ cplan.credits }}次</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 会员特权矩阵列表 -->
      <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm space-y-3">
        <div class="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <i class="fa-solid fa-shield-halved text-emerald-500"></i> 会员权益包含：
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
            <span>专属客服答疑与标的入池优先投票权</span>
          </div>
        </div>
      </div>

      <!-- 支付结账台 -->
      <div class="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-sm flex flex-col sm:flex-row gap-6 items-center justify-between">
        <!-- 二维码 -->
        <div class="flex flex-col items-center shrink-0">
          <div class="w-40 h-40 p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center">
            <img v-if="activeQrUrl" :src="activeQrUrl" class="w-full h-full object-contain rounded-lg" alt="收银二维码">
            <div v-else class="text-xs text-slate-400 text-center">
              <i class="fa-solid fa-qrcode text-3xl mb-1 text-slate-300"></i>
              <p>请在后台配置收款二维码</p>
            </div>
          </div>
          <p class="text-[11px] text-slate-500 mt-2 font-medium">微信 / 支付宝扫码支付</p>
        </div>

        <!-- 凭证核销提交区 -->
        <div class="flex-1 w-full space-y-3.5">
          <div class="flex items-center justify-between border-b border-slate-100 pb-2">
            <div class="text-xs text-slate-500">待开通账号：<strong class="text-slate-800">{{ store.username || '未登录' }}</strong></div>
            <div class="text-right">
              <span class="text-xs text-slate-400">应付总额：</span>
              <span class="text-xl font-extrabold text-red-500 font-mono">¥ {{ selectedPlan?.price || '0.0' }}</span>
            </div>
          </div>

          <div class="space-y-2">
            <div>
              <label class="text-[11px] font-bold text-slate-600 block mb-1">转账单号后 6 位数字（用于秒级自动核销）</label>
              <input v-model="txIdLast6" type="text" maxlength="8" placeholder="微信/支付宝账单详情中的后6位数字"
                     class="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm tracking-wider focus:theme-border outline-none">
            </div>

            <div>
              <input v-model="promoCode" type="text" placeholder="优惠券代码（选填）"
                     class="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono uppercase focus:theme-border outline-none">
            </div>
          </div>

          <button type="button" @click="submitOrder" :disabled="submitting || !selectedPlan"
                  class="w-full theme-bg text-white py-2.5 rounded-xl text-sm font-bold shadow-md hover:opacity-90 disabled:opacity-50 transition-opacity">
            {{ submitting ? '核销中...' : '提交凭证 · 立即开通' }}
          </button>
        </div>
      </div>
    </div>
  `,
};
