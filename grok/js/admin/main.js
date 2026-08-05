/**
 * 后台入口：鉴权 + 路由 + 公共数据 + 挂载
 */
import {
  createApp, ref, computed, onMounted, onUnmounted,
} from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";
import { useAdminLayout } from "./layout.js";

import { DashboardView } from "./views/dashboard.js";
import { UsersView } from "./views/users.js";
import { OrdersView } from "./views/orders.js";
import { PlansView } from "./views/plans.js";
import { SharedView } from "./views/shared.js";
import { CustomView } from "./views/custom.js";
import { PromosView } from "./views/promos.js";
import { SettingsView } from "./views/settings.js";
import { TicketsView } from "./views/tickets.js";

createApp({
  components: {
    DashboardView,
    UsersView,
    OrdersView,
    PlansView,
    SharedView,
    CustomView,
    PromosView,
    SettingsView,
    TicketsView,
  },
  setup() {
    const layout = useAdminLayout();
    const {
      adminSecret, isAuthenticated, currentTab, loading, isInitialLoad,
      errorMsg, sidebarOpen, toasts, showToast, login, logout, switchTab, fetchAdmin,
    } = layout;

    // ---------- 角标用公共计数 ----------
    const orders = ref([]);
    const tickets = ref([]);
    const stats = ref({});

    const pendingOrdersCount = computed(
      () => orders.value.filter((o) => o.status === "pending").length
    );
    const pendingTicketsCount = computed(
      () => tickets.value.filter((t) => t.status === "pending").length
    );

    const fetchStats = async () => {
      try {
        const d = await fetchAdmin("/api/admin/stats");
        if (d.success) stats.value = d.data || {};
      } catch (_) {}
    };

    const fetchOrdersLite = async () => {
      try {
        const d = await fetchAdmin("/api/admin/orders");
        if (d.success) orders.value = d.data || [];
      } catch (_) {}
    };

    const fetchTicketsLite = async () => {
      try {
        const d = await fetchAdmin("/api/admin/tickets");
        if (d.success) tickets.value = d.data || [];
      } catch (_) {}
    };

    const refreshAll = async () => {
      loading.value = true;
      try {
        await Promise.all([fetchStats(), fetchOrdersLite(), fetchTicketsLite()]);
      } finally {
        loading.value = false;
        isInitialLoad.value = false;
      }
    };

    const doLogin = () => login(refreshAll);

    const doSwitchTab = (tab) => {
      switchTab(tab);
      // 各 view 内部自己 fetch；这里只刷新角标相关
      if (tab === "dashboard") fetchStats();
    };

    let pollTimer = null;
    onMounted(() => {
      if (adminSecret.value) doLogin();
      pollTimer = setInterval(() => {
        if (isAuthenticated.value) {
          fetchOrdersLite();
          fetchTicketsLite();
          fetchStats();
        }
      }, 60000);
    });
    onUnmounted(() => {
      if (pollTimer) clearInterval(pollTimer);
    });

    return {
      adminSecret,
      isAuthenticated,
      currentTab,
      loading,
      isInitialLoad,
      errorMsg,
      sidebarOpen,
      toasts,
      showToast,
      login: doLogin,
      logout,
      switchTab: doSwitchTab,
      refreshAll,
      fetchAdmin,
      pendingOrdersCount,
      pendingTicketsCount,
      stats,
      orders,
      tickets,
    };
  },

  template: `
    <!-- 登录页 -->
    <div v-if="!isAuthenticated" class="fixed inset-0 z-50 bg-[#f4f6f8] flex items-center justify-center p-4">
      <div class="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-slate-200 text-center">
        <div class="w-16 h-16 theme-bg rounded-2xl flex items-center justify-center mx-auto mb-4">
          <i class="fa-solid fa-shield-halved text-3xl text-white"></i>
        </div>
        <h2 class="text-xl font-bold text-slate-800 mb-1">管理后台安全验证</h2>
        <p class="text-xs text-slate-400 mb-6">波幅探长 · Admin Console v2.1</p>
        <input v-model="adminSecret" @keyup.enter="login" type="password"
          placeholder="请输入 Admin-Secret"
          class="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-lg mb-4 text-center tracking-widest font-mono text-sm">
        <button @click="login" :disabled="loading"
          class="w-full theme-bg text-white font-medium py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 flex justify-center items-center">
          <i v-if="loading" class="fa-solid fa-spinner animate-spin mr-2"></i> 登 录
        </button>
        <p v-if="errorMsg" class="text-red-500 text-xs mt-3">{{ errorMsg }}</p>
      </div>
    </div>

    <template v-else>
      <!-- 顶栏 -->
      <header class="bg-white border-b border-slate-200 h-14 sm:h-16 shrink-0 flex items-center justify-between px-4 sm:px-6 z-20">
        <div class="flex items-center gap-3">
          <button @click="sidebarOpen=!sidebarOpen" class="sm:hidden text-slate-500 p-1.5">
            <i class="fa-solid fa-bars text-lg"></i>
          </button>
          <img src="assets/logo.png" class="w-7 h-7 rounded-lg object-cover border border-slate-100"
            onerror="this.style.display='none'">
          <h1 class="text-base sm:text-lg font-bold text-slate-800">
            波幅探长
            <span class="text-[10px] sm:text-xs text-slate-400 font-normal ml-1 bg-slate-100 px-2 py-0.5 rounded">管理后台</span>
          </h1>
        </div>
        <div class="flex items-center gap-3">
          <button @click="refreshAll" class="text-slate-400 hover:theme-text text-sm hidden sm:inline-flex items-center gap-1">
            <i class="fa-solid fa-rotate-right" :class="{'animate-spin':loading}"></i>
            <span class="text-xs">刷新</span>
          </button>
          <button @click="logout" class="text-sm text-slate-500 hover:text-red-500">
            <i class="fa-solid fa-power-off mr-1"></i>
            <span class="hidden sm:inline">退出</span>
          </button>
        </div>
      </header>

      <div class="flex flex-1 overflow-hidden relative">
        <!-- 侧栏遮罩（移动端） -->
        <div v-if="sidebarOpen" @click="sidebarOpen=false"
          class="fixed inset-0 bg-black/40 z-30 sm:hidden"></div>

        <!-- 侧栏 -->
        <aside
          class="fixed sm:static inset-y-0 left-0 w-56 bg-white border-r border-slate-200 flex flex-col py-4 z-40 shadow-lg sm:shadow-sm shrink-0 transition-transform duration-300"
          :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'">
          <nav class="flex-1 space-y-0.5 overflow-y-auto custom-scrollbar">
            <div @click="switchTab('dashboard')" class="nav-item flex items-center px-6 py-2.5"
              :class="{active: currentTab==='dashboard'}">
              <i class="fa-solid fa-chart-pie"></i>数据概览
            </div>
            <div @click="switchTab('users')" class="nav-item flex items-center px-6 py-2.5"
              :class="{active: currentTab==='users'}">
              <i class="fa-solid fa-users"></i>用户管理
            </div>
            <div @click="switchTab('orders')" class="nav-item flex items-center px-6 py-2.5"
              :class="{active: currentTab==='orders'}">
              <i class="fa-solid fa-file-invoice-dollar"></i>订单审核
              <span v-if="pendingOrdersCount"
                class="ml-auto bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold badge-pulse">
                {{ pendingOrdersCount }}
              </span>
            </div>
            <div @click="switchTab('plans')" class="nav-item flex items-center px-6 py-2.5"
              :class="{active: currentTab==='plans'}">
              <i class="fa-solid fa-tags"></i>套餐管理
            </div>
            <div @click="switchTab('shared')" class="nav-item flex items-center px-6 py-2.5"
              :class="{active: currentTab==='shared'}">
              <i class="fa-solid fa-list"></i>通用监控
            </div>
            <div @click="switchTab('custom')" class="nav-item flex items-center px-6 py-2.5"
              :class="{active: currentTab==='custom'}">
              <i class="fa-solid fa-user-tag"></i>定制监控
            </div>
            <div @click="switchTab('promos')" class="nav-item flex items-center px-6 py-2.5"
              :class="{active: currentTab==='promos'}">
              <i class="fa-solid fa-percent"></i>优惠码
            </div>
            <div @click="switchTab('settings')" class="nav-item flex items-center px-6 py-2.5"
              :class="{active: currentTab==='settings'}">
              <i class="fa-solid fa-gear"></i>系统设置
            </div>
            <div @click="switchTab('tickets')" class="nav-item flex items-center px-6 py-2.5"
              :class="{active: currentTab==='tickets'}">
              <i class="fa-solid fa-headset"></i>答疑工单
              <span v-if="pendingTicketsCount"
                class="ml-auto bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                {{ pendingTicketsCount }}
              </span>
            </div>
          </nav>
        </aside>

        <!-- 主内容 -->
        <main class="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 bg-slate-50/50">
          <div v-if="loading && isInitialLoad"
            class="h-full flex flex-col items-center justify-center text-slate-400">
            <i class="fa-solid fa-circle-notch animate-spin text-3xl mb-3 theme-text"></i>
            <p class="text-sm">读取云端数据中...</p>
          </div>
          <div v-else class="max-w-7xl mx-auto space-y-4">
            <DashboardView v-if="currentTab==='dashboard'"
              :stats="stats" :fetch-admin="fetchAdmin" :show-toast="showToast"
              :switch-tab="switchTab" />
            <UsersView v-else-if="currentTab==='users'"
              :fetch-admin="fetchAdmin" :show-toast="showToast" />
            <OrdersView v-else-if="currentTab==='orders'"
              :fetch-admin="fetchAdmin" :show-toast="showToast"
              :orders="orders" @refresh="refreshAll" />
            <PlansView v-else-if="currentTab==='plans'"
              :fetch-admin="fetchAdmin" :show-toast="showToast" />
            <SharedView v-else-if="currentTab==='shared'"
              :fetch-admin="fetchAdmin" :show-toast="showToast" />
            <CustomView v-else-if="currentTab==='custom'"
              :fetch-admin="fetchAdmin" :show-toast="showToast" />
            <PromosView v-else-if="currentTab==='promos'"
              :fetch-admin="fetchAdmin" :show-toast="showToast" />
            <SettingsView v-else-if="currentTab==='settings'"
              :fetch-admin="fetchAdmin" :show-toast="showToast" />
            <TicketsView v-else-if="currentTab==='tickets'"
              :fetch-admin="fetchAdmin" :show-toast="showToast"
              :tickets="tickets" @refresh="fetchTicketsLite" />
          </div>
        </main>
      </div>

      <!-- Toast -->
      <div class="fixed top-4 right-4 z-[200] space-y-2">
        <div v-for="(t, i) in toasts" :key="i"
          class="toast-enter px-4 py-2.5 rounded-lg text-sm shadow-lg text-white"
          :class="t.type==='error' ? 'bg-red-500' : 'bg-emerald-500'">
          {{ t.msg }}
        </div>
      </div>
    </template>
  `,
}).mount("#admin-app");
