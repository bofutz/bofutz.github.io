/**
 * 波幅探长 - 后台【订单审核】组件
 * js/components/admin/OrderMgmt.js
 */
import { store } from "../../store.js";
import { adminApi } from "../../api/admin.js";

const { ref, computed, onMounted } = Vue;

export default {
  name: "OrderMgmt",
  setup() {
    const orders = ref([]);
    const loading = ref(false);
    const deleting = ref(false);
    const orderStatusFilter = ref("all");
    const searchQuery = ref("");
    const selectedIds = ref([]);

    const loadOrders = async () => {
      loading.value = true;
      try {
        const res = await adminApi.fetchOrders(
          orderStatusFilter.value === "all" ? "" : orderStatusFilter.value
        );
        orders.value = res.data || [];
        selectedIds.value = [];
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    const approve = async (order) => {
      const userLabel = order.username || order.register_username || "游客";
      if (
        !confirm(
          `确认通过该订单？\n用户：${userLabel}\n类型：${
            order.order_type === "chart_credits"
              ? "查询次数"
              : order.order_type === "custom_watchlist"
              ? "定制监控"
              : "监控VIP"
          }\n金额：¥${order.amount}`
        )
      )
        return;
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

    const allVisibleSelected = computed(() => {
      const list = filteredOrders.value;
      if (!list.length) return false;
      return list.every((o) => selectedIds.value.includes(o.id));
    });

    const toggleSelect = (id) => {
      const i = selectedIds.value.indexOf(id);
      if (i >= 0) selectedIds.value = selectedIds.value.filter((x) => x !== id);
      else selectedIds.value = selectedIds.value.concat(id);
    };

    const toggleSelectAll = () => {
      if (allVisibleSelected.value) {
        const vis = new Set(filteredOrders.value.map((o) => o.id));
        selectedIds.value = selectedIds.value.filter((id) => !vis.has(id));
      } else {
        const set = new Set(selectedIds.value);
        filteredOrders.value.forEach((o) => set.add(o.id));
        selectedIds.value = Array.from(set);
      }
    };

    const askAdminPassword = (hint) => {
      const pwd = window.prompt(
        (hint || "删除订单") + "\n请输入管理密码以确认（防误删）："
      );
      if (pwd == null) return null;
      const s = String(pwd).trim();
      if (!s) {
        store.showToast("已取消：未输入管理密码", "error");
        return null;
      }
      return s;
    };

    const deleteOne = async (order) => {
      if (!order) return;
      if (
        !confirm(
          `确定删除该订单？\nID：${order.id}\n用户：${
            order.username || order.register_username || "游客"
          }\n金额：¥${Number(order.amount).toFixed(2)}\n\n此操作不可恢复。`
        )
      )
        return;
      const pwd = askAdminPassword("删除订单 #" + order.id);
      if (!pwd) return;
      deleting.value = true;
      try {
        await adminApi.deleteOrders([order.id], pwd);
        store.showToast("已删除订单");
        await loadOrders();
      } catch (err) {
        store.showToast(err.message || "删除失败", "error");
      } finally {
        deleting.value = false;
      }
    };

    const deleteSelected = async () => {
      const ids = selectedIds.value.slice();
      if (!ids.length) {
        store.showToast("请先勾选要删除的订单", "error");
        return;
      }
      if (
        !confirm(
          `确定删除选中的 ${ids.length} 条订单？\n此操作不可恢复。`
        )
      )
        return;
      const pwd = askAdminPassword(`批量删除 ${ids.length} 条订单`);
      if (!pwd) return;
      deleting.value = true;
      try {
        await adminApi.deleteOrders(ids, pwd);
        store.showToast(`已删除 ${ids.length} 条订单`);
        await loadOrders();
      } catch (err) {
        store.showToast(err.message || "删除失败", "error");
      } finally {
        deleting.value = false;
      }
    };

    const formatDate = (ts) => {
      if (!ts) return "-";
      const d = new Date(ts);
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${p(
        d.getHours()
      )}:${p(d.getMinutes())}`;
    };

    onMounted(loadOrders);

    return {
      loading,
      deleting,
      orderStatusFilter,
      searchQuery,
      filteredOrders,
      selectedIds,
      allVisibleSelected,
      toggleSelect,
      toggleSelectAll,
      approve,
      reject,
      deleteOne,
      deleteSelected,
      loadOrders,
      formatDate,
    };
  },
  template: `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold text-slate-800">订单审核</h2>
          <p class="text-xs text-slate-400 mt-1">审核支付凭证：监控 VIP 按天 / 图表查询按次</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex bg-slate-100 rounded-lg p-0.5 text-xs">
            <button v-for="s in [{k:'all',t:'全部'},{k:'pending',t:'待审'},{k:'approved',t:'已通过'},{k:'cancelled',t:'已驳回'}]"
                    :key="s.k" @click="orderStatusFilter=s.k; loadOrders()"
                    class="px-3 py-1.5 rounded-md font-bold transition"
                    :class="orderStatusFilter===s.k ? 'bg-white shadow text-slate-800' : 'text-slate-500'">{{ s.t }}</button>
          </div>
          <input v-model="searchQuery" type="text" placeholder="账号 / 单号 / 套餐"
                 class="border rounded-lg px-3 py-1.5 text-xs w-40">
          <button type="button" @click="deleteSelected" :disabled="deleting || !selectedIds.length"
                  class="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 bg-red-50 font-bold disabled:opacity-40 hover:bg-red-100">
            批量删除{{ selectedIds.length ? ' ('+selectedIds.length+')' : '' }}
          </button>
          <button type="button" @click="loadOrders" class="text-slate-400 hover:theme-text p-1.5" title="刷新">
            <i class="fa-solid fa-rotate-right"></i>
          </button>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left">
            <thead class="bg-slate-50 text-xs text-slate-500 border-b font-bold">
              <tr>
                <th class="py-3 px-3 w-10">
                  <input type="checkbox" :checked="allVisibleSelected" @change="toggleSelectAll"
                         class="rounded border-slate-300" title="全选当前列表">
                </th>
                <th class="py-3 px-4">时间</th>
                <th class="py-3 px-4">用户</th>
                <th class="py-3 px-4">类型 / 套餐</th>
                <th class="py-3 px-4">金额</th>
                <th class="py-3 px-4">凭证</th>
                <th class="py-3 px-4">发放</th>
                <th class="py-3 px-4">状态</th>
                <th class="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="o in filteredOrders" :key="o.id" class="hover:bg-slate-50"
                  :class="selectedIds.includes(o.id) ? 'bg-red-50/40' : ''">
                <td class="py-3.5 px-3">
                  <input type="checkbox" :checked="selectedIds.includes(o.id)"
                         @change="toggleSelect(o.id)" class="rounded border-slate-300">
                </td>
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
                      ? (o.vip_days_granted ? ('+' + o.vip_days_granted + '天') : (o.order_type === 'chart_credits' ? '次数' : '已发放'))
                      : '-' }}
                </td>
                <td class="py-3.5 px-4">
                  <span v-if="o.status === 'pending'" class="text-xs bg-orange-100 text-orange-600 px-2.5 py-0.5 rounded-full font-bold">待审核</span>
                  <span v-else-if="o.status === 'approved'" class="text-xs bg-emerald-100 text-emerald-600 px-2.5 py-0.5 rounded-full font-bold">已通过</span>
                  <span v-else class="text-xs bg-slate-100 text-slate-400 px-2.5 py-0.5 rounded-full">已驳回</span>
                </td>
                <td class="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                  <template v-if="o.status === 'pending'">
                    <button type="button" @click="approve(o)" class="theme-bg text-white text-xs px-3 py-1.5 rounded-lg font-bold hover:opacity-90">通过</button>
                    <button type="button" @click="reject(o)" class="bg-slate-100 text-slate-600 text-xs px-3 py-1.5 rounded-lg font-bold hover:bg-slate-200">驳回</button>
                  </template>
                  <button type="button" @click="deleteOne(o)" :disabled="deleting"
                          class="text-xs text-red-500 hover:text-red-700 font-bold px-2 py-1.5">删除</button>
                </td>
              </tr>
              <tr v-if="!filteredOrders.length">
                <td colspan="9" class="py-10 text-center text-slate-400 text-sm">暂无订单</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
};
