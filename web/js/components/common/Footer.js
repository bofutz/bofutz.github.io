/**
 * 波幅探长 - 页脚组件
 * 已按要求彻底移除“发布平台（footer展示）”相关代码
 */
export default {
  name: "Footer",
  template: `
    <footer class="mt-auto border-t border-slate-100 bg-white select-none">
      <div class="max-w-6xl mx-auto px-4 py-5 text-center space-y-1">
        <div class="text-sm font-bold text-slate-700">波幅探长 · 股票/ETF波幅异动批量监控系统</div>
        <div class="text-[11px] text-slate-400">
          © {{ new Date().getFullYear() }} 波幅探长 · 数据仅供参考，不构成投资建议
        </div>
      </div>
    </footer>
  `,
};
