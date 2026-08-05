/**
 * 波幅探长 - 后台【数据概览】分块组件
 * js/components/admin/Dashboard.js
 */
import { store } from "../../store.js";
import { adminApi } from "../../api/admin.js";

const { ref, reactive, onMounted } = Vue;

export default {
  name: "AdminDashboard",
  emits: ["switch-tab"],
  setup(props, { emit }) {
    const loading = ref(false);
    const stats = reactive({
      users: 0,
      vip_users: 0,
      orders_pending: 0,
      revenue: 0,
      shared_count: 0,
      custom_active: 0,
      tickets_pending: 0,
      orders_approved: 0,
      new_users_7d: 0,
      revenue_7d: 0,
    });

    const loadStats = async () => {
      loading.value = true;
      try {
        const res = await adminApi.fetchStats();
        if (res.success && res.data) {
          Object.assign(stats, res.data);
        }
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    const navTo = (tab) => {
      emit("switch-tab", tab);
    };

    onMounted(() => {
      loadStats();
    });

    return {
      loading,
      stats,
      loadStats,
      navTo,
    };
  },
  template: `
    <div class="space-y-4 select-none">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 class="text-xl font-bold text-slate-800">运营数据概览</h2>
        <span class="text-xs text-slate-400">近 7 日新用户 {{ stats.new_users_7d || 0 }} · 营收 ¥{{ Number(stats.revenue_7d || 0).toFixed(2) }}</span>
      </div>

      <!-- 核心指标 4 卡片 -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div class="text-xs text-slate-400 mb-1">注册用户</div>
          <div class="text-2xl font-bold text-slate-800">{{ stats.users || 0 }}</div>
          <div class="text-[11px] text-emerald-600 mt-1">通用 VIP {{ stats.vip_users || 0 }}</div>
        </div>

        <div class="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div class="text-xs text-slate-400 mb-1">待审订单</div>
          <div class="text-2xl font-bold" :class="(stats.orders_pending || 0) > 0 ? 'text-orange-500' : 'text-slate-800'">
            {{ stats.orders_pending || 0 }}
          </div>
          <div class="text-[11px] text-slate-400 mt-1">累计营收 ¥{{ Number(stats.revenue || 0).toFixed(2) }}</div>
        </div>

        <div class="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div class="text-xs text-slate-400 mb-1">通用监控标的</div>
          <div class="text-2xl font-bold text-slate-800">{{ stats.shared_count || 0 }}</div>
          <div class="text-[11px] text-slate-400 mt-1">定制活跃 {{ stats.custom_active || 0 }}</div>
        </div>

        <div class="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div class="text-xs text-slate-400 mb-1">待回复工单</div>
          <div class="text-2xl font-bold" :class="(stats.tickets_pending || 0) > 0 ? 'text-orange-500' : 'text-slate-800'">
            {{ stats.tickets_pending || 0 }}
          </div>
          <div class="text-[11px] text-slate-400 mt-1">已通过订单 {{ stats.orders_approved || 0 }}</div>
        </div>
      </div>

      <!-- 快捷操作区 -->
      <div class="bg-white rounded-xl border border-slate-100 p-5 shadow-sm space-y-3">
        <div class="text-sm font-bold text-slate-700">快捷操作</div>
        <div class="flex flex-wrap gap-2">
          <button @click="navTo('orders')" class="text-xs theme-bg text-white px-3.5 py-2 rounded-lg font-bold hover:opacity-90">
            审核订单 <span v-if="stats.orders_pending" class="bg-white/20 px-1.5 py-0.5 rounded ml-1">{{ stats.orders_pending }}</span>
          </button>
          <button @click="navTo('tickets')" class="text-xs bg-orange-50 text-orange-600 border border-orange-100 px-3.5 py-2 rounded-lg font-bold hover:bg-orange-100">
            处理答疑工单
          </button>
          <button @click="navTo('vote')" class="text-xs bg-emerald-50 text-emerald-600 border border-emerald-100 px-3.5 py-2 rounded-lg font-bold hover:bg-emerald-100">
            会员监控投票管理
          </button>
          <button @click="navTo('shared')" class="text-xs bg-slate-100 text-slate-600 px-3.5 py-2 rounded-lg font-medium hover:bg-slate-200">
            编辑通用列表
          </button>
          <button @click="navTo('plans')" class="text-xs bg-slate-100 text-slate-600 px-3.5 py-2 rounded-lg font-medium hover:bg-slate-200">
            套餐管理 (通用/定制/双重)
          </button>
          <button @click="navTo('settings')" class="text-xs bg-slate-100 text-slate-600 px-3.5 py-2 rounded-lg font-medium hover:bg-slate-200">
            系统设置 / 收款码 / 社交
          </button>
          <button @click="navTo('promos')" class="text-xs bg-slate-100 text-slate-600 px-3.5 py-2 rounded-lg font-medium hover:bg-slate-200">
            优惠码配置
          </button>
        </div>
      </div>

      <!-- 部署提示卡片 -->
      <div class="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-800 leading-relaxed">
        <i class="fa-solid fa-lightbulb mr-1"></i>
        新订单与答疑工单会实时推送 Telegram。可配置 Cloudflare Worker 环境变量 <code class="bg-white px-1.5 py-0.5 rounded border border-amber-200">PAY_NOTIFY_SECRET</code> 并对接回调入口 <code class="bg-white px-1.5 py-0.5 rounded border border-amber-200">/api/pay/notify?key=密钥</code> 实现自动审核开通。
      </div>
    </div>
  `,
};
