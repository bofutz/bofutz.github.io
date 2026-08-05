/**
 * 管理后台 · 系统设置
 * - 注册/邀请赠送天数
 * - 免费图表 Top N、定制最多只数
 * - 支付即注册开关
 * - 收款码（支付宝/微信）
 * - 社交链接
 */
import {
  reactive, onMounted,
} from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";

export const SettingsView = {
  name: "AdminSettings",
  props: {
    fetchAdmin: { type: Function, required: true },
    showToast: { type: Function, required: true },
  },
  setup(props) {
    const settingsForm = reactive({
      gift_register_days: 1,
      gift_inviter_days: 3,
      gift_invitee_days: 2,
      free_top_n_charts: 3,
      pay_register_enabled: "1",
      custom_max_symbols: 3,
      alipay_qr_url: "",
      wechat_qr_url: "",
      default_pay_channel: "alipay",
      social_douyin: "",
      social_shipinhao: "",
      social_xiaohongshu: "",
      social_gongzhonghao: "",
      social_kuaishou: "",
    });

    const fetchSettings = async () => {
      try {
        const d = await props.fetchAdmin("/api/admin/settings");
        if (d.success && d.data) {
          Object.keys(settingsForm).forEach((k) => {
            if (d.data[k] != null) {
              settingsForm[k] =
                k.includes("days") || k.includes("charts") || k.includes("symbols")
                  ? Number(d.data[k])
                  : d.data[k];
            }
          });
        }
      } catch (e) {
        props.showToast(e.message, "error");
      }
    };

    const saveSettings = async () => {
      try {
        await props.fetchAdmin("/api/admin/settings", {
          method: "POST",
          body: JSON.stringify(settingsForm),
        });
        props.showToast("设置已保存", "success");
      } catch (e) {
        props.showToast(e.message, "error");
      }
    };

    onMounted(fetchSettings);

    return {
      settingsForm,
      saveSettings,
    };
  },

  template: `
    <div class="space-y-4">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-bold">系统设置</h2>
        <button @click="saveSettings" class="theme-bg text-white text-sm px-4 py-2 rounded-lg">
          保存设置
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- 注册 / 邀请赠送 -->
        <div class="bg-white rounded-xl border p-5 space-y-3">
          <div class="text-sm font-medium text-slate-700">注册 / 邀请赠送</div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="text-xs text-slate-500 mb-1 block">注册赠送天数</label>
              <input type="number" v-model.number="settingsForm.gift_register_days"
                class="w-full border px-3 py-2 rounded-lg text-sm">
            </div>
            <div>
              <label class="text-xs text-slate-500 mb-1 block">邀请人赠送</label>
              <input type="number" v-model.number="settingsForm.gift_inviter_days"
                class="w-full border px-3 py-2 rounded-lg text-sm">
            </div>
            <div>
              <label class="text-xs text-slate-500 mb-1 block">被邀请人额外</label>
              <input type="number" v-model.number="settingsForm.gift_invitee_days"
                class="w-full border px-3 py-2 rounded-lg text-sm">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-slate-500 mb-1 block">免费图表 Top N</label>
              <input type="number" v-model.number="settingsForm.free_top_n_charts"
                class="w-full border px-3 py-2 rounded-lg text-sm">
            </div>
            <div>
              <label class="text-xs text-slate-500 mb-1 block">定制套餐最多只数</label>
              <input type="number" v-model.number="settingsForm.custom_max_symbols"
                min="1" max="20" class="w-full border px-3 py-2 rounded-lg text-sm">
              <p class="text-[11px] text-slate-400 mt-1">
                套餐总价含这么多只（如 3 = 18.8 元最多填 3 只），不是按只另计费
              </p>
            </div>
          </div>
          <div>
            <label class="text-xs text-slate-500 mb-1 block">允许支付即注册</label>
            <select v-model="settingsForm.pay_register_enabled"
              class="w-full border px-3 py-2 rounded-lg text-sm">
              <option value="1">开启</option>
              <option value="0">关闭</option>
            </select>
          </div>
        </div>

        <!-- 收款码 -->
        <div class="bg-white rounded-xl border p-5 space-y-3">
          <div class="text-sm font-medium text-slate-700">收款码（图片 URL 或支付链接）</div>
          <p class="text-[11px] text-slate-400">填图片直链则直接显示；填支付链接则前台自动转二维码</p>
          <div>
            <label class="text-xs text-slate-500 mb-1 block">支付宝</label>
            <input v-model="settingsForm.alipay_qr_url" placeholder="图片URL 或 支付链接"
              class="w-full border px-3 py-2 rounded-lg text-sm">
          </div>
          <div>
            <label class="text-xs text-slate-500 mb-1 block">微信支付</label>
            <input v-model="settingsForm.wechat_qr_url" placeholder="图片URL 或 支付链接"
              class="w-full border px-3 py-2 rounded-lg text-sm">
          </div>
          <div>
            <label class="text-xs text-slate-500 mb-1 block">默认支付渠道</label>
            <select v-model="settingsForm.default_pay_channel"
              class="w-full border px-3 py-2 rounded-lg text-sm">
              <option value="alipay">支付宝</option>
              <option value="wechat">微信支付</option>
            </select>
          </div>
        </div>

        <!-- 社交链接 -->
        <div class="bg-white rounded-xl border p-5 space-y-3 lg:col-span-2">
          <div class="text-sm font-medium text-slate-700">社交链接（前台页脚展示，空则不显示）</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-slate-500 mb-1 block">抖音</label>
              <input v-model="settingsForm.social_douyin" placeholder="主页链接"
                class="w-full border px-3 py-2 rounded-lg text-sm">
            </div>
            <div>
              <label class="text-xs text-slate-500 mb-1 block">视频号</label>
              <input v-model="settingsForm.social_shipinhao" placeholder="主页链接"
                class="w-full border px-3 py-2 rounded-lg text-sm">
            </div>
            <div>
              <label class="text-xs text-slate-500 mb-1 block">小红书</label>
              <input v-model="settingsForm.social_xiaohongshu" placeholder="主页链接"
                class="w-full border px-3 py-2 rounded-lg text-sm">
            </div>
            <div>
              <label class="text-xs text-slate-500 mb-1 block">公众号</label>
              <input v-model="settingsForm.social_gongzhonghao" placeholder="主页链接"
                class="w-full border px-3 py-2 rounded-lg text-sm">
            </div>
            <div>
              <label class="text-xs text-slate-500 mb-1 block">快手</label>
              <input v-model="settingsForm.social_kuaishou" placeholder="主页链接"
                class="w-full border px-3 py-2 rounded-lg text-sm">
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};
