export const DashboardView = {
  name: "AdminDashboard",
  props: {
    stats: { type: Object, default: () => ({}) },
    fetchAdmin: { type: Function, required: true },
    showToast: { type: Function, required: true },
    switchTab: { type: Function, required: true },
  },
  template: `
    <div class="bg-white rounded-xl border p-8 text-center text-slate-400">
      <i class="fa-solid fa-chart-pie text-3xl mb-3 theme-text"></i>
      <p class="text-sm">数据概览模块（下一步填充）</p>
    </div>
  `,
};
