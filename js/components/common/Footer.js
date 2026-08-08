/**
 * 波幅探长 - 页脚与社交平台图标
 * js/components/common/Footer.js
 * 桌面：悬停显示「平台名 账号」；手机：图标后直接显示账号
 */
import { store } from "../../store.js";

const { computed } = Vue;

const PLATFORM_META = [
  { key: "social_douyin", label: "抖音", icon: "fa-brands fa-tiktok", color: "hover:text-slate-800" },
  { key: "social_shipinhao", label: "视频号", icon: "fa-brands fa-weixin", color: "hover:text-[#07C160]" },
  { key: "social_xiaohongshu", label: "小红书", icon: "fa-solid fa-book", color: "hover:text-[#FE2C55]" },
  { key: "social_gongzhonghao", label: "公众号", icon: "fa-solid fa-comment-dots", color: "hover:text-[#07C160]" },
  { key: "social_kuaishou", label: "快手", icon: "fa-solid fa-video", color: "hover:text-[#FF4906]" },
];

export default {
  name: "Footer",
  setup() {
    const socialItems = computed(() => {
      const s = store.state.publicSettings || {};
      return PLATFORM_META.map((p) => {
        const raw = (s[p.key] || "").trim();
        if (!raw) return null;
        // 没有 @ 时自动补上，方便统一展示
        const handle = raw.startsWith("@") ? raw : `@${raw}`;
        return { ...p, handle };
      }).filter(Boolean);
    });

    return {
      socialItems,
    };
  },
  template: `
    <footer class="mt-10 pt-5 pb-5 border-t border-slate-200/80 text-center text-xs text-slate-500 shrink-0 select-none">
      <div class="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <img src="logo.png" alt="Logo" class="w-5 h-5 rounded object-cover" onerror="this.style.display='none'">
          <span>© 2026 波幅探长 · 专业的波幅监控与数据分析平台</span>
        </div>

        <div v-if="socialItems.length" class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-slate-400">
          <div
            v-for="item in socialItems"
            :key="item.key"
            class="group relative flex items-center gap-1.5 cursor-default transition-colors"
            :class="item.color"
          >
            <i :class="item.icon + ' text-lg'"></i>
            <!-- 手机端：图标后常显账号 -->
            <span class="text-[11px] text-slate-500 sm:hidden">{{ item.handle }}</span>
            <!-- 桌面端：悬停气泡 -->
            <div
              class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden sm:group-hover:block
                     whitespace-nowrap rounded-md bg-slate-800 text-white text-[11px] px-2.5 py-1.5 shadow-lg z-20"
            >
              {{ item.label }} {{ item.handle }}
              <span class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  `,
};
