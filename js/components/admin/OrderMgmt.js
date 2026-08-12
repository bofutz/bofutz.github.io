/**
 * 波幅探长 - 后台【订单审核】组件
 * js/components/admin/OrderMgmt.js
 */
import { store } from "../../store.js";
import { adminApi } from "../../api/admin.js";

// 修复：改用 window.Vue
const { ref, computed, onMounted } = window.Vue;

export default {
  name: "OrderMgmt",
  setup() {
    const orders = ref([]);
    const loading = ref(false);
    const orderStatusFilter = ref("all");
    const searchQuery = ref("");

    const loadOrders = async () => {
      loading.value = true;
      try {
        const res = await adminApi.fetchOrders(
          orderStatusFilter.value === "all" ? "" : orderStatusFilter.value
        );
        orders.value = res.data || [];
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    const approve = async (order) => {
      const userLabel = order.username || order.register_username || "游客";
      if (!confirm(`确认通过该订单？\n用户：${userLabel}\n类型：${order.order_type === "chart_credits" ? "查询次数" : order.order_type === "custom_watchlist" ? "定制监控" : "监控VIP"}\n金额：¥${order.amount}`)) return;
      try {
        await adminApi.approveOrder(order.id, order.user_id);
        store.showToast("订单已审核通过");
        await loadOrders();
      } catch (err) {
        store.showToast(err.message, "error");
      }
    };

    const reject = async (order) => {
      if (!confirm("确认驳回该订单？")) return;
      try {
        await adminApi.rejectOrder(order.id);
        store.showToast("订单已驳回");
        await loadOrders();
      } catch (err) {
        store.showToast(err.message, "error");
      }
    };

    const filteredOrders = computed(() => {
      let list = orders.value;
      if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase().trim();
        list = list.filter(
          (o) =>
            (o.username && o.username.toLowerCase().includes(q)) ||
            (o.register_username && o.register_username.toLowerCase().includes(q)) ||
            (o.tx_id_last6 && o.tx_id_last6.includes(q)) ||
            (o.plan_id && String(o.plan_id).toLowerCase().includes(q))
        );
      }
      return list;
    });

    const formatDate = (ts) => {
      if (!ts) return "-";
      const d = new Date(ts);
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    };

    onMounted(loadOrders);

    return {
      loading,
      orderStatusFilter,
      searchQuery,
      filteredOrders,
      loadOrders,
      approve,
      reject,
      formatDate,
    };
  },
  template: `
    <div class="space-y-4 select-none">
      <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 class="text-xl font-bold text-slate-800">订单审核</h2>
          <p class="text-xs text-slate-400 mt-0.5">审核支付凭证：监控 VIP 按天 / 图表查询按次</p>
        </div>
        <div class="flex gap-2 flex-wrap items-center">
          <div class="flex bg-white border border-slate-200 rounded-lg overflow-hidden text-xs">
            <button
              v-for="s in [{k:'all',t:'全部'},{k:'pending',t:'待审'},{k:'approved',t:'已通过'},{k:'cancelled',t:'已驳回'}]"
              :key="s.k"
              @click="orderStatusFilter = s.k; loadOrders()"
              class="px-3.5 py-2 border-l first:border-0 transition-colors"
              :class="orderStatusFilter === s.k ? 'theme-bg text-white font-bold' : 'text-slate-600 hover:bg-slate-50'"
            >
              {{ s.t }}
            </button>
          </div>
          <!-- 修复：补充 input 闭合斜杠 -->
          <input
            v-model="searchQuery"
            type="text"
            placeholder="账号 / 单号 / 套餐"
            class="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:theme-border w-40"
          />
          <button @click="loadOrders" class="bg-white border px-3 py-2 rounded-lg text-sm hover:bg-slate-50">
            <i class="fa-solid fa-rotate-right" :class="{'animate-spin': loading}"></i>
          </button>
        </div>
      </div>

      <div class="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
        <div v-if="loading" class="text-center py-12 text-slate-400">
          <i class="fa-solid fa-circle-notch animate-spin text-2xl theme-text"></i>
        </div>
        <div v-else-if="!filteredOrders.length" class="text-center py-14 text-slate-400 text-sm">
          暂无订单记录
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm whitespace-nowrap text-left">
            <thead class="bg-slate-50 text-slate-500 border-b text-xs font-bold">
              <tr>
                <th class="py-3 px-4">时间</th>
                <th class="py-3 px-4">用户</th>
                <th class="py-3 px-4">类型 / 套餐</th>
                <th class="py-3 px-4">金额</th>
                <th class="py-3 px-4 text-orange-500">凭证</th>
                <th class="py-3 px-4">发放</th>
                <th class="py-3 px-4">状态</th>
                <th class="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="o in filteredOrders" :key="o.id" class="hover:bg-slate-50">
                <td class="py-3.5 px-4 text-xs text-slate-400 font-mono">{{ formatDate(o.created_at) }}</td>
                <td class="py-3.5 px-4 font-bold text-slate-800">
                  {{ o.username || o.register_username || '游客' }}
                </td>
                <td class="py-3.5 px-4">
                  <span class="bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-600 font-medium">{{ o.plan_id }}</span>
                  <span
                    class="text-[10px] ml-1.5 px-1.5 py-0.5 rounded font-bold"
                    :class="o.order_type === 'chart_credits' ? 'bg-sky-50 text-sky-600' : o.order_type === 'custom_watchlist' ? 'bg-purple-50 text-purple-600' : 'bg-slate-100 text-slate-500'"
                  >
                    {{ o.order_type === 'chart_credits' ? '次数' : o.order_type === 'custom_watchlist' ? '定制' : '监控' }}
                  </span>
                </td>
                <td class="py-3.5 px-4 font-bold text-slate-800 font-mono">¥{{ Number(o.amount).toFixed(2) }}</td>
                <td class="py-3.5 px-4 font-mono font-bold text-orange-500">{{ o.tx_id_last6 || '-' }}</td>
                <td class="py-3.5 px-4 text-xs font-bold text-emerald-600">
                  {{ o.status === 'approved'
                      ? (o.vip_days_granted ? ('+' + o.vip_days_granted + '天') : '定制激活')
                      : '-' }}
                </td>
                <td class="py-3.5 px-4">
                  <span v-if="o.status === 'pending'" class="text-xs bg-orange-100 text-orange-600 px-2.5 py-0.5 rounded-full font-bold">待审核</span>
                  <span v-else-if="o.status === 'approved'" class="text-xs bg-emerald-100 text-emerald-600 px-2.5 py-0.5 rounded-full font-bold">已通过</span>
                  <span v-else class="text-xs bg-slate-100 text-slate-400 px-2.5 py-0.5 rounded-full">已驳回</span>
                </td>
                <td class="py-3.5 px-4 text-right space-x-1">
                  <template v-if="o.status === 'pending'">
                    <button @click="approve(o)" class="theme-bg text-white text-xs px-3 py-1.5 rounded-lg font-bold hover:opacity-90">通过</button>
                    <button @click="reject(o)" class="bg-slate-100 text-slate-600 text-xs px-3 py-1.5 rounded-lg font-bold hover:bg-slate-200">驳回</button>
                  </template>
                  <span v-else class="text-slate-300 text-xs">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
};
