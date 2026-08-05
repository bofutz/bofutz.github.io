const adminSharedHtml = `
<div class="flex flex-col sm:flex-row justify-between gap-3">
  <h2 class="text-xl font-bold">通用监控列表</h2>
  <div class="flex gap-2">
    <button @click="showBatchImport=true" class="text-sm bg-slate-100 px-3 py-2 rounded-lg">批量导入</button>
    <button @click="openSharedModal()" class="theme-bg text-white text-sm px-3 py-2 rounded-lg">添加</button>
    <button @click="fetchShared" class="bg-white border px-3 py-2 rounded-lg text-sm"><i class="fa-solid fa-rotate-right"></i></button>
  </div>
</div>
<div class="bg-white border rounded-xl overflow-hidden shadow-sm">
  <table class="w-full text-sm">
    <thead class="bg-slate-50 text-slate-500 border-b"><tr>
      <th class="py-3 px-4 text-left">代码</th><th class="py-3 px-4 text-left">名称</th>
      <th class="py-3 px-4 text-left">排序</th><th class="py-3 px-4 text-left">状态</th><th class="py-3 px-4 text-right">操作</th>
    </tr></thead>
    <tbody class="divide-y">
      <tr v-for="w in sharedList" :key="w.id" class="hover:bg-slate-50">
        <td class="py-3 px-4 font-mono font-bold">{{w.etf_code}}</td>
        <td class="py-3 px-4">{{w.etf_name}}</td>
        <td class="py-3 px-4">{{w.sort_order||0}}</td>
        <td class="py-3 px-4"><span :class="w.enabled?'text-emerald-500':'text-slate-400'">{{w.enabled?'启用':'停用'}}</span></td>
        <td class="py-3 px-4 text-right space-x-1">
          <button @click="openSharedModal(w)" class="text-xs bg-slate-100 px-2 py-1 rounded">编辑</button>
          <button @click="deleteShared(w)" class="text-xs bg-red-50 text-red-500 px-2 py-1 rounded">删除</button>
        </td>
      </tr>
      <tr v-if="!sharedList.length"><td colspan="5" class="py-10 text-center text-slate-400">暂无</td></tr>
    </tbody>
  </table>
</div>
`;
