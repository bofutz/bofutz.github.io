const adminUsersHtml = `
<div class="flex flex-col sm:flex-row justify-between gap-3">
  <div><h2 class="text-xl font-bold">用户管理</h2><p class="text-xs text-slate-400">充天数 · 重置密码 · 删除均需谨慎操作</p></div>
  <div class="flex flex-wrap gap-2">
    <input v-model="userSearchQuery" placeholder="搜索邮箱/邀请码/IP" class="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white sm:w-48">
    <button @click="openBatchCharge" class="text-sm bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-2 rounded-lg">批量充天数</button>
    <button @click="fetchUsers" class="text-sm bg-white border border-slate-200 px-3 py-2 rounded-lg"><i class="fa-solid fa-rotate-right"></i></button>
  </div>
</div>
<div class="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
  <div class="overflow-x-auto custom-scrollbar">
    <table class="w-full text-sm whitespace-nowrap">
      <thead class="bg-slate-50 text-slate-500 border-b">
        <tr>
          <th class="py-3 px-3 w-8"><input type="checkbox" @change="toggleSelectAllUsers" :checked="selectedUserIds.length&&selectedUserIds.length===filteredUsers.length"></th>
          <th class="py-3 px-4 text-left">ID/时间</th>
          <th class="py-3 px-4 text-left">账号</th>
          <th class="py-3 px-4 text-left">IP</th>
          <th class="py-3 px-4 text-left">通用VIP</th>
          <th class="py-3 px-4 text-left">邀请码</th>
          <th class="py-3 px-4 text-right">操作</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-50">
        <tr v-for="u in filteredUsers" :key="u.id" class="hover:bg-slate-50">
          <td class="px-3"><input type="checkbox" :value="u.id" v-model="selectedUserIds"></td>
          <td class="py-3 px-4 text-xs text-slate-400">{{u.id}}<br>{{formatDate(u.created_at)}}</td>
          <td class="py-3 px-4 font-bold">{{u.username}}<div v-if="u.referred_by||u.ref_by" class="text-[10px] text-slate-400">邀请: {{u.referred_by||u.ref_by}}</div></td>
          <td class="py-3 px-4 font-mono text-xs">{{u.ip||u.register_ip||'-'}}</td>
          <td class="py-3 px-4" :class="(u.shared_vip_days||u.vip_days_left)>0?'text-emerald-500 font-bold':'text-slate-400'">{{u.shared_vip_days??u.vip_days_left??0}} 天</td>
          <td class="py-3 px-4 font-mono text-xs font-bold">{{u.referral_code||'-'}}</td>
          <td class="py-3 px-4 text-right space-x-1">
            <button @click="openChargeModal(u)" class="text-xs bg-emerald-50 text-emerald-600 px-2 py-1 rounded border border-emerald-100">充天数</button>
            <button @click="openResetPwd(u)" class="text-xs bg-amber-50 text-amber-600 px-2 py-1 rounded border border-amber-100">重置密码</button>
            <button @click="openDeleteUser(u)" class="text-xs bg-red-50 text-red-500 px-2 py-1 rounded border border-red-100">删除</button>
          </td>
        </tr>
        <tr v-if="!filteredUsers.length"><td colspan="7" class="py-10 text-center text-slate-400">暂无用户</td></tr>
      </tbody>
    </table>
  </div>
</div>
`;
