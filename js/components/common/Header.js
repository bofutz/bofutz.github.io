/**
 * 波幅探长 - 顶部导航（整合版）
 * - 登录态 / VIP 天数 / 会员等级徽章
 * - 未设安全问题可在用户菜单轻提示
 * js/components/common/Header.js
 */
import { store } from "../../store.js";
import { CONFIG } from "../../config.js";

const { computed, onMounted, onUnmounted } = Vue;

export default {
  name: "Header",
  setup() {
    const levelLabel = computed(() => {
      const map = CONFIG.VIP_LEVEL_LABELS || {};
      const lv = store.state.vipLevel || 0;
      return map[lv] || "普通用户";
    });

    // 桌面顶栏
    const nav = [
      { path: "#/", label: "数据看板", icon: "fa-solid fa-chart-line" },
      { path: "#/vote", label: "票选监控", icon: "fa-solid fa-check-to-slot" },
      { path: "#/plan", label: "开通套餐", icon: "fa-solid fa-crown" },
      { path: "#/guide", label: "使用指南", icon: "fa-solid fa-book-open" },
    ];
    // 手机抽屉顺序：看板 → 个人中心 → 购买套餐 → 票选 → 工单 → 指南
    const mobileNav = [
      { path: "#/", label: "数据看板", icon: "fa-solid fa-chart-line" },
      { path: "#/profile", label: "个人中心", icon: "fa-solid fa-id-card" },
      { path: "#/plan", label: "购买套餐", icon: "fa-solid fa-crown" },
      { path: "#/vote", label: "票选监控", icon: "fa-solid fa-check-to-slot" },
      { path: "#/tickets", label: "工单反馈", icon: "fa-solid fa-headset" },
      { path: "#/guide", label: "使用指南", icon: "fa-solid fa-book-open" },
    ];

    const isActive = (path) => {
      const hash = window.location.hash || "#/";
      if (path === "#/") return hash === "#/" || hash === "#" || hash === "";
      return hash.startsWith(path);
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
      // 点击外部关闭（简单处理：任何点击导航外由 hashchange 也会关）
      if (!e.target.closest?.("[data-header-root]")) {
        store.state.userMenuOpen = false;
      }
    };

    onMounted(() => {
      document.addEventListener("click", closeMenus);
    });
    onUnmounted(() => {
      document.removeEventListener("click", closeMenus);
    });

    return {
      store: store.state,
      nav,
      mobileNav,
      levelLabel,
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
        <!-- Logo -->
        <a href="#/" class="flex items-center gap-2 shrink-0 no-underline">
          <span class="w-8 h-8 rounded-lg theme-bg text-white flex items-center justify-center text-sm font-bold shadow-sm">波</span>
          <span class="font-bold text-slate-800 text-sm sm:text-base tracking-wide">波幅探长</span>
        </a>

        <!-- 桌面导航 -->
        <nav class="hidden md:flex items-center gap-1">
          <a v-for="item in nav" :key="item.path" :href="item.path"
             class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
             :class="isActive(item.path) ? 'theme-text bg-[#4da6a0]/10' : 'text-slate-600 hover:bg-slate-50'">
            <i :class="item.icon" class="mr-1 text-xs opacity-80"></i>{{ item.label }}
          </a>
        </nav>

        <!-- 右侧：用户区 -->
        <div class="flex items-center gap-2">
          <template v-if="store.isLoggedIn">
            <!-- 等级 / VIP 摘要（桌面） -->
            <div class="hidden sm:flex items-center gap-1.5 mr-1">
              <span class="text-[10px] px-2 py-0.5 rounded-full border font-bold"
                    :class="store.vipLevel > 0
                      ? 'bg-amber-50 text-amber-700 border-amber-100'
                      : 'bg-slate-50 text-slate-400 border-slate-100'">
                Lv.{{ store.vipLevel || 0 }}
              </span>
              <span v-if="store.isVip" class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold">
                {{ store.vipDaysLeft }}天
              </span>
            </div>

            <div class="relative">
              <button type="button" @click.stop="toggleUserMenu"
                      class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 text-sm max-w-[140px]">
                <i class="fa-solid fa-user text-slate-400 text-xs"></i>
                <span class="truncate font-medium text-slate-700 text-xs sm:text-sm">{{ store.username }}</span>
                <i class="fa-solid fa-chevron-down text-[10px] text-slate-400"></i>
              </button>

              <div v-if="store.userMenuOpen"
                   class="absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-50">
                <div class="px-3 py-2 border-b border-slate-50">
                  <div class="text-xs text-slate-400">当前身份</div>
                  <div class="text-sm font-bold text-slate-800 mt-0.5">{{ levelLabel }}</div>
                  <div class="text-[11px] text-slate-500 mt-0.5">
                    通用 VIP：
                    <span :class="store.isVip ? 'text-emerald-600 font-bold' : 'text-slate-400'">
                      {{ store.isVip ? ('剩余 ' + store.vipDaysLeft + ' 天') : '未开通' }}
                    </span>
                  </div>
                  <div v-if="!store.securitySet" class="text-[11px] text-red-500 mt-1 font-medium">
                    <i class="fa-solid fa-triangle-exclamation mr-0.5"></i>未设置安全问题
                  </div>
                </div>
                <a href="#/profile" @click="store.userMenuOpen=false"
                   class="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 no-underline">
                  <i class="fa-solid fa-id-card w-4 text-slate-400"></i>个人中心
                </a>
                <a href="#/tickets" @click="store.userMenuOpen=false"
                   class="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 no-underline">
                  <i class="fa-solid fa-headset w-4 text-slate-400"></i>工单反馈
                </a>
                <a href="#/plan" @click="store.userMenuOpen=false"
                   class="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 no-underline">
                  <i class="fa-solid fa-crown w-4 text-amber-500"></i>开通 / 续费
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
                    class="text-xs sm:text-sm px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-50 font-medium">
              登录
            </button>
            <button type="button" @click="openAuth('register')"
                    class="text-xs sm:text-sm px-3 py-1.5 rounded-lg theme-bg text-white font-bold shadow-sm">
              注册
            </button>
          </template>

          <!-- 移动端菜单按钮 -->
          <button type="button" class="md:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-slate-100 text-slate-600"
                  @click.stop="toggleMenu" aria-label="菜单">
            <i :class="store.menuOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'"></i>
          </button>
        </div>
      </div>

      <!-- 移动端抽屉导航 -->
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
