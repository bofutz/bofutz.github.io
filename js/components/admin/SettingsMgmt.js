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
    const chartHealth = ref(null);

    const form = reactive({
      free_top_n_charts: "3",
      free_trial_days: "7",
      chart_price_30: "8.8",
      chart_price_90: "26.8",
      chart_price_180: "48.8",
      chart_price_365: "88.8",
      chart_retention_days: "7",
      chart_interval_half_day: "0",
      chart_interval_daily: "1",
      chart_interval_weekly: "1",
      symbol_price_30: "30",
      symbol_price_90: "88",
      symbol_price_180: "168",
      symbol_price_365: "328",
      promo_enabled: "1",
      alipay_qr_url: "",
      wechat_qr_url: "",
      default_pay_channel: "wechat",
      // 定制标的价格在界面使用独立输入框，保存时统一映射回 symbol_prices。

      // 打赏
      tip_enabled: "0",
      tip_wechat_qr_url: "",
      tip_alipay_qr_url: "",
      tip_note: "注册赠送 7 天全站图表体验 · 您的支持将用于服务器与算力维护",

      // 首页搜索框上方优惠活动文字提醒广告
      ad_enabled: "0",
      ad_content: "",
      ad_link_url: "",
    });

    const loadSettings = async () => {
      loading.value = true;
      try {
        const [res, healthRes] = await Promise.all([adminApi.fetchSettings(), adminApi.fetchChartHealth().catch(() => null)]);
        chartHealth.value = healthRes?.data || null;
        const data = res.data || res || {};
        Object.keys(form).forEach((k) => {
          if (data[k] != null && data[k] !== undefined) {
            form[k] = String(data[k]);
          }
        });
        if (data.symbol_prices) {
          try {
            const prices = JSON.parse(data.symbol_prices);
            const byDays = Object.fromEntries((Array.isArray(prices) ? prices : []).map(x => [Number(x.days), x.price]));
            [30,90,180,365].forEach(days => { if (byDays[days] != null) form[`symbol_price_${days}`] = String(byDays[days]); });
          } catch (_) {}
        }
        if (!form.ad_content && data.ad_title) form.ad_content = String(data.ad_title);
      } catch (err) {
        store.showToast(err.message || "加载失败", "error");
      } finally {
        loading.value = false;
      }
    };

    const saveSettings = async () => {
      if (![form.chart_interval_half_day, form.chart_interval_daily, form.chart_interval_weekly].includes("1")) {
        store.showToast("半日线、日线、周线至少启用一个采集周期", "error");
        return;
      }
      saving.value = true;
      try {
        const payload = { ...form };
        payload.symbol_prices = JSON.stringify([
          { days: 30, price: Number(form.symbol_price_30), label: "1个月" },
          { days: 90, price: Number(form.symbol_price_90), label: "季度" },
          { days: 180, price: Number(form.symbol_price_180), label: "半年" },
          { days: 365, price: Number(form.symbol_price_365), label: "全年" },
        ]);
        [30,90,180,365].forEach(days => delete payload[`symbol_price_${days}`]);
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
      chartHealth,
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

        <section class="bg-white rounded-xl border border-slate-100 p-5 space-y-2 shadow-sm">
          <div class="flex items-center justify-between gap-3"><h3 class="font-bold text-slate-700 text-sm">图表采集健康状态</h3><button @click="loadSettings" class="text-xs text-slate-500 underline">刷新状态</button></div>
          <div v-if="chartHealth" class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div><div class="text-slate-400">最近成功更新</div><div class="font-bold text-slate-700 mt-1">{{new Date(chartHealth.created_at).toLocaleString('zh-CN')}}</div></div>
            <div><div class="text-slate-400">映射图表数量</div><div class="font-bold text-slate-700 mt-1">{{chartHealth.mapped_count || 0}}</div></div>
            <div><div class="text-slate-400">受保护标的</div><div class="font-bold text-slate-700 mt-1">{{chartHealth.protected_count || 0}}</div></div>
            <div><div class="text-slate-400">状态</div><div class="font-bold text-emerald-600 mt-1">{{chartHealth.status === 'success' ? '最近一次成功' : chartHealth.status}}</div></div>
          </div>
          <p v-else class="text-xs text-slate-400">尚无成功的图表映射记录。采集工作流完成后，这里会显示最近一次成功更新时间和映射数量。</p>
        </section>

        <!-- 3. 会员与图表采集设置 -->
        <section class="bg-white rounded-xl border border-slate-100 p-5 space-y-4 shadow-sm">
          <h3 class="font-bold text-slate-700 text-sm border-b pb-2">会员权益与图表采集</h3>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label class="text-xs space-y-1.5 block"><span class="text-slate-500">注册免费体验（天）</span><input v-model="form.free_trial_days" type="number" min="0" max="90" class="w-full border rounded-lg px-3 py-2"></label>
            <label class="text-xs space-y-1.5 block"><span class="text-slate-500">游客免费图表 TOP N</span><input v-model="form.free_top_n_charts" type="number" min="0" max="500" class="w-full border rounded-lg px-3 py-2"></label>
            <label class="text-xs space-y-1.5 block"><span class="text-slate-500">定制标的到期保留（天）</span><input v-model="form.chart_retention_days" type="number" min="0" max="90" class="w-full border rounded-lg px-3 py-2"></label>
          </div>
          <div class="border-t pt-3 space-y-2">
            <div class="text-xs font-bold text-slate-700">全站图表会员价格（元）</div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label v-for="plan in [{d:30,t:'月费'},{d:90,t:'季费'},{d:180,t:'半年费'},{d:365,t:'年费'}]" :key="plan.d" class="text-xs space-y-1"><span class="text-slate-500">{{ plan.t }} · {{plan.d}}天</span><input v-model="form['chart_price_'+plan.d]" type="number" min="0" step="0.01" class="w-full border rounded-lg px-3 py-2"></label>
            </div>
          </div>
          <div class="border-t pt-3 space-y-2">
            <div class="text-xs font-bold text-slate-700">图表采集周期（至少启用一个）</div>
            <div class="flex flex-wrap gap-5 text-xs text-slate-600">
              <label class="inline-flex items-center gap-2"><input type="checkbox" :checked="form.chart_interval_half_day==='1'" @change="form.chart_interval_half_day=$event.target.checked?'1':'0'">半日线</label>
              <label class="inline-flex items-center gap-2"><input type="checkbox" :checked="form.chart_interval_daily==='1'" @change="form.chart_interval_daily=$event.target.checked?'1':'0'">日线</label>
              <label class="inline-flex items-center gap-2"><input type="checkbox" :checked="form.chart_interval_weekly==='1'" @change="form.chart_interval_weekly=$event.target.checked?'1':'0'">周线</label>
            </div>
            <p class="text-[11px] text-slate-400">保存后，GitHub Actions 下次启动时自动读取此配置；关闭周期不会删除其他周期的图表。</p>
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
          <h3 class="font-bold text-slate-700 text-sm border-b pb-2">私人定制标的定价</h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label v-for="plan in [{d:30,t:'1个月'},{d:90,t:'3个月'},{d:180,t:'6个月'},{d:365,t:'12个月'}]" :key="plan.d" class="text-xs space-y-1"><span class="text-slate-500">{{plan.t}} · 元</span><input v-model="form['symbol_price_'+plan.d]" type="number" min="0" step="0.01" class="w-full border rounded-lg px-3 py-2"></label>
          </div>
          <p class="text-[11px] text-slate-400">后台使用独立价格输入框，保存时自动转换为前台定制套餐配置。</p>
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
