/**
 * 顶栏导航 (js/components/common/Header.js)
 * - 顶部主导航：数据看板、定制标的、图表说明、客服工单
 * - 右侧个人菜单：个人中心（用户名/订单/密码）、退出登录（已按要求移除“我的定制”栏，统一在导航栏“定制标的”页面使用）
 * - 未登录按钮：“登录”、“注册”
 */
import { store } from "../../store.js";

const { ref, computed, onMounted, onUnmounted } = Vue;

export default {
  name: "Header",
  setup() {
    const currentHash = ref(window.location.hash || "#/");
    const syncHash = () => {
      currentHash.value = window.location.hash || "#/";
    };

    const displayName = computed(() => store.getDisplayName());

    const mainNav = [
      { path: "#/", label: "数据看板", icon: "fa-solid fa-chart-line", match: "exact" },
      { path: "#/sponsor", label: "定制标的", icon: "fa-solid fa-sliders", match: "sponsor" },
      { path: "#/guide", label: "图表说明", icon: "fa-solid fa-book-open", match: "prefix" },
      { path: "#/tickets", label: "客服工单", icon: "fa-solid fa-headset", match: "prefix" },
    ];

    const isActive = (item) => {
      const raw = currentHash.value || "#/";
      const [base] = raw.split("?");
      const cleanBase = !base || base === "#" ? "#/" : base;
      if (item.match === "exact") return cleanBase === "#/" || cleanBase === "";
      if (item.match === "sponsor") return cleanBase === "#/sponsor" || cleanBase === "#/custom";
      return cleanBase === item.path;
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
        store.state.menuOpen = false;
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
      displayName,
      mainNav,
      isActive,
      openAuth,
      logout,
      toggleMenu,
      toggleUserMenu,
    };
  },
  template: `
    <header data-header-root class="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-100 shadow-sm select-none">
      <div class="max-w-7xl mx-auto px-2.5 sm:px-4 h-13 sm:h-14 flex items-center justify-between gap-2">
        <!-- 品牌 Logo -->
        <a href="#/" class="flex items-center gap-2 shrink-0 no-underline py-1.5">
          <img src="./webpic/logo.png" alt="波幅探长" class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover shadow-sm bg-slate-100 shrink-0"
               onerror="this.onerror=null;this.src='./webpic/logo.png';">
          <div class="flex flex-col">
            <span class="font-bold text-slate-800 text-sm sm:text-base tracking-wide leading-tight">波幅探长</span>
            <span class="text-[10px] text-slate-400 hidden sm:inline leading-none mt-0.5">股票/ETF波幅异动监控</span>
          </div>
        </a>

        <!-- 桌面端主导航 -->
        <nav class="hidden md:flex items-center gap-1">
          <a v-for="item in mainNav" :key="item.path" :href="item.path"
             class="px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors no-underline"
             :class="isActive(item) ? 'theme-text bg-[#4da6a0]/10 font-bold' : 'text-slate-600 hover:bg-slate-50'">
            <i :class="item.icon" class="mr-1.5 text-xs opacity-80"></i>{{ item.label }}
          </a>
        </nav>

        <!-- 右侧用户区 -->
        <div class="flex items-center gap-1.5 sm:gap-2">
          <template v-if="store.isLoggedIn">
            <a v-if="!store.nickname" href="#/profile"
               class="hidden lg:inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 no-underline font-medium"
               title="设置唯一用户名后，您可直接使用用户名登录">
              <i class="fa-solid fa-user-pen text-[10px]"></i>设置用户名
            </a>

            <div class="relative">
              <button type="button" @click.stop="toggleUserMenu"
                      class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200/80 bg-slate-50 hover:bg-slate-100 text-sm max-w-[140px] sm:max-w-[170px] transition">
                <span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                <span class="truncate font-bold text-slate-700 text-xs sm:text-sm">{{ displayName }}</span>
                <i class="fa-solid fa-chevron-down text-[10px] text-slate-400"></i>
              </button>

              <!-- 个人菜单下拉框（已按要求删除“我的定制”栏，直接在导航栏“定制标的”页面使用） -->
              <div v-if="store.userMenuOpen"
                   class="absolute right-0 mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50">
                <div class="px-3.5 py-2.5 border-b border-slate-100 space-y-1">
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-bold text-slate-800 text-sm truncate">{{ displayName }}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold shrink-0">已解锁全量</span>
                  </div>
                  <div class="text-[11px] text-slate-400 truncate font-mono">{{ store.username }}</div>
                  <div v-if="!store.nickname" class="text-[11px] text-amber-600 pt-0.5">
                    <i class="fa-solid fa-circle-info mr-0.5"></i>尚未设置登录用户名
                  </div>
                </div>

                <div class="py-1">
                  <a href="#/profile" @click="store.userMenuOpen=false"
                     class="flex items-center justify-between px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50 no-underline">
                    <span class="flex items-center gap-2">
                      <i class="fa-solid fa-user-gear w-4 text-slate-400"></i>个人中心
                    </span>
                    <span class="text-[11px] text-slate-400">用户名 / 订单 / 密码</span>
                  </a>
                </div>

                <div class="border-t border-slate-100 pt-1">
                  <button type="button" @click="logout"
                          class="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-red-500 hover:bg-red-50 text-left">
                    <i class="fa-solid fa-right-from-bracket w-4"></i>退出登录
                  </button>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <button type="button" @click="openAuth('login')"
                    class="text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-medium">
              登录
            </button>
            <button type="button" @click="openAuth('register')"
                    class="text-xs sm:text-sm px-3 sm:px-3.5 py-1.5 rounded-lg theme-bg text-white font-bold shadow-sm hover:opacity-90">
              注册
            </button>
          </template>

          <!-- 移动端菜单按钮 -->
          <button type="button"
                  class="md:hidden w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg border border-slate-200/80 text-slate-600 active:bg-slate-100"
                  @click.stop="toggleMenu" aria-label="菜单">
            <i :class="store.menuOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'"></i>
          </button>
        </div>
      </div>

      <!-- 移动端底部快捷导航条（手机端免折叠一键直达四大核心页面，更高速美观） -->
      <nav class="md:hidden flex items-center justify-around border-t border-slate-100 bg-slate-50/70 px-1 py-1">
        <a v-for="item in mainNav" :key="item.path" :href="item.path"
           class="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium no-underline transition"
           :class="isActive(item) ? 'theme-text bg-white shadow-sm font-bold' : 'text-slate-600'">
          <i :class="item.icon" class="text-[11px]"></i>
          <span>{{ item.label }}</span>
        </a>
      </nav>

      <!-- 移动端折叠导航面板 -->
      <div v-if="store.menuOpen" class="md:hidden border-t border-slate-100 bg-white px-3 py-2.5 space-y-1 shadow-lg">
        <a v-for="item in mainNav" :key="item.path" :href="item.path" @click="store.menuOpen=false"
           class="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium no-underline"
           :class="isActive(item) ? 'theme-text bg-[#4da6a0]/10 font-bold' : 'text-slate-700 active:bg-slate-50'">
          <i :class="item.icon" class="w-5 text-center"></i>{{ item.label }}
        </a>
        <div v-if="store.isLoggedIn" class="border-t border-slate-100 pt-1.5 mt-1.5">
          <a href="#/profile" @click="store.menuOpen=false"
             class="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200/70 no-underline">
            <i class="fa-solid fa-user-gear text-slate-400"></i>个人中心（用户名 / 订单 / 密码）
          </a>
        </div>
      </div>
    </header>
  `,
};