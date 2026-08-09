/**
 * 波幅探长 - 弹窗广告（整合版）
 * 读取 publicSettings：
 *   ad_enabled, ad_title, ad_content, ad_image_url, ad_link_url,
 *   ad_start_at, ad_end_at, ad_frequency (once | daily | always)
 * 频率写入 localStorage（CONFIG.STORAGE_KEYS.AD_LAST_SHOWN）
 *
 * 使用：在 index.html 根模板挂载 <ads-popup />
 * js/components/common/AdsPopup.js
 */
import { store } from "../../store.js";
import { CONFIG } from "../../config.js";

const { ref, computed, onMounted, watch } = Vue;

function settingOn(val) {
  return val === "1" || val === 1 || val === true || val === "true";
}

function parseTs(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!isNaN(n) && n > 0) return n < 1e12 ? n * 1000 : n;
  const d = Date.parse(String(v));
  return isNaN(d) ? null : d;
}

function sameDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export default {
  name: "AdsPopup",
  setup() {
    const visible = ref(false);
    const closedThisSession = ref(false);

    const settings = computed(() => store.state.publicSettings || {});

    const adPayload = computed(() => {
      const s = settings.value;
      return {
        enabled: settingOn(s.ad_enabled),
        title: String(s.ad_title || "").trim(),
        content: String(s.ad_content || "").trim(),
        imageUrl: String(s.ad_image_url || "").trim(),
        linkUrl: String(s.ad_link_url || "").trim(),
        startAt: parseTs(s.ad_start_at),
        endAt: parseTs(s.ad_end_at),
        frequency: String(s.ad_frequency || "daily").toLowerCase(),
      };
    });

    const hasContent = computed(() => {
      const a = adPayload.value;
      return !!(a.title || a.content || a.imageUrl);
    });

    const withinSchedule = computed(() => {
      const a = adPayload.value;
      const now = Date.now();
      if (a.startAt && now < a.startAt) return false;
      if (a.endAt && now > a.endAt) return false;
      return true;
    });

    const storageKey = () =>
      CONFIG.STORAGE_KEYS?.AD_LAST_SHOWN || "etf_ad_last_shown";

    const shouldShowByFrequency = () => {
      const freq = adPayload.value.frequency;
      if (freq === "always") return true;
      try {
        const raw = localStorage.getItem(storageKey());
        if (!raw) return true;
        const last = parseInt(raw, 10);
        if (isNaN(last)) return true;
        if (freq === "once") return false;
        // daily
        return !sameDay(last, Date.now());
      } catch {
        return true;
      }
    };

    const tryOpen = () => {
      if (closedThisSession.value) return;
      if (!store.state.publicSettingsLoaded && !adPayload.value.enabled) {
        // 设置尚未加载时不弹；加载后再 watch
        return;
      }
      const a = adPayload.value;
      if (!a.enabled || !hasContent.value || !withinSchedule.value) return;
      if (!shouldShowByFrequency()) return;
      visible.value = true;
    };

    const markShown = () => {
      try {
        localStorage.setItem(storageKey(), String(Date.now()));
      } catch (_) {}
    };

    const close = () => {
      visible.value = false;
      closedThisSession.value = true;
      markShown();
    };

    const onCta = () => {
      const url = adPayload.value.linkUrl;
      markShown();
      visible.value = false;
      closedThisSession.value = true;
      if (url) {
        try {
          window.open(url, "_blank", "noopener,noreferrer");
        } catch {
          window.location.href = url;
        }
      }
    };

    onMounted(() => {
      // 稍延后，避免挡首屏加载
      setTimeout(tryOpen, 800);
    });

    watch(
      () => store.state.publicSettingsLoaded,
      (loaded) => {
        if (loaded) setTimeout(tryOpen, 300);
      }
    );

    return {
      visible,
      adPayload,
      close,
      onCta,
    };
  },
  template: `
    <div v-if="visible"
         class="fixed inset-0 z-[200] flex items-center justify-center p-4 modal-overlay"
         @click.self="close">
      <div class="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative">
        <button type="button" @click="close"
                class="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 text-slate-500 flex items-center justify-center"
                aria-label="关闭">
          <i class="fa-solid fa-xmark"></i>
        </button>

        <div v-if="adPayload.imageUrl" class="w-full bg-slate-50 max-h-48 overflow-hidden">
          <img :src="adPayload.imageUrl" alt="" class="w-full h-48 object-cover" @error="$event.target.style.display='none'">
        </div>

        <div class="p-5 sm:p-6 space-y-3 text-center">
          <h3 v-if="adPayload.title" class="text-lg font-bold text-slate-800 leading-snug">
            {{ adPayload.title }}
          </h3>
          <p v-if="adPayload.content" class="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
            {{ adPayload.content }}
          </p>

          <div class="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
            <button v-if="adPayload.linkUrl" type="button" @click="onCta"
                    class="theme-bg text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:opacity-90">
              查看详情
            </button>
            <button type="button" @click="close"
                    class="px-5 py-2.5 rounded-lg text-sm text-slate-500 bg-slate-50 hover:bg-slate-100">
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
};
