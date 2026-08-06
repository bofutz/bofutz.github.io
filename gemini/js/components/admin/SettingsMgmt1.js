/**
 * 波幅探长 - 后台【系统设置】分块组件
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
      custom_max_symbols: 3,
      vote_monthly_limit: 10,
      alipay_qr_url: "",
      wechat_qr_url: "",
      default_pay_channel: "alipay",
      social_douyin: "",
      social_shipinhao: "",
      social_xiaohongshu: "",
      social_gongzhonghao: "",
      social_kuaishou: "",
    });

    const loadSettings = async () => {
      try {
        const res = await adminApi.fetchSettings();
        if (res.success && res.data) {
          Object.keys(settingsForm).forEach((k) => {
            if (res.data[k] != null) {
              settingsForm[k] = k.includes("days") || k.includes("charts") || k.includes("symbols") || k.includes("limit")
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
      try {
        await adminApi.saveSettings(settingsForm);
        store.showToast("系统设置保存成功");
        store.setPublicSettings(settingsForm);
      } catch (err) {
        store.showToast(err.message, "error");
      }
    };

    onMounted(() => {
      loadSettings();
    });

    return {
      settingsForm,
      saveSettings,
    };
  },
  template: `
    <div class="space-y-4 select-none max-w-5xl">
      <div class="flex justify-between items-center">
        <div>
          <h2 class="text-xl font-bold text-slate-800">系统设置</h2>
          <p class="text-xs text-slate-400 mt-1">控制全网赠送规则、收款码、社交媒体链接与权限上限</p>
        </div>
        <button @click="saveSettings" class="theme-bg text-white text-sm px-5 py-2 rounded-lg font-bold hover:opacity-90 shadow-sm">保存全局设置</button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- 注册/邀请赠送与上限 -->
        <div class="bg-white rounded-xl border border-slate-100 p-5 space-y-3.5 shadow-sm">
          <div class="text-sm font-bold text-slate-700 border-b pb-2">注册与奖励配置</div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="text-xs text-slate-500 mb-1 block">注册赠送天数</label>
              <input type="number" v-model.number="settingsForm.gift_register_days" class="w-full border px-3 py-2 rounded-lg text-sm font-mono focus:theme-border outline-none">
            </div>
            <div>
              <label class="text-xs text-slate-500 mb-1 block">邀请人赠送</label>
              <input type="number" v-model.number="settingsForm.gift_inviter_days" class="w-full border px-3 py-2 rounded-lg text-sm font-mono focus:theme-border outline-none">
            </div>
            <div>
              <label class="text-xs text-slate-500 mb-1 block">被邀请人额外</label>
              <input type="number" v-model.number="settingsForm.gift_invitee_days" class="w-full border px-3 py-2 rounded-lg text-sm font-mono focus:theme-border outline-none">
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="text-xs text-slate-500 mb-1 block">免费图表 Top N</label>
              <input type="number" v-model.number="settingsForm.free_top_n_charts" class="w-full border px-3 py-2 rounded-lg text-sm font-mono focus:theme-border outline-none">
            </div>
            <div>
              <label class="text-xs text-slate-500 mb-1 block">定制最多只数</label>
              <input type="number" v-model.number="settingsForm.custom_max_symbols" class="w-full border px-3 py-2 rounded-lg text-sm font-mono focus:theme-border outline-none">
            </div>
            <div>
              <label class="text-xs text-slate-500 mb-1 block">每月投票上限</label>
              <input type="number" v-model.number="settingsForm.vote_monthly_limit" class="w-full border px-3 py-2 rounded-lg text-sm font-mono focus:theme-border outline-none">
            </div>
          </div>
        </div>

        <!-- 收款码配置 -->
        <div class="bg-white rounded-xl border border-slate-100 p-5 space-y-3.5 shadow-sm">
          <div class="text-sm font-bold text-slate-700 border-b pb-2">精准支付与收款码 (直链或支付链接)</div>
          <div>
            <label class="text-xs text-slate-500 mb-1 block">支付宝收款码 URL</label>
            <input v-model="settingsForm.alipay_qr_url" placeholder="图片直链或支付链接" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
          </div>
          <div>
            <label class="text-xs text-slate-500 mb-1 block">微信收款码 URL</label>
            <input v-model="settingsForm.wechat_qr_url" placeholder="图片直链或支付链接" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
          </div>
        </div>

        <!-- 前台 Footer 社交链接 -->
        <div class="bg-white rounded-xl border border-slate-100 p-5 space-y-3.5 shadow-sm lg:col-span-2">
          <div class="text-sm font-bold text-slate-700 border-b pb-2">前台 Footer 社交链接 (留空则前台不展示)</div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="text-xs text-slate-500 mb-1 block">抖音主页链接</label>
              <input v-model="settingsForm.social_douyin" placeholder="https://..." class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
            </div>
            <div>
              <label class="text-xs text-slate-500 mb-1 block">视频号主页链接</label>
              <input v-model="settingsForm.social_shipinhao" placeholder="https://..." class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
            </div>
            <div>
              <label class="text-xs text-slate-500 mb-1 block">小红书主页链接</label>
              <input v-model="settingsForm.social_xiaohongshu" placeholder="https://..." class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
            </div>
            <div>
              <label class="text-xs text-slate-500 mb-1 block">公众号链接</label>
              <input v-model="settingsForm.social_gongzhonghao" placeholder="https://..." class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
            </div>
            <div>
              <label class="text-xs text-slate-500 mb-1 block">快手主页链接</label>
              <input v-model="settingsForm.social_kuaishou" placeholder="https://..." class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};
