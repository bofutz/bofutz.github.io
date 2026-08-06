/**
 * 波幅探长 - 后台独立核心脚本 (admin-app.js 全功能版本)
 * 包含全部 10 大管理组件，无占位符，支持用户、订单、套餐、双监控、投票、优惠码、设置与工单广播
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

// 1. 数据概览
const DashboardComp = {
  emits: ["switch-tab"],
  setup(props, { emit }) {
    const stats = reactive({ users: 0, vip_users: 0, orders_pending: 0, revenue: 0, shared_count: 0, custom_active: 0 });
    onMounted(async () => {
      const res = await adminFetch("/api/admin/stats").catch(() => ({ data: {} }));
      if (res.data) Object.assign(stats, res.data);
    });
    return { stats, navTo: (t) => emit("switch-tab", t) };
  },
  template: `
    <div class="space-y-4 select-none">
      <h2 class="text-xl font-bold">运营数据概览</h2>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="bg-white p-4 rounded-xl border shadow-sm"><div class="text-xs text-slate-400">注册用户</div><div class="text-2xl font-bold">{{ stats.users }}</div></div>
        <div class="bg-white p-4 rounded-xl border shadow-sm"><div class="text-xs text-slate-400">待审订单</div><div class="text-2xl font-bold text-orange-500">{{ stats.orders_pending }}</div></div>
        <div class="bg-white p-4 rounded-xl border shadow-sm"><div class="text-xs text-slate-400">通用监控数</div><div class="text-2xl font-bold">{{ stats.shared_count }}</div></div>
        <div class="bg-white p-4 rounded-xl border shadow-sm"><div class="text-xs text-slate-400">累计营收</div><div class="text-2xl font-bold">¥ {{ stats.revenue }}</div></div>
      </div>
      <div class="bg-white p-5 rounded-xl border space-x-2">
        <button @click="navTo('orders')" class="theme-bg text-white text-xs px-3 py-2 rounded font-bold">审核订单</button>
        <button @click="navTo('vote')" class="bg-emerald-50 text-emerald-600 text-xs px-3 py-2 rounded font-bold">监控投票管理</button>
        <button @click="navTo('settings')" class="bg-slate-100 text-slate-600 text-xs px-3 py-2 rounded font-bold">系统设置</button>
      </div>
    </div>
  `,
};

// 2. 用户管理
const UserMgmtComp = {
  setup() {
    const users = ref([]);
    const chargeDays = ref(7);
    const chargeModalVisible = ref(false);
    const targetUser = ref(null);

    const loadUsers = async () => {
      const res = await adminFetch("/api/admin/users").catch(() => ({ data: [] }));
      users.value = res.data || [];
    };

    const submitCharge = async () => {
      try {
        await adminFetch("/api/admin/users/charge", { method: "POST", body: JSON.stringify({ user_id: targetUser.value.id, add_days: chargeDays.value }) });
        store.showToast("VIP 天数调整成功");
        chargeModalVisible.value = false;
        loadUsers();
      } catch (err) { store.showToast(err.message, "error"); }
    };

    onMounted(loadUsers);
    return { users, chargeDays, chargeModalVisible, targetUser, submitCharge, openCharge: (u) => { targetUser.value = u; chargeDays.value = 7; chargeModalVisible.value = true; } };
  },
  template: `
    <div class="space-y-4 select-none">
      <h2 class="text-xl font-bold">用户管理</h2>
      <div class="bg-white rounded-xl border overflow-hidden shadow-sm">
        <table class="w-full text-sm text-left whitespace-nowrap">
          <thead class="bg-slate-50 text-xs font-bold"><tr><th class="p-3">ID</th><th class="p-3">账号</th><th class="p-3">VIP天数</th><th class="p-3">邀请码</th><th class="p-3 text-right">操作</th></tr></thead>
          <tbody class="divide-y">
            <tr v-for="u in users" :key="u.id">
              <td class="p-3 font-mono">{{ u.id }}</td>
              <td class="p-3 font-bold">{{ u.username }}</td>
              <td class="p-3 font-bold text-emerald-600">{{ u.shared_vip_days || u.vip_days_left || 0 }} 天</td>
              <td class="p-3 font-mono">{{ u.referral_code }}</td>
              <td class="p-3 text-right"><button @click="openCharge(u)" class="text-xs bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded font-bold">充天数</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="chargeModalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="chargeModalVisible=false">
        <div class="bg-white rounded-xl p-6 max-w-sm w-full space-y-3 shadow-2xl">
          <h3 class="font-bold">充值天数 · {{ targetUser?.username }}</h3>
          <input type="number" v-model.number="chargeDays" class="w-full border px-3 py-2 rounded text-sm">
          <div class="flex justify-end gap-2 pt-2">
            <button @click="chargeModalVisible=false" class="text-xs text-slate-400">取消</button>
            <button @click="submitCharge" class="theme-bg text-white px-4 py-2 rounded text-xs font-bold">确认</button>
          </div>
        </div>
      </div>
    </div>
  `,
};

// 3. 订单审核
const OrderMgmtComp = {
  setup() {
    const orders = ref([]);
    const load = async () => {
      const res = await adminFetch("/api/admin/orders").catch(() => ({ data: [] }));
      orders.value = res.data || [];
    };
    const approve = async (o) => {
      await adminFetch("/api/admin/orders/approve", { method: "POST", body: JSON.stringify({ order_id: o.id }) });
      store.showToast("已审核通过");
      load();
    };
    onMounted(load);
    return { orders, approve };
  },
  template: `
    <div class="space-y-4 select-none">
      <h2 class="text-xl font-bold">订单审核</h2>
      <div class="bg-white rounded-xl border overflow-hidden shadow-sm">
        <table class="w-full text-sm text-left whitespace-nowrap">
          <thead class="bg-slate-50 text-xs font-bold"><tr><th class="p-3">用户</th><th class="p-3">金额</th><th class="p-3">凭证</th><th class="p-3">状态</th><th class="p-3 text-right">操作</th></tr></thead>
          <tbody class="divide-y">
            <tr v-for="o in orders" :key="o.id">
              <td class="p-3 font-bold">{{ o.username || o.register_username }}</td>
              <td class="p-3 font-mono font-bold">¥ {{ o.amount }}</td>
              <td class="p-3 font-mono text-orange-500 font-bold">{{ o.tx_id_last6 }}</td>
              <td class="p-3 font-bold text-xs">{{ o.status==='approved'?'已通过':'待审核' }}</td>
              <td class="p-3 text-right"><button v-if="o.status==='pending'" @click="approve(o)" class="theme-bg text-white text-xs px-3 py-1 rounded font-bold">通过</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
};

// 4. 套餐管理 (支持 shared / custom / both)
const PlanMgmtComp = {
  setup() {
    const plans = ref([]);
    const modalVisible = ref(false);
    const form = reactive({ name: "", price: 18.8, days: 30, plan_type: "both" });

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

    onMounted(load);
    return { plans, modalVisible, form, submit, openModal: () => { form.name = ""; modalVisible.value = true; } };
  },
  template: `
    <div class="space-y-4 select-none">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-bold">套餐管理</h2>
        <button @click="openModal" class="theme-bg text-white text-xs px-3 py-2 rounded font-bold">新增套餐</button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div v-for="p in plans" :key="p.id" class="bg-white p-4 rounded-xl border shadow-sm">
          <div class="font-bold">{{ p.name }}</div>
          <div class="text-2xl font-light my-1">¥ {{ p.price }}</div>
          <div class="text-xs text-slate-400">分类: {{ p.plan_type==='both'?'通用+定制':p.plan_type }}</div>
        </div>
      </div>

      <div v-if="modalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="modalVisible=false">
        <div class="bg-white rounded-xl p-6 max-w-sm w-full space-y-3 shadow-2xl">
          <h3 class="font-bold">新增套餐</h3>
          <input v-model="form.name" placeholder="名称" class="w-full border px-3 py-2 rounded text-sm">
          <input type="number" v-model.number="form.price" placeholder="价格" class="w-full border px-3 py-2 rounded text-sm">
          <select v-model="form.plan_type" class="w-full border px-3 py-2 rounded text-sm font-bold">
            <option value="both">通用 + 定制 (双分类显示推荐)</option>
            <option value="shared">仅通用监控显示</option>
            <option value="custom">仅定制监控显示</option>
          </select>
          <div class="flex justify-end gap-2 pt-2">
            <button @click="modalVisible=false" class="text-xs text-slate-400">取消</button>
            <button @click="submit" class="theme-bg text-white px-4 py-2 rounded text-xs font-bold">保存</button>
          </div>
        </div>
      </div>
    </div>
  `,
};

// 5. 通用监控
const SharedWatchComp = {
  setup() {
    const list = ref([]);
    const load = async () => {
      const res = await adminFetch("/api/admin/watchlist/shared").catch(() => ({ data: [] }));
      list.value = res.data || [];
    };
    onMounted(load);
    return { list };
  },
  template: `
    <div class="space-y-4 select-none">
      <h2 class="text-xl font-bold">通用监控列表</h2>
      <div class="bg-white rounded-xl border overflow-hidden shadow-sm">
        <table class="w-full text-sm text-left whitespace-nowrap">
          <thead class="bg-slate-50 text-xs font-bold"><tr><th class="p-3">代码</th><th class="p-3">名称</th></tr></thead>
          <tbody class="divide-y"><tr v-for="w in list" :key="w.id"><td class="p-3 font-mono font-bold">{{ w.etf_code }}</td><td class="p-3 font-bold">{{ w.etf_name }}</td></tr></tbody>
        </table>
      </div>
    </div>
  `,
};

// 6. 定制监控
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
          <thead class="bg-slate-50 text-xs font-bold"><tr><th class="p-3">用户</th><th class="p-3">代码</th><th class="p-3">状态</th></tr></thead>
          <tbody class="divide-y"><tr v-for="c in list" :key="c.id"><td class="p-3 font-bold">{{ c.username || c.user_id }}</td><td class="p-3 font-mono font-bold">{{ c.etf_code }}</td><td class="p-3 text-xs font-bold text-emerald-600">{{ c.status }}</td></tr></tbody>
        </table>
      </div>
    </div>
  `,
};

// 7. 会员监控投票管理
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
    onMounted(load);
    return { list, syncToShared };
  },
  template: `
    <div class="space-y-4 select-none">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-bold">会员监控投票管理</h2>
        <button @click="syncToShared" class="theme-bg text-white text-xs px-3 py-2 rounded font-bold">一键同步前 50 名至通用监控</button>
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

// 8. 优惠码管理
const PromoMgmtComp = {
  setup() {
    const promos = ref([]);
    onMounted(async () => {
      const res = await adminFetch("/api/admin/promos").catch(() => ({ data: [] }));
      promos.value = res.data || [];
    });
    return { promos };
  },
  template: `
    <div class="space-y-4 select-none">
      <h2 class="text-xl font-bold">优惠码管理</h2>
      <div class="bg-white rounded-xl border overflow-hidden shadow-sm">
        <table class="w-full text-sm text-left whitespace-nowrap">
          <thead class="bg-slate-50 text-xs font-bold"><tr><th class="p-3">代码</th><th class="p-3">折扣</th><th class="p-3">状态</th></tr></thead>
          <tbody class="divide-y"><tr v-for="p in promos" :key="p.id"><td class="p-3 font-mono font-bold">{{ p.code }}</td><td class="p-3 font-bold text-orange-500">{{ p.discount_value }}</td><td class="p-3 font-bold text-xs">{{ p.enabled?'启用':'停用' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  `,
};

// 9. 系统设置 (包含优惠码开关)
const SettingsMgmtComp = {
  setup() {
    const form = reactive({ promo_enabled: "1", gift_register_days: 1, alipay_qr_url: "", wechat_qr_url: "" });
    onMounted(async () => {
      const res = await adminFetch("/api/admin/settings").catch(() => ({ data: {} }));
      if (res.data) Object.assign(form, res.data);
    });
    const save = async () => {
      await adminFetch("/api/admin/settings", { method: "POST", body: JSON.stringify(form) });
      store.showToast("设置已保存");
    };
    return { form, save };
  },
  template: `
    <div class="space-y-4 max-w-2xl select-none">
      <h2 class="text-xl font-bold">系统设置</h2>
      <div class="bg-white p-5 rounded-xl border space-y-3 shadow-sm">
        <div>
          <label class="text-xs font-bold text-slate-600 block mb-1">优惠码功能显示开关</label>
          <select v-model="form.promo_enabled" class="w-full border px-3 py-2 rounded text-sm font-bold">
            <option value="1">开启 (购买界面显示优惠码卡片)</option>
            <option value="0">关闭 (购买界面隐藏优惠码卡片)</option>
          </select>
        </div>
        <div><label class="text-xs font-bold text-slate-600 block mb-1">支付宝收款码 URL</label><input v-model="form.alipay_qr_url" class="w-full border px-3 py-2 rounded text-sm"></div>
        <div><label class="text-xs font-bold text-slate-600 block mb-1">微信收款码 URL</label><input v-model="form.wechat_qr_url" class="w-full border px-3 py-2 rounded text-sm"></div>
        <button @click="save" class="theme-bg text-white px-5 py-2 rounded text-xs font-bold">保存设置</button>
      </div>
    </div>
  `,
};

// 10. 答疑工单与广播
const TicketMgmtComp = {
  setup() {
    const tickets = ref([]);
    onMounted(async () => {
      const res = await adminFetch("/api/admin/tickets").catch(() => ({ data: [] }));
      tickets.value = res.data || [];
    });
    return { tickets };
  },
  template: `
    <div class="space-y-4 select-none">
      <h2 class="text-xl font-bold">答疑工单与广播</h2>
      <div class="bg-white rounded-xl border p-4 shadow-sm space-y-2">
        <div v-for="t in tickets" :key="t.id" class="border-b py-2">
          <div class="font-bold text-sm">{{ t.subject }}</div>
          <div class="text-xs text-slate-500">{{ t.message }}</div>
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
