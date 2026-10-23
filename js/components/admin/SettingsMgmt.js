/**
 * 波幅探长 - 后台系统设置
 * 包含：优惠码管理、看板免费TOP N、收款码、定制标的定价、打赏设置、首页搜索框上方优惠活动文字提醒广告
 */
import { store } from "../../store.js";
import { adminApi } from "../../api/admin.js";
import PromoMgmt from "./PromoMgmt.js";

const { ref, reactive, onMounted } = Vue;

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

      // 首页搜索框上方优惠活动文字提醒广告
      ad_enabled: "0",
      ad_content: "",
      ad_link_url: "",
    });

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
        if (!form.ad_content && data.ad_title) {
          form.ad_content = String(data.ad_title);
        }
      } catch (err) {
        store.showToast(err.message || "加载失败", "error");
      } finally {
        loading.value = false;
      }
    };

    const saveSettings = async () => {
      saving.value = true;
      try {
        await adminApi.saveSettings({ ...form });
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
      loading,
      saving,
      loadSettings,
      saveSettings,
    };
  },
  template: `
    <div class="space-y-5 max-w-4xl select-none">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-bold text-slate-800 tracking-tight">系统设置</h2>
          <p class="text-[11px] text-slate-400 mt-0.5">优惠码 → 首页优惠文字提醒广告 → 看板配置 → 支付收款码 → 定制标的定价 → 打赏支持</p>
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
            <h3 class="font-bold text-slate-700 text-sm">优惠码（用于会员定制标的支付折扣）</h3>
            <label class="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" :checked="form.promo_enabled !== '0'"
                     @change="form.promo_enabled = $event.target.checked ? '1' : '0'">
              启用优惠码功能
            </label>
          </div>
          <PromoMgmt />
        </section>

        <!-- 2. 首页优惠活动文字提醒广告（搜索框上方展示） -->
        <section class="bg-white rounded-xl border border-slate-100 p-5 space-y-4 shadow-sm">
          <div class="flex items-center justify-between border-b pb-2">
            <div>
              <h3 class="font-bold text-slate-700 text-sm">优惠活动文字广告（首页搜索框上方展示）</h3>
              <p class="text-[11px] text-slate-400 mt-0.5">开启后，将在前台首页「搜索代码 / 名称...」输入框正上方展示优惠活动文字提醒</p>
            </div>
            <label class="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input type="checkbox" :checked="form.ad_enabled==='1'"
                     @change="form.ad_enabled = $event.target.checked ? '1' : '0'">
              开启展示
            </label>
          </div>
          <label class="text-xs space-y-1.5 block">
            <span class="text-slate-500">优惠活动提醒文字（例如：新年优惠，纵享七折！定制标的输入优惠码 VIP70 即可抵扣）</span>
            <input v-model="form.ad_content" type="text" placeholder="例如：🎉 新年优惠，纵享七折！定制标的结账输入优惠码 VIP70 立享 7 折优惠"
                   class="w-full border rounded-lg px-3 py-2 text-sm focus:theme-border outline-none">
          </label>
          <label class="text-xs space-y-1.5 block">
            <span class="text-slate-500">点击跳转链接（选填，例如填 #/sponsor 点击可直达「定制标的」页，留空则纯文字展示）</span>
            <input v-model="form.ad_link_url" type="text" placeholder="#/sponsor"
                   class="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:theme-border outline-none">
          </label>
        </section>

        <!-- 3. 数据看板基础设置 -->
        <section class="bg-white rounded-xl border border-slate-100 p-5 space-y-4 shadow-sm">
          <h3 class="font-bold text-slate-700 text-sm border-b pb-2">数据看板设置</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label class="text-xs space-y-1.5 block">
              <span class="text-slate-500">未登录访客可免费查看图表 TOP N（注册登录后全量免费）</span>
              <input v-model="form.free_top_n_charts" type="number" min="0" class="w-full border rounded-lg px-3 py-2 text-sm">
            </label>
          </div>
        </section>

        <!-- 4. 收款码（定制与打赏共用） -->
        <section class="bg-white rounded-xl border border-slate-100 p-5 space-y-4 shadow-sm">
          <h3 class="font-bold text-slate-700 text-sm border-b pb-2">收款码（定制标的与自由打赏共用）</h3>
          <p class="text-[11px] text-slate-400">微信 / 支付宝收款码图片直链，前台「定制标的」与「看板打赏」共用。</p>
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

        <!-- 5. 定制标的定价 -->
        <section class="bg-white rounded-xl border border-slate-100 p-5 space-y-4 shadow-sm">
          <h3 class="font-bold text-slate-700 text-sm border-b pb-2">定制标的定价</h3>
          <p class="text-[11px] text-slate-400">JSON 数组：days / price / label。前台「定制标的」页按此计费。</p>
          <label class="text-xs space-y-1.5 block">
            <span class="text-slate-500">symbol_prices JSON</span>
            <textarea v-model="form.symbol_prices" rows="4" class="w-full border rounded-lg px-3 py-2 text-xs font-mono"></textarea>
          </label>
        </section>

        <!-- 6. 看板底部醒目打赏 -->
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
