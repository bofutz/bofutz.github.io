/**
 * 使用说明
 */
export const DocsView = {
  name: "DocsView",
  props: {
    publicSettings: { type: Object, default: () => ({}) },
  },
  template: `
    <div class="max-w-6xl mx-auto">
      <div class="bg-white rounded-xl shadow-sm p-6 sm:p-8 max-w-3xl mx-auto border border-slate-100">
        <h2 class="text-2xl font-medium text-center text-slate-800 mb-8">使用指南</h2>
        <div class="space-y-6 text-slate-600 text-sm leading-relaxed">
          <section>
            <h4 class="text-lg font-medium text-slate-700 mb-2 border-l-4 theme-border pl-3">通用 vs 定制</h4>
            <p class="pl-4">通用监控：解锁通用看板全部图表。定制监控：套餐总价含最多 {{ publicSettings.custom_max_symbols || 3 }} 只，在个人中心管理，不解锁通用图表。</p>
          </section>
          <section>
            <h4 class="text-lg font-medium text-slate-700 mb-2 border-l-4 theme-border pl-3">游客权限</h4>
            <p class="pl-4">可看通用看板与前 {{ publicSettings.free_top_n_charts || 3 }} 名图表、购买套餐。个人中心、答疑需登录。</p>
          </section>
          <section>
            <h4 class="text-lg font-medium text-slate-700 mb-2 border-l-4 theme-border pl-3">支付即注册</h4>
            <p class="pl-4">未登录可在购买页填写账号与密码（不强制邮箱），审核通过后自动注册并开通。</p>
          </section>
        </div>
      </div>
    </div>
  `,
};
