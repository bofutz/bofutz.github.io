/**
 * 波幅探长 - 后台系统设置（整合版）
 * 含：注册赠送、免费 TOP、收款码、定制每组只数、
 *     票选门槛/仅ETF、打赏、弹窗广告、社交平台 JSON
 * js/components/admin/SettingsMgmt.js
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
    const settingsTab = ref("general");
    const loading = ref(false);
    const saving = ref(false);

    const form = reactive({
      gift_register_days: "1",
      gift_inviter_days: "0",
      gift_invitee_days: "3",
      referral_code_min_len: "6",
      referral_code_max_len: "8",
      referral_rebate_percent: "10",
      referral_rebate_min_days: "90",
      free_top_n_charts: "3",
      pay_register_enabled: "1",
      promo_enabled: "1",
      alipay_qr_url: "",
      wechat_qr_url: "",
      default_pay_channel: "wechat",
      custom_max_symbols: "3",
      chart_query_batch_hours: "2",
      chart_run_slots: '[{"time":"15:40","mode":"all","enabled":true},{"time":"18:00","mode":"query","enabled":true},{"time":"20:00","mode":"query","enabled":true},{"time":"22:00","mode":"query","enabled":true}]',
      chart_run_window_minutes: "25",
      chart_query_retain_trading_days: "2",
      chart_query_intervals: '["daily"]',
      chart_query_deduct_on: "submit",

      // 票选
      vote_monthly_limit: "10",
      vote_min_level: "1",
      vote_etf_only: "1",

      // 打赏
      tip_enabled: "0",
      tip_wechat_qr_url: "",
      tip_alipay_qr_url: "",
      tip_note: "觉得有用？请作者喝杯咖啡",

      // 弹窗广告
      ad_enabled: "0",
      ad_title: "",
      ad_content: "",
      ad_image_url: "",
      ad_link_url: "",
      ad_start_at: "",
      ad_end_at: "",
      ad_frequency: "daily",

      // 兼容旧字段
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

        // 社交平台 JSON
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
          // 从旧字段灌入
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
        // 同步旧五字段（便于兼容）
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
        // 前台公共配置可刷新
        if (store.loadPublicSettings) await store.loadPublicSettings();
      } catch (err) {
        store.showToast(err.message || "保存失败", "error");
      } finally {
        saving.value = false;
      }
    };

    onMounted(loadSettings);

    return {
      settingsTab,
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
          <p class="text-[11px] text-slate-400 mt-0.5">优惠码 → 注册与邀请 → 自主查询 → 支付 → 票选 → 广告 → 社交</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button  @click="loadSettings" class="text-xs text-slate-500 px-3 py-1.5 rounded-lg border hover:bg-slate-50">刷新</button>
          <button  @click="saveSettings" :disabled="saving"
                  class="text-xs theme-bg text-white px-4 py-1.5 rounded-lg font-bold disabled:opacity-50">
            {{ saving ? '保存中...' : '保存全部' }}
          </button>
        </div>
      </div>

      <div v-if="false" class="bg-white rounded-2xl border border-slate-100 p-2 shadow-sm">
        <PromoMgmt />
      </div>

      <div v-if="loading" class="text-center py-10 text-slate-400 text-sm">
        <i class="fa-solid fa-spinner animate-spin mr-2"></i>加载中...
      </div>

      <template v-else>
        <!-- 优惠码（内嵌于系统设置首位） -->
        <section class="bg-white rounded-xl border border-slate-100 p-5 space-y-3 shadow-sm">
          <h3 class="font-bold text-slate-700 text-sm border-b pb-2">优惠码</h3>
          <PromoMgmt />
        </section>

        <!-- 注册与邀请返利 -->
        <section class="bg-white rounded-xl border border-slate-100 p-5 space-y-4 shadow-sm">
          <h3 class="font-bold text-slate-700 text-sm border-b pb-2">注册与邀请返利</h3>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label class="text-xs space-y-1">
              <span class="text-slate-500">注册赠送天数</span>
              <input v-model="form.gift_register_days" type="number" min="0" class="w-full border rounded-lg px-3 py-2 text-sm">
            </label>
            <label class="text-xs space-y-1">
              <span class="text-slate-500">邀请人注册赠送（建议 0）</span>
              <input v-model="form.gift_inviter_days" type="number" min="0" class="w-full border rounded-lg px-3 py-2 text-sm">
            </label>
            <label class="text-xs space-y-1">
              <span class="text-slate-500">被邀请人注册赠送</span>
              <input v-model="form.gift_invitee_days" type="number" min="0" class="w-full border rounded-lg px-3 py-2 text-sm">
            </label>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label class="text-xs space-y-1">
              <span class="text-slate-500">邀请码最短位数</span>
              <input v-model="form.referral_code_min_len" type="number" min="4" max="16" class="w-full border rounded-lg px-3 py-2 text-sm">
            </label>
            <label class="text-xs space-y-1">
              <span class="text-slate-500">邀请码最长位数</span>
              <input v-model="form.referral_code_max_len" type="number" min="4" max="32" class="w-full border rounded-lg px-3 py-2 text-sm">
            </label>
            <label class="text-xs space-y-1">
              <span class="text-slate-500">付费返利比例 %</span>
              <input v-model="form.referral_rebate_percent" type="number" min="0" max="100" class="w-full border rounded-lg px-3 py-2 text-sm">
            </label>
            <label class="text-xs space-y-1">
              <span class="text-slate-500">返利门槛（套餐天数≥）</span>
              <input v-model="form.referral_rebate_min_days" type="number" min="0" class="w-full border rounded-lg px-3 py-2 text-sm">
              <span class="text-[10px] text-slate-400">如 90=季付起；邀请人仅在好友付费后获天数返利</span>
            </label>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="text-xs space-y-1">
              <span class="text-slate-500">免费可看图表 TOP N</span>
              <input v-model="form.free_top_n_charts" type="number" min="0" class="w-full border rounded-lg px-3 py-2 text-sm">
            </label>
            <label class="text-xs space-y-1">
              <span class="text-slate-400">（废弃）定制每组只数</span>
              <input v-model="form.custom_max_symbols" type="number" min="1" class="w-full border rounded-lg px-3 py-2 text-sm opacity-40">
            </label>
          </div>
          <div class="rounded-xl border border-slate-100 bg-slate-50/80 p-4 space-y-3">
            <div class="text-xs font-bold text-slate-700">自主查询</div>
            <div class="space-y-2">
              <div class="text-[11px] text-slate-500 leading-relaxed">
                <strong>出图场次</strong>（北京时间）：GitHub Actions 会定时「醒来」，仅当当前时刻落在某场次 ±窗口分钟内才真正跑 charts。
                mode：<code class="bg-white px-1 rounded">all</code>=监控+查询，
                <code class="bg-white px-1 rounded">query</code>=仅自主查询，
                <code class="bg-white px-1 rounded">shared</code>=仅监控。
                增删改下方 JSON 后保存即可，无需改仓库 cron 表达式。
              </div>
              <label class="text-xs space-y-1 block">
                <span class="text-slate-500">出图场次 JSON（chart_run_slots）</span>
                <textarea v-model="form.chart_run_slots" rows="5" class="w-full border rounded-lg px-3 py-2 text-xs font-mono bg-white leading-relaxed"></textarea>
              </label>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label class="text-xs space-y-1">
                <span class="text-slate-500">匹配窗口（分钟）</span>
                <input v-model="form.chart_run_window_minutes" type="number" min="5" max="60" class="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                <span class="text-[10px] text-slate-400">例：25 表示 15:40 场次在 15:15–16:05 醒来均可命中</span>
              </label>
              <label class="text-xs space-y-1">
                <span class="text-slate-500">图片保留交易日</span>
                <input v-model="form.chart_query_retain_trading_days" type="number" min="1" class="w-full border rounded-lg px-3 py-2 text-sm bg-white">
              </label>
              <label class="text-xs space-y-1 sm:col-span-2">
                <span class="text-slate-500">开放周期 JSON</span>
                <input v-model="form.chart_query_intervals" type="text" class="w-full border rounded-lg px-3 py-2 text-sm font-mono bg-white">
              </label>
              <label class="text-xs space-y-1">
                <span class="text-slate-500">扣次时机</span>
                <select v-model="form.chart_query_deduct_on" class="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="submit">提交时</option>
                  <option value="success">成功时</option>
                </select>
              </label>
            </div>
          </div>
          <div class="flex flex-wrap gap-4 text-xs">
            <label class="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" :checked="form.pay_register_enabled==='1'"
                     @change="form.pay_register_enabled = $event.target.checked ? '1' : '0'">
              允许游客支付即注册
            </label>
            <label class="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" :checked="form.promo_enabled==='1'"
                     @change="form.promo_enabled = $event.target.checked ? '1' : '0'">
              启用优惠码
            </label>
          </div>
        </section>

        <!-- 收款码（开通） -->
        <section class="bg-white rounded-xl border border-slate-100 p-5 space-y-4 shadow-sm">
          <h3 class="font-bold text-slate-700 text-sm border-b pb-2">开通套餐收款码</h3>
          <label class="text-xs space-y-1 block">
            <span class="text-slate-500">默认支付渠道</span>
            <select v-model="form.default_pay_channel" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="wechat">微信</option>
              <option value="alipay">支付宝</option>
            </select>
          </label>
          <label class="text-xs space-y-1 block">
            <span class="text-slate-500">微信收款码 URL（图片直链或支付链接）</span>
            <input v-model="form.wechat_qr_url" type="text" class="w-full border rounded-lg px-3 py-2 text-sm font-mono">
          </label>
          <label class="text-xs space-y-1 block">
            <span class="text-slate-500">支付宝收款码 URL</span>
            <input v-model="form.alipay_qr_url" type="text" class="w-full border rounded-lg px-3 py-2 text-sm font-mono">
          </label>
        </section>

        <!-- 票选 -->
        <section class="bg-white rounded-xl border border-slate-100 p-5 space-y-4 shadow-sm">
          <h3 class="font-bold text-slate-700 text-sm border-b pb-2">票选规则</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="text-xs space-y-1">
              <span class="text-slate-500">每月投票上限（只）</span>
              <input v-model="form.vote_monthly_limit" type="number" min="1" class="w-full border rounded-lg px-3 py-2 text-sm">
            </label>
            <label class="text-xs space-y-1">
              <span class="text-slate-500">最低会员等级（1月 2季 3半年 4年）</span>
              <input v-model="form.vote_min_level" type="number" min="0" max="4" class="w-full border rounded-lg px-3 py-2 text-sm">
            </label>
          </div>
          <label class="inline-flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" :checked="form.vote_etf_only==='1'"
                   @change="form.vote_etf_only = $event.target.checked ? '1' : '0'">
            仅允许名称含「ETF」的标的（关闭则不限制）
          </label>
        </section>

        <!-- 打赏 -->
        <section class="bg-white rounded-xl border border-slate-100 p-5 space-y-4 shadow-sm">
          <h3 class="font-bold text-slate-700 text-sm border-b pb-2">打赏（自愿）</h3>
          <label class="inline-flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" :checked="form.tip_enabled==='1'"
                   @change="form.tip_enabled = $event.target.checked ? '1' : '0'">
            开启打赏入口（看板底部文案）
          </label>
          <label class="text-xs space-y-1 block">
            <span class="text-slate-500">引导文案</span>
            <input v-model="form.tip_note" type="text" class="w-full border rounded-lg px-3 py-2 text-sm">
          </label>
          <label class="text-xs space-y-1 block">
            <span class="text-slate-500">打赏 · 微信收款码 URL</span>
            <input v-model="form.tip_wechat_qr_url" type="text" class="w-full border rounded-lg px-3 py-2 text-sm font-mono">
          </label>
          <label class="text-xs space-y-1 block">
            <span class="text-slate-500">打赏 · 支付宝收款码 URL</span>
            <input v-model="form.tip_alipay_qr_url" type="text" class="w-full border rounded-lg px-3 py-2 text-sm font-mono">
          </label>
        </section>

        <!-- 弹窗广告 -->
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

        <!-- 社交平台 -->
        <section class="bg-white rounded-xl border border-slate-100 p-5 space-y-4 shadow-sm">
          <div class="flex items-center justify-between border-b pb-2">
            <h3 class="font-bold text-slate-700 text-sm">发布平台（Footer 展示）</h3>
            <button type="button" @click="addPlatform" class="text-xs theme-text font-bold">+ 添加平台</button>
          </div>
          <p class="text-[11px] text-slate-400">
            手机端只显示图标；电脑端悬停显示「平台@账号」。账号可不填 @。
          </p>
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
