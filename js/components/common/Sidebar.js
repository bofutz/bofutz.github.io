/**
 * 波幅探长 - 前台抽屉侧边栏导航组件
 * js/components/common/Sidebar.js
 */
import { store } from "../../store.js";

export default {
  name: "Sidebar",
  props: {
    currentRoute: {
      type: String,
      default: "#/",
    },
  },
  setup(props, { emit }) {
    const closeSidebar = () => {
      store.state.menuOpen = false;
    };

    const navigate = (path, requireAuth = false) => {
      if (requireAuth && !store.state.isLoggedIn) {
        store.state.authMode = "login";
        store.state.authModalVisible = true;
        closeSidebar();
        return;
      }
      emit("navigate", path);
      closeSidebar();
    };

    return {
      store: store.state,
      closeSidebar,
      navigate,
    };
  },
  template: `
    <div>
      <!-- 遮罩层 -->
      <div v-if="store.menuOpen" @click="closeSidebar" class="fixed inset-0 bg-black/40 z-40 transition-opacity"></div>

      <!-- 侧边栏主体 -->
      <aside class="fixed inset-y-0 left-0 w-64 bg-white z-50 transform transition-transform duration-300 flex flex-col shadow-2xl select-none"
             :class="store.menuOpen ? 'translate-x-0' : '-translate-x-full'">
        <div class="h-14 sm:h-16 theme-bg text-white flex items-center justify-between px-5 text-lg tracking-wider">
          <a href="#/" @click="navigate('#/')" class="flex items-center gap-2 text-white">
            <img src="./logo.png" class="w-7 h-7 rounded-full bg-white/20 p-0.5 object-cover" onerror="this.style.display='none'">
            <span class="font-bold">波幅探长</span>
          </a>
          <button @click="closeSidebar" class="text-white/70 hover:text-white">
            <i class="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto py-2 custom-scrollbar">
          <div @click="navigate('#/')" 
               class="nav-item block px-6 py-3.5 border-b border-slate-50" 
               :class="{active: currentRoute === '#/'}">
            <i class="fa-solid fa-chart-simple w-6"></i> 数据看板
          </div>

          <div @click="navigate('#/profile', true)" 
               class="nav-item block px-6 py-3.5 border-b border-slate-50" 
               :class="{active: currentRoute === '#/profile'}">
            <i class="fa-solid fa-user w-6"></i> 个人中心
          </div>

          <div @click="navigate('#/plan')" 
               class="nav-item block px-6 py-3.5 border-b border-slate-50" 
               :class="{active: currentRoute === '#/plan'}">
            <i class="fa-solid fa-bag-shopping w-6"></i> 购买套餐
          </div>

          <div @click="navigate('#/vote')" 
               class="nav-item block px-6 py-3.5 border-b border-slate-50" 
               :class="{active: currentRoute === '#/vote'}">
            <i class="fa-solid fa-check-to-slot w-6"></i> 票选监控
          </div>

          <div @click="navigate('#/tickets', true)" 
               class="nav-item block px-6 py-3.5 border-b border-slate-50" 
               :class="{active: currentRoute === '#/tickets'}">
            <i class="fa-solid fa-headset w-6"></i> 工单反馈
          </div>

          <div @click="navigate('#/guide')" 
               class="nav-item block px-6 py-3.5" 
               :class="{active: currentRoute === '#/guide'}">
            <i class="fa-solid fa-book-open w-6"></i> 使用指南
          </div>
        </div>
      </aside>
    </div>
  `,
};
