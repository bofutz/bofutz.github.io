/**
 * 波幅探长 - 个人中心分块组件
 * js/components/index/Profile.js
 */
import { store } from "../../store.js";
import { authApi } from "../../api/auth.js";
import { planApi } from "../../api/plan.js";
import { watchlistApi } from "../../api/watchlist.js";

const { ref, reactive, onMounted } = Vue;

export default {
  name: "Profile",
  setup() {
    const orders = ref([]);
    const invitees = ref([]);
    const customList = ref([]);
    const loading = ref(false);

    const pwdForm = reactive({
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    const pwdLoading = ref(false);

    const loadProfileData = async () => {
      loading.value = true;
      try {
        const [ordersRes, inviteesRes, customRes] = await Promise.all([
          planApi.fetchUserOrders().catch(() => ({ data: [] })),
          authApi.getInvitees().catch(() => ({ data: [] })),
          watchlistApi.fetchUserCustomWatchlist().catch(() => ({ data: [] })),
        ]);

        orders.value = ordersRes.data || [];
        invitees.value = inviteesRes.data || [];
        customList.value = customRes.data || [];
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
      if (pwdForm.newPassword !== pwdForm.confirmPassword) {
        store.showToast("两次输入的新密码不一致", "error");
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

    onMounted(() => {
      if (store.state.isLoggedIn) {
        loadProfileData();
      }
    });

    return {
      store: store.state,
      settings: store.state.publicSettings,
      orders,
      invitees,
      customList,
      loading,
      pwdForm,
      pwdLoading,
      changePassword,
    };
  },
  template: `
    <div class="max-w-4xl mx-auto space-y-5 select-none">
      <!-- VIP 状态卡片 -->
      <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
        <div>
          <div class="text-xs text-slate-400 mb-1">通用监控 VIP 权限</div>
          <div class="flex items-center gap-2">
            <span class="text-2xl font-bold" :class="store.isVip ? 'theme-text' : 'text-slate-400'">
              {{ store.isVip ? '已开通' : '未开通' }}
            </span>
            <span v-if="store.isVip" class="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded border border-emerald-100 font-bold">
              剩余 {{ store.vipDaysLeft }} 天
            </span>
          </div>
        </div>
        <a href="#/plan" class="theme-bg text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm">
          {{ store.isVip ? '续费 VIP' : '立即开通' }}
        </a>
      </div>

      <!-- 专属邀请码 -->
      <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-3">
        <div class="font-bold text-slate-700">我的专属邀请码</div>
        <div class="bg-slate-50 p-4 rounded-xl flex justify-between items-center border border-slate-100">
          <span class="font-mono text-2xl font-extrabold theme-text tracking-widest">{{ store.referralCode || '-' }}</span>
          <span class="text-xs text-slate-500">邀请好友注册双方各赠送 VIP 天数</span>
        </div>
      </div>

      <!-- 修改密码 -->
      <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-3 max-w-md">
        <div class="font-bold text-slate-700">修改账号密码</div>
        <input v-model="pwdForm.oldPassword" type="password" placeholder="原密码" class="w-full border px-3 py-2 rounded-lg text-sm">
        <input v-model="pwdForm.newPassword" type="password" placeholder="新密码 (至少6位)" class="w-full border px-3 py-2 rounded-lg text-sm">
        <input v-model="pwdForm.confirmPassword" type="password" placeholder="确认新密码" class="w-full border px-3 py-2 rounded-lg text-sm">
        <button @click="changePassword" :disabled="pwdLoading" class="theme-bg text-white px-5 py-2 rounded-lg text-xs font-bold">
          {{ pwdLoading ? '保存中...' : '确认修改' }}
        </button>
      </div>
    </div>
  `,
};
