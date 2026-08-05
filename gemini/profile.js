const ProfileModule = {
    template: `
    <div v-if="!isLoggedIn" class="bg-white rounded-xl border p-10 text-center">
        <p class="text-slate-500 mb-4">请先登录查看个人中心</p>
        <button @click="openAuth('login')" class="theme-bg text-white px-6 py-2 rounded-lg text-sm">去登录</button>
    </div>
    <template v-else>
        <div class="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-slate-100">
            <div class="flex items-center justify-between gap-3">
                <div>
                    <div class="text-sm text-slate-500 mb-1">通用监控 VIP</div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-xl sm:text-2xl font-bold" :class="isVip ? 'theme-text' : 'text-slate-400'">{{ isVip ? '已开通' : '未开通' }}</span>
                        <span v-if="isVip" class="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded border border-emerald-100">剩余 {{ vipDaysLeft }} 天</span>
                    </div>
                </div>
                <button @click="navigate('#/plan'); planTab='shared'" class="theme-bg text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg text-sm font-medium shadow-sm shrink-0">{{ isVip ? '续费通用' : '开通通用' }}</button>
            </div>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div class="px-5 sm:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                    <div class="font-medium text-slate-700">我的定制监控</div>
                    <p class="text-[11px] text-slate-400 mt-0.5">套餐总价含最多 {{ publicSettings.custom_max_symbols || 3 }} 只 · 与通用独立 · 不解锁通用图表</p>
                </div>
                <button @click="openCustomEditor" class="text-xs theme-bg text-white px-3 py-1.5 rounded-lg self-start"><i class="fa-solid fa-plus mr-1"></i>添加标的</button>
            </div>
            <div v-if="customLoading" class="p-6 text-center text-slate-400 text-sm"><i class="fa-solid fa-spinner animate-spin"></i></div>
            <div v-else-if="!customWatchlist.length" class="p-8 text-center text-sm text-slate-400">暂无定制标的</div>
            <div v-else class="overflow-x-auto">
                <table class="w-full text-sm whitespace-nowrap">
                    <thead class="bg-slate-50 text-xs text-slate-500 border-b"><tr>
                        <th class="py-2.5 px-4 text-left">代码/名称</th><th class="py-2.5 px-3">状态</th><th class="py-2.5 px-3">到期</th><th class="py-2.5 px-3 text-right">操作</th>
                    </tr></thead>
                    <tbody class="divide-y divide-slate-50">
                        <tr v-for="item in customWatchlist" :key="item.id">
                            <td class="py-3 px-4 text-left"><div class="font-mono font-bold">{{ item.etf_code }}</div><div class="text-xs text-slate-500">{{ item.etf_name }}</div></td>
                            <td class="py-3 px-3"><span class="text-xs px-2 py-0.5 rounded-full" :class="item.status==='active'?'bg-emerald-50 text-emerald-600':(item.status==='pending'?'bg-orange-50 text-orange-600':'bg-slate-100 text-slate-400')">{{ item.status==='active'?'监控中':(item.status==='pending'?'待支付':item.status) }}</span></td>
                            <td class="py-3 px-3 text-xs text-slate-400">{{ item.expire_at ? formatDateShort(item.expire_at) : '-' }}</td>
                            <td class="py-3 px-3 text-right"><button @click="removeCustomItem(item)" class="text-xs text-slate-400 hover:text-red-500">移除</button></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div class="px-5 sm:px-6 py-4 border-b border-slate-100 font-medium text-slate-700">我的订单</div>
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm whitespace-nowrap">
                    <thead class="bg-slate-50 text-slate-500 border-b"><tr>
                        <th class="py-3 px-4">套餐</th><th class="py-3 px-4">金额</th><th class="py-3 px-4">类型</th><th class="py-3 px-4">获得VIP</th><th class="py-3 px-4">状态</th><th class="py-3 px-4">时间</th>
                    </tr></thead>
                    <tbody class="divide-y divide-slate-50">
                        <tr v-for="order in orderList" :key="order.id" class="hover:bg-slate-50">
                            <td class="py-3 px-4">
                                <span class="bg-slate-100 px-2 py-1 rounded text-xs">{{ getPlanName(order.plan_id) }}</span>
                                <span v-if="order.promo_code" class="text-[10px] text-orange-500 ml-1">{{ order.promo_code }}</span>
                                <span v-if="order.symbol_count>1" class="text-[10px] text-slate-400 ml-1">×{{ order.symbol_count }}</span>
                            </td>
                            <td class="py-3 px-4">¥ {{ order.amount }}</td>
                            <td class="py-3 px-4 text-xs">{{ order.order_type==='custom_watchlist'?'定制':'通用' }}</td>
                            <td class="py-3 px-4 text-emerald-600 font-medium text-xs">{{ order.status==='approved' ? (order.vip_days_granted ? ('+'+order.vip_days_granted+'天') : (order.order_type==='custom_watchlist'?'定制激活':'-')) : '-' }}</td>
                            <td class="py-3 px-4"><span :class="order.status==='approved'?'text-emerald-600':(order.status==='pending'?'text-orange-500':'text-slate-400')">{{ formatStatus(order.status) }}</span></td>
                            <td class="py-3 px-4 text-xs text-slate-400">{{ formatDateExact(order.created_at) }}</td>
                        </tr>
                        <tr v-if="!orderList.length"><td colspan="6" class="py-8 text-center text-slate-400 text-sm">暂无订单</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
            <div class="font-medium text-slate-700">专属邀请码及奖励</div>
            <div class="bg-slate-50 rounded-xl p-4 sm:p-5 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div class="text-xs text-slate-400 mb-1">您的专属邀请码</div>
                    <span class="font-mono text-2xl font-bold text-slate-700 tracking-widest">{{ referralCode || '-' }}</span>
                </div>
                <div class="sm:text-right text-sm theme-text font-medium leading-relaxed">
                    邀请与被邀请双方各送 VIP<br>
                    <span class="text-base font-bold">邀请人 {{ publicSettings.gift_inviter_days || 3 }} 天 · 被邀请人 {{ publicSettings.gift_invitee_days || 2 }} 天</span>
                </div>
            </div>
            <div>
                <div class="text-sm font-medium text-slate-600 mb-2">我邀请的用户 <span class="text-xs text-slate-400">({{ inviteeList.length }})</span></div>
                <div v-if="inviteeLoading" class="text-xs text-slate-400">加载中...</div>
                <div v-else-if="!inviteeList.length" class="text-xs text-slate-400 py-4">暂无被邀请人</div>
                <div v-else class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="text-xs text-slate-400 border-b"><tr>
                            <th class="py-2 text-left">账号</th><th class="py-2 text-left">当前VIP天数</th><th class="py-2 text-left">注册时间</th>
                        </tr></thead>
                        <tbody class="divide-y divide-slate-50">
                            <tr v-for="inv in inviteeList" :key="inv.id">
                                <td class="py-2.5 font-medium">{{ inv.username }}</td>
                                <td class="py-2.5" :class="inv.vip_days_left>0?'text-emerald-500 font-bold':''">{{ inv.vip_days_left }} 天</td>
                                <td class="py-2.5 text-xs text-slate-400">{{ formatDateExact(inv.created_at) }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 class="font-medium text-slate-700 mb-4">修改密码</h3>
            <div class="space-y-3 max-w-md">
                <input v-model="pwdForm.old" type="password" placeholder="旧密码" class="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm">
                <input v-model="pwdForm.new" type="password" placeholder="新密码" class="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm">
                <input v-model="pwdForm.confirm" type="password" placeholder="确认新密码" class="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm">
                <button @click="submitPasswordChange" :disabled="pwdLoading" class="theme-bg text-white px-6 py-2 rounded-lg text-sm disabled:opacity-50">{{ pwdLoading ? '保存中...' : '保 存' }}</button>
            </div>
        </div>
    </template>
    `
};
