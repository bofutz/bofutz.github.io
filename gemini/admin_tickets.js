const adminTicketsHtml = `
<div class="flex justify-between gap-3">
  <h2 class="text-xl font-bold">答疑工单</h2>
  <div class="flex gap-2">
    <button @click="openBroadcast" class="text-sm bg-indigo-50 text-indigo-600 border border-indigo-100 px-3 py-2 rounded-lg">一键广播</button>
    <button @click="fetchTickets" class="bg-white border px-3 py-2 rounded-lg text-sm"><i class="fa-solid fa-rotate-right"></i></button>
  </div>
</div>
<div class="bg-white border rounded-xl overflow-hidden shadow-sm">
  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="bg-slate-50 text-slate-500 border-b"><tr>
        <th class="py-3 px-4 text-left">时间</th><th class="py-3 px-4 text-left">用户</th><th class="py-3 px-4 text-left">主题</th>
        <th class="py-3 px-4 text-left">级别</th><th class="py-3 px-4 text-left">状态</th><th class="py-3 px-4 text-right">操作</th>
      </tr></thead>
      <tbody class="divide-y">
        <tr v-for="t in tickets" :key="t.id" class="hover:bg-slate-50">
          <td class="py-3 px-4 text-xs text-slate-400">{{formatDate(t.created_at)}}</td>
          <td class="py-3 px-4 font-bold">{{t.username||'-'}}</td>
          <td class="py-3 px-4">{{t.subject}}</td>
          <td class="py-3 px-4 text-xs">{{t.level}}</td>
          <td class="py-3 px-4"><span :class="t.status==='pending'?'text-orange-500':'text-emerald-500'">{{t.status==='pending'?'待回复':'已回复'}}</span></td>
          <td class="py-3 px-4 text-right">
            <button @click="openReplyModal(t)" class="text-xs theme-bg text-white px-3 py-1 rounded-lg">回复</button>
          </td>
        </tr>
        <tr v-if="!tickets.length"><td colspan="6" class="py-10 text-center text-slate-400">暂无工单</td></tr>
      </tbody>
    </table>
  </div>
</div>
`;
