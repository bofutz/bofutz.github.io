/**
 * 波幅探长 - 页脚与社交二维码组件
 * js/components/common/Footer.js
 */
import { store } from "../../store.js";

export default {
  name: "Footer",
  setup() {
    const getQrUrl = (link) => {
      if (!link) return "";
      return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(link.trim())}`;
    };

    return {
      settings: store.state.publicSettings,
      getQrUrl,
    };
  },
  template: `
    <footer class="mt-10 pt-5 pb-5 border-t border-slate-200/80 text-center text-xs text-slate-500 shrink-0 select-none">
      <div class="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <img src="logo.png" alt="Logo" class="w-5 h-5 rounded object-cover" onerror="this.style.display='none'">
          <span>© 2026 波幅探长 · 专业的波幅监控与数据分析平台</span>
        </div>

        <div class="flex items-center gap-4 text-slate-400">
          <a v-if="settings.social_douyin" :href="settings.social_douyin" target="_blank" rel="noopener" class="social-item hover:text-slate-700 transition-colors" title="抖音">
            <i class="fa-brands fa-tiktok text-lg"></i>
            <div class="social-qr-pop">
              <img :src="getQrUrl(settings.social_douyin)" alt="抖音二维码">
              <p class="text-[10px] text-slate-500 mt-1 text-center">扫码关注抖音</p>
            </div>
          </a>

          <a v-if="settings.social_shipinhao" :href="settings.social_shipinhao" target="_blank" rel="noopener" class="social-item hover:text-[#07C160] transition-colors" title="视频号">
            <i class="fa-brands fa-weixin text-lg"></i>
            <div class="social-qr-pop">
              <img :src="getQrUrl(settings.social_shipinhao)" alt="视频号二维码">
              <p class="text-[10px] text-slate-500 mt-1 text-center">扫码关注视频号</p>
            </div>
          </a>

          <a v-if="settings.social_xiaohongshu" :href="settings.social_xiaohongshu" target="_blank" rel="noopener" class="social-item hover:text-[#FE2C55] transition-colors" title="小红书">
            <i class="fa-solid fa-book text-lg"></i>
            <div class="social-qr-pop">
              <img :src="getQrUrl(settings.social_xiaohongshu)" alt="小红书二维码">
              <p class="text-[10px] text-slate-500 mt-1 text-center">扫码关注小红书</p>
            </div>
          </a>

          <a v-if="settings.social_gongzhonghao" :href="settings.social_gongzhonghao" target="_blank" rel="noopener" class="social-item hover:text-[#07C160] transition-colors" title="公众号">
            <i class="fa-solid fa-comment-dots text-lg"></i>
            <div class="social-qr-pop">
              <img :src="getQrUrl(settings.social_gongzhonghao)" alt="公众号二维码">
              <p class="text-[10px] text-slate-500 mt-1 text-center">扫码关注公众号</p>
            </div>
          </a>

          <a v-if="settings.social_kuaishou" :href="settings.social_kuaishou" target="_blank" rel="noopener" class="social-item hover:text-[#FF4906] transition-colors" title="快手">
            <i class="fa-solid fa-video text-lg"></i>
            <div class="social-qr-pop">
              <img :src="getQrUrl(settings.social_kuaishou)" alt="快手二维码">
              <p class="text-[10px] text-slate-500 mt-1 text-center">扫码关注快手</p>
            </div>
          </a>
        </div>
      </div>
    </footer>
  `,
};
