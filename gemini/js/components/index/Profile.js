/**
 * 波幅探长 - 个人中心分块组件 (完全还原图一布局)
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

    const pwdForm = reactive({
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    const pwdLoading = ref(false);

    // 加载个人中心所有关联数据
    const loadProfileData = async () => {
      loading.value = true;
      inviteeLoading.value = true;
      try {
        const [ordersRes, inviteesRes, customRes] = await Promise.all([
          planApi.fetchUserOrders().catch(() => ({ data: [] })),
          authApi.getInvitees().catch(() => ({ data: [] })),
          watchlistApi.fetchUserCustomWatchlist().catch(() => ({ data: [] })),
        ]);

        orders.value = ordersRes.data || [];
        invitees.value = inviteesRes.data || [];
        customList.value = customRes.data || [];
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

    const formatStatus = (s) => {
      if (s === "approved") return "已通过";
      if (s === "pending") return "审核中";
      return "已取消";
    };

    onMounted(() => {
      if (store.state.isLoggedIn) {
        loadProfileData();
      }
    });

    return {
      store: store.state,
      settings: store.state.publicSettings,
      orders,
      invitees,
      customList,
      loading,
      inviteeLoading,
      pwdForm,
      pwdLoading,
      removeCustomItem,
      changePassword,
      formatDateExact,
      formatDateShort,
      formatStatus,
    };
  },
  template: `
    <div class="max-w-4xl mx-auto space-y-5 select-none">
      <!-- 1. VIP 权限顶栏 (卡片一) -->
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

      <!-- 2. 我的定制监控 (卡片二，完全与图一一致) -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div class="px-5 sm:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div class="font-bold text-slate-700 text-base">我的定制监控</div>
            <p class="text-[11px] text-slate-400 mt-0.5">
              套餐总价含最多 {{ settings.custom_max_symbols || 3 }} 只 · 与通用独立 · 不解锁通用图表
            </p>
          </div>
          <a href="#/plan" class="text-xs theme-bg text-white px-3 py-1.5 rounded-lg self-start font-bold hover:opacity-90">
            <i class="fa-solid fa-plus mr-1"></i>添加标的
          </a>
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

      <!-- 3. 我的订单 (卡片三，完全与图一一致) -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div class="px-5 sm:px-6 py-4 border-b border-slate-100 font-bold text-slate-700 text-base">
          我的订单
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm whitespace-nowrap">
            <thead class="bg-slate-50 text-xs text-slate-500 border-b font-bold">
              <tr>
                <th class="py-3 px-4">套餐</th>
                <th class="py-3 px-4">金额</th>
                <th class="py-3 px-4">类型</th>
                <th class="py-3 px-4">获得 VIP</th>
                <th class="py-3 px-4">状态</th>
                <th class="py-3 px-4">时间</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="order in orders" :key="order.id" class="hover:bg-slate-50">
                <td class="py-3.5 px-4 font-medium text-slate-800">
                  <span class="bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-600 font-bold">{{ order.plan_id }}</span>
                  <span v-if="order.promo_code" class="text-[10px] text-orange-500 ml-1 font-bold">{{ order.promo_code }}</span>
                </td>
                <td class="py-3.5 px-4 font-bold font-mono">¥ {{ order.amount }}</td>
                <td class="py-3.5 px-4 text-xs font-bold text-slate-500">{{ order.order_type === 'custom_watchlist' ? '定制' : '通用' }}</td>
                <td class="py-3.5 px-4 text-emerald-600 font-bold text-xs">
                  {{ order.status === 'approved' ? (order.vip_days_granted ? ('+' + order.vip_days_granted + '天') : (order.order_type === 'custom_watchlist' ? '定制激活' : '-')) : '-' }}
                </td>
                <td class="py-3.5 px-4 font-bold text-xs">
                  <span :class="order.status === 'approved' ? 'text-emerald-600' : (order.status === 'pending' ? 'text-orange-500' : 'text-slate-400')">
                    {{ formatStatus(order.status) }}
                  </span>
                </td>
                <td class="py-3.5 px-4 text-xs font-mono text-slate-400">{{ formatDateExact(order.created_at) }}</td>
              </tr>
              <tr v-if="!orders.length">
                <td colspan="6" class="py-10 text-center text-slate-400 text-sm font-medium">暂无订单</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 4. 专属邀请码及奖励 (卡片四，完全与图一一致) -->
      <div class="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
        <div class="font-bold text-slate-700 text-base">专属邀请码及奖励</div>
        
        <!-- 内置浅灰色框 -->
        <div class="bg-slate-50 rounded-xl p-4 sm:p-5 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div class="text-xs text-slate-400 mb-1">您的专属邀请码</div>
            <span class="font-mono text-2xl font-extrabold text-slate-800 tracking-widest">{{ store.referralCode || '-' }}</span>
          </div>
          <div class="sm:text-right text-xs theme-text font-medium leading-relaxed">
            <div>邀请与被邀请双方各送 VIP</div>
            <div class="text-sm font-bold mt-0.5">
              邀请人 {{ settings.gift_inviter_days || 3 }} 天 · 被邀请人 {{ settings.gift_invitee_days || 2 }} 天
            </div>
          </div>
        </div>

        <!-- 我邀请的用户列表 -->
        <div class="pt-2">
          <div class="text-sm font-bold text-slate-600 mb-2">
            我邀请的用户 <span class="text-xs text-slate-400 font-normal">({{ invitees.length }})</span>
          </div>
          <div v-if="inviteeLoading" class="text-xs text-slate-400 py-2">加载中...</div>
          <div v-else-if="!invitees.length" class="text-xs text-slate-400 py-6 text-center font-medium">
            暂无被邀请人
          </div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm text-left">
              <thead class="text-xs text-slate-400 border-b">
                <tr>
                  <th class="py-2 px-3">账号</th>
                  <th class="py-2 px-3">当前 VIP 天数</th>
                  <th class="py-2 px-3">注册时间</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                <tr v-for="inv in invitees" :key="inv.id">
                  <td class="py-2.5 px-3 font-medium text-slate-800">{{ inv.username }}</td>
                  <td class="py-2.5 px-3 font-bold" :class="inv.vip_days_left > 0 ? 'text-emerald-600' : 'text-slate-400'">
                    {{ inv.vip_days_left }} 天
                  </td>
                  <td class="py-2.5 px-3 text-xs font-mono text-slate-400">{{ formatDateExact(inv.created_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 5. 修改账号密码 (卡片五，完全与图一一致) -->
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
    </div>
  `,
};
