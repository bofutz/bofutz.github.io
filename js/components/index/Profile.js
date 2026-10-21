/**
 * 波幅探长 - 个人中心 (v5.0)
 * 1. 已移除：邀请码、被邀请人列表、VIP剩余天数、会员等级
 * 2. 新增置顶：用户名昵称设置（用于在数据看板赞助标的后展示赞助者昵称）
 * 3. 包含：我的订单（赞助订单与打赏记录）、安全问题设置、密码修改
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

    // 用户名昵称设置
    const nicknameInput = ref("");
    const nicknameSaving = ref(false);

    const saveNickname = async () => {
      const val = (nicknameInput.value || "").trim();
      if (!val || val.length < 2 || val.length > 16) {
        store.showToast("昵称长度需为 2～16 个字符", "error");
        return;
      }
      nicknameSaving.value = true;
      try {
        const res = await authApi.updateNickname(val);
        const saved = res.nickname || val;
        store.setUserState({ nickname: saved });
        nicknameInput.value = saved;
        store.showToast(res.message || "昵称已保存！数据看板将展示您的昵称");
      } catch (err) {
        store.showToast(err.message || "昵称保存失败", "error");
      } finally {
        nicknameSaving.value = false;
      }
    };

    // 修改密码
    const pwdForm = reactive({
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    const pwdLoading = ref(false);

    // 安全问题
    const securitySet = ref(true);
    const secForm = reactive({
      q1: "",
      a1: "",
      q2: "",
      a2: "",
      q3: "",
      a3: "",
    });
    const secLoading = ref(false);
    const secEditing = ref(false);

    const loadSecurityStatus = async () => {
      if (!store.state.isLoggedIn) return;
      try {
        const res = await authApi.getSecurityStatus();
        const set = !!(res.data?.security_set ?? res.security_set);
        securitySet.value = set;
        store.setSecuritySet?.(set);
        if (!set) secEditing.value = true;
      } catch (e) {
        console.warn("loadSecurityStatus:", e);
      }
    };

    const saveSecurity = async () => {
      if (
        !secForm.q1?.trim() ||
        !secForm.a1?.trim() ||
        !secForm.q2?.trim() ||
        !secForm.a2?.trim() ||
        !secForm.q3?.trim() ||
        !secForm.a3?.trim()
      ) {
        store.showToast("请填写完整的三个问题与答案", "error");
        return;
      }
      const qs = [secForm.q1, secForm.q2, secForm.q3].map((q) => q.trim());
      if (new Set(qs).size < 3) {
        store.showToast("三个问题不能重复", "error");
        return;
      }
      secLoading.value = true;
      try {
        await authApi.setSecurityQuestions({
          q1: secForm.q1.trim(),
          a1: secForm.a1.trim(),
          q2: secForm.q2.trim(),
          a2: secForm.a2.trim(),
          q3: secForm.q3.trim(),
          a3: secForm.a3.trim(),
        });
        store.showToast("安全问题已保存");
        securitySet.value = true;
        store.setSecuritySet?.(true);
        secEditing.value = false;
        secForm.a1 = "";
        secForm.a2 = "";
        secForm.a3 = "";
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        secLoading.value = false;
      }
    };

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
          store.setUserState({
            username: d.username,
            nickname: d.nickname || "",
            securitySet: d.security_set,
          });
          nicknameInput.value = d.nickname || "";
          if (d.security_set != null) {
            securitySet.value = !!d.security_set;
            store.setSecuritySet?.(!!d.security_set);
          }
        }

        await loadSecurityStatus();
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
      if (pwdForm.newPassword.length < 6) {
        store.showToast("新密码至少需 6 位", "error");
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
      if (o.order_type === "symbol_sponsor") return "赞助标的";
      if (o.order_type === "tip") return "温暖打赏";
      return "历史订单";
    };

    onMounted(() => {
      nicknameInput.value = store.state.nickname || "";
      if (store.state.isLoggedIn) loadProfileData();
    });

    return {
      store: store.state,
      orders,
      loading,
      nicknameInput,
      nicknameSaving,
      saveNickname,
      pwdForm,
      pwdLoading,
      securitySet,
      secForm,
      secLoading,
      secEditing,
      saveSecurity,
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
        <p class="text-sm text-slate-500">请先登录或免费注册账号</p>
        <button type="button" @click="store.authMode='login'; store.authModalVisible=true"
                class="theme-bg text-white px-5 py-2 rounded-lg text-sm font-bold">
          立即登录 / 注册
        </button>
      </div>

      <template v-else>
        <div v-if="!securitySet"
             class="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <i class="fa-solid fa-triangle-exclamation mr-1"></i>
            <strong>请尽快设置安全问题</strong>，以便忘记密码时无需邮箱即可自助找回。
          </div>
          <button type="button" @click="secEditing = true"
                  class="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg font-bold shrink-0 hover:opacity-90">
            去设置
          </button>
        </div>

        <!-- 1. 账号信息与专属昵称设置 -->
        <div class="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div class="text-xs text-slate-400 mb-1">注册邮箱 / 登录账号</div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-lg sm:text-xl font-bold text-slate-800 font-mono">{{ store.username }}</span>
                <span class="text-xs bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded-full border border-emerald-100 font-bold">
                  已解锁全量数据与图表
                </span>
              </div>
            </div>
            <div class="flex gap-2 shrink-0">
              <a href="#/sponsor?tab=mine"
                 class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold no-underline">
                我的赞助管理
              </a>
              <a href="#/sponsor"
                 class="theme-bg text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm hover:opacity-90 no-underline">
                赞助新标的
              </a>
            </div>
          </div>

          <div class="space-y-2 max-w-xl">
            <label class="text-sm font-bold text-slate-700 flex items-center gap-2">
              <i class="fa-solid fa-signature theme-text"></i>
              <span>设置您的用户名昵称（赞助标的展示署名）</span>
            </label>
            <p class="text-xs text-slate-500 leading-relaxed">
              设置昵称后，您赞助的监控标的将在<strong>数据看板</strong>与<strong>公共赞助池</strong>醒目显示
              <span class="text-amber-700 font-bold">「❤️ 您的昵称 赞助」</span>，让全体用户知道是您在为大家服务！
            </p>
            <div class="flex flex-col sm:flex-row gap-2 pt-1">
              <input v-model="nicknameInput" type="text" maxlength="16" placeholder="请输入 2～16 位中英文或数字昵称"
                     class="flex-1 px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none"
                     @keyup.enter="saveNickname">
              <button type="button" @click="saveNickname" :disabled="nicknameSaving"
                      class="theme-bg text-white px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50 hover:opacity-90 shrink-0">
                {{ nicknameSaving ? '保存中...' : '保存昵称' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 2. 我的订单记录 -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div class="px-5 sm:px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <div class="font-bold text-slate-700 text-base">我的订单与支持记录</div>
            <button @click="loadProfileData" class="text-xs text-slate-400 hover:theme-text">
              <i class="fa-solid fa-rotate-right mr-1"></i>刷新列表
            </button>
          </div>
          <div class="overflow-x-auto">
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
                    <span v-if="order.order_type==='symbol_sponsor'" class="text-xs text-slate-500 ml-1.5">
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

        <!-- 3. 安全问题设置 -->
        <div class="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 class="font-bold text-slate-700 text-base">安全问题（密码找回）</h3>
              <p class="text-[11px] text-slate-400 mt-0.5">
                自行设置 3 个最熟悉的问题；忘记密码时随机抽 2 题，全部答对即可重置密码
              </p>
            </div>
            <span v-if="securitySet" class="text-xs text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">已设置</span>
            <span v-else class="text-xs text-red-500 font-bold bg-red-50 px-2.5 py-1 rounded-full border border-red-100">未设置</span>
          </div>

          <div v-if="secEditing || !securitySet" class="space-y-3 max-w-xl">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input v-model="secForm.q1" type="text" placeholder="问题1（如：小学班主任姓氏）"
                     class="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">
              <input v-model="secForm.a1" type="text" placeholder="答案1"
                     class="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input v-model="secForm.q2" type="text" placeholder="问题2（如：第一只宠物名字）"
                     class="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">
              <input v-model="secForm.a2" type="text" placeholder="答案2"
                     class="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input v-model="secForm.q3" type="text" placeholder="问题3（如：最喜欢的城市）"
                     class="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">
              <input v-model="secForm.a3" type="text" placeholder="答案3"
                     class="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">
            </div>
            <p class="text-[11px] text-slate-400">答案不区分大小写与空格；请务必记住，找回时无法查看原答案。</p>
            <div class="flex flex-wrap gap-2">
              <button type="button" @click="saveSecurity" :disabled="secLoading"
                      class="theme-bg text-white px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50 hover:opacity-90">
                {{ secLoading ? '保存中...' : '保存安全问题' }}
              </button>
              <button v-if="securitySet" type="button" @click="secEditing = false"
                      class="text-sm text-slate-500 px-3 py-2">
                取消
              </button>
            </div>
          </div>
          <div v-else>
            <button type="button" @click="secEditing = true"
                    class="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-200">
              重新设置安全问题
            </button>
          </div>
        </div>

        <!-- 4. 修改密码 -->
        <div class="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 class="font-bold text-slate-700 text-base mb-4">修改账号密码</h3>
          <div class="space-y-3 max-w-md">
            <input v-model="pwdForm.oldPassword" type="password" placeholder="原密码"
                   class="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:theme-border outline-none">
            <input v-model="pwdForm.newPassword" type="password" placeholder="新密码（至少6位）"
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
