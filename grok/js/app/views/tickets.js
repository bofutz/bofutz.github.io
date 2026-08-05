/**
 * 答疑留言 - 占位
 */
import { isLoggedIn } from "../../auth.js";

export const TicketsView = {
  name: "TicketsView",
  props: {
    openAuth: { type: Function, required: true },
  },
  setup() {
    return { isLoggedIn };
  },
  template: `
    <div class="max-w-3xl mx-auto space-y-4">
      <div v-if="!isLoggedIn" class="bg-white rounded-xl border p-10 text-center">
        <p class="text-slate-500 mb-4">请登录后提交答疑留言</p>
        <button @click="openAuth('login')" class="theme-bg text-white px-6 py-2 rounded-lg text-sm">去登录</button>
      </div>
      <div v-else class="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400">
        <i class="fa-solid fa-headset text-3xl mb-3 theme-text"></i>
        <p class="text-sm">答疑留言模块加载中…（下一步填充）</p>
      </div>
    </div>
  `,
};
