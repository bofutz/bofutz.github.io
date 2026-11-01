/**
 * 波幅探长 - 图表指南
 * 说明：仅展示日线图、周线图；以 ATR 中间线颜色变化作为观察信号。
 */
import { store } from "../../store.js";

const { ref, onBeforeUnmount } = Vue;

export default {
  name: "Guide",
  setup() {
    const activeSection = ref("signal");
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
        .bofutz-viewer-nav svg {
          width: 18px; height: 18px; fill: none; stroke: currentColor;
          stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round;
        }
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

    const openGuideViewer = (startIndex = 0) => {
      const images = [
        { src: "./webpic/chart1.png", alt: "日线图：ATR 中间线由绿变橙，分批买入示例" },
        { src: "./webpic/chart2.png", alt: "周线图：ATR 中间线由橙变绿，分批卖出示例" },
      ];

      if (!window.Viewer) {
        window.open(images[startIndex]?.src || images[0].src, "_blank");
        return;
      }

      ensureViewerNavStyle();

      if (viewerInstance) {
        try { viewerInstance.destroy(); } catch (_) {}
        viewerInstance = null;
      }

      const wrap = document.createElement("div");
      wrap.style.display = "none";
      images.forEach((item) => {
        const img = document.createElement("img");
        img.src = item.src;
        img.alt = item.alt;
        wrap.appendChild(img);
      });
      document.body.appendChild(wrap);

      viewerInstance = new window.Viewer(wrap, {
        initialViewIndex: startIndex,
        navbar: false,
        title: (image) => image.alt || "图表示例",
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

          const prev = document.createElement("button");
          prev.type = "button";
          prev.className = "bofutz-viewer-nav bofutz-viewer-prev";
          prev.setAttribute("aria-label", "上一张图表");
          prev.innerHTML =
            '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 6 9 12 15 18"></polyline></svg>';
          prev.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            try { viewerInstance && viewerInstance.prev(true); } catch (_) {}
          });

          const next = document.createElement("button");
          next.type = "button";
          next.className = "bofutz-viewer-nav bofutz-viewer-next";
          next.setAttribute("aria-label", "下一张图表");
          next.innerHTML =
            '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 6 15 12 9 18"></polyline></svg>';
          next.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            try { viewerInstance && viewerInstance.next(true); } catch (_) {}
          });

          root.appendChild(prev);
          root.appendChild(next);
        },
        hidden() {
          try { viewerInstance && viewerInstance.destroy(); } catch (_) {}
          viewerInstance = null;
          try { wrap.remove(); } catch (_) {}
        },
      });

      viewerInstance.show();
    };

    onBeforeUnmount(() => {
      if (viewerInstance) {
        try { viewerInstance.destroy(); } catch (_) {}
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
    <div class="max-w-4xl mx-auto space-y-7 select-none pb-10">
      <!-- 页面标题 -->
      <header class="text-center space-y-3">
        <h1 class="text-3xl font-bold text-slate-800">图表说明</h1>
        <p class="text-sm text-slate-500 leading-relaxed max-w-2xl mx-auto">
          波幅探长目前提供<strong class="text-slate-700">日线图与周线图</strong>。
          重点观察 ATR 中间线的颜色变化，并参考前一根已完成 K 线的三个价位进行分批操作。
        </p>
      </header>

      <!-- 页面导航 -->
      <nav class="flex flex-wrap justify-center gap-2 text-xs">
        <button type="button" @click="scrollTo('signal')"
          class="px-4 py-1.5 rounded-full border transition-all"
          :class="activeSection==='signal' ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'">
          买卖信号
        </button>
        <button type="button" @click="scrollTo('examples')"
          class="px-4 py-1.5 rounded-full border transition-all"
          :class="activeSection==='examples' ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'">
          图表示例
        </button>
        <button type="button" @click="scrollTo('discipline')"
          class="px-4 py-1.5 rounded-full border transition-all"
          :class="activeSection==='discipline' ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'">
          交易纪律
        </button>
        <button type="button" @click="scrollTo('disclaimer')"
          class="px-4 py-1.5 rounded-full border transition-all"
          :class="activeSection==='disclaimer' ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'">
          免责声明
        </button>
      </nav>

      <!-- 一、核心买卖信号 -->
      <section id="signal" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden scroll-mt-5">
        <div class="theme-bg px-5 sm:px-6 py-4">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-chart-line"></i> 核心买卖信号
          </h2>
        </div>

        <div class="p-5 sm:p-6 space-y-5 text-sm text-slate-700 leading-relaxed">
          <div class="rounded-xl border border-orange-100 bg-orange-50/70 p-4">
            <div class="flex items-center gap-2 mb-2">
              <span class="inline-block w-3 h-3 rounded-full bg-orange-500"></span>
              <h3 class="font-bold text-orange-900 text-base">ATR 中间线由绿变橙</h3>
              <span class="ml-auto text-xs font-bold text-orange-800 bg-orange-100 rounded-full px-2.5 py-1">买入观察</span>
            </div>
            <p class="text-orange-950">
              当 ATR 中间线由绿色转为橙色，代表指标状态发生转变。可参考前一根已完成 K 线的以下三个价位，分批安排买入：
            </p>
            <ol class="list-decimal pl-5 mt-3 space-y-1.5 text-orange-950">
              <li><strong>前一根 K 线的收盘价</strong></li>
              <li><strong>ATR 中间线对应价</strong></li>
              <li><strong>前一根 K 线实体的 1/2 位置</strong></li>
            </ol>
          </div>

          <div class="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
            <div class="flex items-center gap-2 mb-2">
              <span class="inline-block w-3 h-3 rounded-full bg-emerald-600"></span>
              <h3 class="font-bold text-emerald-900 text-base">ATR 中间线由橙变绿</h3>
              <span class="ml-auto text-xs font-bold text-emerald-800 bg-emerald-100 rounded-full px-2.5 py-1">卖出观察</span>
            </div>
            <p class="text-emerald-950">
              当 ATR 中间线由橙色转为绿色，反向参考相同的三个价位，分批安排卖出：
            </p>
            <ol class="list-decimal pl-5 mt-3 space-y-1.5 text-emerald-950">
              <li><strong>前一根 K 线的收盘价</strong></li>
              <li><strong>ATR 中间线对应价</strong></li>
              <li><strong>前一根 K 线实体的 1/2 位置</strong></li>
            </ol>
          </div>

          <div class="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
            <p class="font-bold text-slate-800">如何计算 K 线实体的 1/2 位置？</p>
            <p>实体中点 =（该根 K 线开盘价 + 收盘价）÷ 2。</p>
            <p class="text-xs text-slate-500">
              注意：这里指 K 线实体的中点，不是最高价与最低价之间的中点。
            </p>
          </div>

          <div class="text-xs text-slate-500 leading-relaxed">
            <strong class="text-slate-700">周期说明：</strong>
            日线图以此前一个已完成的日 K 线作为参考；周线图以此前一个已完成的周 K 线作为参考。
            周线信号应等待当周 K 线收盘确认。不要把尚未收盘的 K 线颜色变化当作最终信号。
          </div>
        </div>
      </section>

      <!-- 二、图表示例 -->
      <section id="examples" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden scroll-mt-5">
        <div class="theme-bg px-5 sm:px-6 py-4">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-images"></i> 图表示例
          </h2>
        </div>
        <div class="p-5 sm:p-6 space-y-6 text-sm text-slate-700 leading-relaxed">
          <p class="text-xs text-slate-500">
            以下示例图用于说明颜色变化及三个参考价位。点击图片可放大查看，也可左右切换。
          </p>

          <figure class="space-y-2">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <span class="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">示例一 · 绿变橙 / 分批买入</span>
              <span class="text-xs text-slate-400">点击图片放大</span>
            </div>
            <button type="button" class="block w-full text-left group" @click="openGuideViewer(0)">
              <img src="./webpic/chart1.png"
                alt="ATR 中间线由绿变橙，参考三个价位分批买入"
                class="w-full rounded-xl border border-slate-200 shadow-sm bg-slate-50 object-contain max-h-[520px] cursor-zoom-in group-hover:opacity-95 transition"
                loading="lazy"
                onerror="this.style.display='none'; this.nextElementSibling && (this.nextElementSibling.style.display='flex');">
              <div style="display:none" class="text-xs text-slate-400 justify-center py-10 border border-dashed rounded-xl">
                请将买入示例图片保存为 webpic/chart1.png
              </div>
            </button>
            <figcaption class="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
              建议在图中标出：颜色由绿变橙的位置、前一根 K 线收盘价、ATR 中间线对应价，以及前一根 K 线实体中点。
            </figcaption>
          </figure>

          <figure class="space-y-2">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <span class="bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full">示例二 · 橙变绿 / 分批卖出</span>
              <span class="text-xs text-slate-400">点击图片放大</span>
            </div>
            <button type="button" class="block w-full text-left group" @click="openGuideViewer(1)">
              <img src="./webpic/chart2.png"
                alt="ATR 中间线由橙变绿，参考三个价位分批卖出"
                class="w-full rounded-xl border border-slate-200 shadow-sm bg-slate-50 object-contain max-h-[520px] cursor-zoom-in group-hover:opacity-95 transition"
                loading="lazy"
                onerror="this.style.display='none'; this.nextElementSibling && (this.nextElementSibling.style.display='flex');">
              <div style="display:none" class="text-xs text-slate-400 justify-center py-10 border border-dashed rounded-xl">
                请将卖出示例图片保存为 webpic/chart2.png
              </div>
            </button>
            <figcaption class="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
              建议在图中标出：颜色由橙变绿的位置，以及对应的三个分批参考价位。
            </figcaption>
          </figure>
        </div>
      </section>

      <!-- 三、交易纪律 -->
      <section id="discipline" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden scroll-mt-5">
        <div class="theme-bg px-5 sm:px-6 py-4">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-list-check"></i> 交易纪律
          </h2>
        </div>
        <div class="p-5 sm:p-6 text-sm text-slate-700 leading-relaxed">
          <ul class="list-disc pl-5 space-y-3">
            <li><strong>等待信号确认：</strong>以已收盘 K 线确认 ATR 中间线颜色变化，避免盘中颜色反复变化造成误操作。</li>
            <li><strong>坚持分批操作：</strong>根据三个参考价位分批执行，不要因为一次信号就把全部资金一次性买入或卖出。</li>
            <li><strong>不盲目追价：</strong>市场价格未到参考价位时，不必为了成交而追涨杀跌；参考价位也不保证一定能够成交。</li>
            <li><strong>控制仓位：</strong>提前规划单笔投入、总仓位和可承受亏损，保留必要的备用资金，避免满仓操作。</li>
            <li><strong>遵守交易规则：</strong>结合标的流动性、买卖价差、交易费用及自身持仓情况执行，不因情绪或短期消息随意改变计划。</li>
            <li><strong>做好交易记录：</strong>记录信号、参考价位、实际成交价及交易结果，定期复盘，不要因一两次盈亏就随意改变方法。</li>
          </ul>
        </div>
      </section>

      <!-- 四、免责声明 -->
      <section id="disclaimer" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden scroll-mt-5">
        <div class="bg-slate-800 px-5 sm:px-6 py-4">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-shield-halved"></i> 风险提示与免责声明
          </h2>
        </div>
        <div class="p-5 sm:p-6 space-y-3 text-sm text-slate-700 leading-relaxed">
          <p>
            波幅探长提供的图表、ATR 中间线颜色变化及相关价位，仅用于行情观察、技术分析和信息参考，
            不构成任何证券、基金或其他金融产品的投资建议、买卖推荐或收益承诺。
          </p>
          <p>
            金融市场存在价格波动、流动性不足、跳空、滑点及本金损失等风险。
            历史数据和技术指标不代表未来表现，任何指标或交易方法都可能出现滞后、失效或连续错误信号。
            参考价位不保证能够成交，也不保证交易结果。
          </p>
          <p>
            投资者应结合自身投资目标、风险承受能力及实际情况独立判断并自主决策。
            因使用本站图表、指标信号或据此进行交易而产生的任何盈亏，均由投资者自行承担。
          </p>
          <div class="pt-2 text-center">
            <a href="#/sponsor"
              class="inline-block theme-bg text-white text-xs font-bold px-5 py-2.5 rounded-lg no-underline">
              前往定制标的
            </a>
          </div>
        </div>
      </section>
    </div>
  `,
};
