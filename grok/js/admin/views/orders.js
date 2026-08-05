export const OrdersView = {
  name: "AdminOrders",
  props: {
    fetchAdmin: { type: Function, required: true },
    showToast: { type: Function, required: true },
    orders: { type: Array, default: () => [] },
  },
  emits: ["refresh"],
  template: `
    <div class="bg-white rounded-xl border p-8 text-center text-slate-400">
      <i class="fa-solid fa-file-invoice-dollar text-3xl mb-3 theme-text"></i>
      <p class="text-sm">订单审核模块（下一步填充）</p>
    </div>
  `,
};
