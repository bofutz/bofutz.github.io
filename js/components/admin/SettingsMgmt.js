/**
 * 波幅探长 - 后台【系统设置】组件
 * js/components/admin/SettingsMgmt.js
 */
import { store } from "../../store.js";
import { adminApi } from "../../api/admin.js";

const { reactive, onMounted } = Vue;

export default {
  name: "SettingsMgmt",
  setup() {
    const settingsForm = reactive({
      gift_register_days: 1,
      gift_inviter_days: 3,
      gift_invitee_days: 2,
      free_top_n_charts: 3,
      pay_register_enabled: "1",
      promo_enabled: "1",
      custom_max_symbols: 3,
      vote_monthly_limit: 10,
      alipay_qr_url: "",
      wechat_qr_url: "",
      default_pay_channel: "wechat",
      social_douyin: "",
      social_shipinhao: "",
      social_xiaohongshu: "",
      social_gongzhonghao: "",
      social_kuaishou: "",
    });

    const saving = reactive({ value: false });

    const loadSettings = async () => {
      try {
        const res = await adminApi.fetchSettings();
        if (res.success && res.data) {
          Object.keys(settingsForm).forEach((k) => {
            if (res.data[k] != null) {
              settingsForm[k] =
                k.includes("days") ||
                k.includes("charts") ||
                k.includes("symbols") ||
                k.includes("limit")
                  ? Number(res.data[k])
                  : res.data[k];
            }
          });
        }
      } catch (err) {
        store.showToast(err.message, "error");
      }
    };

    const saveSettings = async () => {
      saving.value = true;
      try {
        await adminApi.saveSettings(settingsForm);
        store.showToast("系统设置保存成功");
        // 同步到前台公共配置
        if (store.setPublicSettings) {
          store.setPublicSettings({ ...settingsForm });
        }
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        saving.value = false;
      }
    };

    onMounted(loadSettings);

    return {
      settingsForm,
      saving,
      saveSettings,
    };
  },
  template: `
    <div class="space-y-5 select-none max-w-5xl">
      <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 class="text-xl font-bold text-slate-800">系统设置</h2>
          <p class="text-xs text-slate-400 mt-0.5">
            控制全网赠送规则、收款码、优惠码开关、权限上限与社交链接
          </p>
        </div>
        <button
          @click="saveSettings"
          :disabled="saving.value"
          class="theme-bg text-white text-sm px-5 py-2.5 rounded-lg font-bold hover:opacity-90 shadow-sm disabled:opacity-50"
        >
          {{ saving.value ? '保存中...' : '保存全局设置' }}
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- 注册与奖励配置 -->
        <div class="bg-white rounded-xl border border-slate-100 p-5 space-y-4 shadow-sm">
          <div class="text-sm font-bold text-slate-700 border-b pb-2">注册与奖励配置</div>
          
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="text-xs text-slate-500 mb-1 block">注册赠送天数</label>
              <input
                type="number"
                v-model.number="settingsForm.gift_register_days"
                class="w-full border px-3 py-2 rounded-lg text-sm font-mono focus:theme-border outline-none"
              >
            </div>
            <div>
              <label class="text-xs text-slate-500 mb-1 block">邀请人赠送</label>
              <input
                type="number"
                v-model.number="settingsForm.gift_inviter_days"
                class="w-full border px-3 py-2 rounded-lg text-sm font-mono focus:theme-border outline-none"
              >
            </div>
            <div>
              <label class="text-xs text-slate-500 mb-1 block">被邀请人额外</label>
              <input
                type="number"
                v-model.number="settingsForm.gift_invitee_days"
                class="w-full border px-3 py-2 rounded-lg text-sm font-mono focus:theme-border outline-none"
              >
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="text-xs text-slate-500 mb-1 block">免费图表 Top N</label>
              <input
                type="number"
                v-model.number="settingsForm.free_top_n_charts"
                class="w-full border px-3 py-2 rounded-lg text-sm font-mono focus:theme-border outline-none"
              >
            </div>
            <div>
              <label class="text-xs text-slate-500 mb-1 block">定制最多只数</label>
              <input
                type="number"
                v-model.number="settingsForm.custom_max_symbols"
                class="w-full border px-3 py-2 rounded-lg text-sm font-mono focus:theme-border outline-none"
              >
            </div>
            <div>
              <label class="text-xs text-slate-500 mb-1 block">每月投票上限</label>
              <input
                type="number"
                v-model.number="settingsForm.vote_monthly_limit"
                class="w-full border px-3 py-2 rounded-lg text-sm font-mono focus:theme-border outline-none"
              >
            </div>
          </div>

          <div class="pt-1 border-t border-slate-50 space-y-3">
            <div>
              <label class="text-xs text-slate-500 mb-1 block font-bold">优惠码功能显示开关</label>
              <select
                v-model="settingsForm.promo_enabled"
                class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none font-medium"
              >
                <option value="1">开启（购买套餐页展示优惠码输入框）</option>
                <option value="0">关闭（购买套餐页完全隐藏优惠码）</option>
              </select>
            </div>
            <div>
              <label class="text-xs text-slate-500 mb-1 block font-bold">游客支付即注册</label>
              <select
                v-model="settingsForm.pay_register_enabled"
                class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none font-medium"
              >
                <option value="1">开启（未登录可直接支付并自动注册）</option>
                <option value="0">关闭（必须先登录才能购买）</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 收款码与支付通道 -->
        <div class="bg-white rounded-xl border border-slate-100 p-5 space-y-4 shadow-sm">
          <div class="text-sm font-bold text-slate-700 border-b pb-2">精准支付与收款码</div>
          
          <div>
            <label class="text-xs text-slate-500 mb-1 block">默认支付通道</label>
            <select
              v-model="settingsForm.default_pay_channel"
              class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none font-medium"
            >
              <option value="wechat">微信支付（优先显示）</option>
              <option value="alipay">支付宝</option>
            </select>
          </div>
          
          <div>
            <label class="text-xs text-slate-500 mb-1 block">支付宝收款码 URL / 二维码链接</label>
            <input
              v-model="settingsForm.alipay_qr_url"
              placeholder="图片直链 或 支付链接"
              class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none"
            >
          </div>
          
          <div>
            <label class="text-xs text-slate-500 mb-1 block">微信收款码 URL / 二维码链接</label>
            <input
              v-model="settingsForm.wechat_qr_url"
              placeholder="图片直链 或 支付链接"
              class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none"
            >
          </div>
          
          <p class="text-[11px] text-slate-400 leading-relaxed">
            支持直接填写图片地址，或填写支付链接（系统会自动生成二维码）。推荐使用 Cloudflare R2 等稳定图床。
          </p>
        </div>

        <!-- 前台 Footer 社交账号（仅展示，无需链接） -->
        <div class="bg-white rounded-xl border border-slate-100 p-5 space-y-4 shadow-sm lg:col-span-2">
          <div class="text-sm font-bold text-slate-700 border-b pb-2">
            前台 Footer 社交账号
            <span class="font-normal text-slate-400 text-xs ml-2">
              填写账号即可（如 @波幅探长），留空则前台不显示该平台
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label class="text-xs text-slate-500 mb-1 block">抖音账号</label>
              <input
                v-model="settingsForm.social_douyin"
                placeholder="@波幅探长"
                class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none"
              >
            </div>
            <div>
              <label class="text-xs text-slate-500 mb-1 block">视频号账号</label>
              <input
                v-model="settingsForm.social_shipinhao"
                placeholder="@波幅探长"
                class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none"
              >
            </div>
            <div>
              <label class="text-xs text-slate-500 mb-1 block">小红书账号</label>
              <input
                v-model="settingsForm.social_xiaohongshu"
                placeholder="@波幅探长"
                class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none"
              >
            </div>
            <div>
              <label class="text-xs text-slate-500 mb-1 block">公众号名称</label>
              <input
                v-model="settingsForm.social_gongzhonghao"
                placeholder="@波幅探长"
                class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none"
              >
            </div>
            <div>
              <label class="text-xs text-slate-500 mb-1 block">快手账号</label>
              <input
                v-model="settingsForm.social_kuaishou"
                placeholder="@波幅探长"
                class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none"
              >
            </div>
          </div>
          <p class="text-[11px] text-slate-400">
            桌面端鼠标悬停图标显示「平台名 + 账号」；手机端在图标旁直接显示账号。
          </p>
        </div>

      <!-- 底部提示 -->
      <div class="bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs text-slate-500 leading-relaxed">
        <i class="fa-solid fa-circle-info mr-1"></i>
        修改后点击右上角「保存全局设置」立即生效。免费图表 Top N、定制只数上限、每月投票上限等配置会同步影响前台用户端行为。
      </div>
    </div>
  `,
};
