/**
 * 波幅探长 - 图表指南
 * A股配色：上涨趋势线=橙，下跌趋势线=绿
 * 配图：chart1.png（半日线标注）/ chart2.png（日线标注）
 * 点击图片可用 Viewer.js 放大、翻页（与看板一致）
 * js/components/index/Guide.js
 */
import { store } from "../../store.js";

const { ref, onMounted, onBeforeUnmount } = Vue;

export default {
  name: "Guide",
  setup() {
    const activeSection = ref("value");
    let viewerInstance = null;

    const scrollTo = (id) => {
      activeSection.value = id;
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const ensureViewerNavStyle = () => {
      if (document.getElementById("bofutz-guide-viewer-style")) return;
      const style = document.createElement("style");
      style.id = "bofutz-guide-viewer-style";
      style.textContent = `
        .bofutz-viewer-nav {
          position: absolute; top: 50%; transform: translateY(-50%);
          z-index: 20; width: 44px; height: 44px; border-radius: 9999px;
          border: none; background: rgba(15, 23, 42, 0.55); color: #fff;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; backdrop-filter: blur(4px);
        }
        .bofutz-viewer-nav:hover { background: rgba(15, 23, 42, 0.75); }
        .bofutz-viewer-nav svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
        .bofutz-viewer-prev { left: 16px; }
        .bofutz-viewer-next { right: 16px; }
        @media (max-width: 640px) {
          .bofutz-viewer-nav { width: 46px; height: 46px; }
          .bofutz-viewer-prev { left: 8px; }
          .bofutz-viewer-next { right: 8px; }
        }
      `;
      document.head.appendChild(style);
    };

    /** 与看板相同：Viewer 放大 + 左右翻页 */
    const openGuideViewer = (startIndex = 0) => {
      if (!window.Viewer) {
        window.open(startIndex === 1 ? "./chart2.png" : "./chart1.png", "_blank");
        return;
      }
      ensureViewerNavStyle();
      if (viewerInstance) {
        try {
          viewerInstance.destroy();
        } catch (_) {}
        viewerInstance = null;
      }
      const wrap = document.createElement("div");
      wrap.style.display = "none";
      const imgs = [
        { src: "./chart1.png", alt: "半日线：趋势线与涨跌标签" },
        { src: "./chart2.png", alt: "日线：评分与阶段涨跌幅" },
      ];
      imgs.forEach((it) => {
        const img = document.createElement("img");
        img.src = it.src;
        img.alt = it.alt;
        wrap.appendChild(img);
      });
      document.body.appendChild(wrap);

      let navPrev = null;
      let navNext = null;
      viewerInstance = new window.Viewer(wrap, {
        initialViewIndex: startIndex,
        navbar: false,
        title: (image) => image.alt || "图表说明",
        toolbar: {
          zoomIn: 1,
          zoomOut: 1,
          oneToOne: 1,
          reset: 1,
          prev: 0,
          play: 0,
          next: 0,
          rotateLeft: 0,
          rotateRight: 0,
          flipHorizontal: 0,
          flipVertical: 0,
        },
        viewed() {
          const root = document.querySelector(".viewer-container");
          if (!root || root.querySelector(".bofutz-viewer-nav")) return;
          navPrev = document.createElement("button");
          navPrev.type = "button";
          navPrev.className = "bofutz-viewer-nav bofutz-viewer-prev";
          navPrev.setAttribute("aria-label", "上一张");
          navPrev.innerHTML =
            '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 6 9 12 15 18"></polyline></svg>';
          navPrev.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              viewerInstance.prev(true);
            } catch (_) {}
          });
          navNext = document.createElement("button");
          navNext.type = "button";
          navNext.className = "bofutz-viewer-nav bofutz-viewer-next";
          navNext.setAttribute("aria-label", "下一张");
          navNext.innerHTML =
            '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 6 15 12 9 18"></polyline></svg>';
          navNext.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              viewerInstance.next(true);
            } catch (_) {}
          });
          root.appendChild(navPrev);
          root.appendChild(navNext);
        },
        hidden() {
          try {
            viewerInstance && viewerInstance.destroy();
          } catch (_) {}
          viewerInstance = null;
          try {
            wrap.remove();
          } catch (_) {}
        },
      });
      viewerInstance.show();
    };

    onBeforeUnmount(() => {
      if (viewerInstance) {
        try {
          viewerInstance.destroy();
        } catch (_) {}
        viewerInstance = null;
      }
    });

    return {
      store: store.state,
      activeSection,
      scrollTo,
      openGuideViewer,
    };
  },
  template: `
    <div class="max-w-4xl mx-auto space-y-8 select-none pb-10">
      <!-- 标题 -->
      <div class="text-center space-y-3">
        <h1 class="text-3xl font-bold text-slate-800">图表指南</h1>
        <p class="text-slate-500 text-sm max-w-2xl mx-auto leading-relaxed">
          本站用 ATR 筛选波动变大的标的，并提供半日线 / 日线 / 周线图表。
          配色按<strong class="text-slate-700">A股习惯</strong>：<span class="text-orange-500 font-bold">橙色=上涨趋势</span>，
          <span class="text-emerald-600 font-bold">绿色=下跌趋势</span>。
          以下为读图与示例纪律，<strong class="text-slate-700">不构成投资建议</strong>。
        </p>
      </div>

      <!-- 导航 -->
      <div class="flex flex-wrap justify-center gap-2 text-xs">
        <button type="button" @click="scrollTo('value')" class="px-4 py-1.5 rounded-full border transition-all"
                :class="activeSection==='value' ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'">为什么开通</button>
        <button type="button" @click="scrollTo('board')" class="px-4 py-1.5 rounded-full border transition-all"
                :class="activeSection==='board' ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'">数据看板</button>
        <button type="button" @click="scrollTo('read')" class="px-4 py-1.5 rounded-full border transition-all"
                :class="activeSection==='read' ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'">怎么读图</button>
        <button type="button" @click="scrollTo('trade')" class="px-4 py-1.5 rounded-full border transition-all"
                :class="activeSection==='trade' ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'">买卖示例</button>
        <button type="button" @click="scrollTo('risk')" class="px-4 py-1.5 rounded-full border transition-all"
                :class="activeSection==='risk' ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'">风险说明</button>
      </div>

      <!-- 1. 为什么开通 -->
      <section id="value" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div class="theme-bg px-6 py-4">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-crown"></i> 为什么值得开通监控 VIP？
          </h2>
        </div>
        <div class="p-6 space-y-4">
          <div class="grid sm:grid-cols-3 gap-4">
            <div class="bg-slate-50 rounded-xl p-4">
              <div class="font-bold text-slate-800 mb-1 text-sm">1. 波动过滤</div>
              <p class="text-xs text-slate-600 leading-relaxed">用 ATR 判断波动是否够大，达到阈值才在看板标出，减少噪音。</p>
            </div>
            <div class="bg-slate-50 rounded-xl p-4">
              <div class="font-bold text-slate-800 mb-1 text-sm">2. 全量列表 + 图</div>
              <p class="text-xs text-slate-600 leading-relaxed">池内标的都会列出；未触发显示 “-”，仍可打开半日 / 日 / 周线图。</p>
            </div>
            <div class="bg-slate-50 rounded-xl p-4">
              <div class="font-bold text-slate-800 mb-1 text-sm">3. 多周期对照</div>
              <p class="text-xs text-slate-600 leading-relaxed">半日看节奏，日线看结构，周线看方向。VIP 解锁完整图表。</p>
            </div>
          </div>
          <div class="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-900">
            <strong>一句话：</strong>波动筛选 + 多周期图表，用来观察与复盘，不是荐股工具。
          </div>
        </div>
      </section>

      <!-- 2. 看板 -->
      <section id="board" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div class="theme-bg px-6 py-4">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-table"></i> 数据看板怎么读
          </h2>
        </div>
        <div class="p-6 text-sm text-slate-700 leading-relaxed space-y-3">
          <ul class="list-disc pl-5 space-y-2">
            <li><strong>标的列：</strong>名称与代码；「免费」表示未付费也可看图。</li>
            <li><strong>周一～周五：</strong>触发波幅阈值时显示 ± 百分比，未触发为 “-”。</li>
            <li><strong>周线列：</strong>本周周线波幅结果，同样可为 “-”。</li>
            <li><strong>图表图标：</strong>点击查看半日线 / 日线 / 周线大图（可放大翻页）。</li>
          </ul>
          <p class="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
            看板数字回答「波动大不大」；趋势线与评分回答「结构与节奏」。两者对照看，不要当成单一买卖信号。
          </p>
        </div>
      </section>

      <!-- 3. 怎么读图 -->
      <section id="read" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div class="theme-bg px-6 py-4">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-chart-line"></i> 怎么读图（对照示例）
          </h2>
        </div>
        <div class="p-6 space-y-6 text-sm text-slate-700 leading-relaxed">
          <div class="bg-slate-50 rounded-xl p-4 space-y-2">
            <p class="font-bold text-slate-800">配色（A股习惯）</p>
            <ul class="list-disc pl-5 text-xs sm:text-sm space-y-1">
              <li><span class="text-orange-500 font-bold">橙色趋势线</span>：当前偏上涨 / 转强</li>
              <li><span class="text-emerald-600 font-bold">绿色趋势线</span>：当前偏下跌 / 转弱</li>
              <li><span class="text-red-500 font-bold">红色标签</span>：上涨波幅或阶段涨幅标注</li>
              <li><span class="text-emerald-600 font-bold">绿色标签</span>：下跌波幅或阶段跌幅标注</li>
              <li><strong>K 线旁数字</strong>：评分（1、2、3…），表示该段被指标标记的强度</li>
            </ul>
          </div>

          <!-- 图1 半日线 -->
          <figure class="space-y-2">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <span class="bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded">图 1 · 半日线</span>
              <span class="text-xs text-slate-400">点击图片可放大、左右翻页</span>
            </div>
            <button type="button" class="block w-full text-left group" @click="openGuideViewer(0)">
              <img src="./chart1.png" alt="半日线：半日趋势线、2日趋势线、涨跌标签"
                   class="w-full rounded-xl border border-slate-200 shadow-sm bg-slate-50 object-contain max-h-[420px] cursor-zoom-in group-hover:opacity-95 transition"
                   loading="lazy"
                   onerror="this.style.display='none'; this.nextElementSibling && (this.nextElementSibling.style.display='flex');">
              <div style="display:none" class="text-xs text-slate-400 justify-center py-10 border border-dashed rounded-xl">
                请将 chart1.png 放到网站根目录（与 index.html 同级）
              </div>
            </button>
            <figcaption class="text-xs text-slate-600 space-y-1 bg-slate-50 rounded-lg p-3">
              <p><strong>半日趋势线：</strong>跟踪盘中节奏，绿→橙表示节奏转强，橙→绿表示转弱。</p>
              <p><strong>2 日趋势线：</strong>偏结构方向，变化通常慢于半日线，用来确认是否同向。</p>
              <p><strong>红/绿标签 + 数值：</strong>该段相对波幅或涨跌幅度的标记，便于复盘，不是保证收益。</p>
            </figcaption>
          </figure>

          <!-- 图2 日线 -->
          <figure class="space-y-2">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <span class="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded">图 2 · 日线</span>
              <span class="text-xs text-slate-400">点击图片可放大、左右翻页</span>
            </div>
            <button type="button" class="block w-full text-left group" @click="openGuideViewer(1)">
              <img src="./chart2.png" alt="日线：评分与阶段涨跌幅"
                   class="w-full rounded-xl border border-slate-200 shadow-sm bg-slate-50 object-contain max-h-[420px] cursor-zoom-in group-hover:opacity-95 transition"
                   loading="lazy"
                   onerror="this.style.display='none'; this.nextElementSibling && (this.nextElementSibling.style.display='flex');">
              <div style="display:none" class="text-xs text-slate-400 justify-center py-10 border border-dashed rounded-xl">
                请将 chart2.png 放到网站根目录（与 index.html 同级）
              </div>
            </button>
            <figcaption class="text-xs text-slate-600 space-y-1 bg-slate-50 rounded-lg p-3">
              <p><strong>评分数字：</strong>出现在 K 线附近的 1、2、3…，表示该段被连续标记的程度。</p>
              <p><strong>阶段涨跌幅 + 时间：</strong>如标签中的百分比与「5w」等，表示一段行情的幅度与跨度，用于对照，不是下单指令。</p>
              <p><strong>阅读顺序建议：</strong>先看 2 日线方向 → 再看半日/日线是否转色 → 再看评分是否连续 → 最后看位置与波动大小。</p>
            </figcaption>
          </figure>
        </div>
      </section>

      <!-- 4. 买卖示例 -->
      <section id="trade" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div class="theme-bg px-6 py-4">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-list-check"></i> 买卖示例纪律（非投资建议）
          </h2>
        </div>
        <div class="p-6 space-y-5 text-sm text-slate-700 leading-relaxed">
          <p class="text-xs text-slate-500">
            下列比例与条件仅作「可检查步骤」的示例，方便统一观察习惯。不保证收益，不构成买卖推荐。
          </p>

          <div class="border border-orange-100 bg-orange-50/40 rounded-xl p-4 space-y-2">
            <p class="font-bold text-orange-900">买入观察（分两步，各约 50%）</p>
            <ol class="list-decimal pl-5 space-y-1.5">
              <li>
                <strong>半日线或日线趋势：由绿转橙</strong>
                → 可准备约 <strong>50%</strong> 仓位（节奏/当日结构转强）。
              </li>
              <li>
                <strong>2 日趋势线：由绿转橙</strong>
                → 可再准备约 <strong>50%</strong> 仓位（结构确认同向）。
              </li>
            </ol>
            <p class="text-xs text-orange-900/80">若快线已橙、2 日仍绿：示例中只按半仓逻辑观察，不写「一次做满」。</p>
          </div>

          <div class="border border-emerald-100 bg-emerald-50/40 rounded-xl p-4 space-y-2">
            <p class="font-bold text-emerald-900">卖出观察（同理，分两步）</p>
            <ol class="list-decimal pl-5 space-y-1.5">
              <li><strong>半日线或日线：由橙转绿</strong> → 先减约 <strong>50%</strong>。</li>
              <li><strong>2 日趋势线：由橙转绿</strong> → 计划仓位再减至清零。</li>
            </ol>
            <p class="text-xs text-emerald-900/80">两线冲突时，示例优先服从更快周期的减仓信号，降低硬扛。</p>
          </div>

          <div class="border border-slate-200 bg-slate-50 rounded-xl p-4 space-y-2">
            <p class="font-bold text-slate-800">评分过滤（重要）</p>
            <ul class="list-disc pl-5 space-y-1.5">
              <li><strong>单独突然出现的「3 分」：不买入，继续观望。</strong></li>
              <li>
                同一段结构里<strong>已经连续出现过评分</strong>，再出现 3 分（或你设定的门槛）时，才把该 3 分纳入可观察的买入条件。
              </li>
              <li>目的：过滤孤立噪声，只重视「被指标连续标记」的波段。</li>
            </ul>
          </div>

          <div class="border border-amber-100 bg-amber-50/50 rounded-xl p-4 space-y-2">
            <p class="font-bold text-amber-900">止损（必须）</p>
            <ul class="list-disc pl-5 space-y-1">
              <li>所有交易示例都要求<strong>事先设好止损</strong>。</li>
              <li>可按标的波动大小，在约 <strong>2%～5%</strong> 区间调整；波动大的主题 ETF 可取偏上限。</li>
              <li>也可与结构低点/高点外侧比较，取更严格者。</li>
              <li>触发止损后，示例中<strong>当日不再按同一方向立刻加回</strong>。</li>
            </ul>
          </div>

          <div class="bg-slate-50 rounded-xl p-3 text-xs text-slate-600">
            震荡市（双线频繁橙↔绿、评分碎碎出现）时，优先降频或观望，减少反复交易成本。
          </div>
        </div>
      </section>

      <!-- 5. 风险 -->
      <section id="risk" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div class="bg-slate-800 px-6 py-4">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-shield-halved"></i> 风险与免责
          </h2>
        </div>
        <div class="p-6 space-y-3 text-sm text-slate-700 leading-relaxed">
          <ul class="list-disc pl-5 space-y-2">
            <li>趋势线变色与评分多为确认型信息，存在滞后。</li>
            <li>跳空、流动性、费率与滑点可能导致止损无法按预期成交。</li>
            <li>同主题多只 ETF 信号相关，重复加仓会放大同源风险。</li>
            <li>历史图表与波幅不代表未来表现。</li>
          </ul>
          <div class="bg-red-50 border border-red-100 rounded-xl p-4 text-xs sm:text-sm text-red-900">
            <strong>免责声明：</strong>图表及指标仅供参考，不作为投资建议、收益承诺或买卖推荐。
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
