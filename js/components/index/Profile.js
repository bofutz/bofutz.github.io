/**
 * 波幅探长 - 个人中心 (js/components/index/Profile.js)
 * 1. 昵称改为唯一用户名（可用于直接登录，与定制标的无关）
 * 2. 包含：用户名设置、我的订单记录、修改账号密码
 * 3. 定制标的管理链接统一指向 #/sponsor（与定制标的页面合并为同一页面）
 */
import { store } from "../../store.js";
import { authApi } from "../../api/auth.js";
import { request } from "../../api/http.js";

const { ref, reactive, onMounted } = Vue;

export default {
  name: "Profile",
  setup() {
    const orders = ref([]);
    const loading = ref(false);
    const membership = ref(null);
    const customMemberships = ref([]);
    const selectedPlanDays = ref(30);
    const membershipTx = ref("");
    const membershipChannel = ref("wechat");
    const membershipSubmitting = ref(false);
    const membershipPrices = [
      { days: 30, label: "月费", fallback: "8.8" },
      { days: 90, label: "季费", fallback: "26.8" },
      { days: 180, label: "半年费", fallback: "48.8" },
      { days: 365, label: "年费", fallback: "88.8" },
    ];
    const membershipPrice = (days) => Number(store.state.publicSettings[`chart_price_${days}`] ?? membershipPrices.find(x => x.days === days)?.fallback ?? 0).toFixed(2);
    const membershipQr = () => membershipChannel.value === "alipay"
      ? (store.state.publicSettings.alipay_qr_url || "")
      : (store.state.publicSettings.wechat_qr_url || "");
    const submitMembershipOrder = async () => {
      if (!/^\d{6}$/.test(String(membershipTx.value || "").trim())) {
        store.showToast("请填写支付凭证后 6 位数字", "error"); return;
      }
      membershipSubmitting.value = true;
      try {
        const res = await request("/api/membership/order", {
          method: "POST",
          body: JSON.stringify({ days: Number(selectedPlanDays.value), tx_id_last6: String(membershipTx.value).trim() }),
        });
        store.showToast(res.message || "会员订单已提交，等待审核");
        membershipTx.value = "";
        await loadProfileData();
      } catch (err) {
        store.showToast(err.message || "提交失败", "error");
      } finally { membershipSubmitting.value = false; }
    };

    const nicknameInput = ref("");
    const nicknameSaving = ref(false);

    const saveNickname = async () => {
      const val = (nicknameInput.value || "").trim();
      if (!val || val.length < 2 || val.length > 16) {
        store.showToast("用户名长度需为 2～16 个字符", "error");
        return;
      }
      if (val.includes("@")) {
        store.showToast("用户名不能包含 @ 符号", "error");
        return;
      }
      nicknameSaving.value = true;
      try {
        const res = await authApi.updateNickname(val);
        const saved = res.nickname || val;
        store.setUserState({ nickname: saved });
        nicknameInput.value = saved;
        store.showToast(res.message || "用户名已保存！您现在可以使用该用户名登录");
      } catch (err) {
        store.showToast(err.message || "用户名保存失败", "error");
      } finally {
        nicknameSaving.value = false;
      }
    };

    const pwdForm = reactive({
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    const pwdLoading = ref(false);

    const loadProfileData = async () => {
      loading.value = true;
      try {
        const [ordersRes, meRes] = await Promise.all([
          request("/api/user/orders").catch(() => ({ data: [] })),
          authApi.getMe().catch(() => null),
        ]);

        orders.value = ordersRes.data || ordersRes || [];

        if (meRes && (meRes.data || meRes.username)) {
          const d = meRes.data || meRes;
          store.setUserState({ username: d.username, nickname: d.nickname || "" });
          nicknameInput.value = d.nickname || "";
          membership.value = d.chart_membership || null;
          customMemberships.value = Array.isArray(d.custom_memberships) ? d.custom_memberships : [];
        }
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    const changePassword = async () => {
      if (!pwdForm.oldPassword || !pwdForm.newPassword) {
        store.showToast("请输入原密码和新密码", "error");
        return;
      }
      if (pwdForm.newPassword.length < 8) {
        store.showToast("新密码至少需 8 位", "error");
        return;
      }
      if (pwdForm.newPassword !== pwdForm.confirmPassword) {
        store.showToast("两次输入的密码不一致", "error");
        return;
      }
      pwdLoading.value = true;
      try {
        await authApi.changePassword(pwdForm.oldPassword, pwdForm.newPassword);
        store.showToast("密码修改成功，请重新登录");
        store.clearUserState();
        window.location.hash = "#/";
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        pwdLoading.value = false;
      }
    };

    const formatDateExact = (ts) => {
      if (!ts) return "-";
      const d = new Date(ts);
      if (isNaN(d.getTime())) return "-";
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(
        d.getMinutes()
      )}`;
    };

    const formatStatus = (s) => {
      if (s === "approved") return "已通过";
      if (s === "pending") return "待审核";
      return "已驳回";
    };

    const formatOrderType = (o) => {
      if (o.order_type === "symbol_custom" || o.order_type === "symbol_sponsor") return "定制标的";
      if (o.order_type === "chart_membership") return "全站图表会员";
      if (o.order_type === "tip") return "温暖打赏";
      return "历史订单";
    };

    onMounted(() => {
      nicknameInput.value = store.state.nickname || "";
      membershipChannel.value = store.state.publicSettings.default_pay_channel || "wechat";
      if (store.state.isLoggedIn) loadProfileData();
    });

    return {
      store: store.state,
      orders,
      membership,
      customMemberships,
      selectedPlanDays,
      membershipTx,
      membershipChannel,
      membershipSubmitting,
      membershipPrices,
      membershipPrice,
      membershipQr,
      submitMembershipOrder,
      loading,
      nicknameInput,
      nicknameSaving,
      saveNickname,
      pwdForm,
      pwdLoading,
      loadProfileData,
      changePassword,
      formatDateExact,
      formatStatus,
      formatOrderType,
    };
  },
  template: `
    <div class="max-w-4xl mx-auto space-y-5 select-none">
      <div v-if="!store.isLoggedIn" class="bg-white rounded-xl border border-slate-100 p-10 text-center space-y-3 shadow-sm">
        <i class="fa-solid fa-user-lock text-3xl text-slate-300"></i>
        <p class="text-sm text-slate-500">请先登录或注册账号</p>
        <button type="button" @click="store.authMode='login'; store.authModalVisible=true"
                class="theme-bg text-white px-5 py-2 rounded-lg text-sm font-bold">
          立即登录 / 注册
        </button>
      </div>

      <template v-else>
        <!-- 1. 账号信息与唯一用户名设置 -->
        <div class="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div class="text-xs text-slate-400 mb-1">注册电子邮箱</div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-lg sm:text-xl font-bold text-slate-800 font-mono">{{ store.username }}</span>
                <span class="text-xs bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded-full border border-emerald-100 font-bold">
                  已解锁全量数据与图表
                </span>
              </div>
            </div>
            <div class="flex gap-2 shrink-0">
              <a href="#/sponsor"
                 class="theme-bg text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm hover:opacity-90 no-underline">
                定制标的 / 我的定制
              </a>
            </div>
          </div>

          <div class="space-y-2 max-w-xl">
            <label class="text-sm font-bold text-slate-700 flex items-center gap-2">
              <i class="fa-solid fa-id-badge theme-text"></i>
              <span>唯一用户名（可直接用于登录）</span>
            </label>
            <p class="text-xs text-slate-500 leading-relaxed">
              设置唯一用户名后，您既可以使用<strong>用户名</strong>登录，也可以使用<strong>注册邮箱</strong>登录（用户名仅作为账号标识与登录凭证，不在股票代码后展示）。
            </p>
            <div class="flex flex-col sm:flex-row gap-2 pt-1">
              <input v-model="nicknameInput" type="text" maxlength="16" placeholder="请输入 2～16 位唯一用户名"
                     class="flex-1 px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none"
                     @keyup.enter="saveNickname">
              <button type="button" @click="saveNickname" :disabled="nicknameSaving"
                      class="theme-bg text-white px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50 hover:opacity-90 shrink-0">
                {{ nicknameSaving ? '保存中...' : '保存用户名' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 2. 全站图表会员权益 -->
        <section class="bg-white rounded-xl shadow-sm border border-slate-100 p-5 sm:p-6 space-y-4">
          <div class="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 class="font-bold text-slate-800">全站图表会员</h3>
              <p class="text-xs text-slate-400 mt-1">免费体验与付费会员独立记录；续费将在当前有效期后顺延。</p>
            </div>
            <span v-if="membership && membership.expire_at > Date.now()" class="text-xs rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 font-bold">权益有效</span>
            <span v-else class="text-xs rounded-full bg-slate-100 text-slate-500 px-2.5 py-1 font-bold">普通访问</span>
          </div>
          <div v-if="membership && membership.expire_at > Date.now()" class="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div><span class="text-slate-400">会员类型</span><div class="font-bold mt-1">{{ membership.source === 'trial' ? '注册免费体验' : '付费图表会员' }}</div></div>
            <div><span class="text-slate-400">开始时间</span><div class="font-bold mt-1">{{ formatDateExact(membership.start_at) }}</div></div>
            <div><span class="text-slate-400">到期时间</span><div class="font-bold mt-1">{{ formatDateExact(membership.expire_at) }}</div></div>
          </div>
          <div v-if="customMemberships.length" class="border-t pt-3 space-y-2">
            <div class="text-xs font-bold text-slate-700">私人定制标的权益</div>
            <div v-for="item in customMemberships" :key="item.etf_code+'-'+item.created_at" class="flex flex-wrap justify-between gap-2 text-xs border-b border-slate-50 pb-2">
              <span class="font-mono font-bold text-slate-700">{{item.etf_code}} · {{item.etf_name}}</span>
              <span :class="item.status==='active' && item.expire_at>Date.now() ? 'text-emerald-600' : 'text-slate-400'">{{item.status==='active' && item.expire_at>Date.now() ? '有效至 ' : '已到期 '}}{{formatDateExact(item.expire_at)}}</span>
            </div>
          </div>
          <div class="space-y-3">
            <div class="text-xs font-bold text-slate-700">选择续费套餐</div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button v-for="plan in membershipPrices" :key="plan.days" type="button" @click="selectedPlanDays=plan.days"
                      :class="selectedPlanDays===plan.days ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' : 'border-slate-200 bg-white'"
                      class="rounded-lg border p-3 text-left">
                <div class="text-xs text-slate-500">{{plan.label}}</div>
                <div class="text-lg font-extrabold text-slate-900 mt-1">¥{{membershipPrice(plan.days)}}</div>
                <div class="text-[10px] text-slate-400">{{plan.days}} 天</div>
              </button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start">
              <div class="space-y-2">
                <div class="flex gap-2">
                  <select v-model="membershipChannel" class="border rounded-lg px-3 py-2 text-xs"><option value="wechat">微信支付</option><option value="alipay">支付宝</option></select>
                  <input v-model="membershipTx" maxlength="6" inputmode="numeric" placeholder="支付凭证后 6 位" class="flex-1 min-w-0 border rounded-lg px-3 py-2 text-xs">
                </div>
                <button type="button" @click="submitMembershipOrder" :disabled="membershipSubmitting" class="theme-bg text-white rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50">
                  {{membershipSubmitting ? '提交中...' : '提交会员订单 · ¥'+membershipPrice(selectedPlanDays)}}
                </button>
                <p class="text-[10px] text-slate-400">支付后提交凭证，管理员人工核对；审核通过后自动开通。不会自动续费。</p>
              </div>
              <img v-if="membershipQr()" :src="membershipQr()" alt="会员支付收款码" class="w-32 h-32 object-contain border rounded-lg p-1 bg-white">
              <div v-else class="w-32 h-32 border border-dashed rounded-lg flex items-center justify-center text-[10px] text-slate-400 text-center p-2">管理员尚未配置收款码</div>
            </div>
          </div>
        </section>

        <!-- 3. 我的订单记录 -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div class="px-5 sm:px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <div class="font-bold text-slate-700 text-base">我的订单与支持记录</div>
            <button @click="loadProfileData" class="text-xs text-slate-400 hover:theme-text">
              <i class="fa-solid fa-rotate-right mr-1"></i>刷新列表
            </button>
          </div>
          <div class="overflow-x-auto custom-scrollbar">
            <table class="w-full text-left text-sm whitespace-nowrap">
              <thead class="bg-slate-50 text-xs text-slate-500 border-b font-bold">
                <tr>
                  <th class="py-3 px-4">凭证(后6位)</th>
                  <th class="py-3 px-4">类型 / 详情</th>
                  <th class="py-3 px-4">实付金额</th>
                  <th class="py-3 px-4">状态</th>
                  <th class="py-3 px-4">提交时间</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                <tr v-for="order in orders" :key="order.id" class="hover:bg-slate-50">
                  <td class="py-3.5 px-4 font-mono font-bold text-slate-700">
                    {{ order.tx_id_last6 && order.tx_id_last6 !== '000000' ? ('****' + order.tx_id_last6) : '-' }}
                  </td>
                  <td class="py-3.5 px-4 font-medium text-slate-800">
                    <span class="px-2 py-0.5 rounded text-xs font-bold"
                          :class="order.order_type==='tip' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'">
                      {{ formatOrderType(order) }}
                    </span>
                    <span v-if="order.order_type==='symbol_custom' || order.order_type==='symbol_sponsor'" class="text-xs text-slate-500 ml-1.5">
                      {{ order.symbol_count || 1 }}只 · {{ order.sponsor_days || 30 }}天
                    </span>
                    <span v-if="order.promo_code" class="text-[10px] bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.2 rounded ml-1.5 font-bold">
                      优惠码: {{ order.promo_code }}
                    </span>
                  </td>
                  <td class="py-3.5 px-4 font-bold font-mono text-red-500">
                    ¥ {{ Number(order.amount || 0).toFixed(2) }}
                  </td>
                  <td class="py-3.5 px-4 font-bold text-xs">
                    <span :class="order.status === 'approved' ? 'text-emerald-600' : (order.status === 'pending' ? 'text-orange-500' : 'text-slate-400')">
                      {{ formatStatus(order.status) }}
                    </span>
                  </td>
                  <td class="py-3.5 px-4 text-xs font-mono text-slate-400">{{ formatDateExact(order.created_at) }}</td>
                </tr>
                <tr v-if="!orders.length">
                  <td colspan="5" class="py-10 text-center text-slate-400 text-sm font-medium">暂无订单记录</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 3. 修改密码 -->
        <div class="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 class="font-bold text-slate-700 text-base mb-4">修改账号密码</h3>
          <div class="space-y-3 max-w-md">
            <input v-model="pwdForm.oldPassword" type="password" placeholder="原密码"
                   class="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">
            <input v-model="pwdForm.newPassword" type="password" placeholder="新密码（至少8位）"
                   class="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">
            <input v-model="pwdForm.confirmPassword" type="password" placeholder="确认新密码"
                   class="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">
            <button @click="changePassword" :disabled="pwdLoading"
                    class="theme-bg text-white px-6 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 hover:opacity-90 shadow-sm">
              {{ pwdLoading ? '保存中...' : '确认修改' }}
            </button>
          </div>
        </div>
      </template>
    </div>
  `,
};