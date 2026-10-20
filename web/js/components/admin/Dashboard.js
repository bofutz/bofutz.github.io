/**
 * 后台数据概览（已去掉票选/定制）
 */
import { store } from "../../store.js";
import { adminApi } from "../../api/admin.js";

const { ref, reactive, onMounted } = window.Vue || Vue;

export default {
  name: "AdminDashboard",
  emits: ["switch-tab"],
  setup(_, { emit }) {
    const loading = ref(false);
    const stats = reactive({
      users: 0,
      orders_pending: 0,
      revenue: 0,
      shared_count: 0,
      sponsor_active: 0,
      tickets_pending: 0,
      orders_approved: 0,
      new_users_7d: 0,
      revenue_7d: 0,
    });

    const loadStats = async () => {
      loading.value = true;
      try {
        const res = await adminApi.fetchStats();
        if (res.success && res.data) Object.assign(stats, res.data);
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    const navTo = (tab) => emit("switch-tab", tab);
    onMounted(loadStats);
    return { loading, stats, loadStats, navTo };
  },
  template: `
    <div class="space-y-5 select-none">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 class="text-xl font-bold text-slate-800">运营数据概览</h2>
          <p class="text-xs text-slate-400 mt-0.5">注册即看全量 · 赞助标的进入公共池</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs text-slate-400">
            近7日新用户 <strong class="text-slate-700">{{ stats.new_users_7d || 0 }}</strong>
            · 营收 <strong class="text-slate-700">¥{{ Number(stats.revenue_7d || 0).toFixed(2) }}</strong>
          </span>
          <button @click="loadStats" class="bg-white border px-3 py-1.5 rounded-lg text-sm">
            <i class="fa-solid fa-rotate-right" :class="{'animate-spin': loading}"></i>
          </button>
        </div>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="bg-white rounded-xl border p-4 shadow-sm">
          <div class="text-xs text-slate-400 mb-1">注册用户</div>
          <div class="text-2xl font-bold">{{ stats.users || 0 }}</div>
        </div>
        <div class="bg-white rounded-xl border p-4 shadow-sm">
          <div class="text-xs text-slate-400 mb-1">待审订单</div>
          <div class="text-2xl font-bold" :class="(stats.orders_pending||0)>0?'text-orange-500':''">{{ stats.orders_pending || 0 }}</div>
          <div class="text-[11px] text-slate-400 mt-1">累计 ¥{{ Number(stats.revenue||0).toFixed(2) }}</div>
        </div>
        <div class="bg-white rounded-xl border p-4 shadow-sm">
          <div class="text-xs text-slate-400 mb-1">默认列表</div>
          <div class="text-2xl font-bold">{{ stats.shared_count || 0 }}</div>
          <div class="text-[11px] text-slate-400 mt-1">有效赞助 {{ stats.sponsor_active || 0 }}</div>
        </div>
        <div class="bg-white rounded-xl border p-4 shadow-sm">
          <div class="text-xs text-slate-400 mb-1">待回复工单</div>
          <div class="text-2xl font-bold" :class="(stats.tickets_pending||0)>0?'text-orange-500':''">{{ stats.tickets_pending || 0 }}</div>
        </div>
      </div>
      <div class="bg-white rounded-xl border p-5 shadow-sm">
        <div class="text-sm font-bold text-slate-700 mb-3">快捷操作</div>
        <div class="flex flex-wrap gap-2">
          <button @click="navTo('orders')" class="text-xs theme-bg text-white px-3.5 py-2 rounded-lg font-bold">审核订单</button>
          <button @click="navTo('sponsors')" class="text-xs bg-emerald-50 text-emerald-600 border border-emerald-100 px-3.5 py-2 rounded-lg font-bold">赞助标的</button>
          <button @click="navTo('shared')" class="text-xs bg-slate-100 text-slate-600 px-3.5 py-2 rounded-lg">默认监控列表</button>
          <button @click="navTo('tickets')" class="text-xs bg-orange-50 text-orange-600 border border-orange-100 px-3.5 py-2 rounded-lg font-bold">客服工单</button>
          <button @click="navTo('settings')" class="text-xs bg-slate-100 text-slate-600 px-3.5 py-2 rounded-lg">系统设置</button>
        </div>
      </div>
    </div>
  `,
};
