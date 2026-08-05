/**
 * 波幅探长 - 前台【使用说明指南】分块组件
 * js/components/index/Docs.js
 */
import { store } from "../../store.js";

export default {
  name: "Docs",
  setup() {
    return {
      settings: store.state.publicSettings,
    };
  },
  template: `
    <div class="max-w-4xl mx-auto space-y-6 select-none">
      <div class="bg-white rounded-2xl shadow-sm p-6 sm:p-8 border border-slate-100">
        <h2 class="text-2xl font-bold text-center text-slate-800 mb-8">波幅探长 · 使用指南</h2>
        
        <div class="space-y-6 text-slate-600 text-sm leading-relaxed">
          <section>
            <h4 class="text-base font-bold text-slate-800 mb-2 border-l-4 theme-border pl-3">1. 通用监控 vs 定制监控</h4>
            <p class="pl-4">
              <strong>通用监控：</strong>开通后解锁数据看板全部标的高清日线/周线指标图表。<br>
              <strong>定制监控：</strong>包含设定最多只数标的，专属监控，与通用独立。
            </p>
          </section>

          <section>
            <h4 class="text-base font-bold text-slate-800 mb-2 border-l-4 theme-border pl-3">2. 全网会员监控投票</h4>
            <p class="pl-4">
              月付及以上会员，每月可填写或点击投票最多 {{ settings.vote_monthly_limit || 10 }} 只标的代码。月底 24 时汇总，排名前 50 标的自动纳入下月【通用监控】。
            </p>
          </section>

          <section>
            <h4 class="text-base font-bold text-slate-800 mb-2 border-l-4 theme-border pl-3">3. 游客支持“支付即注册”</h4>
            <p class="pl-4">
              未登录用户购买套餐时，可在页面直接设置账号和密码（不强制验证邮箱），付款成功审核后系统将自动为您注册账号并开通 VIP 权益。
            </p>
          </section>
        </div>
      </div>
    </div>
  `,
};
