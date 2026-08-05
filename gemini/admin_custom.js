const adminCustomHtml = `
<div class="flex flex-col sm:flex-row justify-between gap-3">
  <h2 class="text-xl font-bold">定制监控</h2>
  <button @click="fetchCustom" class="bg-white border px-3 py-2 rounded-lg text-sm"><i class="fa-solid fa-rotate-right"></i></button>
</div>
<div class="bg-white border rounded-xl overflow-hidden shadow-sm">
  <div class="overflow-x-auto">
    <table class="w-full text-sm whitespace-nowrap">
      <thead class="bg-slate-50 text-slate-500 border-b"><tr>
        <th class="py-3 px-4 text-left">用户</th><th class="py-3 px-4 text-left">代码/名称</th>
        <th class="py-3 px-4 text-left">状态</th><th class="py-3 px-4 text-left">到期</th><th class="py-3 px-4 text-right">操作</th>
      </tr></thead>
      <tbody class="divide-y">
        <tr v-for="w in customList" :key="w.id" class="hover:bg-slate-50">
          <td class="py-3 px-4">{{w.username||w.user_id}}</td>
          <td class="py-3 px-4"><span class="font-mono font-bold">{{w.etf_code}}</span> <span class="text-xs text-slate-400">{{w.etf_name}}</span></td>
          <td class="py-3 px-4"><span :class="w.status==='active'?'text-emerald-500':(w.status==='pending'?'text-orange-500':'text-slate-400')">{{w.status}}</span></td>
          <td class="py-3 px-4 text-xs text-slate-400">{{w.expire_at?formatDate(w.expire_at):'-'}}</td>
          <td class="py-3 px-4 text-right space-x-1">
            <button @click="openCustomEdit(w)" class="text-xs bg-slate-100 px-2 py-1 rounded">编辑</button>
            <button @click="deleteCustom(w)" class="text-xs bg-red-50 text-red-500 px-2 py-1 rounded">删除</button>
          </td>
        </tr>
        <tr v-if="!customList.length"><td colspan="5" class="py-10 text-center text-slate-400">暂无</td></tr>
      </tbody>
    </table>
  </div>
</div>
`;
