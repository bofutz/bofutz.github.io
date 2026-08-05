const adminPlansHtml = `
<div class="flex flex-col sm:flex-row justify-between gap-3">
  <div>
    <h2 class="text-xl font-bold">套餐管理</h2>
    <p class="text-xs text-slate-400">通用与定制套餐独立配置。定制为「套餐总价」，含系统设置中的最多只数（默认 3 只），不按只数乘价。</p>
  </div>
  <div class="flex gap-2">
    <div class="flex bg-white border rounded-lg overflow-hidden text-xs">
      <button v-for="s in [{k:'all',t:'全部'},{k:'shared',t:'通用'},{k:'custom',t:'定制'}]" :key="s.k"
        @click="planTypeFilter=s.k" class="px-3 py-2 border-l first:border-0"
        :class="planTypeFilter===s.k?'theme-bg text-white':'text-slate-600'">{{s.t}}</button>
    </div>
    <button @click="openPlanModal()" class="theme-bg text-white text-sm px-3 py-2 rounded-lg">新增套餐</button>
  </div>
</div>
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
  <div v-for="p in filteredPlans" :key="p.id" class="bg-white border rounded-xl p-4 shadow-sm relative">
    <span v-if="p.tag" class="absolute top-0 right-0 bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-bl">{{p.tag}}</span>
    <div class="font-bold text-slate-800">{{p.name}}</div>
    <div class="text-2xl font-light mt-1">¥{{p.price}} <span class="text-xs text-slate-400">{{(p.plan_type||'shared')==='custom'?'（套餐总价）':''}}</span></div>
    <div class="text-xs text-slate-400 mt-1">{{p.days}} 天 · {{(p.plan_type||'shared')==='custom'?'定制':'通用'}} · 排序 {{p.sort_order||0}}</div>
    <div class="mt-3 flex gap-2">
      <button @click="openPlanModal(p)" class="text-xs bg-slate-100 px-2 py-1 rounded">编辑</button>
      <button @click="deletePlan(p)" class="text-xs bg-red-50 text-red-500 px-2 py-1 rounded">删除</button>
      <span class="text-[10px] ml-auto self-center" :class="p.enabled?'text-emerald-500':'text-slate-400'">{{p.enabled?'启用':'停用'}}</span>
    </div>
  </div>
</div>
`;
