/**
 * 个人中心 - 占位
 */
import { isLoggedIn } from "../../auth.js";

export const ProfileView = {
  name: "ProfileView",
  props: {
    publicSettings: { type: Object, default: () => ({}) },
    navigate: { type: Function, required: true },
    openAuth: { type: Function, required: true },
    openCustomEditor: { type: Function, required: true },
  },
  setup() {
    return { isLoggedIn };
  },
  template: `
    <div class="max-w-4xl mx-auto space-y-5">
      <div v-if="!isLoggedIn" class="bg-white rounded-xl border p-10 text-center">
        <p class="text-slate-500 mb-4">请先登录查看个人中心</p>
        <button @click="openAuth('login')" class="theme-bg text-white px-6 py-2 rounded-lg text-sm">去登录</button>
      </div>
      <div v-else class="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400">
        <i class="fa-solid fa-user text-3xl mb-3 theme-text"></i>
        <p class="text-sm">个人中心模块加载中…（下一步填充）</p>
        <button @click="openCustomEditor" class="mt-4 text-xs theme-bg text-white px-3 py-1.5 rounded-lg">测试：添加定制</button>
      </div>
    </div>
  `,
};
