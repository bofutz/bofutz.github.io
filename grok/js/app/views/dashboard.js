/**
 * 数据看板 - 占位，下一步填充完整逻辑
 */
export const DashboardView = {
  name: "DashboardView",
  props: {
    publicSettings: { type: Object, default: () => ({}) },
    navigate: { type: Function, required: true },
    openAuth: { type: Function, required: true },
  },
  template: `
    <div class="max-w-7xl mx-auto space-y-3 sm:space-y-4">
      <div class="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400">
        <i class="fa-solid fa-chart-simple text-3xl mb-3 theme-text"></i>
        <p class="text-sm">数据看板模块加载中…（下一步填充）</p>
      </div>
    </div>
  `,
};
