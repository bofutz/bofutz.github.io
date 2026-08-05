const adminDashboardHtml = `
<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
  <h2 class="text-xl font-bold text-slate-800">运营数据概览</h2>
  <span class="text-xs text-slate-400">近 7 日新用户 {{stats.new_users_7d||0}} · 营收 ¥{{Number(stats.revenue_7d||0).toFixed(2)}}</span>
</div>
<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
  <div class="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
    <div class="text-xs text-slate-400 mb-1">注册用户</div>
    <div class="text-2xl font-bold">{{stats.users||0}}</div>
    <div class="text-[11px] text-emerald-600 mt-1">通用VIP {{stats.vip_users||0}}</div>
  </div>
  <div class="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
    <div class="text-xs text-slate-400 mb-1">待审订单</div>
    <div class="text-2xl font-bold" :class="(stats.orders_pending||0)>0?'text-orange-500':''">{{stats.orders_pending||0}}</div>
    <div class="text-[11px] text-slate-400 mt-1">累计营收 ¥{{Number(stats.revenue||0).toFixed(2)}}</div>
  </div>
  <div class="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
    <div class="text-xs text-slate-400 mb-1">监控标的</div>
    <div class="text-2xl font-bold">{{stats.shared_count||0}}</div>
    <div class="text-[11px] text-slate-400 mt-1">定制活跃 {{stats.custom_active||0}}</div>
  </div>
  <div class="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
    <div class="text-xs text-slate-400 mb-1">待回复工单</div>
    <div class="text-2xl font-bold" :class="(stats.tickets_pending||0)>0?'text-orange-500':''">{{stats.tickets_pending||0}}</div>
    <div class="text-[11px] text-slate-400 mt-1">已通过订单 {{stats.orders_approved||0}}</div>
  </div>
</div>
<div class="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
  <div class="text-sm font-medium text-slate-700 mb-3">快捷操作</div>
  <div class="flex flex-wrap gap-2">
    <button @click="switchTab('orders')" class="text-xs theme-bg text-white px-3 py-2 rounded-lg">审核订单 <span v-if="stats.orders_pending" class="bg-white/20 px-1.5 rounded">{{stats.orders_pending}}</span></button>
    <button @click="switchTab('tickets')" class="text-xs bg-orange-50 text-orange-600 border border-orange-100 px-3 py-2 rounded-lg">处理工单</button>
    <button @click="openBroadcast" class="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 px-3 py-2 rounded-lg">一键广播</button>
    <button @click="switchTab('shared')" class="text-xs bg-slate-100 px-3 py-2 rounded-lg">编辑通用列表</button>
    <button @click="switchTab('plans')" class="text-xs bg-slate-100 px-3 py-2 rounded-lg">套餐（通用/定制）</button>
    <button @click="switchTab('settings')" class="text-xs bg-slate-100 px-3 py-2 rounded-lg">赠送 / 收款码 / 社交</button>
    <button @click="switchTab('promos')" class="text-xs bg-slate-100 px-3 py-2 rounded-lg">优惠码</button>
  </div>
</div>
<div class="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-800">
  <i class="fa-solid fa-lightbulb mr-1"></i>
  新订单与答疑工单会通过 Telegram 提醒。支付自动开通可配置 Worker 环境变量 <code class="bg-white px-1 rounded">PAY_NOTIFY_SECRET</code> 并对接 V免签 notify → <code class="bg-white px-1 rounded">/api/pay/notify?key=密钥</code>。工单 TG 回复请配置 webhook 到 <code class="bg-white px-1 rounded">/api/tickets/tg-webhook</code>。
</div>
`;
