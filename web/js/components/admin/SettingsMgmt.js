/**
 * 波幅探长 - 后台系统设置 (v5.0)
 * - 已移除：注册赠送天数、邀请码位数与邀请返利配置
 * - 保留：优惠码管理、看板免费TOP N、收款码、赞助定价、打赏设置、弹窗广告、发布平台
 */
import { store } from "../../store.js";
import { adminApi } from "../../api/admin.js";
import PromoMgmt from "./PromoMgmt.js";

const { ref, reactive, onMounted } = Vue;

const DEFAULT_PLATFORMS = [
  { key: "douyin", label: "抖音", icon: "fa-brands fa-tiktok", handle: "" },
  { key: "shipinhao", label: "视频号", icon: "fa-brands fa-weixin", handle: "" },
  { key: "xiaohongshu", label: "小红书", icon: "fa-solid fa-book", handle: "" },
  { key: "gongzhonghao", label: "公众号", icon: "fa-solid fa-comment-dots", handle: "" },
  { key: "kuaishou", label: "快手", icon: "fa-solid fa-video", handle: "" },
];

export default {
  name: "SettingsMgmt",
  components: { PromoMgmt },
  setup() {
    const loading = ref(false);
    const saving = ref(false);

    const form = reactive({
      free_top_n_charts: "3",
      promo_enabled: "1",
      alipay_qr_url: "",
      wechat_qr_url: "",
      default_pay_channel: "wechat",
      symbol_prices:
        '[{"days":30,"price":30,"label":"1个月"},{"days":90,"price":88,"label":"季度"},{"days":180,"price":168,"label":"半年"},{"days":365,"price":328,"label":"全年"}]',

      // 打赏
      tip_enabled: "1",
      tip_wechat_qr_url: "",
      tip_alipay_qr_url: "",
      tip_note: "本站注册即免费开放全量数据与图表 · 您的打赏支持将直接用于服务器与算力维护",

      // 弹窗广告
      ad_enabled: "0",
      ad_title: "",
      ad_content: "",
      ad_image_url: "",
      ad_link_url: "",
      ad_start_at: "",
      ad_end_at: "",
      ad_frequency: "daily",

      social_douyin: "",
      social_shipinhao: "",
      social_xiaohongshu: "",
      social_gongzhonghao: "",
      social_kuaishou: "",
    });

    const platforms = ref(DEFAULT_PLATFORMS.map((p) => ({ ...p })));

    const loadSettings = async () => {
      loading.value = true;
      try {
        const res = await adminApi.fetchSettings();
        const data = res.data || res || {};
        Object.keys(form).forEach((k) => {
          if (data[k] != null && data[k] !== undefined) {
            form[k] = String(data[k]);
          }
        });

        let loaded = null;
        if (data.social_platforms) {
          try {
            const arr =
              typeof data.social_platforms === "string"
                ? JSON.parse(data.social_platforms)
                : data.social_platforms;
            if (Array.isArray(arr) && arr.length) loaded = arr;
          } catch (_) {}
        }
        if (loaded) {
          platforms.value = loaded.map((p, i) => ({
            key: p.key || `p${i}`,
            label: p.label || p.key || `平台${i + 1}`,
            icon: p.icon || "fa-solid fa-link",
            handle: String(p.handle || "").replace(/^@/, ""),
          }));
        } else {
          platforms.value = DEFAULT_PLATFORMS.map((p) => {
            const legacyKey = `social_${p.key}`;
            let handle = String(data[legacyKey] || form[legacyKey] || "").trim();
            handle = handle.replace(/^@/, "");
            return { ...p, handle };
          });
        }
      } catch (err) {
        store.showToast(err.message || "加载失败", "error");
      } finally {
        loading.value = false;
      }
    };

    const addPlatform = () => {
      platforms.value.push({
        key: `p${Date.now()}`,
        label: "新平台",
        icon: "fa-solid fa-link",
        handle: "",
      });
    };

    const removePlatform = (idx) => {
      platforms.value.splice(idx, 1);
    };

    const saveSettings = async () => {
      saving.value = true;
      try {
        const mapLegacy = {
          douyin: "social_douyin",
          shipinhao: "social_shipinhao",
          xiaohongshu: "social_xiaohongshu",
          gongzhonghao: "social_gongzhonghao",
          kuaishou: "social_kuaishou",
        };
        Object.values(mapLegacy).forEach((k) => {
          form[k] = "";
        });
        platforms.value.forEach((p) => {
          const leg = mapLegacy[p.key];
          if (leg) form[leg] = p.handle || "";
        });

        const social_platforms = JSON.stringify(
          platforms.value
            .filter((p) => p.label || p.handle)
            .map((p) => ({
              key: p.key,
              label: p.label,
              icon: p.icon || "fa-solid fa-link",
              handle: p.handle ? (p.handle.startsWith("@") ? p.handle : `@${p.handle}`) : "",
            }))
        );

        const payload = { ...form, social_platforms };
        await adminApi.saveSettings(payload);
        store.showToast("设置已保存");
        if (store.loadPublicSettings) await store.loadPublicSettings();
      } catch (err) {
        store.showToast(err.message || "保存失败", "error");
      } finally {
        saving.value = false;
      }
    };

    onMounted(loadSettings);

    return {
      form,
      platforms,
      loading,
      saving,
      loadSettings,
      saveSettings,
      addPlatform,
      removePlatform,
    };
  },
  template: `
    <div class="space-y-5 max-w-4xl select-none">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-bold text-slate-800 tracking-tight">系统设置</h2>
          <p class="text-[11px] text-slate-400 mt-0.5">优惠码 → 看板配置 → 支付收款码 → 赞助定价 → 打赏支持 → 广告 → 社交平台</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button @click="loadSettings" class="text-xs text-slate-500 px-3 py-1.5 rounded-lg border hover:bg-slate-50">刷新</button>
          <button @click="saveSettings" :disabled="saving"
                  class="text-xs theme-bg text-white px-4 py-1.5 rounded-lg font-bold disabled:opacity-50">
            {{ saving ? '保存中...' : '保存全部' }}
          </button>
        </div>
      </div>

      <div v-if="loading" class="text-center py-10 text-slate-400 text-sm">
        <i class="fa-solid fa-spinner animate-spin mr-2"></i>加载中...
      </div>

      <template v-else>
        <!-- 1. 优惠码管理 -->
        <section class="bg-white rounded-xl border border-slate-100 p-5 space-y-3 shadow-sm">
          <div class="flex items-center justify-between border-b pb-2">
            <h3 class="font-bold text-slate-700 text-sm">优惠码（用于会员赞助标的支付折扣）</h3>
            <label class="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" :checked="form.promo_enabled !== '0'"
                     @change="form.promo_enabled = $event.target.checked ? '1' : '0'">
              启用优惠码功能
            </label>
          </div>
          <PromoMgmt />
        </section>

        <!-- 2. 数据看板基础设置 -->
        <section class="bg-white rounded-xl border border-slate-100 p-5 space-y-4 shadow-sm">
          <h3 class="font-bold text-slate-700 text-sm border-b pb-2">数据看板设置</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label class="text-xs space-y-1.5 block">
              <span class="text-slate-500">未登录访客可免费查看图表 TOP N（注册登录后全量免费）</span>
              <input v-model="form.free_top_n_charts" type="number" min="0" class="w-full border rounded-lg px-3 py-2 text-sm">
            </label>
          </div>
        </section>

        <!-- 3. 收款码（赞助与打赏共用） -->
        <section class="bg-white rounded-xl border border-slate-100 p-5 space-y-4 shadow-sm">
          <h3 class="font-bold text-slate-700 text-sm border-b pb-2">收款码（赞助标的与自由打赏共用）</h3>
          <p class="text-[11px] text-slate-400">微信 / 支付宝收款码图片直链，前台「赞助标的」与「看板打赏」共用。</p>
          <label class="text-xs space-y-1 block">
            <span class="text-slate-500">默认支付渠道</span>
            <select v-model="form.default_pay_channel" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="wechat">微信</option>
              <option value="alipay">支付宝</option>
            </select>
          </label>
          <label class="text-xs space-y-1 block">
            <span class="text-slate-500">微信收款码（图片直链，如 .jpg / .png）</span>
            <input v-model="form.wechat_qr_url" type="text" class="w-full border rounded-lg px-3 py-2 text-sm font-mono">
          </label>
          <label class="text-xs space-y-1 block">
            <span class="text-slate-500">支付宝收款码（图片直链，如 .jpg / .png）</span>
            <input v-model="form.alipay_qr_url" type="text" class="w-full border rounded-lg px-3 py-2 text-sm font-mono">
          </label>
        </section>

        <!-- 4. 赞助标的定价 -->
        <section class="bg-white rounded-xl border border-slate-100 p-5 space-y-4 shadow-sm">
          <h3 class="font-bold text-slate-700 text-sm border-b pb-2">赞助标的定价</h3>
          <p class="text-[11px] text-slate-400">JSON 数组：days / price / label。前台「赞助标的」页按此计费。</p>
          <label class="text-xs space-y-1.5 block">
            <span class="text-slate-500">symbol_prices JSON</span>
            <textarea v-model="form.symbol_prices" rows="4" class="w-full border rounded-lg px-3 py-2 text-xs font-mono"></textarea>
          </label>
        </section>

        <!-- 5. 看板底部醒目打赏 -->
        <section class="bg-white rounded-xl border border-slate-100 p-5 space-y-4 shadow-sm">
          <h3 class="font-bold text-slate-700 text-sm border-b pb-2">看板底部打赏支持</h3>
          <label class="inline-flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" :checked="form.tip_enabled !== '0'"
                   @change="form.tip_enabled = $event.target.checked ? '1' : '0'">
            开启数据看板底部醒目打赏横幅（支持访客/会员自由输入金额打赏）
          </label>
          <label class="text-xs space-y-1 block">
            <span class="text-slate-500">打赏引导标题文案</span>
            <input v-model="form.tip_note" type="text" class="w-full border rounded-lg px-3 py-2 text-sm">
          </label>
        </section>

        <!-- 6. 弹窗广告 -->
        <section class="bg-white rounded-xl border border-slate-100 p-5 space-y-4 shadow-sm">
          <h3 class="font-bold text-slate-700 text-sm border-b pb-2">弹窗广告</h3>
          <label class="inline-flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" :checked="form.ad_enabled==='1'"
                   @change="form.ad_enabled = $event.target.checked ? '1' : '0'">
            启用弹窗广告
          </label>
          <label class="text-xs space-y-1 block">
            <span class="text-slate-500">标题</span>
            <input v-model="form.ad_title" type="text" class="w-full border rounded-lg px-3 py-2 text-sm">
          </label>
          <label class="text-xs space-y-1 block">
            <span class="text-slate-500">正文</span>
            <textarea v-model="form.ad_content" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm"></textarea>
          </label>
          <label class="text-xs space-y-1 block">
            <span class="text-slate-500">图片 URL（可选）</span>
            <input v-model="form.ad_image_url" type="text" class="w-full border rounded-lg px-3 py-2 text-sm font-mono">
          </label>
          <label class="text-xs space-y-1 block">
            <span class="text-slate-500">跳转链接（可选）</span>
            <input v-model="form.ad_link_url" type="text" class="w-full border rounded-lg px-3 py-2 text-sm font-mono">
          </label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="text-xs space-y-1">
              <span class="text-slate-500">开始时间（时间戳 ms 或空）</span>
              <input v-model="form.ad_start_at" type="text" placeholder="留空=立即" class="w-full border rounded-lg px-3 py-2 text-sm font-mono">
            </label>
            <label class="text-xs space-y-1">
              <span class="text-slate-500">结束时间（时间戳 ms 或空）</span>
              <input v-model="form.ad_end_at" type="text" placeholder="留空=不限" class="w-full border rounded-lg px-3 py-2 text-sm font-mono">
            </label>
          </div>
          <label class="text-xs space-y-1 block">
            <span class="text-slate-500">展示频率</span>
            <select v-model="form.ad_frequency" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="once">仅一次（关闭后本机不再弹）</option>
              <option value="daily">每天一次</option>
              <option value="always">每次访问（同会话关后不重复）</option>
            </select>
          </label>
        </section>

        <!-- 7. 发布平台 -->
        <section class="bg-white rounded-xl border border-slate-100 p-5 space-y-4 shadow-sm">
          <div class="flex items-center justify-between border-b pb-2">
            <h3 class="font-bold text-slate-700 text-sm">发布平台（Footer 展示）</h3>
            <button type="button" @click="addPlatform" class="text-xs theme-text font-bold">+ 添加平台</button>
          </div>
          <div class="space-y-3">
            <div v-for="(p, idx) in platforms" :key="p.key + idx"
                 class="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end border border-slate-100 rounded-lg p-3">
              <label class="text-xs space-y-1 sm:col-span-3">
                <span class="text-slate-500">显示名称</span>
                <input v-model="p.label" type="text" class="w-full border rounded-lg px-2 py-1.5 text-sm">
              </label>
              <label class="text-xs space-y-1 sm:col-span-4">
                <span class="text-slate-500">图标 class（Font Awesome）</span>
                <input v-model="p.icon" type="text" placeholder="fa-brands fa-tiktok" class="w-full border rounded-lg px-2 py-1.5 text-sm font-mono">
              </label>
              <label class="text-xs space-y-1 sm:col-span-4">
                <span class="text-slate-500">账号</span>
                <input v-model="p.handle" type="text" placeholder="波幅探长" class="w-full border rounded-lg px-2 py-1.5 text-sm">
              </label>
              <button type="button" @click="removePlatform(idx)"
                      class="sm:col-span-1 text-slate-400 hover:text-red-500 text-sm py-2">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        </section>

        <div class="flex justify-end pb-8">
          <button @click="saveSettings" :disabled="saving"
                  class="theme-bg text-white px-6 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 shadow-sm">
            {{ saving ? '保存中...' : '保存全部设置' }}
          </button>
        </div>
      </template>
    </div>
  `,
};
