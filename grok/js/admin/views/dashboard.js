/**
 * 管理后台 · 数据概览
 * - 运营指标卡片
 * - 快捷操作
 * - 一键广播弹窗
 */
import { ref, reactive } from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";

export const DashboardView = {
  name: "AdminDashboard",
  props: {
    stats: { type: Object, default: () => ({}) },
    fetchAdmin: { type: Function, required: true },
    showToast: { type: Function, required: true },
    switchTab: { type: Function, required: true },
  },
  setup(props) {
    const broadcastVisible = ref(false);
    const broadcastLoading = ref(false);
    const broadcastForm = reactive({
      title: "",
      content: "",
      also_tg: true,
    });

    const openBroadcast = () => {
      broadcastForm.title = "";
      broadcastForm.content = "";
      broadcastForm.also_tg = true;
      broadcastVisible.value = true;
    };

    const submitBroadcast = async () => {
      if (!broadcastForm.content.trim()) {
        props.showToast("请填写内容", "error");
        return;
      }
      broadcastLoading.value = true;
      try {
        const d = await props.fetchAdmin("/api/admin/broadcast", {
          method: "POST",
          body: JSON.stringify({
            title: broadcastForm.title || "系统通知",
            content: broadcastForm.content.trim(),
            also_tg: broadcastForm.also_tg,
          }),
        });
        props.showToast(d.message || "广播成功", "success");
        broadcastVisible.value = false;
      } catch (e) {
        props.showToast(e.message, "error");
      } finally {
        broadcastLoading.value = false;
      }
    };

    return {
      stats: props.stats,
      switchTab: props.switchTab,
      broadcastVisible,
      broadcastLoading,
      broadcastForm,
      openBroadcast,
      submitBroadcast,
    };
  },

  template: `
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 class="text-xl font-bold text-slate-800">运营数据概览</h2>
        <span class="text-xs text-slate-400">
          近 7 日新用户 {{ stats.new_users_7d || 0 }} · 营收 ¥{{ Number(stats.revenue_7d || 0).toFixed(2) }}
        </span>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div class="text-xs text-slate-400 mb-1">注册用户</div>
          <div class="text-2xl font-bold">{{ stats.users || 0 }}</div>
          <div class="text-[11px] text-emerald-600 mt-1">通用VIP {{ stats.vip_users || 0 }}</div>
        </div>
        <div class="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div class="text-xs text-slate-400 mb-1">待审订单</div>
          <div class="text-2xl font-bold" :class="(stats.orders_pending||0)>0 ? 'text-orange-500' : ''">
            {{ stats.orders_pending || 0 }}
          </div>
          <div class="text-[11px] text-slate-400 mt-1">累计营收 ¥{{ Number(stats.revenue || 0).toFixed(2) }}</div>
        </div>
        <div class="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div class="text-xs text-slate-400 mb-1">监控标的</div>
          <div class="text-2xl font-bold">{{ stats.shared_count || 0 }}</div>
          <div class="text-[11px] text-slate-400 mt-1">定制活跃 {{ stats.custom_active || 0 }}</div>
        </div>
        <div class="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div class="text-xs text-slate-400 mb-1">待回复工单</div>
          <div class="text-2xl font-bold" :class="(stats.tickets_pending||0)>0 ? 'text-orange-500' : ''">
            {{ stats.tickets_pending || 0 }}
          </div>
          <div class="text-[11px] text-slate-400 mt-1">已通过订单 {{ stats.orders_approved || 0 }}</div>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
        <div class="text-sm font-medium text-slate-700 mb-3">快捷操作</div>
        <div class="flex flex-wrap gap-2">
          <button @click="switchTab('orders')" class="text-xs theme-bg text-white px-3 py-2 rounded-lg">
            审核订单
            <span v-if="stats.orders_pending" class="bg-white/20 px-1.5 rounded">{{ stats.orders_pending }}</span>
          </button>
          <button @click="switchTab('tickets')"
            class="text-xs bg-orange-50 text-orange-600 border border-orange-100 px-3 py-2 rounded-lg">
            处理工单
          </button>
          <button @click="openBroadcast"
            class="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 px-3 py-2 rounded-lg">
            一键广播
          </button>
          <button @click="switchTab('shared')" class="text-xs bg-slate-100 px-3 py-2 rounded-lg">编辑通用列表</button>
          <button @click="switchTab('plans')" class="text-xs bg-slate-100 px-3 py-2 rounded-lg">套餐（通用/定制）</button>
          <button @click="switchTab('settings')" class="text-xs bg-slate-100 px-3 py-2 rounded-lg">赠送 / 收款码 / 社交</button>
          <button @click="switchTab('promos')" class="text-xs bg-slate-100 px-3 py-2 rounded-lg">优惠码</button>
        </div>
      </div>

      <div class="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-800">
        <i class="fa-solid fa-lightbulb mr-1"></i>
        新订单与答疑工单会通过 Telegram 提醒。支付自动开通可配置 Worker 环境变量
        <code class="bg-white px-1 rounded">PAY_NOTIFY_SECRET</code>
        并对接 V免签 notify →
        <code class="bg-white px-1 rounded">/api/pay/notify?key=密钥</code>。
        工单 TG 回复请配置 webhook 到
        <code class="bg-white px-1 rounded">/api/tickets/tg-webhook</code>。
      </div>

      <!-- 广播弹窗 -->
      <div v-if="broadcastVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4"
        @click.self="broadcastVisible=false">
        <div class="bg-white rounded-2xl w-full max-w-md p-6 space-y-3">
          <h3 class="font-bold">
            <i class="fa-solid fa-bullhorn mr-1 text-indigo-500"></i>一键广播给全体会员
          </h3>
          <p class="text-xs text-slate-400">将写入公告，并为每位用户生成一条「已回复」工单。</p>
          <input v-model="broadcastForm.title" placeholder="标题（默认：系统通知）"
            class="w-full border px-3 py-2 rounded-lg text-sm">
          <textarea v-model="broadcastForm.content" rows="5" placeholder="广播内容..."
            class="w-full border px-3 py-2 rounded-lg text-sm"></textarea>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" v-model="broadcastForm.also_tg"> 同时通知管理员 TG
          </label>
          <div class="flex justify-end gap-2">
            <button @click="broadcastVisible=false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button @click="submitBroadcast" :disabled="broadcastLoading"
              class="bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              {{ broadcastLoading ? '发送中...' : '确认广播' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
};
