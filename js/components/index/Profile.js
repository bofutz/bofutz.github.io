/* ========================= FILE: .\js\components\index\Profile.js ========================= */

/**
 * 波幅探长 - 个人中心（纯净版）
 * 专注于 VIP 状态、专属邀请分销、订单记录
 * js/components/index/Profile.js
 */
import { store } from "../../store.js";
import { authApi } from "../../api/auth.js";
import { planApi } from "../../api/plan.js";
import { CONFIG } from "../../config.js";

const { ref, computed, onMounted } = Vue;

export default {
  name: "Profile",
  setup() {
    const orders = ref([]);
    const invitees = ref([]);
    const loading = ref(false);
    const inviteeLoading = ref(false);

    const settings = computed(() => store.state.publicSettings || {});
    const levelLabel = computed(() => {
      const map = CONFIG.VIP_LEVEL_LABELS || {};
      return map[store.state.vipLevel] || map[0] || "普通用户";
    });

    const loadProfileData = async () => {
      loading.value = true;
      inviteeLoading.value = true;
      try {
        const [ordersRes, inviteesRes, meRes] = await Promise.all([
          planApi.fetchUserOrders().catch(() => ({ data: [] })),
          authApi.getInvitees().catch(() => ({ data: [] })),
          authApi.getMe().catch(() => null),
        ]);

        orders.value = ordersRes.data || ordersRes || [];
        invitees.value = inviteesRes.data || inviteesRes || [];

        if (meRes && (meRes.data || meRes.username)) {
          const d = meRes.data || meRes;
          const days = d.shared_vip_days ?? d.vip_days_left ?? 0;
          store.setUserState({
            username: d.username,
            referralCode: d.referral_code,
            vipDaysLeft: days,
            vipLevel: d.vip_level ?? 0,
          });
        }
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
        inviteeLoading.value = false;
      }
    };

    const formatDateExact = (ts) => {
      if (!ts) return "-";
      const d = new Date(ts);
      if (isNaN(d.getTime())) return "-";
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    };

    const formatStatus = (s) => {
      if (s === "approved") return "已通过";
      if (s === "pending") return "审核中";
      return "已取消";
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

    onMounted(() => {
      if (store.state.isLoggedIn) loadProfileData();
    });

    return {
      store: store.state,
      settings,
      levelLabel,
      orders,
      invitees,
      copyReferralCode,
      loading,
      inviteeLoading,
      loadProfileData,
      formatDateExact,
      formatStatus,
    };
  },
  template: `
    <div class="max-w-4xl mx-auto space-y-5 select-none pb-8">
      <!-- 用户身份与 VIP 天数 -->
      <div class="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-slate-100">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-xs text-slate-400 mb-1">当前绑定昵称：<strong class="text-slate-700">{{ store.username }}</strong></div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xl sm:text-2xl font-bold" :class="store.isVip ? 'theme-text' : 'text-slate-400'">
                {{ store.isVip ? 'VIP 已激活' : '未开通 VIP' }}
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
          <a href="#/plan" class="theme-bg text-white px-5 sm:px-6 py-2 sm:py-2.5 rounded-lg text-sm font-bold shadow-sm shrink-0 hover:opacity-90 no-underline">
            {{ store.isVip ? '续费 VIP' : '开通 VIP' }}
          </a>
        </div>
      </div>

      <!-- 专属邀请码与返利中心 -->
      <div class="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
        <div class="font-bold text-slate-700 text-base">专属邀请码与分销返利</div>
        <div class="bg-slate-50 rounded-xl p-4 sm:p-5 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div class="text-xs text-slate-400 mb-1">我的专属邀请码</div>
            <span class="font-mono text-2xl font-extrabold text-slate-800 tracking-widest">{{ store.referralCode || '未分配' }}</span>
            <div class="flex flex-wrap gap-2 mt-3 items-center">
              <button type="button" v-if="store.referralCode" @click="copyReferralCode"
                      class="text-xs border px-3 py-1.5 rounded-lg font-bold text-slate-600 hover:bg-slate-50 bg-white">
                一键复制
              </button>
            </div>
          </div>
          <div class="sm:text-right text-xs theme-text font-medium leading-relaxed">
            <div>好友注册双方各赠 3 天体验</div>
            <div class="text-sm font-bold mt-0.5">
              好友充值享 {{ settings.referral_rebate_percent || 10 }}% 会员时长返利
            </div>
          </div>
        </div>

        <div class="pt-2">
          <div class="text-sm font-bold text-slate-600 mb-2">
            我邀请的好友 <span class="text-xs text-slate-400 font-normal">({{ invitees.length }})</span>
          </div>
          <div v-if="inviteeLoading" class="text-xs text-slate-400 py-2">加载中...</div>
          <div v-else-if="!invitees.length" class="text-xs text-slate-400 py-6 text-center font-medium">暂无被邀请记录</div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm text-left">
              <thead class="text-xs text-slate-400 border-b">
                <tr>
                  <th class="py-2 px-3">好友昵称</th>
                  <th class="py-2 px-3">注册时间</th>
                  <th class="py-2 px-3">当前状态</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                <tr v-for="inv in invitees" :key="inv.id">
                  <td class="py-2.5 px-3 font-medium text-slate-800">{{ inv.username }}</td>
                  <td class="py-2.5 px-3 text-xs font-mono text-slate-400">{{ formatDateExact(inv.created_at) }}</td>
                  <td class="py-2.5 px-3 font-bold" :class="inv.vip_days_left > 0 ? 'text-emerald-600' : 'text-slate-400'">
                    {{ inv.vip_days_left > 0 ? 'VIP中 (' + inv.vip_days_left + '天)' : '普通用户' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 订单记录 -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div class="px-5 sm:px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <div class="font-bold text-slate-700 text-base">充值订单记录</div>
          <button @click="loadProfileData" class="text-xs text-slate-400 hover:theme-text">
            <i class="fa-solid fa-rotate-right mr-1"></i>刷新
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm whitespace-nowrap">
            <thead class="bg-slate-50 text-xs text-slate-500 border-b font-bold">
              <tr>
                <th class="py-3 px-4">单号凭证</th>
                <th class="py-3 px-4">套餐类型</th>
                <th class="py-3 px-4">实付金额</th>
                <th class="py-3 px-4">获得权益</th>
                <th class="py-3 px-4">审核状态</th>
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
                </td>
                <td class="py-3.5 px-4 font-bold font-mono text-red-500">¥ {{ order.amount }}</td>
                <td class="py-3.5 px-4 text-emerald-600 font-bold text-xs">
                  {{ order.status === 'approved' ? (order.vip_days_granted ? ('+' + order.vip_days_granted + '天') : '已发放') : '-' }}
                </td>
                <td class="py-3.5 px-4 font-bold text-xs">
                  <span :class="order.status === 'approved' ? 'text-emerald-600' : (order.status === 'pending' ? 'text-orange-500' : 'text-slate-400')">
                    {{ formatStatus(order.status) }}
                  </span>
                </td>
                <td class="py-3.5 px-4 text-xs font-mono text-slate-400">{{ formatDateExact(order.created_at) }}</td>
              </tr>
              <tr v-if="!orders.length">
                <td colspan="6" class="py-10 text-center text-slate-400 text-sm font-medium">暂无充值记录</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
};
