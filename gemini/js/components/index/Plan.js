/**
 * 波幅探长 - 购买套餐分块组件
 * js/components/index/Plan.js
 */
import { store } from "../../store.js";
import { planApi } from "../../api/plan.js";

const { ref, reactive, computed, onMounted } = Vue;

export default {
  name: "Plan",
  setup() {
    const plans = ref([]);
    const loading = ref(false);
    const planTab = ref("shared"); // 'shared' | 'custom' | 'both'

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

    const displayPlans = computed(() => {
      if (planTab.value === "custom") {
        return plans.value.filter((p) => p.plan_type === "custom");
      }
      if (planTab.value === "both") {
        return plans.value.filter((p) => p.plan_type === "both");
      }
      return plans.value.filter((p) => p.plan_type === "shared" || !p.plan_type);
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
      topUpForm.orderType = plan.plan_type === "custom" ? "custom_watchlist" : "vip";
      promoValid.value = false;
      promoMessage.value = "";
    };

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
      selectPlan,
      applyPromo,
      submitOrder,
    };
  },
  template: `
    <div class="max-w-5xl mx-auto space-y-6 select-none">
      <div>
        <h2 class="text-2xl font-bold text-slate-800">选择服务套餐</h2>
        <p class="text-xs text-slate-400 mt-1">支持通用监控、定制监控与通用+定制多重套餐模式，未登录支持自动注册开通。</p>
      </div>

      <!-- 选项卡切换 -->
      <div class="flex gap-2 text-sm">
        <button @click="planTab='shared'" class="px-4 py-2 rounded-lg border transition-all" :class="planTab==='shared'?'theme-bg text-white border-transparent font-bold':'bg-white text-slate-600'">通用监控</button>
        <button @click="planTab='custom'" class="px-4 py-2 rounded-lg border transition-all" :class="planTab==='custom'?'theme-bg text-white border-transparent font-bold':'bg-white text-slate-600'">定制监控</button>
        <button @click="planTab='both'" class="px-4 py-2 rounded-lg border transition-all" :class="planTab==='both'?'theme-bg text-white border-transparent font-bold':'bg-white text-slate-600'">通用+定制双重套餐</button>
      </div>

      <!-- 套餐卡片网格 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="plan in displayPlans" :key="plan.id" @click="selectPlan(plan)"
             class="bg-white rounded-xl shadow-sm border-2 p-5 cursor-pointer relative transition-all flex flex-col justify-between"
             :class="topUpForm.planId === plan.id ? 'theme-border ring-2 ring-[#4da6a0]/20' : 'border-slate-100 hover:border-slate-200'">
          <div v-if="plan.tag" class="absolute top-0 right-0 bg-orange-500 text-white text-[10px] px-2.5 py-0.5 rounded-bl font-bold">{{ plan.tag }}</div>
          <div>
            <div class="text-slate-500 text-sm mb-2">{{ plan.name }}</div>
            <div class="text-3xl font-light text-slate-800 mb-2">¥ {{ plan.price }}</div>
            <div class="text-xs text-slate-400">有效期 {{ plan.days }} 个自然日</div>
          </div>
          <button class="w-full mt-4 py-2 rounded-lg text-xs font-bold transition-colors" :class="topUpForm.planId === plan.id ? 'theme-bg text-white' : 'bg-slate-100 text-slate-600'">
            {{ topUpForm.planId === plan.id ? '已选中' : '选择套餐' }}
          </button>
        </div>
      </div>

      <!-- 支付与单号提交卡片 -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 max-w-2xl mx-auto space-y-5">
        <div class="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
          <label class="text-xs font-bold text-slate-600 mb-2 block">优惠码 (选填)</label>
          <div class="flex gap-2">
            <input v-model="promoInput" type="text" placeholder="输入优惠码" class="flex-1 px-3 py-2 border rounded-lg text-sm font-mono uppercase focus:theme-border outline-none">
            <button @click="applyPromo" :disabled="promoChecking" class="px-4 py-2 theme-bg text-white rounded-lg text-xs disabled:opacity-50">校验</button>
          </div>
          <p v-if="promoMessage" class="text-xs mt-2" :class="promoValid ? 'text-emerald-600' : 'text-red-500'">{{ promoMessage }}</p>
        </div>

        <div v-if="!store.isLoggedIn" class="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-3">
          <div class="text-xs font-bold text-amber-800">游客支付即注册</div>
          <input v-model="payRegister.username" type="text" placeholder="设置登录账号 (不强制邮箱)" class="w-full px-3 py-2 border rounded-lg text-sm focus:theme-border outline-none">
          <input v-model="payRegister.password" type="password" placeholder="设置密码 (至少6位)" class="w-full px-3 py-2 border rounded-lg text-sm focus:theme-border outline-none">
        </div>

        <div class="text-center">
          <div class="text-xs text-slate-400 mb-1">精准应付金额</div>
          <div class="text-3xl font-extrabold text-red-500 font-mono">¥ {{ topUpForm.floatingAmount }}</div>
        </div>

        <div class="flex justify-center gap-2 text-xs">
          <button @click="payChannel='alipay'" class="px-4 py-1.5 rounded-full border" :class="payChannel==='alipay'?'theme-bg text-white border-transparent':'bg-white'">支付宝</button>
          <button @click="payChannel='wechat'" class="px-4 py-1.5 rounded-full border" :class="payChannel==='wechat'?'theme-bg text-white border-transparent':'bg-white'">微信支付</button>
        </div>

        <div class="max-w-xs mx-auto text-center space-y-3">
          <button @click="showManualInput = !showManualInput" class="text-xs text-slate-400 hover:text-slate-600">手动提交支付单号后 6 位</button>
          <div v-if="showManualInput" class="space-y-2">
            <input v-model="topUpForm.txId" type="text" maxlength="6" placeholder="后 6 位数字" class="w-full px-4 py-2 border rounded-lg text-center font-mono text-sm">
            <button @click="submitOrder" :disabled="submitLoading" class="w-full py-2.5 theme-bg text-white rounded-lg text-xs font-bold">提交审核</button>
          </div>
        </div>
      </div>
    </div>
  `,
};
