/**
 * 波幅探长 - 个人中心（整合版）
 * - 安全问题设置 + 未设置红条提醒
 * - 会员等级展示
 * - 定制标的可添加多只；按「每组 N 只」计费（N=后台 custom_max_symbols）
 * - 草稿 → 购买定制套餐
 * js/components/index/Profile.js
 */
import { store } from "../../store.js";
import { authApi } from "../../api/auth.js";
import { planApi } from "../../api/plan.js";
import { watchlistApi } from "../../api/watchlist.js";
import { CONFIG } from "../../config.js";

const { ref, reactive, computed, onMounted } = Vue;

export default {
  name: "Profile",
  setup() {
    const orders = ref([]);
    const invitees = ref([]);
    const referralEdit = ref("");
    const referralSaving = ref(false);
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

    // ---------- 安全问题 ----------
    const securitySet = ref(true);
    const secForm = reactive({
      q1: "",
      a1: "",
      q2: "",
      a2: "",
      q3: "",
      a3: "",
    });
    const secLoading = ref(false);
    const secEditing = ref(false);

    const settings = computed(() => store.state.publicSettings || {});
    const perGroup = computed(() => {
      const n = parseInt(settings.value.custom_max_symbols || "3", 10);
      return isNaN(n) || n < 1 ? 3 : n;
    });
    const draftGroups = computed(() =>
      planApi.calcCustomGroups(draftSymbols.value.length, perGroup.value)
    );
    const levelLabel = computed(() => {
      const map = CONFIG.VIP_LEVEL_LABELS || {};
      return map[store.state.vipLevel] || map[0] || "普通用户";
    });

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
      // 不再限制只数上限；按组计费

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

    const loadSecurityStatus = async () => {
      if (!store.state.isLoggedIn) return;
      try {
        const res = await authApi.getSecurityStatus();
        const set = !!(res.data?.security_set ?? res.security_set);
        securitySet.value = set;
        store.setSecuritySet?.(set);
        if (!set) secEditing.value = true;
      } catch (e) {
        console.warn("loadSecurityStatus:", e);
      }
    };

    const saveSecurity = async () => {
      if (
        !secForm.q1?.trim() ||
        !secForm.a1?.trim() ||
        !secForm.q2?.trim() ||
        !secForm.a2?.trim() ||
        !secForm.q3?.trim() ||
        !secForm.a3?.trim()
      ) {
        store.showToast("请填写完整的三个问题与答案", "error");
        return;
      }
      const qs = [secForm.q1, secForm.q2, secForm.q3].map((q) => q.trim());
      if (new Set(qs).size < 3) {
        store.showToast("三个问题不能重复", "error");
        return;
      }
      secLoading.value = true;
      try {
        await authApi.setSecurityQuestions({
          q1: secForm.q1.trim(),
          a1: secForm.a1.trim(),
          q2: secForm.q2.trim(),
          a2: secForm.a2.trim(),
          q3: secForm.q3.trim(),
          a3: secForm.a3.trim(),
        });
        store.showToast("安全问题已保存");
        securitySet.value = true;
        store.setSecuritySet?.(true);
        secEditing.value = false;
        secForm.a1 = "";
        secForm.a2 = "";
        secForm.a3 = "";
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        secLoading.value = false;
      }
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
        const rawCustom = customRes?.data ?? customRes;
        customList.value = Array.isArray(rawCustom) ? rawCustom : [];

        if (meRes && (meRes.data || meRes.username)) {
          const d = meRes.data || meRes;
          const days = d.shared_vip_days ?? d.vip_days_left ?? 0;
          store.setUserState({
            username: d.username,
            referralCode: d.referral_code,
            vipDaysLeft: days,
            vipLevel: d.vip_level ?? 0,
          });
          if (d.security_set != null) {
            securitySet.value = !!d.security_set;
            store.setSecuritySet?.(!!d.security_set);
          }
        }

        await loadSecurityStatus();
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

    const saveReferralCode = async () => {
      const code = (referralEdit.value || "").trim();
      if (!code) {
        store.showToast("请输入邀请码", "error");
        return;
      }
      referralSaving.value = true;
      try {
        const res = await authApi.setReferralCode(code);
        store.state.referralCode = res.referral_code || code.toUpperCase();
        referralEdit.value = "";
        store.showToast(res.message || "邀请码已设置");
      } catch (err) {
        store.showToast(err.message || "设置失败", "error");
      } finally {
        referralSaving.value = false;
      }
    };

    const copyReferralCode = async () => {
      const code = store.state.referralCode;
      if (!code) {
        store.showToast("暂无邀请码", "error");
        return;
      }
      try {
        await navigator.clipboard.writeText(code);
        store.showToast("邀请码已复制");
      } catch {
        store.showToast("复制失败，请手动复制", "error");
      }
    };

    return {
      store: store.state,
      settings,
      perGroup,
      draftGroups,
      levelLabel,
      orders,
      invitees,
      referralEdit,
      referralSaving,
      saveReferralCode,
      copyReferralCode,
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
      securitySet,
      secForm,
      secLoading,
      secEditing,
      saveSecurity,
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

      <!-- 未设置安全问题提醒 -->
      <div v-if="store.isLoggedIn && !securitySet"
           class="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <i class="fa-solid fa-triangle-exclamation mr-1"></i>
          <strong>请尽快设置安全问题</strong>，否则无法使用「忘记密码」找回账号。
        </div>
        <button type="button" @click="secEditing = true"
                class="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg font-bold shrink-0 hover:opacity-90">
          去设置
        </button>
      </div>

      <!-- VIP + 等级 -->
      <div class="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-slate-100">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-xs text-slate-400 mb-1">监控 VIP 权限</div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xl sm:text-2xl font-bold" :class="store.isVip ? 'theme-text' : 'text-slate-400'">
                {{ store.isVip ? '已开通' : '未开通' }}
              </span>
              <span v-if="store.isVip" class="text-xs bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded-full border border-emerald-100 font-bold">
                剩余 {{ store.vipDaysLeft }} 天
              </span>
              <span class="text-xs px-2.5 py-0.5 rounded-full border font-bold"
                    :class="store.vipLevel > 0 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-slate-50 text-slate-400 border-slate-100'">
                Lv.{{ store.vipLevel || 0 }} · {{ levelLabel }}
              </span>
            </div>
          </div>
          <a href="#/plan" class="theme-bg text-white px-5 sm:px-6 py-2 sm:py-2.5 rounded-lg text-sm font-bold shadow-sm shrink-0 hover:opacity-90">
            {{ store.isVip ? '续费 VIP' : '开通 VIP' }}
          </a>
        </div>
      </div>
<!-- 订单 -->
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
                  <span class="text-xs font-bold text-slate-500 ml-1">({{ order.order_type === 'chart_credits' ? '查询次数' : order.order_type === 'custom_watchlist' ? '定制' : '监控VIP' }})</span>
                  <span v-if="order.order_type === 'custom_watchlist' && order.symbol_count" class="text-[10px] text-purple-500 ml-1 font-bold">
                    {{ order.symbol_count }}只
                  </span>
                  <span v-if="order.promo_code" class="text-[10px] text-orange-500 ml-1 font-bold">{{ order.promo_code }}</span>
                </td>
                <td class="py-3.5 px-4 font-bold font-mono text-red-500">¥ {{ order.amount }}</td>
                <td class="py-3.5 px-4 text-emerald-600 font-bold text-xs">
                  {{ order.status === 'approved'
                      ? (order.vip_days_granted ? ('+' + order.vip_days_granted + '天') : (order.order_type === 'custom_watchlist' ? '定制激活' : '-'))
                      : '-' }}
                </td>
                <td class="py-3.5 px-4 font-bold text-xs">
                  <span :class="order.status === 'approved' ? 'text-emerald-600' : (order.status === 'pending' ? 'text-orange-500' : 'text-slate-400')">
                    {{ formatStatus(order.status) }}
                  </span>
                </td>
                <td class="py-3.5 px-4 text-xs font-mono text-slate-400">{{ formatDateExact(order.created_at) }}</td>
              </tr>
              <tr v-if="!orders.length">
                <td colspan="6" class="py-10 text-center text-slate-400 text-sm font-medium">暂无订单数据</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 邀请 -->
      <div class="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
        <div class="font-bold text-slate-700 text-base">专属邀请码及奖励</div>
        <div class="bg-slate-50 rounded-xl p-4 sm:p-5 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div class="text-xs text-slate-400 mb-1">您的专属邀请码</div>
            <span class="font-mono text-2xl font-extrabold text-slate-800 tracking-widest">{{ store.referralCode || '未设置' }}</span>
            <div class="flex flex-wrap gap-2 mt-3 items-center">
              
              <button type="button" v-if="store.referralCode" @click="copyReferralCode"
                      class="text-xs border px-3 py-1.5 rounded-lg font-bold text-slate-600 hover:bg-slate-50">
                复制
              </button>
            </div>
            <p class="text-[10px] text-slate-400 mt-1">系统自动分配 · 格式 BOFUTZ-XXX（输入时空格可忽略）</p>
          </div>
          <div class="sm:text-right text-xs theme-text font-medium leading-relaxed">
            <div>邀请规则：注册送被邀请人体验 · 付费返利给邀请人</div>
            <div class="text-sm font-bold mt-0.5">
              被邀请人 +{{ settings.gift_invitee_days || 3 }} 天 · 付费返利 {{ settings.referral_rebate_percent || 10 }}%（门槛 {{ settings.referral_rebate_min_days || 90 }} 天）
            </div>
          </div>
        </div>
        <div class="pt-2">
          <div class="text-sm font-bold text-slate-600 mb-2">
            我邀请的用户 <span class="text-xs text-slate-400 font-normal">({{ invitees.length }})</span>
          </div>
          <div v-if="inviteeLoading" class="text-xs text-slate-400 py-2">加载中...</div>
          <div v-else-if="!invitees.length" class="text-xs text-slate-400 py-6 text-center font-medium">暂无被邀请人</div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm text-left">
              <thead class="text-xs text-slate-400 border-b">
                <tr>
                  <th class="py-2 px-3">注册账号</th>
                  <th class="py-2 px-3">注册时间</th>
                  <th class="py-2 px-3">当前 VIP 天数</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                <tr v-for="inv in invitees" :key="inv.id">
                  <td class="py-2.5 px-3 font-medium text-slate-800">{{ inv.username }}</td>
                  <td class="py-2.5 px-3 text-xs font-mono text-slate-400">{{ formatDateExact(inv.created_at) }}</td>
                  <td class="py-2.5 px-3 font-bold" :class="inv.vip_days_left > 0 ? 'text-emerald-600' : 'text-slate-400'">
                    {{ inv.vip_days_left }} 天
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 安全问题 -->
      <div class="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 class="font-bold text-slate-700 text-base">安全问题（密码找回）</h3>
            <p class="text-[11px] text-slate-400 mt-0.5">
              自行设置 3 个最熟悉的问题；忘记密码时随机抽 2 题，全部答对即可重置密码（无需邮箱）
            </p>
          </div>
          <span v-if="securitySet" class="text-xs text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">已设置</span>
          <span v-else class="text-xs text-red-500 font-bold bg-red-50 px-2.5 py-1 rounded-full border border-red-100">未设置</span>
        </div>

        <div v-if="secEditing || !securitySet" class="space-y-3 max-w-xl">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input v-model="secForm.q1" type="text" placeholder="问题1（如：小学班主任姓氏）"
                   class="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">
            <input v-model="secForm.a1" type="text" placeholder="答案1"
                   class="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input v-model="secForm.q2" type="text" placeholder="问题2（如：第一只宠物名字）"
                   class="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">
            <input v-model="secForm.a2" type="text" placeholder="答案2"
                   class="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input v-model="secForm.q3" type="text" placeholder="问题3（如：最喜欢的城市）"
                   class="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">
            <input v-model="secForm.a3" type="text" placeholder="答案3"
                   class="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">
          </div>
          <p class="text-[11px] text-slate-400">答案不区分大小写与空格；请务必记住，找回时无法查看原答案。</p>
          <div class="flex flex-wrap gap-2">
            <button type="button" @click="saveSecurity" :disabled="secLoading"
                    class="theme-bg text-white px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50 hover:opacity-90">
              {{ secLoading ? '保存中...' : '保存安全问题' }}
            </button>
            <button v-if="securitySet" type="button" @click="secEditing = false"
                    class="text-sm text-slate-500 px-3 py-2">
              取消
            </button>
          </div>
        </div>
        <div v-else>
          <button type="button" @click="secEditing = true"
                  class="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-200">
            重新设置安全问题
          </button>
        </div>
      </div>

      <!-- 修改密码 -->
      <div class="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-slate-100">
        <h3 class="font-bold text-slate-700 text-base mb-4">修改账号密码</h3>
        <div class="space-y-3 max-w-md">
          <input v-model="pwdForm.oldPassword" type="password" placeholder="原密码" class="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">
          <input v-model="pwdForm.newPassword" type="password" placeholder="新密码(至少6位)" class="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">
          <input v-model="pwdForm.confirmPassword" type="password" placeholder="确认新密码" class="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">
          <button @click="changePassword" :disabled="pwdLoading" class="theme-bg text-white px-6 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 hover:opacity-90 shadow-sm">
            {{ pwdLoading ? '保存中...' : '确认修改' }}
          </button>
        </div>
      </div>

      <!-- 添加定制标的弹窗 -->
      <div v-if="customModalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4 select-none" @click.self="customModalVisible = false">
        <div class="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl space-y-4 p-6">
          <div class="flex justify-between items-center border-b pb-3">
            <h3 class="font-bold text-slate-800 text-base">添加定制监控标的</h3>
            <button @click="customModalVisible = false" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark text-lg"></i></button>
          </div>
          <p class="text-[11px] text-slate-500 leading-relaxed">
            可添加任意只数。结算时：每 <strong class="theme-text">{{ perGroup }}</strong> 只为 1 组，
            组数 = 向上取整(只数 ÷ {{ perGroup }})，购买对应组数的定制套餐即可。
          </p>
          <div class="space-y-2">
            <label class="text-xs font-bold text-slate-600">请输入定制标的代码：</label>
            <div class="flex gap-2">
              <input v-model="inputCode" @input="onCodeInput" placeholder="如：563300" class="flex-1 px-3 py-2 border rounded-lg text-sm font-mono uppercase focus:theme-border outline-none">
              <button @click="confirmAddSingleSymbol" :disabled="!inputCode || searchingName" class="px-4 py-2 theme-bg text-white rounded-lg text-xs font-bold disabled:opacity-50">
                {{ searchingName ? '识别中...' : '添加' }}
              </button>
            </div>
            <p v-if="foundName" class="text-xs theme-text font-bold flex items-center gap-1 pt-1">
              <i class="fa-solid fa-circle-check"></i> 已识别标的：{{ foundName }}
            </p>
            <p v-else-if="searchError" class="text-xs text-amber-600 font-medium pt-1">{{ searchError }}</p>
          </div>
          <div v-if="draftSymbols.length > 0" class="pt-2 border-t space-y-2">
            <div class="text-xs font-bold text-slate-600 flex justify-between">
              <span>已添加 {{ draftSymbols.length }} 只</span>
              <span class="theme-text">需购买 {{ draftGroups }} 组</span>
            </div>
            <div class="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
              <div v-for="(sym, i) in draftSymbols" :key="i" class="flex justify-between items-center bg-slate-50 px-3 py-2.5 rounded-lg text-xs border">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">#{{ i + 1 }}</span>
                    <span class="font-mono font-bold text-slate-800">{{ sym.code }}</span>
                    <span class="text-slate-600 font-medium truncate">{{ sym.name }}</span>
                  </div>
                  <div class="text-[10px] text-slate-400 mt-0.5 pl-7">添加于 {{ formatAddTime(sym.addTime) }}</div>
                </div>
                <button @click="removeDraftSymbol(i)" class="text-slate-400 hover:text-red-500 ml-2 shrink-0">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>
          </div>
          <div class="pt-3 border-t flex flex-col gap-2">
            <button @click="goToBuyCustomPlan" :disabled="draftSymbols.length === 0" class="w-full py-2.5 theme-bg text-white rounded-lg text-xs font-bold disabled:opacity-50 shadow-sm flex items-center justify-center gap-1">
              <i class="fa-solid fa-cart-shopping"></i>
              去购买定制套餐（{{ draftGroups }} 组）
            </button>
            <p class="text-[11px] text-slate-400 text-center">支付页将按组数 × 套餐单价结算</p>
          </div>
        </div>
      </div>
    </div>
  `,
};
