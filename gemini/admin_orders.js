const adminOrdersHtml = `
<div class="flex flex-col sm:flex-row justify-between gap-3">
  <h2 class="text-xl font-bold">订单审核</h2>
  <div class="flex gap-2 flex-wrap">
    <div class="flex bg-white border rounded-lg overflow-hidden text-xs">
      <button v-for="s in [{k:'all',t:'全部'},{k:'pending',t:'待审'},{k:'approved',t:'已通过'},{k:'cancelled',t:'已驳回'}]" :key="s.k"
        @click="orderStatusFilter=s.k" class="px-3 py-2 border-l first:border-0"
        :class="orderStatusFilter===s.k?'theme-bg text-white':'text-slate-600'">{{s.t}}</button>
    </div>
    <input v-model="orderSearchQuery" placeholder="账号/单号" class="px-3 py-2 border rounded-lg text-sm bg-white">
    <button @click="fetchOrders" class="bg-white border px-3 py-2 rounded-lg text-sm"><i class="fa-solid fa-rotate-right"></i></button>
  </div>
</div>
<div class="bg-white border rounded-xl overflow-hidden shadow-sm">
  <div class="overflow-x-auto">
    <table class="w-full text-sm whitespace-nowrap">
      <thead class="bg-slate-50 text-slate-500 border-b"><tr>
        <th class="py-3 px-4 text-left">时间</th><th class="py-3 px-4 text-left">用户</th><th class="py-3 px-4 text-left">类型/套餐</th>
        <th class="py-3 px-4 text-left">金额</th><th class="py-3 px-4 text-left text-orange-500">凭证</th>
        <th class="py-3 px-4 text-left">发放</th><th class="py-3 px-4 text-left">状态</th><th class="py-3 px-4 text-right">操作</th>
      </tr></thead>
      <tbody class="divide-y">
        <tr v-for="o in filteredOrders" :key="o.id" class="hover:bg-slate-50">
          <td class="py-3 px-4 text-xs text-slate-400">{{formatDate(o.created_at)}}</td>
          <td class="py-3 px-4 font-bold">{{o.username||o.register_username||'-'}}</td>
          <td class="py-3 px-4">
            <span class="bg-slate-100 px-2 py-0.5 rounded text-xs">{{getPlanName(o.plan_id)}}</span>
            <span class="text-[10px] ml-1" :class="o.order_type==='custom_watchlist'?'text-purple-500':'text-slate-400'">{{o.order_type==='custom_watchlist'?'定制':'通用'}}</span>
            <span v-if="o.symbol_count>1" class="text-[10px] text-slate-400 ml-1">×{{o.symbol_count}}只</span>
            <span v-if="o.promo_code" class="text-[10px] text-orange-500 ml-1">{{o.promo_code}}</span>
          </td>
          <td class="py-3 px-4 font-bold">¥{{Number(o.amount||0).toFixed(2)}}
            <span v-if="o.original_amount&&Number(o.original_amount)!==Number(o.amount)" class="text-[10px] text-slate-400 line-through ml-1">¥{{Number(o.original_amount).toFixed(2)}}</span>
          </td>
          <td class="py-3 px-4 font-mono font-bold text-orange-500">{{o.tx_id_last6||'-'}}</td>
          <td class="py-3 px-4 text-xs">{{o.status==='approved'?(o.vip_days_granted?('+'+o.vip_days_granted+'天'):'定制激活'):'-'}}</td>
          <td class="py-3 px-4">
            <span v-if="o.status==='pending'" class="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">待审核</span>
            <span v-else-if="o.status==='approved'" class="text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">已通过</span>
            <span v-else class="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">已驳回</span>
          </td>
          <td class="py-3 px-4 text-right space-x-1" v-if="o.status==='pending'">
            <button @click="approveOrder(o)" class="theme-bg text-white text-xs px-3 py-1 rounded-lg">通过</button>
            <button @click="rejectOrder(o)" class="bg-slate-100 text-xs px-3 py-1 rounded-lg">驳回</button>
          </td>
          <td v-else class="py-3 px-4 text-right text-slate-300 text-xs">—</td>
        </tr>
        <tr v-if="!filteredOrders.length"><td colspan="8" class="py-10 text-center text-slate-400">暂无订单</td></tr>
      </tbody>
    </table>
  </div>
</div>
`;
