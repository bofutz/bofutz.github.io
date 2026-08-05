export const PlansView = {
  name: "AdminPlans",
  props: {
    fetchAdmin: { type: Function, required: true },
    showToast: { type: Function, required: true },
  },
  template: `
    <div class="bg-white rounded-xl border p-8 text-center text-slate-400">
      <i class="fa-solid fa-tags text-3xl mb-3 theme-text"></i>
      <p class="text-sm">套餐管理模块（下一步填充）</p>
    </div>
  `,
};
