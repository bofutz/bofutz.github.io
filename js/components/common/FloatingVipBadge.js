/* ========================= FILE: .\js\components\common\FloatingVipBadge.js ========================= */

/**
 * 波幅探长 - 全局变现促单悬浮挂件
 * js/components/common/FloatingVipBadge.js
 */
import { store } from "../../store.js";

const { computed } = Vue;

export default {
  name: "FloatingVipBadge",
  setup() {
    const isVip = computed(() => store.state.isVip);

    const handleClick = () => {
      if (!store.state.isLoggedIn) {
        store.state.authModalVisible = true;
      } else {
        window.location.hash = "#/plan";
      }
    };

    return {
      store: store.state,
      isVip,
      handleClick,
    };
  },
  template: `
    <aside v-if="!isVip" class="fixed bottom-6 right-4 sm:right-6 z-40 select-none">
      <button type="button" @click="handleClick"
              class="flex items-center gap-2 bg-slate-900/95 hover:bg-slate-900 text-amber-300 pl-3 pr-3.5 py-2 rounded-full shadow-2xl border border-amber-400/40 backdrop-blur text-xs font-bold transition-transform hover:scale-105 active:scale-95 animate-pulse">
        <span class="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-400 to-orange-400 text-slate-900 flex items-center justify-center text-xs">
          <i class="fa-solid fa-crown"></i>
        </span>
        <span>{{ !store.isLoggedIn ? '微信关注立送 3 天 VIP' : '特惠开通 VIP' }}</span>
        <i class="fa-solid fa-angle-right text-[10px] text-amber-200/60"></i>
      </button>
    </aside>
  `,
};
