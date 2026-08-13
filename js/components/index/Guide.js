/**
 * 波幅探长 - 图表指南
 * 说明本站价值、看板用法、双趋势线读图与示例纪律
 * 图片请放在站点根目录：chart1.png、chart2.png
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
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return {
      store: store.state,
      activeSection,
      scrollTo,
    };
  },
  template: `
    <div class="max-w-4xl mx-auto space-y-8 select-none pb-10">
      <!-- 标题 -->
      <div class="text-center space-y-3">
        <h1 class="text-3xl font-bold text-slate-800">图表指南</h1>
        <p class="text-slate-500 text-sm max-w-2xl mx-auto leading-relaxed">
          本站用波动率（ATR）筛选「波动变大」的标的，并提供半日线 / 日线 / 周线图表，帮助你把观察从感觉变成可核对的规则。
          以下内容为读图与示例纪律说明，<strong class="text-slate-700">不构成投资建议</strong>。
        </p>
      </div>

      <!-- 导航 -->
      <div class="flex flex-wrap justify-center gap-2 text-xs">
        <button type="button" @click="scrollTo('value')" class="px-4 py-1.5 rounded-full border transition-all"
                :class="activeSection==='value' ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'">
          为什么开通
        </button>
        <button type="button" @click="scrollTo('board')" class="px-4 py-1.5 rounded-full border transition-all"
                :class="activeSection==='board' ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'">
          数据看板
        </button>
        <button type="button" @click="scrollTo('charts')" class="px-4 py-1.5 rounded-full border transition-all"
                :class="activeSection==='charts' ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'">
          三张图表
        </button>
        <button type="button" @click="scrollTo('trend')" class="px-4 py-1.5 rounded-full border transition-all"
                :class="activeSection==='trend' ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'">
          双趋势线读图
        </button>
        <button type="button" @click="scrollTo('rules')" class="px-4 py-1.5 rounded-full border transition-all"
                :class="activeSection==='rules' ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'">
          示例纪律
        </button>
        <button type="button" @click="scrollTo('risk')" class="px-4 py-1.5 rounded-full border transition-all"
                :class="activeSection==='risk' ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'">
          风险说明
        </button>
      </div>

      <!-- 1. 为什么开通 -->
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
                波动过滤，少看噪音
              </div>
              <p class="text-xs text-slate-600 leading-relaxed">
                并非每一笔涨跌都值得盯。系统用 ATR 衡量「这一段波动是否够大」，只有达到设定倍数才会在看板标出，帮你把注意力放在更显著的波动上。
              </p>
            </div>
            <div class="bg-slate-50 rounded-xl p-4">
              <div class="font-bold text-slate-800 mb-1 flex items-center gap-2">
                <span class="w-6 h-6 rounded-full theme-bg text-white text-xs flex items-center justify-center">2</span>
                全量列表 + 图表，不只看触发
              </div>
              <p class="text-xs text-slate-600 leading-relaxed">
                监控会列出池内<strong>全部</strong>标的：未触发时显示 “-”，仍可打开半日线 / 日线 / 周线图表。真正价值往往在「没触发也能看结构」。
              </p>
            </div>
            <div class="bg-slate-50 rounded-xl p-4">
              <div class="font-bold text-slate-800 mb-1 flex items-center gap-2">
                <span class="w-6 h-6 rounded-full theme-bg text-white text-xs flex items-center justify-center">3</span>
                半日线 · 日线 · 周线
              </div>
              <p class="text-xs text-slate-600 leading-relaxed">
                半日线（约 3 小时）看节奏，日线看当日结构，周线看中期方向。免费用户可看部分免费标的图表，VIP 解锁通用池完整图表。
              </p>
            </div>
            <div class="bg-slate-50 rounded-xl p-4">
              <div class="font-bold text-slate-800 mb-1 flex items-center gap-2">
                <span class="w-6 h-6 rounded-full theme-bg text-white text-xs flex items-center justify-center">4</span>
                定制监控：你的标的你做主
              </div>
              <p class="text-xs text-slate-600 leading-relaxed">
                定制池里的标的即使长期不触发波幅，只要在有效期内，也可随时看图，方便跟踪自己的持仓与观察名单。
              </p>
            </div>
          </div>
          <div class="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-900">
            <strong>一句话：</strong>本站是「波动筛选 + 多周期图表」工具，用来辅助观察与复盘，而不是荐股或收益承诺。
          </div>
        </div>
      </section>

      <!-- 2. 数据看板 -->
      <section id="board" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div class="theme-bg px-6 py-4">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-table"></i> 数据看板怎么读
          </h2>
        </div>
        <div class="p-6 space-y-4 text-sm text-slate-700 leading-relaxed">
          <ul class="list-disc pl-5 space-y-2">
            <li><strong>标的名称列：</strong>名称与代码；「免费」为未付费也可看图的示例标的；「定制」为你的专属监控。</li>
            <li><strong>周一～周五：</strong>当日若触发波幅阈值，显示带正负号的百分比；未触发为 “-”。</li>
            <li><strong>周线列：</strong>本周（或沿用上周）周线波幅结果；同样可为 “-”。</li>
            <li><strong>图表图标：</strong>点击可查看半日线 / 日线（或周线）大图。无触发数据时也可以点，只要图床已更新。</li>
            <li><strong>展开行：</strong>点击通用表某一行，可展开近几周历史波幅（有数据时）。</li>
          </ul>
          <p class="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
            提示：看板数字回答的是「波动是否够大」；趋势线与评分回答的是「结构与节奏」。两者可对照，不要混成单一买卖信号。
          </p>
        </div>
      </section>

      <!-- 3. 三张图表 -->
      <section id="charts" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div class="theme-bg px-6 py-4">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-images"></i> 半日线 · 日线 · 周线
          </h2>
        </div>
        <div class="p-6 space-y-8">
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <span class="bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded">半日线（约 3 小时）</span>
              <span class="text-sm text-slate-500">节奏 · 盘中结构</span>
            </div>
            <div class="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed space-y-2">
              <p><strong>看什么：</strong>比日线更细的节奏，适合观察「当前周期趋势线」与评分的变化是否刚发生。</p>
              <p><strong>用法：</strong>与日线对照——半日线先转强、日线尚未走完时，只作预案，不替代收盘后的复核。</p>
            </div>
          </div>
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <span class="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded">日线图表</span>
              <span class="text-sm text-slate-500">最常用 · 当日结构</span>
            </div>
            <div class="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed space-y-2">
              <p><strong>看什么：</strong>日线 K 线、趋势线与波幅标注；看板「日线触发」多与此周期相关。</p>
              <p><strong>红色 + / 绿色 -：</strong>表示该时段相对阈值的向上或向下波幅标记，用于观察，不是涨跌保证。</p>
            </div>
          </div>
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <span class="bg-indigo-500 text-white text-xs font-bold px-2.5 py-1 rounded">周线图表</span>
              <span class="text-sm text-slate-500">中期方向</span>
            </div>
            <div class="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed space-y-2">
              <p><strong>看什么：</strong>一周一根 K 的结构与周线波幅，用于判断中期是否同向。</p>
              <p><strong>建议：</strong>短周期信号与周线方向一致时，结构更清晰；方向冲突时降低频率、优先观望。</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. 双趋势线 -->
      <section id="trend" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div class="theme-bg px-6 py-4">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-chart-line"></i> 双趋势线怎么读
          </h2>
        </div>
        <div class="p-6 space-y-6 text-sm text-slate-700 leading-relaxed">
          <p>
            图表中通常有两条趋势线：<strong>当前周期趋势线</strong>（例如 3 小时，偏节奏）与
            <strong>2 日趋势线</strong>（偏结构）。K 线附近的数字为<strong>评分</strong>（具体算法以指标说明为准）。
            颜色习惯：转强偏绿，转弱偏黄/橙（以你实际指标配色为准）。
          </p>

          <!-- 图 1 -->
          <figure class="space-y-2">
            <img src="./chart1.png" alt="双趋势线与评分示例图一"
                 class="w-full rounded-xl border border-slate-200 shadow-sm bg-slate-50 object-contain max-h-[480px]"
                 loading="lazy"
                 onerror="this.style.display='none'; this.nextElementSibling && (this.nextElementSibling.style.display='block');">
            <div style="display:none" class="text-xs text-slate-400 text-center py-8 border border-dashed rounded-xl">
              请将 chart1.png 上传到网站根目录（与 index.html 同级）
            </div>
            <figcaption class="text-xs text-slate-500 text-center">图 1 · 双趋势线与K线评分示意：趋势线上涨为绿线，下跌为橙线。</figcaption>
          </figure>

          <!-- 图 2 -->
          <figure class="space-y-2">
            <img src="./chart2.png" alt="上涨标签和下涨标签示例图二"
                 class="w-full rounded-xl border border-slate-200 shadow-sm bg-slate-50 object-contain max-h-[480px]"
                 loading="lazy"
                 onerror="this.style.display='none'; this.nextElementSibling && (this.nextElementSibling.style.display='block');">
            <div style="display:none" class="text-xs text-slate-400 text-center py-8 border border-dashed rounded-xl">
              请将 chart2.png 上传到网站根目录（与 index.html 同级）
            </div>
            <figcaption class="text-xs text-slate-500 text-center">图 2 · 上涨标签和下跌标签示意（示例）</figcaption>
          </figure>

          <div class="bg-slate-50 rounded-xl p-4 space-y-2">
            <p class="font-bold text-slate-800">建议阅读顺序</p>
            <ol class="list-decimal pl-5 space-y-1 text-xs sm:text-sm">
              <li>先看 <strong>2 日线</strong>：大方向是否已转、是否与当前周期一致。</li>
              <li>再看 <strong>当前周期线</strong>：是否刚从弱转强或从强转弱。</li>
              <li>再看 <strong>评分</strong>：转色附近是否达到你的最低门槛（如 ≥3）。</li>
              <li>最后看位置与波幅：是否已远离近期高低点、波动是否异常放大。</li>
            </ol>
          </div>

          <div class="bg-emerald-50 border border-emerald-100 rounded-xl p-4 space-y-2">
            <p class="font-bold text-emerald-900">评分过滤（重要）</p>
            <p class="text-xs sm:text-sm text-emerald-900/90">
              <strong>单独突然冒出来的「3 分」K 线，不作为介入依据。</strong>
              仅当该 3 分（或达到门槛的评分）出现前，同一段结构里已经出现过其它评分数字
              （说明波段已被指标连续标记，而不是孤立噪声）时，才考虑把该评分纳入你的观察条件。
            </p>
          </div>
        </div>
      </section>

      <!-- 5. 示例纪律 -->
      <section id="rules" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div class="theme-bg px-6 py-4">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-list-check"></i> 示例纪律（非投资建议）
          </h2>
        </div>
        <div class="p-6 space-y-5 text-sm text-slate-700 leading-relaxed">
          <p class="text-xs text-slate-500">
            以下为便于理解的规则化示例，用于说明「如何把读图变成可检查的步骤」。比例、阈值、品种因人而异，不保证收益。
          </p>

          <div class="border border-slate-100 rounded-xl p-4 space-y-2">
            <p class="font-bold text-slate-800">偏向加仓观察（分两步，各约 50%）</p>
            <ol class="list-decimal pl-5 space-y-1">
              <li>当前周期趋势线<strong>由下转上</strong>、颜色转强，且评分 ≥3，并满足「前面已有其它评分、非孤立 3 分」→ 计划仓位的约 50%。</li>
              <li>2 日趋势线随后也转强 → 再考虑剩余约 50%。</li>
            </ol>
            <p class="text-xs text-slate-500">若当前已强而 2 日仍弱：示例中只按半仓逻辑观察，不写「做满」。</p>
          </div>

          <div class="border border-slate-100 rounded-xl p-4 space-y-2">
            <p class="font-bold text-slate-800">偏向减仓观察（分两步）</p>
            <ol class="list-decimal pl-5 space-y-1">
              <li>当前周期线转弱 → 先减约 50%。</li>
              <li>2 日线转弱 → 计划仓位清零。</li>
            </ol>
            <p class="text-xs text-slate-500">两线冲突时，示例优先服从更快周期的减仓信号，降低「大级别还强就硬扛」的冲动。</p>
          </div>

          <div class="border border-amber-100 bg-amber-50/50 rounded-xl p-4 space-y-2">
            <p class="font-bold text-amber-900">止损示例</p>
            <ul class="list-disc pl-5 space-y-1 text-amber-950/90">
              <li>默认可为成本价约 <strong>2%</strong>，或结构低点/高点外侧，取更严格者。</li>
              <li>高波动主题品种可自行放宽；固定 2% 并非对所有 ETF 都合适。</li>
              <li>触发止损后，示例中<strong>当日不再按同一方向立即加回</strong>。</li>
            </ul>
          </div>

          <div class="bg-slate-50 rounded-xl p-4 space-y-1 text-xs sm:text-sm">
            <p class="font-bold text-slate-800">震荡市</p>
            <p>双线频繁绿↔黄、评分碎碎出现时，优先降频或观望，避免反复交易成本与情绪消耗。</p>
          </div>
        </div>
      </section>

      <!-- 6. 风险 -->
      <section id="risk" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div class="bg-slate-800 px-6 py-4">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-shield-halved"></i> 风险与免责说明
          </h2>
        </div>
        <div class="p-6 space-y-3 text-sm text-slate-700 leading-relaxed">
          <ul class="list-disc pl-5 space-y-2">
            <li>趋势线变色与评分多为<strong>确认型</strong>信息，存在滞后，可能买在波段中后部或卖在已走一段之后。</li>
            <li>跳空、流动性、费率与滑点可能导致「理想止损」无法按预期成交。</li>
            <li>多只同主题 ETF 信号高度相关，重复加仓会放大同源风险。</li>
            <li>历史波幅与图表不代表未来表现；任何规则都有失效阶段。</li>
          </ul>
          <div class="bg-red-50 border border-red-100 rounded-xl p-4 text-xs sm:text-sm text-red-900">
            <strong>免责声明：</strong>波幅数据与图表由特定指标与自动化脚本生成，仅供学习与观察。
            本页面所有示例纪律、比例与阈值均不构成投资建议、收益承诺或买卖推荐。
            市场有风险，决策与后果由使用者自行承担。
          </div>
          <div class="pt-2 text-center">
            <a href="#/plan" class="inline-block theme-bg text-white text-xs font-bold px-5 py-2.5 rounded-lg no-underline">
              了解开通套餐
            </a>
          </div>
        </div>
      </section>
    </div>
  `,
};
