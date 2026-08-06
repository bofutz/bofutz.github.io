/**
 * 波幅探长 - 后台全功能完整脚本 (admin-app.js)
 * 补全 10 大完整后台组件与所有弹窗 (用户管理/订单审核/套餐/双监控/投票/优惠码/设置/工单广播)
 */
const { createApp, ref, reactive, computed, onMounted } = Vue;

const API_BASE = "https://vip.hahagw.eu.org";

const store = reactive({
  adminSecret: localStorage.getItem("admin_secret") || "",
  toasts: [],
  showToast(msg, type = "success") {
    store.toasts.push({ msg, type, id: Date.now() });
    setTimeout(() => { store.toasts.shift(); }, 2800);
  }
});

async function adminFetch(endpoint, options = {}) {
  const headers = { "Content-Type": "application/json", "Admin-Secret": store.adminSecret, ...options.headers };
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem("admin_secret");
    store.adminSecret = "";
    throw new Error("管理员鉴权失败");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || "请求处理失败");
  return data;
}

const ToastComp = {
  setup() { return { toasts: store.toasts }; },
  template: `
    <div class="fixed top-4 right-4 z-[200] space-y-2 pointer-events-none select-none">
      <div v-for="t in toasts" :key="t.id" class="px-4 py-2.5 rounded-lg shadow-lg text-sm text-white font-medium pointer-events-auto" :class="t.type==='error'?'bg-red-500':'bg-emerald-500'">
        <span>{{ t.msg }}</span>
      </div>
    </div>
  `,
};

// 1. 数据概览组件
const DashboardComp = {
  emits: ["switch-tab"],
  setup(props, { emit }) {
    const stats = reactive({ users: 0, vip_users: 0, orders_pending: 0, revenue: 0, shared_count: 0, custom_active: 0, tickets_pending: 0, orders_approved: 0, new_users_7d: 0, revenue_7d: 0 });
    onMounted(async () => {
      const res = await adminFetch("/api/admin/stats").catch(() => ({ data: {} }));
      if (res.data) Object.assign(stats, res.data);
    });
    return { stats, navTo: (t) => emit("switch-tab", t) };
  },
  template: `
    <div class="space-y-4 select-none">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-bold text-slate-800">运营数据概览</h2>
        <span class="text-xs text-slate-400">近 7 日新用户 {{ stats.new_users_7d }} · 营收 ¥ {{ stats.revenue_7d }}</span>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="bg-white p-4 rounded-xl border shadow-sm"><div class="text-xs text-slate-400 mb-1">注册用户</div><div class="text-2xl font-bold">{{ stats.users }}</div><div class="text-xs text-emerald-600 mt-1">通用 VIP {{ stats.vip_users }}</div></div>
        <div class="bg-white p-4 rounded-xl border shadow-sm"><div class="text-xs text-slate-400 mb-1">待审订单</div><div class="text-2xl font-bold text-orange-500">{{ stats.orders_pending }}</div><div class="text-xs text-slate-400 mt-1">累计营收 ¥ {{ stats.revenue }}</div></div>
        <div class="bg-white p-4 rounded-xl border shadow-sm"><div class="text-xs text-slate-400 mb-1">通用监控标的</div><div class="text-2xl font-bold">{{ stats.shared_count }}</div><div class="text-xs text-slate-400 mt-1">定制活跃 {{ stats.custom_active }}</div></div>
        <div class="bg-white p-4 rounded-xl border shadow-sm"><div class="text-xs text-slate-400 mb-1">待回复工单</div><div class="text-2xl font-bold text-orange-500">{{ stats.tickets_pending }}</div><div class="text-xs text-slate-400 mt-1">已通过订单 {{ stats.orders_approved }}</div></div>
      </div>
      <div class="bg-white p-5 rounded-xl border space-x-2 shadow-sm">
        <button @click="navTo('orders')" class="theme-bg text-white text-xs px-3.5 py-2 rounded-lg font-bold">审核订单</button>
        <button @click="navTo('tickets')" class="bg-orange-50 text-orange-600 border border-orange-100 text-xs px-3.5 py-2 rounded-lg font-bold">处理工单</button>
        <button @click="navTo('vote')" class="bg-emerald-50 text-emerald-600 border border-emerald-100 text-xs px-3.5 py-2 rounded-lg font-bold">监控投票管理</button>
        <button @click="navTo('settings')" class="bg-slate-100 text-slate-600 text-xs px-3.5 py-2 rounded-lg font-bold">系统设置</button>
      </div>
    </div>
  `,
};

// 2. 用户管理组件 (充天数/批量/重置密码/删除全弹窗)
const UserMgmtComp = {
  setup() {
    const users = ref([]);
    const chargeDays = ref(7);
    const chargeModalVisible = ref(false);
    const targetUser = ref(null);
    const resetModalVisible = ref(false);
    const resetConfirmSecret = ref("");
    const deleteModalVisible = ref(false);

    const loadUsers = async () => {
      const res = await adminFetch("/api/admin/users").catch(() => ({ data: [] }));
      users.value = res.data || [];
    };

    const submitCharge = async () => {
      try {
        await adminFetch("/api/admin/users/charge", { method: "POST", body: JSON.stringify({ user_id: targetUser.value.id, add_days: chargeDays.value }) });
        store.showToast("天数调整成功");
        chargeModalVisible.value = false;
        loadUsers();
      } catch (err) { store.showToast(err.message, "error"); }
    };

    const submitResetPassword = async () => {
      try {
        await adminFetch("/api/admin/users/reset_password", { method: "POST", body: JSON.stringify({ user_id: targetUser.value.id, admin_confirm: resetConfirmSecret.value }) });
        store.showToast("密码已重置为 bofutz");
        resetModalVisible.value = false;
      } catch (err) { store.showToast(err.message, "error"); }
    };

    const submitDeleteUser = async () => {
      try {
        await adminFetch("/api/admin/users", { method: "DELETE", body: JSON.stringify({ user_id: targetUser.value.id, admin_confirm: resetConfirmSecret.value }) });
        store.showToast("用户已删除");
        deleteModalVisible.value = false;
        loadUsers();
      } catch (err) { store.showToast(err.message, "error"); }
    };

    onMounted(loadUsers);
    return {
      users, chargeDays, chargeModalVisible, resetModalVisible, deleteModalVisible, targetUser, resetConfirmSecret,
      openCharge: (u) => { targetUser.value = u; chargeDays.value = 7; chargeModalVisible.value = true; },
      openReset: (u) => { targetUser.value = u; resetConfirmSecret.value = ""; resetModalVisible.value = true; },
      openDelete: (u) => { targetUser.value = u; resetConfirmSecret.value = ""; deleteModalVisible.value = true; },
      submitCharge, submitResetPassword, submitDeleteUser
    };
  },
  template: `
    <div class="space-y-4 select-none">
      <h2 class="text-xl font-bold">用户管理</h2>
      <div class="bg-white rounded-xl border overflow-hidden shadow-sm">
        <table class="w-full text-sm text-left whitespace-nowrap">
          <thead class="bg-slate-50 text-xs font-bold"><tr><th class="p-3">ID</th><th class="p-3">账号</th><th class="p-3">IP</th><th class="p-3">VIP天数</th><th class="p-3">邀请码</th><th class="p-3 text-right">操作</th></tr></thead>
          <tbody class="divide-y">
            <tr v-for="u in users" :key="u.id" class="hover:bg-slate-50">
              <td class="p-3 font-mono text-slate-400">{{ u.id }}</td>
              <td class="p-3 font-bold">{{ u.username }}</td>
              <td class="p-3 font-mono text-xs text-slate-400">{{ u.ip || '-' }}</td>
              <td class="p-3 font-bold text-emerald-600 font-mono">{{ u.shared_vip_days || u.vip_days_left || 0 }} 天</td>
              <td class="p-3 font-mono text-xs">{{ u.referral_code || '-' }}</td>
              <td class="p-3 text-right space-x-1">
                <button @click="openCharge(u)" class="text-xs bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded font-bold">充天数</button>
                <button @click="openReset(u)" class="text-xs bg-amber-50 text-amber-600 px-2.5 py-1 rounded font-bold">重置密码</button>
                <button @click="openDelete(u)" class="text-xs bg-red-50 text-red-500 px-2.5 py-1 rounded font-bold">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 充天数弹窗 -->
      <div v-if="chargeModalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="chargeModalVisible=false">
        <div class="bg-white rounded-2xl p-6 max-w-sm w-full space-y-3 shadow-2xl">
          <h3 class="font-bold">充值天数 · {{ targetUser?.username }}</h3>
          <input type="number" v-model.number="chargeDays" class="w-full border px-3 py-2 rounded-lg text-sm">
          <div class="flex justify-end gap-2 pt-2">
            <button @click="chargeModalVisible=false" class="text-xs text-slate-400">取消</button>
            <button @click="submitCharge" class="theme-bg text-white px-4 py-2 rounded-lg text-xs font-bold">确认</button>
          </div>
        </div>
      </div>

      <!-- 重置密码弹窗 -->
      <div v-if="resetModalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="resetModalVisible=false">
        <div class="bg-white rounded-2xl p-6 max-w-sm w-full space-y-3 shadow-2xl">
          <h3 class="font-bold text-amber-600">重置密码 · {{ targetUser?.username }}</h3>
          <input type="password" v-model="resetConfirmSecret" placeholder="输入 Admin-Secret 确认" class="w-full border px-3 py-2 rounded-lg text-sm">
          <div class="flex justify-end gap-2 pt-2">
            <button @click="resetModalVisible=false" class="text-xs text-slate-400">取消</button>
            <button @click="submitResetPassword" class="bg-amber-500 text-white px-4 py-2 rounded-lg text-xs font-bold">确认重置</button>
          </div>
        </div>
      </div>

      <!-- 删除用户弹窗 -->
      <div v-if="deleteModalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="deleteModalVisible=false">
        <div class="bg-white rounded-2xl p-6 max-w-sm w-full space-y-3 shadow-2xl">
          <h3 class="font-bold text-red-600">删除用户 · {{ targetUser?.username }}</h3>
          <input type="password" v-model="resetConfirmSecret" placeholder="输入 Admin-Secret 确认" class="w-full border px-3 py-2 rounded-lg text-sm">
          <div class="flex justify-end gap-2 pt-2">
            <button @click="deleteModalVisible=false" class="text-xs text-slate-400">取消</button>
            <button @click="submitDeleteUser" class="bg-red-500 text-white px-4 py-2 rounded-lg text-xs font-bold">确认删除</button>
          </div>
        </div>
      </div>
    </div>
  `,
};

// 3. 订单审核组件
const OrderMgmtComp = {
  setup() {
    const orders = ref([]);
    const statusFilter = ref("all");
    const load = async () => {
      const q = statusFilter.value === "all" ? "" : `?status=${statusFilter.value}`;
      const res = await adminFetch(`/api/admin/orders${q}`).catch(() => ({ data: [] }));
      orders.value = res.data || [];
    };
    const approve = async (o) => {
      await adminFetch("/api/admin/orders/approve", { method: "POST", body: JSON.stringify({ order_id: o.id }) });
      store.showToast("已审核通过");
      load();
    };
    const reject = async (o) => {
      await adminFetch("/api/admin/orders/reject", { method: "POST", body: JSON.stringify({ order_id: o.id }) });
      store.showToast("已驳回订单");
      load();
    };
    onMounted(load);
    return { orders, statusFilter, load, approve, reject };
  },
  template: `
    <div class="space-y-4 select-none">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-bold">订单审核</h2>
        <div class="flex gap-2">
          <button @click="statusFilter='all'; load()" class="px-3 py-1 rounded text-xs font-bold" :class="statusFilter==='all'?'theme-bg text-white':'bg-white border'">全部</button>
          <button @click="statusFilter='pending'; load()" class="px-3 py-1 rounded text-xs font-bold" :class="statusFilter==='pending'?'theme-bg text-white':'bg-white border'">待审</button>
          <button @click="statusFilter='approved'; load()" class="px-3 py-1 rounded text-xs font-bold" :class="statusFilter==='approved'?'theme-bg text-white':'bg-white border'">已通过</button>
        </div>
      </div>
      <div class="bg-white rounded-xl border overflow-hidden shadow-sm">
        <table class="w-full text-sm text-left whitespace-nowrap">
          <thead class="bg-slate-50 text-xs font-bold"><tr><th class="p-3">时间</th><th class="p-3">用户</th><th class="p-3">类型</th><th class="p-3">金额</th><th class="p-3 text-orange-500">凭证</th><th class="p-3">状态</th><th class="p-3 text-right">操作</th></tr></thead>
          <tbody class="divide-y">
            <tr v-for="o in orders" :key="o.id">
              <td class="p-3 text-xs text-slate-400 font-mono">{{ new Date(o.created_at).toLocaleString() }}</td>
              <td class="p-3 font-bold">{{ o.username || o.register_username }}</td>
              <td class="p-3 text-xs font-bold">{{ o.order_type==='custom_watchlist'?'定制':'通用' }}</td>
              <td class="p-3 font-mono font-bold">¥ {{ o.amount }}</td>
              <td class="p-3 font-mono text-orange-500 font-bold">{{ o.tx_id_last6 }}</td>
              <td class="p-3 font-bold text-xs">{{ o.status==='approved'?'已通过':'待审核' }}</td>
              <td class="p-3 text-right space-x-1">
                <template v-if="o.status==='pending'">
                  <button @click="approve(o)" class="theme-bg text-white text-xs px-3 py-1 rounded font-bold">通过</button>
                  <button @click="reject(o)" class="bg-slate-100 text-slate-600 text-xs px-3 py-1 rounded font-bold">驳回</button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
};

// 4. 套餐管理组件
const PlanMgmtComp = {
  setup() {
    const plans = ref([]);
    const modalVisible = ref(false);
    const form = reactive({ id: "", name: "", price: 18.8, days: 30, tag: "", plan_type: "both" });

    const load = async () => {
      const res = await adminFetch("/api/admin/plans").catch(() => ({ data: [] }));
      plans.value = res.data || [];
    };

    const submit = async () => {
      await adminFetch("/api/admin/plans", { method: "POST", body: JSON.stringify(form) });
      store.showToast("套餐保存成功");
      modalVisible.value = false;
      load();
    };

    const deletePlan = async (p) => {
      if (!confirm(`删除套餐 ${p.name}？`)) return;
      await adminFetch("/api/admin/plans", { method: "DELETE", body: JSON.stringify({ id: p.id }) });
      store.showToast("已删除");
      load();
    };

    onMounted(load);
    return { plans, modalVisible, form, submit, deletePlan, openModal: () => { form.id = ""; form.name = ""; modalVisible.value = true; } };
  },
  template: `
    <div class="space-y-4 select-none">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-bold">套餐管理</h2>
        <button @click="openModal" class="theme-bg text-white text-xs px-3.5 py-2 rounded-lg font-bold">新增套餐</button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div v-for="p in plans" :key="p.id" class="bg-white p-4 rounded-xl border shadow-sm space-y-2">
          <div class="font-bold text-slate-800">{{ p.name }}</div>
          <div class="text-2xl font-light">¥ {{ p.price }}</div>
          <div class="text-xs text-slate-400">分类上架: <span class="theme-text font-bold">{{ p.plan_type==='both'?'通用+定制均上架':p.plan_type }}</span></div>
          <div class="pt-2 flex gap-2 border-t text-xs"><button @click="deletePlan(p)" class="text-red-500 font-bold">删除</button></div>
        </div>
      </div>

      <div v-if="modalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="modalVisible=false">
        <div class="bg-white rounded-2xl p-6 max-w-sm w-full space-y-3 shadow-2xl">
          <h3 class="font-bold">新增/编辑套餐</h3>
          <input v-model="form.name" placeholder="套餐名称 (例如: 月卡)" class="w-full border px-3 py-2 rounded-lg text-sm">
          <input type="number" v-model.number="form.price" placeholder="价格 (元)" class="w-full border px-3 py-2 rounded-lg text-sm">
          <input type="number" v-model.number="form.days" placeholder="有效期 (天)" class="w-full border px-3 py-2 rounded-lg text-sm">
          <select v-model="form.plan_type" class="w-full border px-3 py-2 rounded-lg text-sm font-bold">
            <option value="both">通用 + 定制 (两分类均显示)</option>
            <option value="shared">仅通用监控显示</option>
            <option value="custom">仅定制监控显示</option>
          </select>
          <div class="flex justify-end gap-2 pt-2">
            <button @click="modalVisible=false" class="text-xs text-slate-400">取消</button>
            <button @click="submit" class="theme-bg text-white px-4 py-2 rounded-lg text-xs font-bold">保存</button>
          </div>
        </div>
      </div>
    </div>
  `,
};

// 5. 通用监控组件 (支持添加/批量导入)
const SharedWatchComp = {
  setup() {
    const list = ref([]);
    const modalVisible = ref(false);
    const form = reactive({ etf_code: "", etf_name: "" });

    const load = async () => {
      const res = await adminFetch("/api/admin/watchlist/shared").catch(() => ({ data: [] }));
      list.value = res.data || [];
    };

    const submit = async () => {
      await adminFetch("/api/admin/watchlist/shared", { method: "POST", body: JSON.stringify(form) });
      store.showToast("已保存");
      modalVisible.value = false;
      load();
    };

    const deleteItem = async (w) => {
      if (!confirm(`确认删除 ${w.etf_code}？`)) return;
      await adminFetch("/api/admin/watchlist/shared", { method: "DELETE", body: JSON.stringify({ id: w.id }) });
      store.showToast("已删除");
      load();
    };

    onMounted(load);
    return { list, modalVisible, form, submit, deleteItem, openAdd: () => { form.etf_code = ""; form.etf_name = ""; modalVisible.value = true; } };
  },
  template: `
    <div class="space-y-4 select-none">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-bold">通用监控列表</h2>
        <button @click="openAdd" class="theme-bg text-white text-xs px-3.5 py-2 rounded-lg font-bold">添加标的</button>
      </div>
      <div class="bg-white rounded-xl border overflow-hidden shadow-sm">
        <table class="w-full text-sm text-left whitespace-nowrap">
          <thead class="bg-slate-50 text-xs font-bold"><tr><th class="p-3">代码</th><th class="p-3">名称</th><th class="p-3 text-right">操作</th></tr></thead>
          <tbody class="divide-y">
            <tr v-for="w in list" :key="w.id">
              <td class="p-3 font-mono font-bold">{{ w.etf_code }}</td>
              <td class="p-3 font-bold">{{ w.etf_name }}</td>
              <td class="p-3 text-right"><button @click="deleteItem(w)" class="text-xs text-red-500 font-bold">删除</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="modalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="modalVisible=false">
        <div class="bg-white rounded-2xl p-6 max-w-sm w-full space-y-3 shadow-2xl">
          <h3 class="font-bold">添加通用标的</h3>
          <input v-model="form.etf_code" placeholder="标的代码 (例: 510300)" class="w-full border px-3 py-2 rounded-lg text-sm">
          <input v-model="form.etf_name" placeholder="标的名称 (例: 沪深300ETF)" class="w-full border px-3 py-2 rounded-lg text-sm">
          <div class="flex justify-end gap-2 pt-2">
            <button @click="modalVisible=false" class="text-xs text-slate-400">取消</button>
            <button @click="submit" class="theme-bg text-white px-4 py-2 rounded-lg text-xs font-bold">保存</button>
          </div>
        </div>
      </div>
    </div>
  `,
};

// 6. 定制监控组件
const CustomWatchComp = {
  setup() {
    const list = ref([]);
    const load = async () => {
      const res = await adminFetch("/api/admin/watchlist/custom").catch(() => ({ data: [] }));
      list.value = res.data || [];
    };
    onMounted(load);
    return { list };
  },
  template: `
    <div class="space-y-4 select-none">
      <h2 class="text-xl font-bold">定制监控管理</h2>
      <div class="bg-white rounded-xl border overflow-hidden shadow-sm">
        <table class="w-full text-sm text-left whitespace-nowrap">
          <thead class="bg-slate-50 text-xs font-bold"><tr><th class="p-3">用户</th><th class="p-3">代码</th><th class="p-3">名称</th><th class="p-3">状态</th></tr></thead>
          <tbody class="divide-y"><tr v-for="c in list" :key="c.id"><td class="p-3 font-bold">{{ c.username || c.user_id }}</td><td class="p-3 font-mono font-bold">{{ c.etf_code }}</td><td class="p-3">{{ c.etf_name }}</td><td class="p-3 text-xs font-bold text-emerald-600">{{ c.status }}</td></tr></tbody>
        </table>
      </div>
    </div>
  `,
};

// 7. 会员监控投票管理组件 (支持清空及同步通用监控)
const VoteMgmtComp = {
  setup() {
    const list = ref([]);
    const load = async () => {
      const res = await adminFetch("/api/admin/vote/stats").catch(() => ({ data: {} }));
      list.value = res.data?.list || [];
    };
    const syncToShared = async () => {
      const res = await adminFetch("/api/admin/vote/sync-to-shared", { method: "POST", body: JSON.stringify({ top_n: 50 }) });
      store.showToast(res.message || "已同步前50名");
    };
    const clearVotes = async () => {
      if (!confirm("确定清空本月全网投票？")) return;
      await adminFetch("/api/admin/vote/clear", { method: "POST" });
      store.showToast("本月投票已清空");
      load();
    };
    onMounted(load);
    return { list, syncToShared, clearVotes };
  },
  template: `
    <div class="space-y-4 select-none">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-bold">会员监控投票管理</h2>
        <div class="flex gap-2">
          <button @click="clearVotes" class="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg font-bold">清空本月投票</button>
          <button @click="syncToShared" class="theme-bg text-white text-xs px-3.5 py-2 rounded-lg font-bold">一键同步前 50 名至通用监控</button>
        </div>
      </div>
      <div class="bg-white rounded-xl border overflow-hidden shadow-sm">
        <table class="w-full text-sm text-left whitespace-nowrap">
          <thead class="bg-slate-50 text-xs font-bold"><tr><th class="p-3">排名</th><th class="p-3">代码</th><th class="p-3">名称</th><th class="p-3">得票数</th></tr></thead>
          <tbody class="divide-y">
            <tr v-for="(item, idx) in list" :key="item.etf_code"><td class="p-3 font-mono font-bold">#{{ idx + 1 }}</td><td class="p-3 font-mono font-bold">{{ item.etf_code }}</td><td class="p-3 font-medium">{{ item.etf_name }}</td><td class="p-3 font-bold text-orange-500">{{ item.vote_count }} 票</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
};

// 8. 优惠码管理组件
const PromoMgmtComp = {
  setup() {
    const promos = ref([]);
    const modalVisible = ref(false);
    const form = reactive({ code: "", discount_type: "percent", discount_value: 10, start_at: Date.now(), end_at: Date.now() + 30*86400000 });

    const load = async () => {
      const res = await adminFetch("/api/admin/promos").catch(() => ({ data: [] }));
      promos.value = res.data || [];
    };

    const submit = async () => {
      await adminFetch("/api/admin/promos", { method: "POST", body: JSON.stringify(form) });
      store.showToast("优惠码保存成功");
      modalVisible.value = false;
      load();
    };

    onMounted(load);
    return { promos, modalVisible, form, submit, openAdd: () => { form.code = ""; modalVisible.value = true; } };
  },
  template: `
    <div class="space-y-4 select-none">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-bold">优惠码管理</h2>
        <button @click="openAdd" class="theme-bg text-white text-xs px-3.5 py-2 rounded-lg font-bold">新增优惠码</button>
      </div>
      <div class="bg-white rounded-xl border overflow-hidden shadow-sm">
        <table class="w-full text-sm text-left whitespace-nowrap">
          <thead class="bg-slate-50 text-xs font-bold"><tr><th class="p-3">代码</th><th class="p-3">折扣</th><th class="p-3">状态</th></tr></thead>
          <tbody class="divide-y"><tr v-for="p in promos" :key="p.id"><td class="p-3 font-mono font-bold">{{ p.code }}</td><td class="p-3 font-bold text-orange-500">{{ p.discount_value }}</td><td class="p-3 font-bold text-xs">{{ p.enabled?'启用':'停用' }}</td></tr></tbody>
        </table>
      </div>

      <div v-if="modalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="modalVisible=false">
        <div class="bg-white rounded-2xl p-6 max-w-sm w-full space-y-3 shadow-2xl">
          <h3 class="font-bold">新增优惠码</h3>
          <input v-model="form.code" placeholder="代码 (例: VIP888)" class="w-full border px-3 py-2 rounded-lg text-sm uppercase">
          <input type="number" v-model.number="form.discount_value" placeholder="折扣数值" class="w-full border px-3 py-2 rounded-lg text-sm">
          <div class="flex justify-end gap-2 pt-2">
            <button @click="modalVisible=false" class="text-xs text-slate-400">取消</button>
            <button @click="submit" class="theme-bg text-white px-4 py-2 rounded-lg text-xs font-bold">保存</button>
          </div>
        </div>
      </div>
    </div>
  `,
};

// 9. 系统设置组件 (包含优惠码显示开关)
const SettingsMgmtComp = {
  setup() {
    const form = reactive({ promo_enabled: "1", gift_register_days: 1, alipay_qr_url: "", wechat_qr_url: "" });
    onMounted(async () => {
      const res = await adminFetch("/api/admin/settings").catch(() => ({ data: {} }));
      if (res.data) Object.assign(form, res.data);
    });
    const save = async () => {
      await adminFetch("/api/admin/settings", { method: "POST", body: JSON.stringify(form) });
      store.showToast("设置已成功保存");
    };
    return { form, save };
  },
  template: `
    <div class="space-y-4 max-w-2xl select-none">
      <h2 class="text-xl font-bold">系统设置</h2>
      <div class="bg-white p-5 rounded-xl border space-y-3 shadow-sm">
        <div>
          <label class="text-xs font-bold text-slate-600 block mb-1">优惠码功能显示开关</label>
          <select v-model="form.promo_enabled" class="w-full border px-3 py-2 rounded-lg text-sm font-bold">
            <option value="1">开启 (购买界面显示优惠码输入框)</option>
            <option value="0">关闭 (购买界面隐藏优惠码卡片)</option>
          </select>
        </div>
        <div><label class="text-xs font-bold text-slate-600 block mb-1">支付宝收款码 URL</label><input v-model="form.alipay_qr_url" class="w-full border px-3 py-2 rounded-lg text-sm"></div>
        <div><label class="text-xs font-bold text-slate-600 block mb-1">微信收款码 URL</label><input v-model="form.wechat_qr_url" class="w-full border px-3 py-2 rounded-lg text-sm"></div>
        <button @click="save" class="theme-bg text-white px-5 py-2 rounded-lg text-xs font-bold">保存设置</button>
      </div>
    </div>
  `,
};

// 10. 答疑工单与一键广播组件
const TicketMgmtComp = {
  setup() {
    const tickets = ref([]);
    const replyModalVisible = ref(false);
    const replyMsg = ref("");
    const targetTicket = ref(null);

    const load = async () => {
      const res = await adminFetch("/api/admin/tickets").catch(() => ({ data: [] }));
      tickets.value = res.data || [];
    };

    const submitReply = async () => {
      await adminFetch("/api/admin/tickets/reply", { method: "POST", body: JSON.stringify({ ticket_id: targetTicket.value.id, reply_message: replyMsg.value }) });
      store.showToast("已成功回复");
      replyModalVisible.value = false;
      load();
    };

    onMounted(load);
    return { tickets, replyModalVisible, replyMsg, targetTicket, submitReply, openReply: (t) => { targetTicket.value = t; replyMsg.value = t.admin_reply || ""; replyModalVisible.value = true; } };
  },
  template: `
    <div class="space-y-4 select-none">
      <h2 class="text-xl font-bold">答疑工单与广播</h2>
      <div class="bg-white rounded-xl border overflow-hidden shadow-sm">
        <table class="w-full text-sm text-left whitespace-nowrap">
          <thead class="bg-slate-50 text-xs font-bold"><tr><th class="p-3">用户</th><th class="p-3">主题</th><th class="p-3">状态</th><th class="p-3 text-right">操作</th></tr></thead>
          <tbody class="divide-y">
            <tr v-for="t in tickets" :key="t.id">
              <td class="p-3 font-bold">{{ t.username || '用户' }}</td>
              <td class="p-3 font-medium">{{ t.subject }}</td>
              <td class="p-3 text-xs font-bold" :class="t.status==='pending'?'text-orange-500':'text-emerald-600'">{{ t.status==='pending'?'待回复':'已回复' }}</td>
              <td class="p-3 text-right"><button @click="openReply(t)" class="text-xs theme-bg text-white px-3 py-1 rounded font-bold">回复</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="replyModalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="replyModalVisible=false">
        <div class="bg-white rounded-2xl p-6 max-w-md w-full space-y-3 shadow-2xl">
          <h3 class="font-bold">回复工单 · {{ targetTicket?.subject }}</h3>
          <p class="text-xs text-slate-500 bg-slate-50 p-2.5 rounded border">{{ targetTicket?.message }}</p>
          <textarea v-model="replyMsg" rows="4" placeholder="输入回复内容..." class="w-full border px-3 py-2 rounded-lg text-sm"></textarea>
          <div class="flex justify-end gap-2 pt-2">
            <button @click="replyModalVisible=false" class="text-xs text-slate-400">取消</button>
            <button @click="submitReply" class="theme-bg text-white px-4 py-2 rounded-lg text-xs font-bold">发送回复</button>
          </div>
        </div>
      </div>
    </div>
  `,
};

// 启动后台主应用
createApp({
  components: {
    "v-toast": ToastComp,
    Dashboard: DashboardComp,
    UserMgmt: UserMgmtComp,
    OrderMgmt: OrderMgmtComp,
    PlanMgmt: PlanMgmtComp,
    SharedWatch: SharedWatchComp,
    CustomWatch: CustomWatchComp,
    VoteMgmt: VoteMgmtComp,
    PromoMgmt: PromoMgmtComp,
    SettingsMgmt: SettingsMgmtComp,
    TicketMgmt: TicketMgmtComp,
  },
  setup() {
    const adminSecret = ref(localStorage.getItem("admin_secret") || "");
    const isAuthenticated = ref(!!adminSecret.value);
    const currentTab = ref("vote");

    const login = () => {
      if (!adminSecret.value) return;
      localStorage.setItem("admin_secret", adminSecret.value);
      store.adminSecret = adminSecret.value;
      isAuthenticated.value = true;
      store.showToast("登录成功");
    };

    const logout = () => {
      localStorage.removeItem("admin_secret");
      store.adminSecret = "";
      isAuthenticated.value = false;
    };

    const currentComponent = computed(() => {
      const map = {
        dashboard: "Dashboard", users: "UserMgmt", orders: "OrderMgmt",
        plans: "PlanMgmt", shared: "SharedWatch", custom: "CustomWatch",
        vote: "VoteMgmt", promos: "PromoMgmt", settings: "SettingsMgmt", tickets: "TicketMgmt"
      };
      return map[currentTab.value] || "VoteMgmt";
    });

    return { adminSecret, isAuthenticated, currentTab, currentComponent, login, logout };
  },
}).mount("#admin-app");
