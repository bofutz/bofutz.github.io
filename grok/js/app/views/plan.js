/**
 * 购买套餐 - 占位
 */
export const PlanView = {
  name: "PlanView",
  props: {
    publicSettings: { type: Object, default: () => ({}) },
    navigate: { type: Function, required: true },
    openAuth: { type: Function, required: true },
    customDraftItems: { type: Object, required: true },
    customDedupeTip: { type: Object, required: true },
    customMaxSymbols: { type: [Number, Object], required: true },
    customSymbolCount: { type: [Number, Object], required: true },
    dedupeCustomDraft: { type: Function, required: true },
  },
  template: `
    <div class="max-w-6xl mx-auto">
      <div class="mb-4">
        <h2 class="text-xl font-medium text-slate-800">选择套餐</h2>
        <p class="text-xs text-slate-400 mt-1">
          通用与定制独立计费 · 定制为套餐总价（含最多 {{ publicSettings.custom_max_symbols || 3 }} 只）
        </p>
      </div>
      <div class="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400">
        <i class="fa-solid fa-bag-shopping text-3xl mb-3 theme-text"></i>
        <p class="text-sm">购买套餐模块加载中…（下一步填充）</p>
      </div>
    </div>
  `,
};
