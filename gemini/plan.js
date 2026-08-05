const planHtml = `
<div class="mb-4">
    <h2 class="text-xl font-medium text-slate-800">选择套餐</h2>
    <p class="text-xs text-slate-400 mt-1">通用与定制独立计费 · 定制为套餐总价（含最多 {{ publicSettings.custom_max_symbols || 3 }} 只）· 游客可支付并同步注册</p>
</div>
<div class="flex gap-2 mb-6 text-sm">
    <button @click="planTab='shared'" class="px-4 py-2 rounded-lg border" :class="planTab==='shared'?'theme-bg text-white border-transparent':'bg-white'">通用监控</button>
    <button @click="planTab='custom'" class="px-4 py-2 rounded-lg border" :class="planTab==='custom'?'theme-bg text-white border-transparent':'bg-white'">定制监控</button>
</div>

<div v-if="displayPlans.length === 0" class="text-center py-12 text-slate-400">加载套餐中...</div>
<div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
    <div v-for="plan in displayPlans" :key="plan.id" @click="selectTopUpPlan(plan)"
        class="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col cursor-pointer transition-all border-2 relative"
        :class="topUpForm.planId === plan.id ? 'theme-border ring-2 ring-[#4da6a0]/20' : 'border-transparent hover:border-slate-200'">
        <div v-if="plan.tag" class="absolute top-0 right-0 bg-orange-500 text-white text-[10px] px-2.5 py-0.5 rounded-bl">{{ plan.tag }}</div>
        <div class="p-5 sm:p-6 border-b border-slate-50 bg-slate-50/50">
            <div class="text-slate-500 text-sm mb-3">{{ plan.name }}</div>
            <div class="flex items-end mb-1"><span class="text-3xl font-light text-slate-800">¥ {{ plan.price }}</span></div>
            <div class="text-slate-400 text-xs">有效期 {{ plan.days }} 个自然日<span v-if="planTab==='custom'"> · 含最多 {{ publicSettings.custom_max_symbols || 3 }} 只</span></div>
        </div>
        <div class="p-5 flex-1">
            <ul class="text-xs text-slate-600 space-y-2 mb-4">
                <li v-if="planTab==='shared'"><i class="fa-solid fa-circle-check text-[#4da6a0] mr-2"></i> 解锁通用看板全部图表</li>
                <li v-if="planTab==='custom'"><i class="fa-solid fa-circle-check text-[#4da6a0] mr-2"></i> 套餐总价 · 最多 {{ publicSettings.custom_max_symbols || 3 }} 只标的</li>
                <li><i class="fa-solid fa-circle-check text-[#4da6a0] mr-2"></i> 支持优惠码</li>
            </ul>
            <div class="w-full text-center py-2 rounded text-xs font-medium" :class="topUpForm.planId === plan.id ? 'theme-bg text-white' : 'bg-slate-100 text-slate-600'">
                {{ topUpForm.planId === plan.id ? '已选中' : '选择' }}
            </div>
        </div>
    </div>
</div>

<div v-if="planTab==='custom'" class="bg-white rounded-xl border p-5 mb-6 max-w-2xl mx-auto space-y-3">
    <div class="text-sm font-medium">定制标的（套餐总价，最多 {{ publicSettings.custom_max_symbols || 3 }} 只）</div>
    <div v-for="(row, i) in customDraftItems" :key="i" class="flex gap-2 items-center">
        <input v-model="row.etf_code" @blur="dedupeCustomDraft" placeholder="代码" class="w-28 px-2 py-2 border rounded-lg text-sm font-mono">
        <input v-model="row.etf_name" placeholder="名称" class="flex-1 px-2 py-2 border rounded-lg text-sm">
        <button v-if="customDraftItems.length>1" @click="customDraftItems.splice(i,1); dedupeCustomDraft()" class="text-slate-300 hover:text-red-500 px-1"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <button v-if="customDraftItems.length < (Number(publicSettings.custom_max_symbols)||3)" @click="customDraftItems.push({etf_code:'',etf_name:''})" class="text-xs theme-text">+ 再加一只</button>
    <p class="text-xs text-slate-500">已填 {{ customSymbolCount }} 只 · 应付套餐价 ¥{{ (Number(topUpForm.amount)||0).toFixed(2) }}</p>
    <p v-if="customDedupeTip" class="text-xs text-amber-600"><i class="fa-solid fa-circle-info mr-1"></i>{{ customDedupeTip }}</p>
</div>

<div class="bg-white rounded-xl shadow-sm p-5 sm:p-8 max-w-2xl mx-auto border border-slate-100 space-y-5">
    <div class="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
        <label class="text-xs font-medium text-slate-600 mb-2 block">优惠码（选填）</label>
        <div class="flex gap-2">
            <input v-model="promoInput" type="text" placeholder="请输入优惠码" class="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono uppercase">
            <button @click="applyPromo" :disabled="promoChecking" class="px-4 py-2 theme-bg text-white rounded-lg text-xs disabled:opacity-50">{{ promoChecking ? '校验中' : '使用' }}</button>
        </div>
        <p v-if="promoMessage" class="text-xs mt-2" :class="promoValid ? 'text-emerald-600' : 'text-red-500'">{{ promoMessage }}</p>
    </div>

    <div v-if="!isLoggedIn" class="border border-amber-100 rounded-xl p-4 bg-amber-50/40 space-y-3">
        <div class="text-xs font-medium text-amber-800"><i class="fa-solid fa-user-plus mr-1"></i> 未登录：支付成功后将用下方<strong>账号</strong>同步注册（可随意填写，不强制邮箱）</div>
        <input v-model="payRegister.username" type="text" placeholder="注册账号（必填，可随意填写）" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
        <input v-model="payRegister.password" type="password" placeholder="设置密码（至少6位）" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
        <input v-model="payRegister.refCode" type="text" placeholder="推荐码（选填）" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
    </div>

    <div class="text-center">
        <div class="inline-flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full mb-3 border border-amber-200">
            <i class="fa-solid fa-triangle-exclamation"></i> 请严格支付下方金额
        </div>
        <h3 class="text-lg font-bold text-slate-800">扫码精准支付</h3>
        <div class="mt-2 flex items-baseline justify-center gap-1">
            <span class="text-sm text-slate-500">需支付:</span>
            <span class="text-3xl font-extrabold text-red-500 font-mono">¥{{ displayPayAmount }}</span>
            <span v-if="promoValid && topUpForm.originalAmount" class="text-sm text-slate-400 line-through ml-1">¥{{ topUpForm.originalAmount }}</span>
        </div>
    </div>

    <div class="flex justify-center gap-2 text-xs">
        <button @click="payChannel='alipay'" class="px-4 py-1.5 rounded-full border" :class="payChannel==='alipay'?'theme-bg text-white border-transparent':'bg-white'">支付宝</button>
        <button @click="payChannel='wechat'" class="px-4 py-1.5 rounded-full border" :class="payChannel==='wechat'?'theme-bg text-white border-transparent':'bg-white'">微信支付</button>
    </div>
    <div class="flex flex-col items-center">
        <div class="w-52 h-52 bg-slate-50 rounded-xl p-3 border-2 border-dashed border-slate-200 mb-3 flex items-center justify-center">
            <img v-if="currentPayQrSrc" :src="currentPayQrSrc" class="w-full h-full object-contain rounded-lg" alt="收款码">
            <span v-else class="text-xs text-slate-400 text-center px-4">请在后台配置{{ payChannel==='alipay'?'支付宝':'微信' }}收款码（图片URL或支付链接）</span>
        </div>
        <div class="bg-emerald-50 text-emerald-700 text-xs px-4 py-2.5 rounded-lg border border-emerald-100 max-w-md text-center">
            <p class="font-bold">请严格支付精准金额 {{ displayPayAmount }} 元</p>
            <p class="text-emerald-600 mt-1">付完后提交单号，审核通过即开通</p>
        </div>
    </div>

    <div class="max-w-xs mx-auto text-center space-y-3">
        <button @click="showManualInput = !showManualInput" class="text-xs text-slate-400 hover:text-slate-600">手动补填支付单号后6位</button>
        <div v-if="showManualInput" class="mt-3 space-y-2">
            <input v-model="topUpForm.txId" type="text" maxlength="6" class="w-full px-4 py-2 border border-slate-300 rounded text-center tracking-widest font-mono text-sm" placeholder="后6位数字">
            <button @click="submitOrder" :disabled="orderLoading || topUpForm.txId.length !== 6" class="w-full py-2 theme-bg text-white rounded text-xs font-medium disabled:opacity-50">提交单号充值</button>
        </div>
        <div v-if="orderMessage" class="text-xs px-3 py-2 rounded font-medium" :class="orderMessage.includes('成功') ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'">{{ orderMessage }}</div>
    </div>
</div>
`;
