/**
 * 波幅探长 - 全局 Toast 消息提示组件
 * js/components/common/Toast.js
 */
import { store } from "../../store.js";

export default {
  name: "Toast",
  setup() {
    return {
      toasts: store.state.toasts,
    };
  },
  template: `
    <div class="fixed top-4 right-4 z-[200] space-y-2 pointer-events-none select-none">
      <div v-for="t in toasts" :key="t.id"
           class="toast-enter px-4 py-2.5 rounded-lg shadow-lg text-sm text-white font-medium flex items-center gap-2 pointer-events-auto"
           :class="t.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'">
        <i class="fa-solid" :class="t.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'"></i>
        <span>{{ t.msg }}</span>
      </div>
    </div>
  `,
};
