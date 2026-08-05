const adminPromosHtml = `
<div class="flex justify-between gap-3">
  <h2 class="text-xl font-bold">优惠码</h2>
  <button @click="openPromoModal()" class="theme-bg text-white text-sm px-3 py-2 rounded-lg">新增</button>
</div>
<div class="bg-white border rounded-xl overflow-hidden shadow-sm">
  <div class="overflow-x-auto">
    <table class="w-full text-sm whitespace-nowrap">
      <thead class="bg-slate-50 text-slate-500 border-b"><tr>
        <th class="py-3 px-4 text-left">代码</th><th class="py-3 px-4 text-left">名称</th><th class="py-3 px-4 text-left">折扣</th>
        <th class="py-3 px-4 text-left">有效期</th><th class="py-3 px-4 text-left">状态</th><th class="py-3 px-4 text-right">操作</th>
      </tr></thead>
      <tbody class="divide-y">
        <tr v-for="p in promos" :key="p.id" class="hover:bg-slate-50">
          <td class="py-3 px-4 font-mono font-bold">{{p.code}}</td>
          <td class="py-3 px-4">{{p.name||'-'}}</td>
          <td class="py-3 px-4">{{p.discount_type==='percent'? (p.discount_value+'%') : ('¥'+p.discount_value)}}</td>
          <td class="py-3 px-4 text-xs">{{formatDate(p.start_at)}} ~ {{formatDate(p.end_at)}}</td>
          <td class="py-3 px-4"><span :class="p.enabled?'text-emerald-500':'text-slate-400'">{{p.enabled?'启用':'停用'}}</span></td>
          <td class="py-3 px-4 text-right space-x-1">
            <button @click="openPromoModal(p)" class="text-xs bg-slate-100 px-2 py-1 rounded">编辑</button>
            <button @click="deletePromo(p)" class="text-xs bg-red-50 text-red-500 px-2 py-1 rounded">删除</button>
          </td>
        </tr>
        <tr v-if="!promos.length"><td colspan="6" class="py-10 text-center text-slate-400">暂无</td></tr>
      </tbody>
    </table>
  </div>
</div>
`;
