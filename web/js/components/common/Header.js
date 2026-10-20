/**
 * 顶栏导航（已移除票选；登录即可全量看图）
 */
import { store } from "../../store.js";

const { ref, onMounted, onUnmounted } = Vue;

export default {
  name: "Header",
  setup() {
    const nav = [
      { path: "#/", label: "数据看板", icon: "fa-solid fa-chart-line" },
      { path: "#/sponsor", label: "赞助标的", icon: "fa-solid fa-hand-holding-heart" },
      { path: "#/query", label: "自主查询", icon: "fa-solid fa-magnifying-glass-chart" },
      { path: "#/plan", label: "次数套餐", icon: "fa-solid fa-coins" },
      { path: "#/guide", label: "图表说明", icon: "fa-solid fa-book-open" },
    ];
    const mobileNav = [
      ...nav.slice(0, 1),
      { path: "#/profile", label: "个人中心", icon: "fa-solid fa-id-card" },
      ...nav.slice(1),
      { path: "#/tickets", label: "客服工单", icon: "fa-solid fa-headset" },
    ];

    const currentHash = ref(window.location.hash || "#/");
    const syncHash = () => {
      currentHash.value = window.location.hash || "#/";
    };

    const isActive = (path) => {
      let hash = (currentHash.value || "#/").split("?")[0];
      if (!hash || hash === "#") hash = "#/";
      if (path === "#/") return hash === "#/" || hash === "";
      return hash === path;
    };

    const openAuth = (mode = "login") => {
      store.state.authMode = mode;
      store.state.authModalVisible = true;
      store.state.menuOpen = false;
      store.state.userMenuOpen = false;
    };

    const logout = () => {
      store.clearUserState();
      store.state.userMenuOpen = false;
      store.state.menuOpen = false;
      store.showToast("已退出登录");
      window.location.hash = "#/";
    };

    const toggleMenu = () => {
      store.state.menuOpen = !store.state.menuOpen;
      store.state.userMenuOpen = false;
    };

    const toggleUserMenu = () => {
      store.state.userMenuOpen = !store.state.userMenuOpen;
      store.state.menuOpen = false;
    };

    const closeMenus = (e) => {
      if (!e.target.closest?.("[data-header-root]")) {
        store.state.userMenuOpen = false;
      }
    };

    onMounted(() => {
      document.addEventListener("click", closeMenus);
      window.addEventListener("hashchange", syncHash);
      syncHash();
    });
    onUnmounted(() => {
      document.removeEventListener("click", closeMenus);
      window.removeEventListener("hashchange", syncHash);
    });

    return {
      store: store.state,
      nav,
      mobileNav,
      isActive,
      openAuth,
      logout,
      toggleMenu,
      toggleUserMenu,
    };
  },
  template: `
    <header data-header-root class="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-100 shadow-sm select-none">
      <div class="max-w-6xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-3">
        <a href="#/" class="flex items-center gap-2 shrink-0 no-underline">
          <img src="./webpic/logo.png" alt="波幅探长" class="w-8 h-8 rounded-lg object-cover shadow-sm bg-slate-100 shrink-0"
               onerror="this.onerror=null;this.src='./webpic/logo.png';">
          <span class="font-bold text-slate-800 text-sm sm:text-base tracking-wide">波幅探长</span>
        </a>

        <nav class="hidden md:flex items-center gap-1">
          <a v-for="item in nav" :key="item.path" :href="item.path"
             class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
             :class="isActive(item.path) ? 'theme-text bg-[#4da6a0]/10' : 'text-slate-600 hover:bg-slate-50'">
            <i :class="item.icon" class="mr-1 text-xs opacity-80"></i>{{ item.label }}
          </a>
        </nav>

        <div class="flex items-center gap-2">
          <template v-if="store.isLoggedIn">
            <span class="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold">
              已登录 · 全量看板
            </span>
            <div class="relative">
              <button type="button" @click.stop="toggleUserMenu"
                      class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 text-sm max-w-[140px]">
                <i class="fa-solid fa-user text-slate-400 text-xs"></i>
                <span class="truncate font-medium text-slate-700 text-xs sm:text-sm">{{ store.username }}</span>
                <i class="fa-solid fa-chevron-down text-[10px] text-slate-400"></i>
              </button>
              <div v-if="store.userMenuOpen"
                   class="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-50">
                <div class="px-3 py-2 border-b border-slate-50 text-xs text-slate-500">
                  查询次数 <strong class="theme-text font-mono">{{ store.chartCredits ?? 0 }}</strong>
                  <div v-if="!store.securitySet" class="text-red-500 mt-1 font-medium">
                    <i class="fa-solid fa-triangle-exclamation mr-0.5"></i>未设置安全问题
                  </div>
                </div>
                <a href="#/profile" @click="store.userMenuOpen=false"
                   class="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 no-underline">
                  <i class="fa-solid fa-id-card w-4 text-slate-400"></i>个人中心
                </a>
                <a href="#/sponsor" @click="store.userMenuOpen=false"
                   class="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 no-underline">
                  <i class="fa-solid fa-hand-holding-heart w-4 text-slate-400"></i>我的赞助
                </a>
                <a href="#/tickets" @click="store.userMenuOpen=false"
                   class="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 no-underline">
                  <i class="fa-solid fa-headset w-4 text-slate-400"></i>客服工单
                </a>
                <button type="button" @click="logout"
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 text-left">
                  <i class="fa-solid fa-right-from-bracket w-4"></i>退出登录
                </button>
              </div>
            </div>
          </template>
          <template v-else>
            <button type="button" @click="openAuth('login')"
                    class="text-xs sm:text-sm px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-50 font-medium">登录</button>
            <button type="button" @click="openAuth('register')"
                    class="text-xs sm:text-sm px-3 py-1.5 rounded-lg theme-bg text-white font-bold shadow-sm">注册</button>
          </template>
          <button type="button" class="md:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-slate-100 text-slate-600"
                  @click.stop="toggleMenu" aria-label="菜单">
            <i :class="store.menuOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'"></i>
          </button>
        </div>
      </div>
      <div v-if="store.menuOpen" class="md:hidden border-t border-slate-100 bg-white px-3 py-2 space-y-0.5">
        <a v-for="item in mobileNav" :key="item.path" :href="item.path"
           @click="store.menuOpen=false"
           class="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium no-underline"
           :class="isActive(item.path) ? 'theme-text bg-[#4da6a0]/10' : 'text-slate-600'">
          <i :class="item.icon" class="w-5 text-center opacity-80"></i>{{ item.label }}
        </a>
      </div>
    </header>
  `,
};
