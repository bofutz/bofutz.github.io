/**
 * 波幅探长 - 图表指南分块组件
 * 向用户清晰说明本站价值、图表用法与交易策略
 * 任何人可查看（无需登录）
 * js/components/index/Guide.js
 */
import { store } from "../../store.js";

const { ref } = Vue;

export default {
  name: "Guide",
  setup() {
    const activeSection = ref("value");

    const scrollTo = (id) => {
      activeSection.value = id;
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    return {
      store: store.state,
      activeSection,
      scrollTo,
    };
  },
  template: `
    <div class="max-w-4xl mx-auto space-y-8 select-none pb-10">
      <!-- 顶部标题区 -->
      <div class="text-center space-y-3">
        <h1 class="text-3xl font-bold text-slate-800">图表指南</h1>
        <p class="text-slate-500 text-sm max-w-2xl mx-auto leading-relaxed">
          本站核心价值在于用科学的波动率（ATR）方法，提前捕捉日线与周线级别的关键突破与反转信号，帮助你提高交易胜率、控制回撤。
        </p>
      </div>

      <!-- 快速导航 -->
      <div class="flex flex-wrap justify-center gap-2 text-xs">
        <button @click="scrollTo('value')" class="px-4 py-1.5 rounded-full border transition-all"
                :class="activeSection==='value' ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'">
          为什么值得付费
        </button>
        <button @click="scrollTo('charts')" class="px-4 py-1.5 rounded-full border transition-all"
                :class="activeSection==='charts' ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'">
          三张核心图表
        </button>
        <button @click="scrollTo('strategy')" class="px-4 py-1.5 rounded-full border transition-all"
                :class="activeSection==='strategy' ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'">
          交易策略示例
        </button>
        <button @click="scrollTo('risk')" class="px-4 py-1.5 rounded-full border transition-all"
                :class="activeSection==='risk' ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'">
          风险控制
        </button>
      </div>

      <!-- 1. 为什么值得付费 -->
      <section id="value" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div class="theme-bg px-6 py-4">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-crown"></i> 为什么值得开通 VIP / 定制监控？
          </h2>
        </div>
        <div class="p-6 space-y-5">
          <div class="grid sm:grid-cols-2 gap-4">
            <div class="bg-slate-50 rounded-xl p-4">
              <div class="font-bold text-slate-800 mb-1 flex items-center gap-2">
                <span class="w-6 h-6 rounded-full theme-bg text-white text-xs flex items-center justify-center">1</span>
                提前发现关键信号
              </div>
              <p class="text-xs text-slate-600 leading-relaxed">
                普通软件只告诉你「涨了」或「跌了」。我们用 ATR（真实波动幅度）量化「突破是否有效」，在日线/周线收盘后第一时间提示真正有意义的波动。
              </p>
            </div>
            <div class="bg-slate-50 rounded-xl p-4">
              <div class="font-bold text-slate-800 mb-1 flex items-center gap-2">
                <span class="w-6 h-6 rounded-full theme-bg text-white text-xs flex items-center justify-center">2</span>
                过滤假突破噪音
              </div>
              <p class="text-xs text-slate-600 leading-relaxed">
                市场每天都有小波动。只有当涨跌幅度达到近期 ATR 的 1.1 倍以上，才会触发提示，大幅减少无效信号，让你把精力集中在高胜率机会上。
              </p>
            </div>
            <div class="bg-slate-50 rounded-xl p-4">
              <div class="font-bold text-slate-800 mb-1 flex items-center gap-2">
                <span class="w-6 h-6 rounded-full theme-bg text-white text-xs flex items-center justify-center">3</span>
                日线 + 周线双维度
              </div>
              <p class="text-xs text-slate-600 leading-relaxed">
                同时监控日线与周线，既捕捉短线机会，也把握中期趋势转折。免费用户仅可查看 Top3，VIP 解锁全部标的完整图表。
              </p>
            </div>
            <div class="bg-slate-50 rounded-xl p-4">
              <div class="font-bold text-slate-800 mb-1 flex items-center gap-2">
                <span class="w-6 h-6 rounded-full theme-bg text-white text-xs flex items-center justify-center">4</span>
                定制自己的监控池
              </div>
              <p class="text-xs text-slate-600 leading-relaxed">
                通用监控覆盖热门 ETF，定制监控则让你把真正关心的标的加入专属列表，互不干扰，精准服务个人交易体系。
              </p>
            </div>
          </div>

          <div class="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-900">
            <strong>一句话总结：</strong> 本站不是简单的行情软件，而是一套「波动率过滤 + 多周期共振」的信号系统，帮你把交易决策从「感觉」变成「有数据支撑」。
          </div>
        </div>
      </section>

      <!-- 2. 三张核心图表详解 -->
      <section id="charts" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div class="theme-bg px-6 py-4">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-chart-line"></i> 三张核心图表如何使用
          </h2>
        </div>
        <div class="p-6 space-y-8">

          <!-- 日线图表 -->
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <span class="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded">日线图表</span>
              <span class="text-sm text-slate-500">最常用 · 捕捉日内有效突破</span>
            </div>
            <div class="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed space-y-2">
              <p><strong>看什么：</strong> 当日收盘后，系统计算近 14 日 ATR，判断今日涨跌是否达到「有效突破」标准（约 1.1 倍 ATR）。</p>
              <p><strong>红色数字（带 +）：</strong> 向上有效突破，关注多头机会。</p>
              <p><strong>绿色数字（带 -）：</strong> 向下有效突破，关注空头或止损信号。</p>
              <p><strong>使用建议：</strong> 优先关注「日线触发 + 周线方向一致」的标的，胜率显著高于单一周期信号。</p>
            </div>
          </div>

          <!-- 半日线图表 -->
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <span class="bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded">半日线图表</span>
              <span class="text-sm text-slate-500">辅助确认 · 观察盘中力度</span>
            </div>
            <div class="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed space-y-2">
              <p><strong>看什么：</strong> 把一天拆成上午/下午两个时段，观察突破是「全天持续」还是「尾盘突击」。</p>
              <p><strong>实战价值：</strong> 真正有力量的突破通常上午就已显现。若半日线已大幅触发，而日线尚未完全收官，可提前做好预案。</p>
              <p><strong>注意：</strong> 半日线仅作为辅助参考，最终决策仍以日线收盘信号为准。</p>
            </div>
          </div>

          <!-- 周线图表 -->
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <span class="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded">周线图表</span>
              <span class="text-sm text-slate-500">定方向 · 过滤短线噪音</span>
            </div>
            <div class="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed space-y-2">
              <p><strong>看什么：</strong> 以周为单位计算 ATR，判断本周收盘是否出现中期级别的有效突破。</p>
              <p><strong>核心作用：</strong> 周线决定「大方向」。日线信号若与周线方向相悖，应降低仓位或观望；两者共振时，可加大操作力度。</p>
              <p><strong>更新节奏：</strong> 每周五收盘后更新，周末即可规划下周重点关注标的。</p>
            </div>
          </div>

        </div>
      </section>

      <!-- 3. 交易策略示例 -->
      <section id="strategy" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div class="theme-bg px-6 py-4">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-lightbulb"></i> 实战交易策略示例
          </h2>
        </div>
        <div class="p-6 space-y-5">
          <div class="border border-slate-200 rounded-xl overflow-hidden">
            <div class="bg-slate-50 px-4 py-2.5 font-bold text-sm text-slate-700">策略一：日线 + 周线共振做趋势</div>
            <div class="p-4 text-sm text-slate-600 space-y-2 leading-relaxed">
              <p>1. 周线出现向上有效突破（红色）→ 确立多头环境。</p>
              <p>2. 等待日线也出现向上突破，且最好发生在周线突破后的 1～3 周内。</p>
              <p>3. 入场后，以日线最新 ATR 作为移动止损参考，或等到日线出现反向有效突破再离场。</p>
              <p class="text-emerald-600 font-medium">优势：过滤了大量逆势交易，胜率和盈亏比都更稳定。</p>
            </div>
          </div>

          <div class="border border-slate-200 rounded-xl overflow-hidden">
            <div class="bg-slate-50 px-4 py-2.5 font-bold text-sm text-slate-700">策略二：周线突破后的回调买入</div>
            <div class="p-4 text-sm text-slate-600 space-y-2 leading-relaxed">
              <p>1. 周线刚出现大幅向上突破。</p>
              <p>2. 后续 1～2 周出现正常回调（日线可能短暂转绿），但未跌破关键支撑。</p>
              <p>3. 当日线再次向上触发时，作为二次入场点，止损放在回调低点下方。</p>
              <p class="text-emerald-600 font-medium">优势：买在相对低位，回撤更小，心态更轻松。</p>
            </div>
          </div>

          <div class="border border-slate-200 rounded-xl overflow-hidden">
            <div class="bg-slate-50 px-4 py-2.5 font-bold text-sm text-slate-700">策略三：反向信号作为风控</div>
            <div class="p-4 text-sm text-slate-600 space-y-2 leading-relaxed">
              <p>持仓过程中，如果日线突然出现与持仓方向相反的有效突破，优先减仓或离场，而不是「再等等看」。</p>
              <p class="text-emerald-600 font-medium">这是本系统最大的价值之一：用客观数据强制执行纪律，避免利润回吐或亏损扩大。</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. 风险控制 -->
      <section id="risk" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div class="theme-bg px-6 py-4">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-shield-halved"></i> 风险控制建议
          </h2>
        </div>
        <div class="p-6 space-y-4 text-sm text-slate-700 leading-relaxed">
          <div class="flex gap-3">
            <div class="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold shrink-0">!</div>
            <div>
              <div class="font-bold mb-0.5">信号不是买卖指令</div>
              <p class="text-slate-600">本站提供的是「有效波动提示」，最终买卖决策需结合自身仓位、大盘环境与资金管理规则。</p>
            </div>
          </div>
          <div class="flex gap-3">
            <div class="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold shrink-0">!</div>
            <div>
              <div class="font-bold mb-0.5">永远设置止损</div>
              <p class="text-slate-600">即使是共振信号，也建议用 ATR 的一定倍数作为初始止损距离，保护本金。</p>
            </div>
          </div>
          <div class="flex gap-3">
            <div class="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold shrink-0">!</div>
            <div>
              <div class="font-bold mb-0.5">控制单笔风险</div>
              <p class="text-slate-600">单笔交易亏损不超过总资金的 1%～2%，即使连续出现亏损信号，也不会伤及元气。</p>
            </div>
          </div>
          <div class="flex gap-3">
            <div class="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold shrink-0">!</div>
            <div>
              <div class="font-bold mb-0.5">避免过度交易</div>
              <p class="text-slate-600">不是每个信号都要做。优先选择日线与周线方向一致、且处于自己擅长的品种。</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 底部行动号召 -->
      <div class="bg-gradient-to-r from-[#4da6a0] to-[#3d8b86] rounded-2xl p-6 sm:p-8 text-center text-white shadow-lg">
        <h3 class="text-xl font-bold mb-2">现在就开启你的波动率交易系统</h3>
        <p class="text-sm text-white/90 mb-5 max-w-lg mx-auto">
          免费用户可查看实时排名前 3 的标的完整图表。开通 VIP 后解锁全部通用监控，或使用定制监控打造专属列表。
        </p>
        <div class="flex flex-col sm:flex-row justify-center gap-3">
          <a href="#/plan" class="inline-flex items-center justify-center gap-2 bg-white text-[#4da6a0] font-bold text-sm px-6 py-3 rounded-xl hover:bg-slate-50 transition-colors">
            <i class="fa-solid fa-rocket"></i>
            立即查看套餐
          </a>
          <a href="#/" class="inline-flex items-center justify-center gap-2 bg-white/20 text-white font-bold text-sm px-6 py-3 rounded-xl hover:bg-white/30 transition-colors">
            返回数据看板
          </a>
        </div>
      </div>

      <!-- 免责声明 -->
      <p class="text-center text-[11px] text-slate-400 leading-relaxed px-4">
        本页面内容仅供学习与参考，不构成任何投资建议。市场有风险，交易需谨慎。过往信号表现不代表未来结果。
      </p>
    </div>
  `,
};
