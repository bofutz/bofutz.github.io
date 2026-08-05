/**
 * 波幅探长 - 前台顶部导航栏组件
 * js/components/common/Header.js
 */
import { store } from "../../store.js";

export default {
  name: "Header",
  props: {
    pageTitle: {
      type: String,
      default: "数据看板",
    },
  },
  setup(props, { emit }) {
    const toggleMenu = () => {
      store.state.menuOpen = !store.state.menuOpen;
    };

    const toggleUserMenu = () => {
      store.state.userMenuOpen = !store.state.userMenuOpen;
    };

    const openAuth = (mode) => {
      store.state.authMode = mode;
      store.state.authModalVisible = true;
    };

    const navigate = (path) => {
      emit("navigate", path);
      store.state.userMenuOpen = false;
    };

    const logout = () => {
      store.clearUserState();
      store.state.userMenuOpen = false;
      store.showToast("已退出登录", "success");
      emit("navigate", "#/");
    };

    return {
      store: store.state,
      toggleMenu,
      toggleUserMenu,
      openAuth,
      navigate,
      logout,
    };
  },
  template: `
    <header class="h-14 sm:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 z-10 shrink-0 select-none">
      <div class="flex items-center gap-2 sm:gap-3">
        <button @click.stop="toggleMenu" class="text-slate-500 hover:text-slate-700 p-2 focus:outline-none">
          <i class="fa-solid fa-bars text-xl"></i>
        </button>
        <a @click.prevent="navigate('#/')" href="#/" class="flex items-center gap-2 cursor-pointer hover:opacity-85">
          <img src="logo.png" alt="Logo" class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover shadow-sm border border-slate-100" onerror="this.style.display='none'">
          <span class="text-base sm:text-lg font-bold theme-text tracking-wide hidden sm:block">波幅探长</span>
        </a>
        <span class="text-sm font-semibold text-slate-500 border-l border-slate-200 pl-3 hidden sm:block">{{ pageTitle }}</span>
        <span class="text-sm font-semibold text-slate-700 sm:hidden">{{ pageTitle }}</span>
      </div>

      <div class="flex items-center gap-2 sm:gap-5">
        <div v-if="!store.isLoggedIn" class="flex gap-2">
          <button @click="openAuth('login')" class="text-sm font-medium text-slate-600 hover:theme-text px-1">登录</button>
          <button @click="openAuth('register')" class="text-sm font-medium theme-bg text-white px-3 py-1.5 rounded-lg hover:opacity-90 shadow-sm">注册</button>
        </div>
        <div v-else class="relative">
          <div @click.stop="toggleUserMenu" class="flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded">
            <i class="fa-solid fa-circle-user text-slate-400 text-2xl"></i>
            <span class="text-sm font-medium text-slate-600 hidden sm:inline">{{ store.username }}</span>
            <i class="fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform" :class="{'rotate-180': store.userMenuOpen}"></i>
          </div>
          <div v-if="store.userMenuOpen" @click.stop class="absolute right-0 mt-2 w-36 bg-white rounded-xl shadow-lg border border-slate-100 z-50 overflow-hidden">
            <div @click="navigate('#/profile')" class="px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer flex items-center border-b border-slate-50">
              <i class="fa-regular fa-user mr-2 text-slate-400"></i>个人中心
            </div>
            <div @click="logout" class="px-4 py-3 text-sm text-red-500 hover:bg-red-50 cursor-pointer flex items-center">
              <i class="fa-solid fa-right-from-bracket mr-2"></i>退出登录
            </div>
          </div>
        </div>
      </div>
    </header>
  `,
};
