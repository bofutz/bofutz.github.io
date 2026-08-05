/**
 * 购买套餐
 * - 通用 / 定制 Tab
 * - 套餐选择、优惠码、浮动金额
 * - 支付即注册、收款码、提交订单
 */
import {
  ref, reactive, computed, watch, onMounted, nextTick,
} from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";
import { API_BASE } from "../../config.js";
import { isImageUrl, linkToQrSrc, pureCode } from "../../utils.js";
import { isLoggedIn } from "../../auth.js";

export const PlanView = {
  name: "PlanView",
  props: {
    publicSettings: { type: Object, default: () => ({}) },
    navigate: { type: Function, required: true },
    openAuth: { type: Function, required: true },
    customDraftItems: { type: Object, required: true },
    customDedupeTip: { type: Object, required: true },
    customMaxSymbols: { type: [Number, Object], required: true },
    customSymbolCount: { type: [Number, Object], required: true },
    dedupeCustomDraft: { type: Function, required: true },
  },
  setup(props) {
    const vipPlans = ref([]);
    const planTab = ref("shared");
    const showManualInput = ref(false);
    const payChannel = ref("alipay");
    const orderLoading = ref(false);
    const orderMessage = ref("");
    const promoInput = ref("");
    const promoChecking = ref(false);
    const promoValid = ref(false);
    const promoMessage = ref("");
    const orderList = ref([]);

    const topUpForm = reactive({
      planId: "",
      amount: 0,
      originalAmount: 0,
      floatingAmount: "0.00",
      txId: "",
      orderType: "vip",
      unitPrice: 0,
    });

    const payRegister = reactive({
      username: "",
      password: "",
      refCode: "",
    });

    // ---------- 计算属性 ----------
    const displayPlans = computed(() => {
      if (planTab.value === "custom") {
        return vipPlans.value.filter((p) => (p.plan_type || "") === "custom");
      }
      return vipPlans.value.filter(
        (p) => (p.plan_type || "shared") === "shared" || !p.plan_type
      );
    });

    const displayPayAmount = computed(() => topUpForm.floatingAmount);

    const currentPayQrSrc = computed(() => {
      const raw =
        payChannel.value === "wechat"
          ? props.publicSettings.wechat_qr_url || ""
          : props.publicSettings.alipay_qr_url || "";
      if (!raw || !String(raw).trim()) return "";
      const url = String(raw).trim();
      if (isImageUrl(url)) return url;
      return linkToQrSrc(url);
    });

    const maxSymbols = computed(() => {
      const v = props.customMaxSymbols;
      return typeof v === "object" && v?.value != null ? v.value : Number(v) || 3;
    });

    const symbolCount = computed(() => {
      const v = props.customSymbolCount;
      return typeof v === "object" && v?.value != null ? v.value : Number(v) || 0;
    });

    // ---------- 金额 ----------
    const generateFloatingAmount = (basePrice) => {
      const randCents = (Math.floor(Math.random() * 5) + 1) / 100;
      return (Number(basePrice) + randCents).toFixed(2);
    };

    // 定制 = 套餐总价（含最多 N 只），不按只数乘
    const recalcCustomPrice = () => {
      const base = Number(topUpForm.unitPrice) || 0;
      topUpForm.amount = base;
      topUpForm.originalAmount = base;
      if (!promoValid.value) {
        topUpForm.floatingAmount = generateFloatingAmount(base);
      }
    };

    const selectTopUpPlan = (plan) => {
      topUpForm.planId = plan.id;
      topUpForm.unitPrice = Number(plan.price);
      topUpForm.orderType =
        plan.plan_type === "custom" || planTab.value === "custom"
          ? "custom_watchlist"
          : "vip";
      promoValid.value = false;
      promoMessage.value = "";
      promoInput.value = "";
      const base = Number(plan.price);
      topUpForm.amount = base;
      topUpForm.originalAmount = base;
      topUpForm.floatingAmount = generateFloatingAmount(base);
    };

    // ---------- 优惠码 ----------
    const applyPromo = async () => {
      if (!promoInput.value.trim()) {
        promoMessage.value = "请输入优惠码";
        promoValid.value = false;
        return;
      }
      if (!topUpForm.planId) {
        alert("请先选择套餐");
        return;
      }
      promoChecking.value = true;
      try {
        const headers = { "Content-Type": "application/json" };
        const token = localStorage.getItem("etf_token");
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${API_BASE}/api/promo/check`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            plan_id: topUpForm.planId,
            promo_code: promoInput.value.trim(),
            quantity: 1,
          }),
        });
        const data = await res.json();
        if (data.success) {
          promoValid.value = true;
          promoMessage.value = `已优惠 ¥${data.discount}，实付基准 ¥${data.amount}`;
          topUpForm.originalAmount = data.original_amount;
          topUpForm.amount = data.amount;
          topUpForm.floatingAmount = generateFloatingAmount(data.amount);
        } else {
          promoValid.value = false;
          promoMessage.value = data.error || "优惠码无效";
        }
      } catch (_) {
        promoValid.value = false;
        promoMessage.value = "校验失败，请重试";
      } finally {
        promoChecking.value = false;
      }
    };

    // ---------- 套餐列表 ----------
    const fetchPlans = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/plans`);
        const data = await res.json();
        if (data.success && data.data?.length) {
          vipPlans.value = data.data;
          const list = displayPlans.value;
          if (list.length) {
            const current = list.find((p) => p.id === topUpForm.planId);
            selectTopUpPlan(current || list[0]);
          }
        }
      } catch (_) {}
    };

    const fetchOrders = async () => {
      if (!isLoggedIn.value) return;
      try {
        const token = localStorage.getItem("etf_token");
        const res = await fetch(`${API_BASE}/api/user/orders`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const data = await res.json();
        if (data.success) orderList.value = data.data || [];
      } catch (_) {}
    };

    // ---------- 提交订单 ----------
    const submitOrder = async () => {
      if (!/^\d{6}$/.test(topUpForm.txId)) {
        alert("请填写6位数字凭证");
        return;
      }

      if (!isLoggedIn.value) {
        if (!payRegister.username || !payRegister.password) {
          alert("未登录请填写注册账号和密码，或先登录");
          return;
        }
        if (String(payRegister.username).trim().length < 2) {
          alert("账号至少2个字符");
          return;
        }
        if (String(payRegister.password).length < 6) {
          alert("密码至少6位");
          return;
        }
      }

      if (isLoggedIn.value && orderList.value.some((o) => o.status === "pending")) {
        alert("您有待审核订单，请勿重复提交");
        return;
      }

      let customItems = null;
      if (planTab.value === "custom" || topUpForm.orderType === "custom_watchlist") {
        props.dedupeCustomDraft();
        const draft = props.customDraftItems?.value ?? props.customDraftItems ?? [];
        customItems = draft
          .map((r) => ({
            etf_code: String(r.etf_code || "").trim(),
            etf_name: String(r.etf_name || "").trim(),
          }))
          .filter((r) => r.etf_code);

        const pending = sessionStorage.getItem("pending_custom_items");
        if ((!customItems || !customItems.length) && pending) {
          try {
            customItems = JSON.parse(pending);
          } catch (_) {}
        }
        if (!customItems || !customItems.length) {
          alert("请填写至少一只定制标的代码");
          return;
        }
        if (customItems.length > maxSymbols.value) {
          alert(`定制套餐最多 ${maxSymbols.value} 只，当前 ${customItems.length} 只`);
          return;
        }
      }

      orderLoading.value = true;
      orderMessage.value = "";
      try {
        const body = {
          plan_id: topUpForm.planId,
          amount: Number(topUpForm.floatingAmount) || topUpForm.amount,
          tx_id_last6: topUpForm.txId,
          promo_code: promoValid.value ? promoInput.value.trim() : undefined,
          order_type:
            planTab.value === "custom" || topUpForm.orderType === "custom_watchlist"
              ? "custom_watchlist"
              : "vip",
        };
        if (customItems) body.custom_items = customItems;
        if (!isLoggedIn.value) {
          body.register_username = payRegister.username.trim();
          body.register_password = payRegister.password;
          if (payRegister.refCode) body.ref_code = payRegister.refCode;
        }

        const headers = { "Content-Type": "application/json" };
        const token = localStorage.getItem("etf_token");
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(`${API_BASE}/api/orders`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || "提交失败");

        orderMessage.value = "提交成功！等待审核开通";
        topUpForm.txId = "";
        sessionStorage.removeItem("pending_custom_items");
        if (isLoggedIn.value) {
          setTimeout(() => fetchOrders(), 1500);
        }
      } catch (err) {
        orderMessage.value = err.message;
      } finally {
        orderLoading.value = false;
      }
    };

    // ---------- 监听 ----------
    watch(planTab, (tab) => {
      const list =
        tab === "custom"
          ? vipPlans.value.filter((p) => p.plan_type === "custom")
          : vipPlans.value.filter(
              (p) => (p.plan_type || "shared") === "shared" || !p.plan_type
            );
      if (list.length) selectTopUpPlan(list[0]);
    });

    // 从 sessionStorage 恢复定制草稿（个人中心「去选套餐」跳转过来）
    const restorePendingCustom = () => {
      const pending = sessionStorage.getItem("pending_custom_items");
      if (!pending) return;
      try {
        const items = JSON.parse(pending);
        if (items?.length) {
          const draft = props.customDraftItems;
          if (draft && typeof draft === "object" && "value" in draft) {
            draft.value = items;
          }
          planTab.value = "custom";
          props.dedupeCustomDraft();
        }
      } catch (_) {}
    };

    // 默认支付渠道
    watch(
      () => props.publicSettings.default_pay_channel,
      (ch) => {
        if (ch) payChannel.value = ch;
      },
      { immediate: true }
    );

    onMounted(() => {
      fetchPlans();
      fetchOrders();
      nextTick(() => restorePendingCustom());
    });

    return {
      isLoggedIn,
      vipPlans,
      planTab,
      displayPlans,
      topUpForm,
      selectTopUpPlan,
      orderLoading,
      orderMessage,
      submitOrder,
      showManualInput,
      promoInput,
      promoChecking,
      promoValid,
      promoMessage,
      applyPromo,
      displayPayAmount,
      payRegister,
      payChannel,
      currentPayQrSrc,
      maxSymbols,
      symbolCount,
      // 透传 props 给模板用
      publicSettings: computed(() => props.publicSettings),
      customDraftItems: props.customDraftItems,
      customDedupeTip: props.customDedupeTip,
      dedupeCustomDraft: props.dedupeCustomDraft,
    };
  },

  template: `
    <div class="max-w-6xl mx-auto">
      <div class="mb-4">
        <h2 class="text-xl font-medium text-slate-800">选择套餐</h2>
        <p class="text-xs text-slate-400 mt-1">
          通用与定制独立计费 · 定制为套餐总价（含最多 {{ publicSettings.custom_max_symbols || 3 }} 只）· 游客可支付并同步注册
        </p>
      </div>

      <div class="flex gap-2 mb-6 text-sm">
        <button @click="planTab='shared'" class="px-4 py-2 rounded-lg border"
          :class="planTab==='shared'?'theme-bg text-white border-transparent':'bg-white'">通用监控</button>
        <button @click="planTab='custom'" class="px-4 py-2 rounded-lg border"
          :class="planTab==='custom'?'theme-bg text-white border-transparent':'bg-white'">定制监控</button>
      </div>

      <div v-if="displayPlans.length === 0" class="text-center py-12 text-slate-400">加载套餐中...</div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div v-for="plan in displayPlans" :key="plan.id" @click="selectTopUpPlan(plan)"
          class="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col cursor-pointer transition-all border-2 relative"
          :class="topUpForm.planId === plan.id ? 'theme-border ring-2 ring-[#4da6a0]/20' : 'border-transparent hover:border-slate-200'">
          <div v-if="plan.tag" class="absolute top-0 right-0 bg-orange-500 text-white text-[10px] px-2.5 py-0.5 rounded-bl">{{ plan.tag }}</div>
          <div class="p-5 sm:p-6 border-b border-slate-50 bg-slate-50/50">
            <div class="text-slate-500 text-sm mb-3">{{ plan.name }}</div>
            <div class="flex items-end mb-1">
              <span class="text-3xl font-light text-slate-800">¥ {{ plan.price }}</span>
            </div>
            <div class="text-slate-400 text-xs">
              有效期 {{ plan.days }} 个自然日
              <span v-if="planTab==='custom'"> · 含最多 {{ publicSettings.custom_max_symbols || 3 }} 只</span>
            </div>
          </div>
          <div class="p-5 flex-1">
            <ul class="text-xs text-slate-600 space-y-2 mb-4">
              <li v-if="planTab==='shared'">
                <i class="fa-solid fa-circle-check text-[#4da6a0] mr-2"></i> 解锁通用看板全部图表
              </li>
              <li v-if="planTab==='custom'">
                <i class="fa-solid fa-circle-check text-[#4da6a0] mr-2"></i>
                套餐总价 · 最多 {{ publicSettings.custom_max_symbols || 3 }} 只标的
              </li>
              <li><i class="fa-solid fa-circle-check text-[#4da6a0] mr-2"></i> 支持优惠码</li>
            </ul>
            <div class="w-full text-center py-2 rounded text-xs font-medium"
              :class="topUpForm.planId === plan.id ? 'theme-bg text-white' : 'bg-slate-100 text-slate-600'">
              {{ topUpForm.planId === plan.id ? '已选中' : '选择' }}
            </div>
          </div>
        </div>
      </div>

      <!-- 定制标的填写 -->
      <div v-if="planTab==='custom'" class="bg-white rounded-xl border p-5 mb-6 max-w-2xl mx-auto space-y-3">
        <div class="text-sm font-medium">
          定制标的（套餐总价，最多 {{ publicSettings.custom_max_symbols || 3 }} 只）
        </div>
        <div v-for="(row, i) in customDraftItems" :key="i" class="flex gap-2 items-center">
          <input v-model="row.etf_code" @blur="dedupeCustomDraft" placeholder="代码"
            class="w-28 px-2 py-2 border rounded-lg text-sm font-mono">
          <input v-model="row.etf_name" placeholder="名称" class="flex-1 px-2 py-2 border rounded-lg text-sm">
          <button v-if="customDraftItems.length>1"
            @click="customDraftItems.splice(i,1); dedupeCustomDraft()"
            class="text-slate-300 hover:text-red-500 px-1">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <button v-if="customDraftItems.length < (Number(publicSettings.custom_max_symbols)||3)"
          @click="customDraftItems.push({etf_code:'',etf_name:''})"
          class="text-xs theme-text">+ 再加一只</button>
        <p class="text-xs text-slate-500">
          已填 {{ symbolCount }} 只 · 应付套餐价 ¥{{ (Number(topUpForm.amount)||0).toFixed(2) }}
        </p>
        <p v-if="customDedupeTip" class="text-xs text-amber-600">
          <i class="fa-solid fa-circle-info mr-1"></i>{{ customDedupeTip }}
        </p>
      </div>

      <!-- 支付区 -->
      <div class="bg-white rounded-xl shadow-sm p-5 sm:p-8 max-w-2xl mx-auto border border-slate-100 space-y-5">
        <div class="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
          <label class="text-xs font-medium text-slate-600 mb-2 block">优惠码（选填）</label>
          <div class="flex gap-2">
            <input v-model="promoInput" type="text" placeholder="请输入优惠码"
              class="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono uppercase">
            <button @click="applyPromo" :disabled="promoChecking"
              class="px-4 py-2 theme-bg text-white rounded-lg text-xs disabled:opacity-50">
              {{ promoChecking ? '校验中' : '使用' }}
            </button>
          </div>
          <p v-if="promoMessage" class="text-xs mt-2"
            :class="promoValid ? 'text-emerald-600' : 'text-red-500'">{{ promoMessage }}</p>
        </div>

        <div v-if="!isLoggedIn" class="border border-amber-100 rounded-xl p-4 bg-amber-50/40 space-y-3">
          <div class="text-xs font-medium text-amber-800">
            <i class="fa-solid fa-user-plus mr-1"></i>
            未登录：支付成功后将用下方<strong>账号</strong>同步注册（可随意填写，不强制邮箱）
          </div>
          <input v-model="payRegister.username" type="text" placeholder="注册账号（必填，可随意填写）"
            class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
          <input v-model="payRegister.password" type="password" placeholder="设置密码（至少6位）"
            class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
          <input v-model="payRegister.refCode" type="text" placeholder="推荐码（选填）"
            class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
        </div>

        <div class="text-center">
          <div class="inline-flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full mb-3 border border-amber-200">
            <i class="fa-solid fa-triangle-exclamation"></i> 请严格支付下方金额
          </div>
          <h3 class="text-lg font-bold text-slate-800">扫码精准支付</h3>
          <div class="mt-2 flex items-baseline justify-center gap-1">
            <span class="text-sm text-slate-500">需支付:</span>
            <span class="text-3xl font-extrabold text-red-500 font-mono">¥{{ displayPayAmount }}</span>
            <span v-if="promoValid && topUpForm.originalAmount"
              class="text-sm text-slate-400 line-through ml-1">¥{{ topUpForm.originalAmount }}</span>
          </div>
        </div>

        <div class="flex justify-center gap-2 text-xs">
          <button @click="payChannel='alipay'" class="px-4 py-1.5 rounded-full border"
            :class="payChannel==='alipay'?'theme-bg text-white border-transparent':'bg-white'">支付宝</button>
          <button @click="payChannel='wechat'" class="px-4 py-1.5 rounded-full border"
            :class="payChannel==='wechat'?'theme-bg text-white border-transparent':'bg-white'">微信支付</button>
        </div>

        <div class="flex flex-col items-center">
          <div class="w-52 h-52 bg-slate-50 rounded-xl p-3 border-2 border-dashed border-slate-200 mb-3 flex items-center justify-center">
            <img v-if="currentPayQrSrc" :src="currentPayQrSrc" class="w-full h-full object-contain rounded-lg" alt="收款码">
            <span v-else class="text-xs text-slate-400 text-center px-4">
              请在后台配置{{ payChannel==='alipay'?'支付宝':'微信' }}收款码（图片URL或支付链接）
            </span>
          </div>
          <div class="bg-emerald-50 text-emerald-700 text-xs px-4 py-2.5 rounded-lg border border-emerald-100 max-w-md text-center">
            <p class="font-bold">请严格支付精准金额 {{ displayPayAmount }} 元</p>
            <p class="text-emerald-600 mt-1">付完后提交单号，审核通过即开通</p>
          </div>
        </div>

        <div class="max-w-xs mx-auto text-center space-y-3">
          <button @click="showManualInput = !showManualInput"
            class="text-xs text-slate-400 hover:text-slate-600">手动补填支付单号后6位</button>
          <div v-if="showManualInput" class="mt-3 space-y-2">
            <input v-model="topUpForm.txId" type="text" maxlength="6"
              class="w-full px-4 py-2 border border-slate-300 rounded text-center tracking-widest font-mono text-sm"
              placeholder="后6位数字">
            <button @click="submitOrder"
              :disabled="orderLoading || topUpForm.txId.length !== 6"
              class="w-full py-2 theme-bg text-white rounded text-xs font-medium disabled:opacity-50">
              提交单号充值
            </button>
          </div>
          <div v-if="orderMessage" class="text-xs px-3 py-2 rounded font-medium"
            :class="orderMessage.includes('成功') ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'">
            {{ orderMessage }}
          </div>
        </div>
      </div>
    </div>
  `,
};
