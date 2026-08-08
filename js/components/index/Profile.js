/**
 * 波幅探长 - 个人中心
 * - 定制列表走 /api/watchlist/custom（由 watchlistApi 对齐）
 * - 添加标的 → 草稿 → 跳转购买定制套餐
 * js/components/index/Profile.js
 */
import { store } from "../../store.js";
import { authApi } from "../../api/auth.js";
import { planApi } from "../../api/plan.js";
import { watchlistApi } from "../../api/watchlist.js";

const { ref, reactive, onMounted } = Vue;

export default {
  name: "Profile",
  setup() {
    const orders = ref([]);
    const invitees = ref([]);
    const customList = ref([]);
    const loading = ref(false);
    const inviteeLoading = ref(false);

    const customModalVisible = ref(false);
    const inputCode = ref("");
    const foundName = ref("");
    const searchingName = ref(false);
    const searchError = ref("");
    const draftSymbols = ref([]);

    const pwdForm = reactive({
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    const pwdLoading = ref(false);

    const fetchStockNameByCode = async (symbolStr) => {
      try {
        const codeMatch = String(symbolStr || "").match(/\d{6}/);
        if (!codeMatch) return "";
        const code = codeMatch[0];
        const prefix = ["5", "6", "9"].includes(code[0]) ? "sh" : "sz";
        const tx_url = `https://qt.gtimg.cn/q=${prefix}${code}`;
        const resp = await fetch(tx_url);
        if (!resp.ok) return "";
        const buffer = await resp.arrayBuffer();
        const decoder = new TextDecoder("gbk");
        const text = decoder.decode(buffer);
        const match = text.match(/="[^~]+~([^~]+)/);
        return match ? match[1].trim() : "";
      } catch (err) {
        console.error("fetchName error:", err);
        return "";
      }
    };

    let searchTimer = null;
    const onCodeInput = () => {
      foundName.value = "";
      searchError.value = "";
      if (searchTimer) clearTimeout(searchTimer);
      const code = inputCode.value.trim();
      if (!code) return;
      searchTimer = setTimeout(async () => {
        searchingName.value = true;
        const name = await fetchStockNameByCode(code);
        searchingName.value = false;
        if (name) foundName.value = name;
        else searchError.value = "未识别到中文名称，确认后将直接使用代码";
      }, 300);
    };

    const openCustomModal = () => {
      inputCode.value = "";
      foundName.value = "";
      searchError.value = "";
      try {
        const cached = sessionStorage.getItem("draft_custom_symbols");
        draftSymbols.value = cached ? JSON.parse(cached) : [];
        if (!Array.isArray(draftSymbols.value)) draftSymbols.value = [];
      } catch {
        draftSymbols.value = [];
      }
      customModalVisible.value = true;
    };

    const confirmAddSingleSymbol = async () => {
      const code = inputCode.value.trim().toUpperCase();
      if (!code) {
        store.showToast("请输入标的代码", "error");
        return;
      }
      if (!/^\d{6}$/.test(code)) {
        store.showToast("请输入 6 位标的代码", "error");
        return;
      }
      if (draftSymbols.value.some((s) => s.code === code)) {
        store.showToast("请勿重复添加相同代码", "error");
        return;
      }
      const maxLimit = parseInt(store.state.publicSettings.custom_max_symbols || 3, 10);
      if (draftSymbols.value.length >= maxLimit) {
        store.showToast(`定制套餐最多添加 ${maxLimit} 只标的`, "error");
        return;
      }

      let name = foundName.value;
      if (!name) {
        searchingName.value = true;
        name = await fetchStockNameByCode(code);
        searchingName.value = false;
      }

      draftSymbols.value.push({
        code,
        name: name || code,
        addTime: Date.now(),
      });
      sessionStorage.setItem("draft_custom_symbols", JSON.stringify(draftSymbols.value));
      inputCode.value = "";
      foundName.value = "";
      searchError.value = "";
    };

    const removeDraftSymbol = (index) => {
      draftSymbols.value.splice(index, 1);
      sessionStorage.setItem("draft_custom_symbols", JSON.stringify(draftSymbols.value));
    };

    const goToBuyCustomPlan = () => {
      if (!draftSymbols.value.length) {
        store.showToast("请先输入并添加至少一只定制标的", "error");
        return;
      }
      const formattedItems = draftSymbols.value.map((item) => ({
        etf_code: item.code,
        etf_name: item.name,
      }));
      sessionStorage.setItem("pending_custom_items", JSON.stringify(formattedItems));
      sessionStorage.setItem("prefer_plan_tab", "custom");
      customModalVisible.value = false;
      window.location.hash = "#/plan";
    };

    const loadProfileData = async () => {
      loading.value = true;
      inviteeLoading.value = true;
      try {
        const [ordersRes, inviteesRes, customRes, meRes] = await Promise.all([
          planApi.fetchUserOrders().catch(() => ({ data: [] })),
          authApi.getInvitees().catch(() => ({ data: [] })),
          watchlistApi.fetchUserCustomWatchlist().catch(() => ({ data: [] })),
          authApi.getMe().catch(() => null),
        ]);

        orders.value = ordersRes.data || ordersRes || [];
        invitees.value = inviteesRes.data || inviteesRes || [];
        // 兼容 { data: [] } 或直接数组
        const rawCustom = customRes?.data ?? customRes;
        customList.value = Array.isArray(rawCustom) ? rawCustom : [];

        if (meRes && (meRes.data || meRes.username)) {
          const d = meRes.data || meRes;
          const days = d.shared_vip_days ?? d.vip_days_left ?? 0;
          store.setUserState({
            username: d.username,
            referralCode: d.referral_code,
            vipDaysLeft: days,
          });
        }
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
        inviteeLoading.value = false;
      }
    };

    const removeCustomItem = async (item) => {
      if (!confirm(`确认移除定制标的 ${item.etf_code}？`)) return;
      try {
        await watchlistApi.removeCustomItem(item.id);
        store.showToast("已成功移除");
        await loadProfileData();
      } catch (err) {
        store.showToast(err.message, "error");
      }
    };

    const changePassword = async () => {
      if (!pwdForm.oldPassword || !pwdForm.newPassword) {
        store.showToast("请输入原密码和新密码", "error");
        return;
      }
      if (pwdForm.newPassword.length < 6) {
        store.showToast("新密码至少需 6 位", "error");
        return;
      }
      if (pwdForm.newPassword !== pwdForm.confirmPassword) {
        store.showToast("两次输入的密码不一致", "error");
        return;
      }
      pwdLoading.value = true;
      try {
        await authApi.changePassword(pwdForm.oldPassword, pwdForm.newPassword);
        store.showToast("密码修改成功，请重新登录");
        store.clearUserState();
        window.location.hash = "#/";
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        pwdLoading.value = false;
      }
    };

    const formatDateExact = (ts) => {
      if (!ts) return "-";
      const d = new Date(ts);
      if (isNaN(d.getTime())) return "-";
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    };

    const formatDateShort = (ts) => {
      if (!ts) return "-";
      const d = new Date(ts);
      if (isNaN(d.getTime())) return "-";
      const p = (n) => String(n).padStart(2, "0");
      return `${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    };

    const formatAddTime = (ts) => {
      if (!ts) return "";
      const d = new Date(ts);
      if (isNaN(d.getTime())) return "";
      const p = (n) => String(n).padStart(2, "0");
      return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    };

    const formatStatus = (s) => {
      if (s === "approved") return "已通过";
      if (s === "pending") return "审核中";
      return "已取消";
    };

    onMounted(() => {
      if (store.state.isLoggedIn) loadProfileData();
    });

    return {
      store: store.state,
      settings: store.state.publicSettings,
      orders,
      invitees,
      customList,
      loading,
      inviteeLoading,
      customModalVisible,
      inputCode,
      foundName,
      searchingName,
      searchError,
      draftSymbols,
      pwdForm,
      pwdLoading,
      onCodeInput,
      openCustomModal,
      confirmAddSingleSymbol,
      removeDraftSymbol,
      goToBuyCustomPlan,
      loadProfileData,
      removeCustomItem,
      changePassword,
      formatDateExact,
      formatDateShort,
      formatAddTime,
      formatStatus,
    };
  },
  template: `
    <div class="max-w-4xl mx-auto space-y-5 select-none">
      <div class="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-slate-100">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-xs text-slate-400 mb-1">通用监控 VIP 权限</div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xl sm:text-2xl font-bold" :class="store.isVip ? 'theme-text' : 'text-slate-400'">
                {{ store.isVip ? '已开通' : '未开通' }}
              </span>
              <span v-if="store.isVip" class="text-xs bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded-full border border-emerald-100 font-bold">
                剩余 {{ store.vipDaysLeft }} 天
              </span>
            </div>
          </div>
          <a href="#/plan" class="theme-bg text-white px-5 sm:px-6 py-2 sm:py-2.5 rounded-lg text-sm font-bold shadow-sm shrink-0 hover:opacity-90">
            {{ store.isVip ? '续费 VIP' : '开通 VIP' }}
          </a>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div class="px-5 sm:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div class="font-bold text-slate-700 text-base">我的定制监控</div>
            <p class="text-[11px] text-slate-400 mt-0.5">
              套餐总价含最多 {{ settings.custom_max_symbols || 3 }} 只 · 与通用独立 · 不解锁通用图表
            </p>
          </div>
          <button @click="openCustomModal" class="text-xs theme-bg text-white px-3 py-1.5 rounded-lg self-start font-bold hover:opacity-90">
            <i class="fa-solid fa-plus mr-1"></i>添加标的
          </button>
        </div>

        <div v-if="loading" class="p-8 text-center text-slate-400 text-sm">
          <i class="fa-solid fa-circle-notch animate-spin theme-text mr-2"></i>加载中...
        </div>
        <div v-else-if="!customList.length" class="p-10 text-center text-sm text-slate-400 font-medium">
          暂无定制标的
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm whitespace-nowrap text-left">
            <thead class="bg-slate-50 text-xs text-slate-500 border-b">
              <tr>
                <th class="py-2.5 px-4">代码 / 名称</th>
                <th class="py-2.5 px-3 text-center">状态</th>
                <th class="py-2.5 px-3 text-center">到期</th>
                <th class="py-2.5 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="item in customList" :key="item.id">
                <td class="py-3 px-4">
                  <div class="font-mono font-bold text-slate-800">{{ item.etf_code }}</div>
                  <div class="text-xs text-slate-500">{{ item.etf_name }}</div>
                </td>
                <td class="py-3 px-3 text-center">
                  <span class="text-xs px-2.5 py-0.5 rounded-full font-bold"
                        :class="item.status==='active'?'bg-emerald-50 text-emerald-600':(item.status==='pending'?'bg-orange-50 text-orange-600':'bg-slate-100 text-slate-400')">
                    {{ item.status==='active'?'监控中':(item.status==='pending'?'待支付':item.status) }}
                  </span>
                </td>
                <td class="py-3 px-3 text-center text-xs font-mono text-slate-400">
                  {{ item.expire_at ? formatDateShort(item.expire_at) : '-' }}
                </td>
                <td class="py-3 px-4 text-right">
                  <button @click="removeCustomItem(item)" class="text-xs text-slate-400 hover:text-red-500">移除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div class="px-5 sm:px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <div class="font-bold text-slate-700 text-base">我的订单</div>
          <button @click="loadProfileData" class="text-xs text-slate-400 hover:theme-text">
            <i class="fa-solid fa-rotate-right mr-1"></i>刷新列表
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm whitespace-nowrap">
            <thead class="bg-slate-50 text-xs text-slate-500 border-b font-bold">
              <tr>
                <th class="py-3 px-4">凭证(后6位)</th>
                <th class="py-3 px-4">套餐/类型</th>
                <th class="py-3 px-4">实付金额</th>
                <th class="py-3 px-4">获得 VIP</th>
                <th class="py-3 px-4">状态</th>
                <th class="py-3 px-4">提交时间</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="order in orders" :key="order.id" class="hover:bg-slate-50">
                <td class="py-3.5 px-4 font-mono font-bold text-slate-700">
                  {{ order.tx_id_last6 ? ('****' + order.tx_id_last6) : '-' }}
                </td>
                <td class="py-3.5 px-4 font-medium text-slate-800">
                  <span class="bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-600 font-bold">{{ order.plan_id }}</span>
                  <span class="text-xs font-bold text-slate-500 ml-1">({{ order.order_type ===
