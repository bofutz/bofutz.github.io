/**
 * 波幅探长 - 后台【用户管理】分块组件
 * js/components/admin/UserMgmt.js
 */
import { store } from "../../store.js";
import { adminApi } from "../../api/admin.js";

const { ref, reactive, computed, onMounted } = Vue;

export default {
  name: "UserMgmt",
  setup() {
    const users = ref([]);
    const loading = ref(false);
    const searchQuery = ref("");
    const selectedUserIds = ref([]);

    // 弹窗控制
    const chargeModalVisible = ref(false);
    const chargeTarget = ref(null);
    const chargeDays = ref(7);

    const batchChargeVisible = ref(false);
    const batchDays = ref(7);

    const resetPwdVisible = ref(false);
    const resetTarget = ref(null);
    const resetConfirmSecret = ref("");

    const deleteUserVisible = ref(false);
    const deleteTarget = ref(null);
    const deleteConfirmSecret = ref("");

    const loadUsers = async () => {
      loading.value = true;
      try {
        const res = await adminApi.fetchUsers();
        users.value = res.data || [];
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    const filteredUsers = computed(() => {
      if (!searchQuery.value) return users.value;
      const q = searchQuery.value.toLowerCase().trim();
      return users.value.filter(
        (u) =>
          (u.username && u.username.toLowerCase().includes(q)) ||
          (u.referral_code && u.referral_code.toLowerCase().includes(q)) ||
          (u.ip && u.ip.includes(q))
      );
    });

    const toggleSelectAll = (e) => {
      selectedUserIds.value = e.target.checked ? filteredUsers.value.map((u) => u.id) : [];
    };

    // 单个充值
    const openChargeModal = (u) => {
      chargeTarget.value = u;
      chargeDays.value = 7;
      chargeModalVisible.value = true;
    };
    const submitCharge = async () => {
      try {
        await adminApi.chargeUser(chargeTarget.value.id, chargeDays.value);
        store.showToast("天数修改成功");
        chargeModalVisible.value = false;
        await loadUsers();
      } catch (err) {
        store.showToast(err.message, "error");
      }
    };

    // 批量充值
    const openBatchCharge = () => {
      if (!selectedUserIds.value.length) {
        store.showToast("请先勾选目标用户", "error");
        return;
      }
      batchDays.value = 7;
      batchChargeVisible.value = true;
    };
    const submitBatchCharge = async () => {
      try {
        await adminApi.batchChargeUsers(selectedUserIds.value, batchDays.value);
        store.showToast("批量充值处理完成");
        batchChargeVisible.value = false;
        selectedUserIds.value = [];
        await loadUsers();
      } catch (err) {
        store.showToast(err.message, "error");
      }
    };

    // 重置密码
    const openResetPwd = (u) => {
      resetTarget.value = u;
      resetConfirmSecret.value = "";
      resetPwdVisible.value = true;
    };
    const submitResetPwd = async () => {
      try {
        const res = await adminApi.resetPassword(resetTarget.value.id, resetConfirmSecret.value);
        store.showToast(res.message || "密码已重置");
        resetPwdVisible.value = false;
      } catch (err) {
        store.showToast(err.message, "error");
      }
    };

    // 删除用户
    const openDeleteUser = (u) => {
      deleteTarget.value = u;
      deleteConfirmSecret.value = "";
      deleteUserVisible.value = true;
    };
    const submitDeleteUser = async () => {
      try {
        await adminApi.deleteUser(deleteTarget.value.id, deleteConfirmSecret.value);
        store.showToast("用户已删除");
        deleteUserVisible.value = false;
        await loadUsers();
      } catch (err) {
        store.showToast(err.message, "error");
      }
    };

    const formatDate = (ts) => {
      if (!ts) return "-";
      const d = new Date(ts);
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    };

    onMounted(() => {
      loadUsers();
    });

    return {
      loading,
      searchQuery,
      selectedUserIds,
      filteredUsers,
      chargeModalVisible,
      chargeTarget,
      chargeDays,
      batchChargeVisible,
      batchDays,
      resetPwdVisible,
      resetTarget,
      resetConfirmSecret,
      deleteUserVisible,
      deleteTarget,
      deleteConfirmSecret,
      loadUsers,
      toggleSelectAll,
      openChargeModal,
      submitCharge,
      openBatchCharge,
      submitBatchCharge,
      openResetPwd,
      submitResetPwd,
      openDeleteUser,
      submitDeleteUser,
      formatDate,
    };
  },
  template: `
    <div class="space-y-4 select-none">
      <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 class="text-xl font-bold text-slate-800">用户管理</h2>
          <p class="text-xs text-slate-400 mt-1">充天数 · 重置密码 · 删除均需谨慎操作</p>
        </div>
        <div class="flex gap-2 flex-wrap">
          <input v-model="searchQuery" type="text" placeholder="搜索 邮箱/邀请码/IP" class="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:theme-border sm:w-48">
          <button @click="openBatchCharge" class="text-xs bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-2 rounded-lg font-bold hover:bg-emerald-100">批量充天数</button>
          <button @click="loadUsers" class="bg-white border px-3 py-2 rounded-lg text-sm hover:bg-slate-50"><i class="fa-solid fa-rotate-right" :class="{'animate-spin': loading}"></i></button>
        </div>
      </div>

      <!-- 用户列表表格 -->
      <div class="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
        <div v-if="loading" class="text-center py-10 text-slate-400">
          <i class="fa-solid fa-circle-notch animate-spin text-2xl theme-text"></i>
        </div>
        <div v-else-if="!filteredUsers.length" class="text-center py-12 text-slate-400 text-sm">
          暂无用户数据
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm whitespace-nowrap text-left">
            <thead class="bg-slate-50 text-slate-500 border-b text-xs font-bold">
              <tr>
                <th class="py-3 px-3 w-8"><input type="checkbox" @change="toggleSelectAll" :checked="selectedUserIds.length && selectedUserIds.length === filteredUsers.length"></th>
                <th class="py-3 px-4">ID / 注册时间</th>
                <th class="py-3 px-4">账号</th>
                <th class="py-3 px-4">IP</th>
                <th class="py-3 px-4">通用 VIP</th>
                <th class="py-3 px-4">专属邀请码</th>
                <th class="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="u in filteredUsers" :key="u.id" class="hover:bg-slate-50">
                <td class="px-3"><input type="checkbox" :value="u.id" v-model="selectedUserIds"></td>
                <td class="py-3 px-4 text-xs text-slate-400 font-mono">{{ u.id }}<br>{{ formatDate(u.created_at) }}</td>
                <td class="py-3 px-4 font-bold text-slate-800">
                  {{ u.username }}
                  <div v-if="u.referred_by" class="text-[10px] text-slate-400 font-normal">邀请人: {{ u.referred_by }}</div>
                </td>
                <td class="py-3 px-4 font-mono text-xs text-slate-500">{{ u.ip || '-' }}</td>
                <td class="py-3 px-4 font-mono font-bold" :class="(u.shared_vip_days || u.vip_days_left) > 0 ? 'text-emerald-600' : 'text-slate-400'">
                  {{ u.shared_vip_days ?? u.vip_days_left ?? 0 }} 天
                </td>
                <td class="py-3 px-4 font-mono text-xs font-bold text-slate-700">{{ u.referral_code || '-' }}</td>
                <td class="py-3 px-4 text-right space-x-1">
                  <button @click="openChargeModal(u)" class="text-xs bg-emerald-50 text-emerald-600 px-2 py-1 rounded border border-emerald-100 font-bold">充天数</button>
                  <button @click="openResetPwd(u)" class="text-xs bg-amber-50 text-amber-600 px-2 py-1 rounded border border-amber-100 font-bold">重置密码</button>
                  <button @click="openDeleteUser(u)" class="text-xs bg-red-50 text-red-500 px-2 py-1 rounded border border-red-100 font-bold">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 充天数弹窗 -->
      <div v-if="chargeModalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="chargeModalVisible = false">
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 space-y-3 shadow-2xl">
          <h3 class="font-bold text-slate-800">充天数 · {{ chargeTarget?.username }}</h3>
          <input type="number" v-model.number="chargeDays" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none" placeholder="天数（可为负）">
          <div class="flex justify-end gap-2 pt-2">
            <button @click="chargeModalVisible = false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button @click="submitCharge" class="theme-bg text-white px-4 py-2 rounded-lg text-sm font-bold">确认</button>
          </div>
        </div>
      </div>

      <!-- 批量充天数弹窗 -->
      <div v-if="batchChargeVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="batchChargeVisible = false">
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 space-y-3 shadow-2xl">
          <h3 class="font-bold text-slate-800">批量充天数 (已选 {{ selectedUserIds.length }} 人)</h3>
          <input type="number" v-model.number="batchDays" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
          <div class="flex justify-end gap-2 pt-2">
            <button @click="batchChargeVisible = false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button @click="submitBatchCharge" class="theme-bg text-white px-4 py-2 rounded-lg text-sm font-bold">确认批量</button>
          </div>
        </div>
      </div>

      <!-- 重置密码确认弹窗 -->
      <div v-if="resetPwdVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="resetPwdVisible = false">
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 space-y-3 shadow-2xl">
          <h3 class="font-bold text-amber-600">重置密码 · {{ resetTarget?.username }}</h3>
          <p class="text-xs text-slate-400">请输入管理密钥确认，密码将重置为 bofutz</p>
          <input type="password" v-model="resetConfirmSecret" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none" placeholder="Admin-Secret">
          <div class="flex justify-end gap-2 pt-2">
            <button @click="resetPwdVisible = false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button @click="submitResetPwd" class="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-bold">确认重置</button>
          </div>
        </div>
      </div>

      <!-- 删除用户确认弹窗 -->
      <div v-if="deleteUserVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="deleteUserVisible = false">
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 space-y-3 shadow-2xl">
          <h3 class="font-bold text-red-600">删除用户 · {{ deleteTarget?.username }}</h3>
          <p class="text-xs text-slate-400">请再次输入 Admin-Secret 确认，删除后不可恢复！</p>
          <input type="password" v-model="deleteConfirmSecret" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none" placeholder="Admin-Secret">
          <div class="flex justify-end gap-2 pt-2">
            <button @click="deleteUserVisible = false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button @click="submitDeleteUser" class="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold">确认删除</button>
          </div>
        </div>
      </div>
    </div>
  `,
};
