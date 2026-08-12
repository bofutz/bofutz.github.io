/**
 * 波幅探长 - 页脚（整合版）
 * - 电脑：图标 + 悬停显示「平台@账号」
 * - 手机：仅图标（或小标签），避免「@波幅探长」挤成一排难看
 * - 优先 social_platforms JSON；否则回退旧五字段
 * js/components/common/Footer.js
 */
import { store } from "../../store.js";

// 修复：改用 window.Vue
const { computed } = window.Vue;

export default {
  name: "Footer",
  setup() {
    const platforms = computed(() => {
      try {
        return store.getSocialPlatforms ? store.getSocialPlatforms() : [];
      // 修复：补充 err 绑定，防止严格 linter 报错
      } catch (err) {
        return [];
      }
    });

    /** 展示用 handle：保证有 @ 前缀 */
    const displayHandle = (h) => {
      const s = String(h || "").trim();
      if (!s) return "";
      return s.startsWith("@") ? s : `@${s}`;
    };

    return {
      platforms,
      displayHandle,
    };
  },
  template: `
    <footer class="mt-auto border-t border-slate-100 bg-white">
      <div class="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

          <div class="text-center sm:text-left">
            <div class="text-sm font-bold text-slate-700">波幅探长</div>
            <p class="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              ETF 波幅监控 · 图表与票选工具
            </p>
          </div>

          <!-- 社交：手机仅图标；md 及以上悬停显示账号 -->
          <div v-if="platforms.length" class="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <div
              v-for="p in platforms"
              :key="p.key || p.label"
              class="group relative"
              :title="p.label + ' ' + displayHandle(p.handle)"
            >
              <!-- 图标按钮 -->
              <span
                class="inline-flex items-center justify-center w-9 h-9 sm:w-auto sm:h-auto sm:px-2.5 sm:py-1.5
                       rounded-full sm:rounded-lg bg-slate-50 border border-slate-100
                       text-slate-500 hover:theme-text hover:border-[#4da6a0]/30 transition-colors cursor-default"
              >
                <i :class="p.icon || 'fa-solid fa-link'" class="text-sm"></i>
                <!-- 仅桌面显示平台名，不塞 @账号 -->
                <span class="hidden sm:inline text-xs font-medium ml-1.5 text-slate-600 group-hover:theme-text">
                  {{ p.label }}
                </span>
              </span>

              <!-- 桌面悬停气泡：平台@账号 -->
              <span
                class="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5
                       hidden md:group-hover:block z-20 whitespace-nowrap
                       bg-slate-800 text-white text-[11px] px-2.5 py-1 rounded-md shadow-lg"
              >
                {{ p.label }}{{ displayHandle(p.handle) }}
                <span class="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0
                             border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800"></span>
              </span>
            </div>
          </div>
        </div>

        <div class="mt-5 pt-4 border-t border-slate-50 text-center text-[11px] text-slate-400">
          © {{ new Date().getFullYear() }} 波幅探长 · 数据仅供参考，不构成投资建议
        </div>
      </div>
    </footer>
  `,
};
