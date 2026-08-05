const adminSettingsHtml = `
<div class="flex justify-between items-center">
  <h2 class="text-xl font-bold">系统设置</h2>
  <button @click="saveSettings" class="theme-bg text-white text-sm px-4 py-2 rounded-lg">保存设置</button>
</div>
<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <div class="bg-white rounded-xl border p-5 space-y-3">
    <div class="text-sm font-medium text-slate-700">注册 / 邀请赠送</div>
    <div class="grid grid-cols-3 gap-3">
      <div>
        <label class="text-xs text-slate-500 mb-1 block">注册赠送天数</label>
        <input type="number" v-model.number="settingsForm.gift_register_days" class="w-full border px-3 py-2 rounded-lg text-sm">
      </div>
      <div>
        <label class="text-xs text-slate-500 mb-1 block">邀请人赠送</label>
        <input type="number" v-model.number="settingsForm.gift_inviter_days" class="w-full border px-3 py-2 rounded-lg text-sm">
      </div>
      <div>
        <label class="text-xs text-slate-500 mb-1 block">被邀请人额外</label>
        <input type="number" v-model.number="settingsForm.gift_invitee_days" class="w-full border px-3 py-2 rounded-lg text-sm">
      </div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="text-xs text-slate-500 mb-1 block">免费图表 Top N</label>
        <input type="number" v-model.number="settingsForm.free_top_n_charts" class="w-full border px-3 py-2 rounded-lg text-sm">
      </div>
      <div>
        <label class="text-xs text-slate-500 mb-1 block">定制套餐最多只数</label>
        <input type="number" v-model.number="settingsForm.custom_max_symbols" min="1" max="20" class="w-full border px-3 py-2 rounded-lg text-sm">
        <p class="text-[11px] text-slate-400 mt-1">套餐总价含这么多只（如 3 = 18.8 元最多填 3 只），不是按只另计费</p>
      </div>
    </div>
    <div>
      <label class="text-xs text-slate-500 mb-1 block">允许支付即注册</label>
      <select v-model="settingsForm.pay_register_enabled" class="w-full border px-3 py-2 rounded-lg text-sm">
        <option value="1">开启</option>
        <option value="0">关闭</option>
      </select>
    </div>
  </div>

  <div class="bg-white rounded-xl border p-5 space-y-3">
    <div class="text-sm font-medium text-slate-700">收款码（图片 URL 或支付链接）</div>
    <p class="text-[11px] text-slate-400">填图片直链则直接显示；填支付链接则前台自动转二维码</p>
    <div>
      <label class="text-xs text-slate-500 mb-1 block">支付宝</label>
      <input v-model="settingsForm.alipay_qr_url" placeholder="图片URL 或 支付链接" class="w-full border px-3 py-2 rounded-lg text-sm">
    </div>
    <div>
      <label class="text-xs text-slate-500 mb-1 block">微信</label>
      <input v-model="settingsForm.wechat_qr_url" placeholder="图片URL 或 支付链接" class="w-full border px-3 py-2 rounded-lg text-sm">
    </div>
    <div>
      <label class="text-xs text-slate-500 mb-1 block">默认支付通道</label>
      <select v-model="settingsForm.default_pay_channel" class="w-full border px-3 py-2 rounded-lg text-sm">
        <option value="alipay">支付宝</option>
        <option value="wechat">微信</option>
      </select>
    </div>
  </div>

  <div class="bg-white rounded-xl border p-5 space-y-3 lg:col-span-2">
    <div class="text-sm font-medium text-slate-700">前台 Footer 社交（留空则不显示）</div>
    <p class="text-[11px] text-slate-400">填写主页/账号链接。前台：鼠标悬停显示二维码，点击进入链接。清空某一项即从前台移除。</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div>
        <label class="text-xs text-slate-500 mb-1 block">抖音链接</label>
        <input v-model="settingsForm.social_douyin" placeholder="https://..." class="w-full border px-3 py-2 rounded-lg text-sm">
      </div>
      <div>
        <label class="text-xs text-slate-500 mb-1 block">视频号链接</label>
        <input v-model="settingsForm.social_shipinhao" placeholder="https://..." class="w-full border px-3 py-2 rounded-lg text-sm">
      </div>
      <div>
        <label class="text-xs text-slate-500 mb-1 block">小红书链接</label>
        <input v-model="settingsForm.social_xiaohongshu" placeholder="https://..." class="w-full border px-3 py-2 rounded-lg text-sm">
      </div>
      <div>
        <label class="text-xs text-slate-500 mb-1 block">公众号链接</label>
        <input v-model="settingsForm.social_gongzhonghao" placeholder="https://..." class="w-full border px-3 py-2 rounded-lg text-sm">
      </div>
      <div>
        <label class="text-xs text-slate-500 mb-1 block">快手链接</label>
        <input v-model="settingsForm.social_kuaishou" placeholder="https://..." class="w-full border px-3 py-2 rounded-lg text-sm">
      </div>
    </div>
  </div>
</div>
`;
