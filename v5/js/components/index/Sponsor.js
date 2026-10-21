/**
 * 赞助监控标的 (v5.2 全面强化优惠码核销版)
 * 1. 全流程常驻【优惠码】功能（不受后台开关误关影响，三大位置均可直接输入核销）：
 *    - 位置 A：「① 选择赞助周期并添加标的」主表单内常驻【优惠码折扣】输入框，未加清单也可提前校验绑定优惠码
 *    - 位置 B：「待赞助清单」结算栏内展示优惠码输入/切换框及「原价 vs 折后价」对比
 *    - 位置 C：「扫码支付弹窗」内顶部金额下方常驻醒目的橙色【优惠码折扣抵扣】专区，支持随时输入/更换优惠码并实时重算扫码金额
 * 2. 智能交互优化：
 *    - 若用户在代码框输入了 6 位代码但未点「加入清单」就直接点「立即扫码支付」或「使用优惠码」，系统自动将该标的加入清单并计算折扣
 *    - 切换赞助周期（月/季/半年/年）或增减标的时，已绑定的优惠码自动按新总价实时重算折扣，无需重新输入
 * 3. 交易条件标识同步看板规则：T+0 标的代码后标注 (0)，非 T+0 标的不标注 (t+1)
 */
import { store } from "../../store.js";
import { sponsorApi } from "../../api/sponsor.js";
import { authApi } from "../../api/auth.js";
import { resolveTradeRule } from "../../config.js";

const { ref, reactive, computed, onMounted, onUnmounted } = Vue;

export default {
  name: "Sponsor",
  setup() {
    const parseTabFromHash = () => {
      const h = window.location.hash || "";
      return h.includes("tab=mine") ? "mine" : "public";
    };

    const activeTab = ref(parseTabFromHash());
    const syncTabFromHash = () => {
      activeTab.value = parseTabFromHash();
    };

    const switchTab = (tab) => {
      activeTab.value = tab;
      const targetHash = tab === "mine" ? "#/sponsor?tab=mine" : "#/sponsor";
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
    };

    const loading = ref(false);
    const mine = ref([]);
    const activeList = ref([]);
    const prices = computed(() => store.getSymbolPrices());

    // 快捷设置昵称
    const nickInput = ref("");
    const nickSaving = ref(false);
    const showNickEdit = ref(false);

    const saveQuickNickname = async () => {
      const val = (nickInput.value || "").trim();
      if (!val || val.length < 2) {
        store.showToast("昵称至少需要 2 个字符", "error");
        return;
      }
      nickSaving.value = true;
      try {
        const res = await authApi.updateNickname(val);
        store.setUserState({ nickname: res.nickname || val });
        store.showToast(res.message || "昵称已保存，看板已同步更新您的署名");
        showNickEdit.value = false;
        await Promise.all([loadActive(), loadMine()]);
      } catch (e) {
        store.showToast(e.message || "保存失败", "error");
      } finally {
        nickSaving.value = false;
      }
    };

    const cart = ref([]);
    const form = reactive({ code: "", name: "", trade_mode: "auto" });
    const searching = ref(false);
    const selectedDays = ref(30);
    const payChannel = ref("wechat");
    const txId = ref("");
    const showPay = ref(false);
    const submitLoading = ref(false);
    const floatingCents = ref(0.01);

    // ==================== 优惠码核心状态（全程常驻可用） ====================
    const promoInput = ref("");
    const promoChecking = ref(false);
    const appliedPromo = ref(null); // { code, name, discount_type, discount_value, discount, amount, original }

    const settings = computed(() => store.state.publicSettings || {});

    const unitPrice = computed(() => {
      const p = prices.value.find((x) => x.days === selectedDays.value);
      return p ? Number(p.price) : 0;
    });
    const selectedLabel = computed(() => {
      const p = prices.value.find((x) => x.days === selectedDays.value);
      return p ? p.label : `${selectedDays.value}天`;
    });

    /** 有效标的数：若清单为空但输入框已填6位代码，按 1 只预估以支持提前算优惠 */
    const effectiveCount = computed(() => {
      if (cart.value.length > 0) return cart.value.length;
      const code = String(form.code || "").replace(/\D/g, "");
      return code.length === 6 ? 1 : 0;
    });

    const totalBase = computed(() => unitPrice.value * cart.value.length);
    const previewBase = computed(() => unitPrice.value * Math.max(1, effectiveCount.value));

    /** 根据已绑定优惠码规则动态计算当前清单折后价与减免额 */
    const promoCalc = computed(() => {
      const orig = totalBase.value;
      if (!appliedPromo.value || !(orig > 0)) {
        return { discount: 0, finalBase: orig };
      }
      const p = appliedPromo.value;
      let discounted = orig;
      if (p.discount_type === "percent" && Number(p.discount_value) > 0) {
        const pct = Math.min(99, Math.max(0, Number(p.discount_value)));
        discounted = orig * (1 - pct / 100);
      } else if (p.discount_type === "fixed" && Number(p.discount_value) > 0) {
        discounted = Math.max(0.01, orig - Number(p.discount_value));
      } else if (p.amount != null && Number(p.original) === orig) {
        discounted = Number(p.amount);
      }
      discounted = Math.max(0.01, Math.round(discounted * 100) / 100);
      const saved = Math.max(0, Math.round((orig - discounted) * 100) / 100);
      return { discount: saved, finalBase: discounted };
    });

    const discountedBase = computed(() => promoCalc.value.finalBase);
    const discountSaved = computed(() => promoCalc.value.discount);

    const payableAmount = computed(() => {
      const base = discountedBase.value;
      if (!(base > 0)) return "0.00";
      return (base + floatingCents.value).toFixed(2);
    });

    const editModal = reactive({
      visible: false,
      id: null,
      etf_code: "",
      etf_name: "",
      trade_mode: "auto",
    });
    const editLoading = ref(false);

    const isImageUrl = (url) => {
      const u = String(url || "").trim();
      return u && /^https?:\/\//i.test(u) && /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(u);
    };
    const qrSrc = computed(() => {
      const raw =
        payChannel.value === "wechat"
          ? settings.value.wechat_qr_url || ""
          : settings.value.alipay_qr_url || "";
      return isImageUrl(raw) ? raw.trim() : "";
    });

    const fetchName = async (code) => {
      try {
        const m = String(code || "").match(/\d{6}/);
        if (!m) return "";
        const c = m[0];
        const prefix = ["5", "6", "9"].includes(c[0]) ? "sh" : "sz";
        const resp = await fetch(`https://qt.gtimg.cn/q=${prefix}${c}`);
        if (!resp.ok) return "";
        const text = new TextDecoder("gbk").decode(await resp.arrayBuffer());
        const match = text.match(/="[^~]+~([^~]+)/);
        return match ? match[1].trim() : "";
      } catch {
        return "";
      }
    };

    let timer = null;
    const onCodeInput = () => {
      form.name = "";
      if (timer) clearTimeout(timer);
      const code = form.code.trim();
      if (!/^\d{6}$/.test(code)) return;
      timer = setTimeout(async () => {
        searching.value = true;
        form.name = (await fetchName(code)) || "";
        searching.value = false;
      }, 300);
    };

    const regenFloat = () => {
      floatingCents.value = (Math.floor(Math.random() * 5) + 1) / 100;
    };

    const clearPromo = () => {
      appliedPromo.value = null;
      promoInput.value = "";
    };

    /** 若用户已在输入框填了 6 位代码但尚未点“加入清单”，自动帮其加入清单 */
    const ensureCartFromForm = async () => {
      const rawCode = String(form.code || "").trim().replace(/\D/g, "").slice(-6);
      if (rawCode.length === 6 && !cart.value.some((x) => x.etf_code === rawCode)) {
        if (!form.name) form.name = (await fetchName(rawCode)) || rawCode;
        const mode =
          form.trade_mode === "t+0" || form.trade_mode === "t+1"
            ? form.trade_mode
            : resolveTradeRule(rawCode, form.name);
        cart.value.push({
          etf_code: rawCode,
          etf_name: form.name || rawCode,
          trade_mode: mode,
        });
        form.code = "";
        form.name = "";
        form.trade_mode = "auto";
        regenFloat();
      }
    };

    const applyPromoCode = async () => {
      const code = (promoInput.value || "").trim().toUpperCase();
      if (!code) {
        store.showToast("请输入优惠码", "error");
        return;
      }
      await ensureCartFromForm();
      const checkBase = totalBase.value > 0 ? totalBase.value : previewBase.value || 30;

      promoChecking.value = true;
      try {
        const res = await sponsorApi.checkPromo({
          base_amount: checkBase,
          promo_code: code,
        });
        appliedPromo.value = {
          code: res.code || code,
          name: res.name || code,
          discount_type: res.discount_type || "percent",
          discount_value: Number(res.discount_value || 0),
          discount: Number(res.discount || 0),
          amount: Number(res.amount || checkBase),
          original: Number(res.original || checkBase),
        };
        promoInput.value = appliedPromo.value.code;
        if (totalBase.value > 0) {
          store.showToast(`优惠码 ${appliedPromo.value.code} 已生效，立减 ¥${discountSaved.value.toFixed(2)}`);
        } else {
          const ruleDesc =
            appliedPromo.value.discount_type === "percent"
              ? `减免 ${appliedPromo.value.discount_value}%`
              : `立减 ¥${appliedPromo.value.discount_value}`;
          store.showToast(`优惠码 ${appliedPromo.value.code}（${ruleDesc}）已绑定，添加标的后自动抵扣`);
        }
      } catch (e) {
        appliedPromo.value = null;
        store.showToast(e.message || "优惠码无效或已过期", "error");
      } finally {
        promoChecking.value = false;
      }
    };

    const addToCart = async () => {
      const code = form.code.trim().replace(/\D/g, "").slice(-6);
      if (code.length !== 6) {
        store.showToast("请输入 6 位标的代码", "error");
        return;
      }
      if (cart.value.some((x) => x.etf_code === code)) {
        store.showToast("该标的已在待赞助清单中", "error");
        return;
      }
      if (!form.name) form.name = (await fetchName(code)) || code;
      const mode =
        form.trade_mode === "t+0" || form.trade_mode === "t+1"
          ? form.trade_mode
          : resolveTradeRule(code, form.name);
      cart.value.push({
        etf_code: code,
        etf_name: form.name || code,
        trade_mode: mode,
      });
      form.code = "";
      form.name = "";
      form.trade_mode = "auto";
      regenFloat();
      // 若用户在输入优惠码框填了内容但未点“使用优惠码”，自动帮其校验
      if (promoInput.value.trim() && !appliedPromo.value) {
        await applyPromoCode();
      }
    };

    const removeCart = (code) => {
      cart.value = cart.value.filter((x) => x.etf_code !== code);
      regenFloat();
    };

    const selectPeriod = (days) => {
      selectedDays.value = days;
      regenFloat();
    };

    const openPay = async () => {
      if (!store.state.isLoggedIn) {
        store.state.authMode = "login";
        store.state.authModalVisible = true;
        return;
      }
      await ensureCartFromForm();
      if (!cart.value.length) {
        store.showToast("请先输入 6 位标的代码并加入清单", "error");
        return;
      }
      if (!(unitPrice.value > 0)) {
        store.showToast("请选择有效赞助周期", "error");
        return;
      }
      if (promoInput.value.trim() && !appliedPromo.value) {
        await applyPromoCode();
      }
      regenFloat();
      txId.value = "";
      showPay.value = true;
    };

    const submitOrder = async () => {
      if (!/^\d{6}$/.test(txId.value)) {
        store.showToast("请填写 6 位数字支付凭证", "error");
        return;
      }
      submitLoading.value = true;
      try {
        await sponsorApi.submitOrder({
          items: cart.value,
          days: selectedDays.value,
          amount: Number(payableAmount.value),
          original_amount: Number(totalBase.value),
          promo_code: appliedPromo.value ? appliedPromo.value.code : undefined,
          tx_id_last6: txId.value.trim(),
        });
        store.showToast("赞助订单已提交！审核通过后标的将进入公共监控池并在您的看板默认置顶");
        cart.value = [];
        txId.value = "";
        clearPromo();
        showPay.value = false;
        await loadMine();
        switchTab("mine");
      } catch (e) {
        store.showToast(e.message || "提交失败", "error");
      } finally {
        submitLoading.value = false;
      }
    };

    const loadMine = async () => {
      if (!store.state.isLoggedIn) {
        mine.value = [];
        return;
      }
      try {
        const res = await sponsorApi.fetchMine();
        mine.value = res.data || [];
      } catch (_) {
        mine.value = [];
      }
    };

    const loadActive = async () => {
      try {
        const res = await sponsorApi.fetchActive();
        activeList.value = res.data || [];
      } catch (_) {
        activeList.value = [];
      }
    };

    /** 解析赞助者显示名：若为当前登录会员且设置了昵称，立即优先使用最新昵称 */
    const formatSponsorBadgeName = (row) => {
      if (!row) return "热心会员";
      const myNick = (store.state.nickname || "").trim();
      if (myNick) {
        const isMeById =
          store.state.userId &&
          row.user_id &&
          Number(row.user_id) === Number(store.state.userId);
        const isMeByUser =
          store.state.username &&
          row.username &&
          String(row.username).toLowerCase() === String(store.state.username).toLowerCase();
        if (isMeById || isMeByUser) return myNick;
      }
      if (row.nickname && String(row.nickname).trim()) return String(row.nickname).trim();
      if (row.sponsor_name && String(row.sponsor_name).trim() && row.sponsor_name !== "热心会员") {
        return String(row.sponsor_name).trim();
      }
      return row.sponsor_name || "热心会员";
    };

    const getTradeTag = (row) => {
      return resolveTradeRule(row?.etf_code, row?.etf_name, row?.trade_mode);
    };

    const openEdit = (row) => {
      editModal.visible = true;
      editModal.id = row.id;
      editModal.etf_code = row.etf_code;
      editModal.etf_name = row.etf_name || "";
      editModal.trade_mode = row.trade_mode || "auto";
    };

    const onEditCodeInput = async () => {
      const c = String(editModal.etf_code || "").trim();
      if (/^\d{6}$/.test(c)) {
        const name = await fetchName(c);
        if (name) editModal.etf_name = name;
      }
    };

    const saveEdit = async () => {
      const code = String(editModal.etf_code || "").replace(/\D/g, "").slice(-6);
      if (code.length !== 6) {
        store.showToast("代码须为 6 位数字", "error");
        return;
      }
      editLoading.value = true;
      try {
        await sponsorApi.updateSymbol(editModal.id, {
          etf_code: code,
          etf_name: editModal.etf_name,
          trade_mode: editModal.trade_mode,
        });
        store.showToast("赞助标的已更新");
        editModal.visible = false;
        await Promise.all([loadMine(), loadActive()]);
      } catch (e) {
        store.showToast(e.message || "更新失败", "error");
      } finally {
        editLoading.value = false;
      }
    };

    const toggleLike = async (row) => {
      if (!store.state.isLoggedIn) {
        store.state.authMode = "login";
        store.state.authModalVisible = true;
        return;
      }
      try {
        if (row.liked_by_me) {
          await sponsorApi.unlike(row.id);
          row.liked_by_me = false;
          row.like_count = Math.max(0, (row.like_count || 1) - 1);
        } else {
          await sponsorApi.like(row.id);
          row.liked_by_me = true;
          row.like_count = (row.like_count || 0) + 1;
        }
      } catch (e) {
        store.showToast(e.message || "操作失败", "error");
      }
    };

    const formatTime = (ts) => {
      if (!ts) return "-";
      const d = new Date(Number(ts));
      if (isNaN(d.getTime())) return "-";
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
    };

    const isActive = (row) =>
      row.status === "active" && Number(row.expire_at) > Date.now();

    const remainDays = (row) => {
      if (!row || !row.expire_at) return 0;
      const left = Number(row.expire_at) - Date.now();
      if (left <= 0) return 0;
      return Math.ceil(left / 86400000);
    };

    const remainText = (row) => {
      if (!isActive(row)) return "已过期";
      const d = remainDays(row);
      if (d <= 0) return "即将到期";
      if (d === 1) return "不足 1 天";
      return `剩余 ${d} 天`;
    };

    onMounted(async () => {
      window.addEventListener("hashchange", syncTabFromHash);
      syncTabFromHash();
      loading.value = true;
      const ch = settings.value.default_pay_channel || "wechat";
      payChannel.value = ch === "alipay" ? "alipay" : "wechat";
      if (prices.value.length) selectedDays.value = prices.value[0].days;
      nickInput.value = store.state.nickname || "";
      await Promise.all([loadMine(), loadActive()]);
      loading.value = false;
    });

    onUnmounted(() => {
      window.removeEventListener("hashchange", syncTabFromHash);
    });

    return {
      store: store.state,
      activeTab,
      switchTab,
      loading,
      mine,
      activeList,
      prices,
      nickInput,
      nickSaving,
      showNickEdit,
      saveQuickNickname,
      cart,
      form,
      searching,
      selectedDays,
      selectPeriod,
      selectedLabel,
      unitPrice,
      totalBase,
      discountedBase,
      discountSaved,
      payableAmount,
      promoInput,
      promoChecking,
      appliedPromo,
      applyPromoCode,
      clearPromo,
      payChannel,
      txId,
      showPay,
      submitLoading,
      qrSrc,
      editModal,
      editLoading,
      onCodeInput,
      onEditCodeInput,
      addToCart,
      removeCart,
      openPay,
      submitOrder,
      openEdit,
      saveEdit,
      toggleLike,
      formatTime,
      isActive,
      remainDays,
      remainText,
      formatSponsorBadgeName,
      getTradeTag,
      loadActive,
      loadMine,
    };
  },
  template: `
    <div class="max-w-4xl mx-auto space-y-4 sm:space-y-5 select-none">
      <!-- 顶部标题与分栏切换 -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="text-xl sm:text-2xl font-bold text-slate-800">赞助监控标的</h2>
          <p class="text-xs text-slate-500 mt-1 leading-relaxed">
            一人赞助，全员共享；<strong>您赞助的标的将在您的数据看板默认置顶</strong>，并展示您的<strong>专属昵称</strong>。
          </p>
        </div>

        <div class="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm shrink-0 self-start">
          <button type="button" @click="switchTab('public')"
                  class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition"
                  :class="activeTab==='public' ? 'theme-bg text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'">
            发起赞助 / 公共池
          </button>
          <button type="button" @click="switchTab('mine')"
                  class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"
                  :class="activeTab==='mine' ? 'theme-bg text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'">
            <span>我的赞助</span>
            <span v-if="mine.length" class="px-1.5 py-0.2 rounded-full text-[10px]"
                  :class="activeTab==='mine' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'">
              {{ mine.length }}
            </span>
          </button>
        </div>
      </div>

      <!-- 赞助署名昵称状态条 -->
      <div v-if="store.isLoggedIn"
           class="bg-white rounded-xl border border-slate-100 px-4 py-3 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div class="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
          <i class="fa-solid fa-signature theme-text"></i>
          <span>看板赞助署名：</span>
          <strong v-if="store.nickname" class="text-slate-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-xs">
            ❤️ {{ store.nickname }} 赞助
          </strong>
          <span v-else class="text-amber-600 font-medium">尚未设置昵称（建议设置后展示您的专属昵称）</span>
        </div>
        <div class="flex items-center gap-2">
          <template v-if="showNickEdit || !store.nickname">
            <input v-model="nickInput" type="text" maxlength="16" placeholder="输入您的昵称（2~16字）"
                   class="border border-slate-200 rounded-lg px-2.5 py-1 text-xs w-40 focus:theme-border outline-none"
                   @keyup.enter="saveQuickNickname">
            <button type="button" @click="saveQuickNickname" :disabled="nickSaving"
                    class="theme-bg text-white text-xs font-bold px-3 py-1 rounded-lg disabled:opacity-50">
              {{ nickSaving ? '保存中...' : '保存昵称' }}
            </button>
            <button v-if="store.nickname" type="button" @click="showNickEdit=false" class="text-xs text-slate-400">取消</button>
          </template>
          <button v-else type="button" @click="nickInput=store.nickname; showNickEdit=true"
                  class="text-xs theme-text font-bold hover:underline">
            修改昵称
          </button>
        </div>
      </div>

      <!-- 视图 1：发起赞助 & 公共赞助池 -->
      <template v-if="activeTab === 'public'">
        <div class="bg-white rounded-xl border border-slate-100 p-4 sm:p-5 shadow-sm space-y-4">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <span class="text-sm font-bold text-slate-700">① 选择赞助周期、添加标的与优惠码</span>
            <span class="text-[11px] text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-200 font-bold">
              <i class="fa-solid fa-ticket mr-1"></i>支持优惠码立减抵扣
            </span>
          </div>

          <!-- 周期选择 -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button v-for="p in prices" :key="p.days" type="button" @click="selectPeriod(p.days)"
                    class="p-3 rounded-xl border text-left transition"
                    :class="selectedDays===p.days ? 'theme-bg text-white border-transparent shadow-sm' : 'bg-slate-50/60 hover:bg-slate-50 text-slate-700 border-slate-200'">
              <div class="text-xs font-bold opacity-90">{{ p.label }}（{{ p.days }}天）</div>
              <div class="text-lg font-extrabold font-mono mt-0.5">¥{{ p.price }}<span class="text-xs font-normal">/只</span></div>
            </button>
          </div>

          <!-- 标的输入行 -->
          <div class="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input v-model="form.code" @input="onCodeInput" maxlength="6" placeholder="输入 6 位股票/ETF代码（如 513090）"
                   class="sm:col-span-4 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm font-mono uppercase focus:theme-border outline-none"
                   @keyup.enter="addToCart">
            <input v-model="form.name" placeholder="标的名称（输入代码自动识别，也可手填）"
                   class="sm:col-span-4 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:theme-border outline-none"
                   @keyup.enter="addToCart">
            <select v-model="form.trade_mode" class="sm:col-span-2 border border-slate-200 rounded-lg px-2.5 py-2.5 text-xs text-slate-700 focus:theme-border outline-none">
              <option value="auto">交易规则: 自动</option>
              <option value="t+0">T+0 标的(0)</option>
              <option value="t+1">常规标的</option>
            </select>
            <button type="button" @click="addToCart"
                    class="sm:col-span-2 theme-bg text-white px-4 py-2.5 rounded-lg text-xs font-bold shrink-0 hover:opacity-90 shadow-sm">
              <i class="fa-solid fa-plus mr-1"></i>加入清单
            </button>
          </div>
          <p v-if="searching" class="text-xs text-slate-400">
            <i class="fa-solid fa-spinner animate-spin mr-1"></i>正在自动识别标的名称…
          </p>

          <!-- 位置 A：主表单常驻【优惠码】输入栏（未加清单也能直接看到并输入） -->
          <div class="bg-gradient-to-r from-orange-50/80 via-amber-50/50 to-white border border-orange-200/80 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div class="flex items-center gap-2 text-xs">
              <span class="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <i class="fa-solid fa-ticket text-xs"></i>
              </span>
              <div>
                <div class="font-bold text-slate-800">优惠码折扣（选填）</div>
                <div class="text-[11px] text-slate-500">输入优惠码点击「使用优惠码」，支付时自动减免对应金额</div>
              </div>
            </div>

            <div v-if="!appliedPromo" class="flex items-center gap-2 sm:w-80">
              <input v-model="promoInput" type="text" placeholder="请输入优惠码（如 VIP88）"
                     class="flex-1 border border-orange-200 bg-white rounded-lg px-3 py-2 text-xs font-mono uppercase focus:theme-border outline-none"
                     @keyup.enter="applyPromoCode">
              <button type="button" @click="applyPromoCode" :disabled="promoChecking || !promoInput.trim()"
                      class="px-3.5 py-2 rounded-lg text-xs font-bold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 shrink-0 shadow-sm">
                {{ promoChecking ? '校验中...' : '使用优惠码' }}
              </button>
            </div>
            <div v-else class="flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-700 sm:w-auto">
              <span>
                <i class="fa-solid fa-circle-check mr-1"></i>已绑定优惠码 <strong>{{ appliedPromo.code }}</strong>
                <template v-if="appliedPromo.discount_type === 'percent'">（减免 {{ appliedPromo.discount_value }}%）</template>
                <template v-else-if="appliedPromo.discount_type === 'fixed'">（立减 ¥{{ appliedPromo.discount_value }}）</template>
                <template v-if="totalBase > 0"> · 已减 <strong>¥{{ discountSaved.toFixed(2) }}</strong></template>
              </span>
              <button type="button" @click="clearPromo" class="text-xs text-slate-500 hover:text-red-500 underline ml-2 shrink-0">取消</button>
            </div>
          </div>

          <!-- 位置 B：待赞助清单 + 结算与立即扫码支付按钮 -->
          <div v-if="cart.length" class="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div class="bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-600 flex justify-between items-center flex-wrap gap-2">
              <span>待赞助清单（{{ cart.length }} 只）· 周期：{{ selectedLabel }}</span>
              <span class="text-slate-800">
                <template v-if="appliedPromo && discountSaved > 0">
                  <span class="line-through text-slate-400 mr-1.5">原价 ¥{{ totalBase.toFixed(2) }}</span>
                  <span class="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-[11px] mr-1.5">优惠码 -¥{{ discountSaved.toFixed(2) }}</span>
                  <span class="text-red-500 font-extrabold text-sm">折后 ¥{{ discountedBase.toFixed(2) }}</span>
                </template>
                <template v-else>小计 ¥{{ totalBase.toFixed(2) }}</template>
              </span>
            </div>

            <div class="divide-y divide-slate-100">
              <div v-for="c in cart" :key="c.etf_code" class="px-4 py-2.5 text-sm flex justify-between items-center">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-mono font-bold text-slate-800">{{ c.etf_code }}<span v-if="(c.trade_mode || getTradeTag(c)) === 't+0'" class="text-indigo-600 font-bold">(0)</span></span>
                  <span class="text-slate-700 font-medium ml-1">{{ c.etf_name }}</span>
                </div>
                <button type="button" @click="removeCart(c.etf_code)" class="text-xs text-red-500 hover:underline">移除</button>
              </div>
            </div>

            <div class="p-3.5 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <span class="text-xs text-slate-500">
                <i class="fa-solid fa-shield-heart text-emerald-600 mr-1"></i>点击右侧按钮打开收款码（支付弹窗内同样可输入或更换优惠码）
              </span>
              <button type="button" @click="openPay"
                      class="theme-bg text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm hover:opacity-90 shrink-0">
                ② 扫码支付（实付 ¥{{ payableAmount }}）
              </button>
            </div>
          </div>

          <!-- 若尚未点“加入清单”但填了6位代码，也提供一键直达支付按钮 -->
          <div v-else-if="form.code.trim().length === 6" class="flex justify-end pt-1">
            <button type="button" @click="openPay"
                    class="theme-bg text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm hover:opacity-90">
              ② 直接扫码支付该标的
            </button>
          </div>
        </div>

        <!-- 公共赞助池 + 点赞致谢 -->
        <div class="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
          <div class="px-4 sm:px-5 py-3.5 border-b flex justify-between items-center">
            <div>
              <span class="font-bold text-slate-700 text-sm">当前公共赞助池</span>
              <span class="text-xs text-slate-400 ml-2">感谢以下会员为大家赞助监控标的</span>
            </div>
            <button type="button" @click="loadActive" class="text-xs text-slate-400 hover:theme-text">
              <i class="fa-solid fa-rotate-right mr-1"></i>刷新
            </button>
          </div>
          <div v-if="loading" class="py-10 text-center text-slate-400 text-sm">加载中…</div>
          <div v-else-if="!activeList.length" class="py-10 text-center text-sm text-slate-400">
            暂无有效赞助标的，成为第一位赞助者吧！
          </div>
          <div v-else class="divide-y divide-slate-50">
            <div v-for="r in activeList" :key="r.id" class="px-4 sm:px-5 py-3.5 flex flex-wrap items-center gap-3 justify-between hover:bg-slate-50/60">
              <div>
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-mono font-bold text-slate-800">{{ r.etf_code }}<span v-if="getTradeTag(r) === 't+0'" class="text-indigo-600 font-bold">(0)</span></span>
                  <span class="font-bold text-slate-700 text-sm ml-0.5">{{ r.etf_name }}</span>
                  <span class="inline-flex items-center gap-1 text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                    <i class="fa-solid fa-heart text-[9px] text-rose-500"></i>
                    {{ formatSponsorBadgeName(r) }} 赞助
                  </span>
                </div>
                <div class="text-[11px] text-slate-400 mt-1">
                  赞助周期 {{ r.days || '-' }} 天 · 有效期至 {{ formatTime(r.expire_at) }}（{{ remainText(r) }}）
                </div>
              </div>
              <button type="button" @click="toggleLike(r)"
                      class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition font-medium"
                      :class="r.liked_by_me ? 'bg-rose-50 border-rose-200 text-rose-600 font-bold' : 'bg-white border-slate-200 text-slate-500 hover:border-rose-200'">
                <i class="fa-solid fa-thumbs-up"></i>
                <span>感谢 ({{ r.like_count || 0 }})</span>
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- 视图 2：我的赞助管理 -->
      <template v-else>
        <div class="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
          <div class="px-4 sm:px-5 py-3.5 border-b flex justify-between items-center flex-wrap gap-2">
            <div>
              <span class="font-bold text-slate-700 text-sm">我的赞助记录</span>
              <span class="text-xs text-slate-400 ml-2">有效期内可随时免费更换标的代码与交易规则</span>
            </div>
            <div class="flex items-center gap-3">
              <button type="button" @click="switchTab('public')" class="text-xs theme-text font-bold hover:underline">
                + 新增赞助标的
              </button>
              <button type="button" @click="loadMine" class="text-xs text-slate-400 hover:theme-text">
                <i class="fa-solid fa-rotate-right"></i>
              </button>
            </div>
          </div>

          <div v-if="!store.isLoggedIn" class="py-12 text-center text-sm text-slate-400 space-y-3">
            <p>登录后可查看与管理您赞助的标的</p>
            <button type="button" @click="store.authMode='login'; store.authModalVisible=true"
                    class="theme-bg text-white text-xs font-bold px-4 py-2 rounded-lg">
              立即登录
            </button>
          </div>
          <div v-else-if="!mine.length" class="py-12 text-center text-sm text-slate-400 space-y-3">
            <p>您还没有生效的赞助记录（提交支付后待管理员审核通过即显示在此）</p>
            <button type="button" @click="switchTab('public')"
                    class="theme-bg text-white text-xs font-bold px-4 py-2 rounded-lg">
              去赞助标的
            </button>
          </div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm text-left whitespace-nowrap">
              <thead class="bg-slate-50 text-xs text-slate-500 border-b">
                <tr>
                  <th class="py-3 px-4">标的代码</th>
                  <th class="py-3 px-4">标的名称</th>
                  <th class="py-3 px-4">购买周期</th>
                  <th class="py-3 px-4">到期日</th>
                  <th class="py-3 px-4">剩余时间</th>
                  <th class="py-3 px-4">收获感谢</th>
                  <th class="py-3 px-4">状态</th>
                  <th class="py-3 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                <tr v-for="r in mine" :key="r.id" class="hover:bg-slate-50">
                  <td class="py-3 px-4 font-mono font-bold text-slate-800">
                    {{ r.etf_code }}<span v-if="getTradeTag(r) === 't+0'" class="text-indigo-600 font-bold">(0)</span>
                  </td>
                  <td class="py-3 px-4 font-medium">{{ r.etf_name }}</td>
                  <td class="py-3 px-4 text-xs font-bold text-slate-600">{{ r.days || '-' }} 天</td>
                  <td class="py-3 px-4 text-xs font-mono text-slate-500">{{ formatTime(r.expire_at) }}</td>
                  <td class="py-3 px-4 text-xs font-bold"
                      :class="isActive(r) ? (remainDays(r) <= 7 ? 'text-amber-600' : 'text-emerald-600') : 'text-slate-400'">
                    {{ remainText(r) }}
                  </td>
                  <td class="py-3 px-4 text-xs text-rose-500 font-bold">
                    <i class="fa-solid fa-heart mr-1"></i>{{ r.like_count || 0 }}
                  </td>
                  <td class="py-3 px-4">
                    <span class="text-xs font-bold px-2 py-0.5 rounded-full"
                          :class="isActive(r) ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'">
                      {{ isActive(r) ? '监控生效中·看板置顶' : '已过期' }}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-right">
                    <button v-if="isActive(r)" type="button" @click="openEdit(r)"
                            class="text-xs theme-bg text-white px-3 py-1 rounded-lg font-bold hover:opacity-90">
                      更换标的
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>

      <!-- 位置 C：扫码支付弹窗（常驻展示醒目的优惠码输入与实时折扣计算，不依赖任何隐藏开关） -->
      <div v-if="showPay" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="showPay=false">
        <div class="bg-white rounded-2xl w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 class="font-bold text-slate-800 text-base">扫码支付赞助费用</h3>
            <button type="button" @click="showPay=false" class="text-slate-400 hover:text-slate-600">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <!-- 应付金额大字展示 -->
          <div class="text-center space-y-1 bg-slate-50 rounded-xl p-3.5 border border-slate-100">
            <div class="text-xs text-amber-700 bg-amber-50 inline-block px-2.5 py-0.5 rounded border border-amber-100">
              请按下方精准浮动金额扫码支付（便于快速核对）
            </div>
            <div class="text-3xl font-extrabold text-red-500 font-mono pt-1">
              ¥ {{ payableAmount }}
            </div>
            <div class="text-xs text-slate-500">
              <span>{{ cart.length }} 只 × {{ selectedLabel }}（单价 ¥{{ unitPrice }}）</span>
              <span v-if="appliedPromo && discountSaved > 0" class="ml-1.5 line-through text-slate-400">原价 ¥{{ totalBase.toFixed(2) }}</span>
              <span v-if="appliedPromo && discountSaved > 0" class="ml-1 text-emerald-600 font-bold">已省 ¥{{ discountSaved.toFixed(2) }}</span>
            </div>
          </div>

          <!-- 优惠码输入与抵扣区（无条件常驻显示在支付弹窗核心位置） -->
          <div class="bg-orange-50/70 border-2 border-orange-200 rounded-xl p-3.5 space-y-2">
            <div class="text-xs font-bold text-orange-800 flex items-center justify-between">
              <span><i class="fa-solid fa-ticket mr-1.5 text-orange-500"></i>优惠码折扣抵扣</span>
              <span v-if="appliedPromo" class="text-emerald-600 font-extrabold">已立减 ¥{{ discountSaved.toFixed(2) }}</span>
              <span v-else class="text-[11px] font-normal text-orange-600">输入优惠码立即减免应付金额</span>
            </div>
            <div v-if="!appliedPromo" class="flex gap-2">
              <input v-model="promoInput" type="text" placeholder="请输入优惠码（如 VIP88）"
                     class="flex-1 border border-orange-300 bg-white rounded-lg px-3 py-2 text-xs font-mono uppercase focus:theme-border outline-none"
                     @keyup.enter="applyPromoCode">
              <button type="button" @click="applyPromoCode" :disabled="promoChecking || !promoInput.trim()"
                      class="px-4 py-2 rounded-lg text-xs font-bold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 shrink-0 shadow-sm">
                {{ promoChecking ? '校验中...' : '使用优惠码' }}
              </button>
            </div>
            <div v-else class="flex items-center justify-between bg-white border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-700">
              <span>
                <i class="fa-solid fa-tag mr-1"></i>
                优惠码 <strong>{{ appliedPromo.code }}</strong> 已生效（立减 <strong>¥{{ discountSaved.toFixed(2) }}</strong>）
              </span>
              <button type="button" @click="clearPromo" class="text-xs text-slate-500 hover:text-red-500 underline ml-2">
                更换/取消
              </button>
            </div>
          </div>

          <!-- 清单摘要 -->
          <div class="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-1 max-h-28 overflow-y-auto border border-slate-100">
            <div v-for="c in cart" :key="c.etf_code" class="flex justify-between">
              <span class="font-mono font-bold text-slate-800">{{ c.etf_code }}<span v-if="(c.trade_mode || getTradeTag(c)) === 't+0'" class="text-indigo-600">(0)</span></span>
              <span class="text-slate-500 truncate ml-2">{{ c.etf_name }}</span>
            </div>
          </div>

          <div class="flex justify-center gap-2 text-xs">
            <button type="button" @click="payChannel='wechat'" class="px-4 py-1.5 rounded-full border font-bold transition"
                    :class="payChannel==='wechat'?'theme-bg text-white border-transparent':'text-slate-600'">
              <i class="fa-brands fa-weixin mr-1"></i>微信支付
            </button>
            <button type="button" @click="payChannel='alipay'" class="px-4 py-1.5 rounded-full border font-bold transition"
                    :class="payChannel==='alipay'?'theme-bg text-white border-transparent':'text-slate-600'">
              <i class="fa-brands fa-alipay mr-1"></i>支付宝
            </button>
          </div>

          <div class="flex justify-center">
            <img v-if="qrSrc" :src="qrSrc" class="w-44 h-44 object-contain border rounded-xl p-1 bg-white shadow-sm" alt="收款码">
            <p v-else class="text-xs text-slate-400 py-8">请在后台系统设置中配置收款码</p>
          </div>

          <div>
            <label class="text-xs text-slate-600 font-bold block mb-1.5 text-center">
              支付完成后，请填写支付订单号/流水号后 6 位数字
            </label>
            <input v-model="txId" maxlength="6" placeholder="请输入 6 位数字凭证（如 123456）"
                   class="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-center font-mono text-sm tracking-widest focus:theme-border outline-none">
          </div>

          <div class="flex gap-2 justify-end pt-1">
            <button type="button" @click="showPay=false" class="text-sm text-slate-500 px-3 py-2">取消</button>
            <button type="button" @click="submitOrder" :disabled="submitLoading || !/^\d{6}$/.test(txId)"
                    class="theme-bg text-white px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50 shadow-sm">
              {{ submitLoading ? '提交中…' : '我已支付 · 提交审核' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 修改标的弹窗 -->
      <div v-if="editModal.visible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="editModal.visible=false">
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 space-y-3.5 shadow-2xl">
          <h3 class="font-bold text-slate-800">更换赞助监控标的</h3>
          <p class="text-xs text-slate-400">赞助有效期内可随时更换为其他 6 位股票/ETF代码</p>
          <input v-model="editModal.etf_code" @input="onEditCodeInput" maxlength="6" placeholder="新 6 位代码"
                 class="w-full border rounded-lg px-3 py-2 font-mono text-sm focus:theme-border outline-none">
          <input v-model="editModal.etf_name" placeholder="标的名称（可自动识别）"
                 class="w-full border rounded-lg px-3 py-2 text-sm focus:theme-border outline-none">
          <select v-model="editModal.trade_mode" class="w-full border rounded-lg px-3 py-2 text-sm focus:theme-border outline-none">
            <option value="auto">交易规则：自动识别</option>
            <option value="t+0">T+0 标的 (0)</option>
            <option value="t+1">常规标的</option>
          </select>
          <div class="flex justify-end gap-2 pt-1">
            <button type="button" @click="editModal.visible=false" class="text-sm text-slate-500 px-3">取消</button>
            <button type="button" @click="saveEdit" :disabled="editLoading"
                    class="theme-bg text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50">
              {{ editLoading ? '保存中...' : '确认更换' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
};
