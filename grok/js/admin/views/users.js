/**
 * 管理后台 · 用户管理
 * - 搜索 / 列表
 * - 单用户充天数
 * - 批量充天数
 * - 重置密码 / 删除（需二次确认 Admin-Secret）
 */
import {
  ref, computed, onMounted,
} from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";
import { formatDate } from "../../utils.js";

export const UsersView = {
  name: "AdminUsers",
  props: {
    fetchAdmin: { type: Function, required: true },
    showToast: { type: Function, required: true },
  },
  setup(props) {
    const users = ref([]);
    const loading = ref(false);
    const userSearchQuery = ref("");
    const selectedUserIds = ref([]);

    // 充天数
    const chargeModalVisible = ref(false);
    const chargeTarget = ref(null);
    const chargeDays = ref(7);

    // 批量充
    const batchChargeVisible = ref(false);
    const batchDays = ref(7);

    // 重置密码
    const resetPwdVisible = ref(false);
    const resetTarget = ref(null);
    const resetConfirmSecret = ref("");

    // 删除
    const deleteUserVisible = ref(false);
    const deleteTarget = ref(null);
    const deleteConfirmSecret = ref("");

    const filteredUsers = computed(() => {
      let list = users.value;
      if (userSearchQuery.value) {
        const q = userSearchQuery.value.toLowerCase();
        list = list.filter(
          (u) =>
            (u.username || "").toLowerCase().includes(q) ||
            (u.referral_code || "").toLowerCase().includes(q) ||
            (u.ip || u.register_ip || "").includes(q)
        );
      }
      return list;
    });

    const fetchUsers = async () => {
      loading.value = true;
      try {
        const d = await props.fetchAdmin("/api/admin/users");
        if (d.success) users.value = d.data || [];
      } catch (e) {
        props.showToast(e.message, "error");
      } finally {
        loading.value = false;
      }
    };

    const toggleSelectAllUsers = (e) => {
      selectedUserIds.value = e.target.checked
        ? filteredUsers.value.map((u) => u.id)
        : [];
    };

    // ---------- 充天数 ----------
    const openChargeModal = (u) => {
      chargeTarget.value = u;
      chargeDays.value = 7;
      chargeModalVisible.value = true;
    };

    const submitCharge = async () => {
      try {
        await props.fetchAdmin("/api/admin/users/charge", {
          method: "POST",
          body: JSON.stringify({
            user_id: chargeTarget.value.id,
            add_days: chargeDays.value,
          }),
        });
        props.showToast("已调整天数", "success");
        chargeModalVisible.value = false;
        fetchUsers();
      } catch (e) {
        props.showToast(e.message, "error");
      }
    };

    // ---------- 批量充 ----------
    const openBatchCharge = () => {
      if (!selectedUserIds.value.length) {
        props.showToast("请先勾选用户", "error");
        return;
      }
      batchDays.value = 7;
      batchChargeVisible.value = true;
    };

    const submitBatchCharge = async () => {
      try {
        await props.fetchAdmin("/api/admin/users/batch_charge", {
          method: "POST",
          body: JSON.stringify({
            user_ids: selectedUserIds.value,
            add_days: batchDays.value,
          }),
        });
        props.showToast("批量充值完成", "success");
        batchChargeVisible.value = false;
        selectedUserIds.value = [];
        fetchUsers();
      } catch (e) {
        props.showToast(e.message, "error");
      }
    };

    // ---------- 重置密码 ----------
    const openResetPwd = (u) => {
      resetTarget.value = u;
      resetConfirmSecret.value = "";
      resetPwdVisible.value = true;
    };

    const submitResetPwd = async () => {
      try {
        const d = await props.fetchAdmin("/api/admin/users/reset_password", {
          method: "POST",
          body: JSON.stringify({
            user_id: resetTarget.value.id,
            admin_confirm: resetConfirmSecret.value,
          }),
        });
        props.showToast(d.message || "已重置", "success");
        resetPwdVisible.value = false;
      } catch (e) {
        props.showToast(e.message, "error");
      }
    };

    // ---------- 删除 ----------
    const openDeleteUser = (u) => {
      deleteTarget.value = u;
      deleteConfirmSecret.value = "";
      deleteUserVisible.value = true;
    };

    const submitDeleteUser = async () => {
      try {
        await props.fetchAdmin("/api/admin/users", {
          method: "DELETE",
          body: JSON.stringify({
            user_id: deleteTarget.value.id,
            admin_confirm: deleteConfirmSecret.value,
          }),
        });
        props.showToast("用户已删除", "success");
        deleteUserVisible.value = false;
        fetchUsers();
      } catch (e) {
        props.showToast(e.message, "error");
      }
    };

    onMounted(fetchUsers);

    return {
      users,
      loading,
      userSearchQuery,
      selectedUserIds,
      filteredUsers,
      fetchUsers,
      toggleSelectAllUsers,
      formatDate,
      chargeModalVisible,
      chargeTarget,
      chargeDays,
      openChargeModal,
      submitCharge,
      batchChargeVisible,
      batchDays,
      openBatchCharge,
      submitBatchCharge,
      resetPwdVisible,
      resetTarget,
      resetConfirmSecret,
      openResetPwd,
      submitResetPwd,
      deleteUserVisible,
      deleteTarget,
      deleteConfirmSecret,
      openDeleteUser,
      submitDeleteUser,
    };
  },

  template: `
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h2 class="text-xl font-bold">用户管理</h2>
          <p class="text-xs text-slate-400">充天数 · 重置密码 · 删除均需谨慎操作</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <input v-model="userSearchQuery" placeholder="搜索邮箱/邀请码/IP"
            class="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white sm:w-48">
          <button @click="openBatchCharge"
            class="text-sm bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-2 rounded-lg">
            批量充天数
          </button>
          <button @click="fetchUsers"
            class="text-sm bg-white border border-slate-200 px-3 py-2 rounded-lg">
            <i class="fa-solid fa-rotate-right" :class="{'animate-spin': loading}"></i>
          </button>
        </div>
      </div>

      <div class="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
        <div class="overflow-x-auto custom-scrollbar">
          <table class="w-full text-sm whitespace-nowrap">
            <thead class="bg-slate-50 text-slate-500 border-b">
              <tr>
                <th class="py-3 px-3 w-8">
                  <input type="checkbox"
                    @change="toggleSelectAllUsers"
                    :checked="selectedUserIds.length && selectedUserIds.length === filteredUsers.length">
                </th>
                <th class="py-3 px-4 text-left">ID/时间</th>
                <th class="py-3 px-4 text-left">账号</th>
                <th class="py-3 px-4 text-left">IP</th>
                <th class="py-3 px-4 text-left">通用VIP</th>
                <th class="py-3 px-4 text-left">邀请码</th>
                <th class="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="u in filteredUsers" :key="u.id" class="hover:bg-slate-50">
                <td class="px-3">
                  <input type="checkbox" :value="u.id" v-model="selectedUserIds">
                </td>
                <td class="py-3 px-4 text-xs text-slate-400">
                  {{ u.id }}<br>{{ formatDate(u.created_at) }}
                </td>
                <td class="py-3 px-4 font-bold">
                  {{ u.username }}
                  <div v-if="u.referred_by || u.ref_by" class="text-[10px] text-slate-400">
                    邀请: {{ u.referred_by || u.ref_by }}
                  </div>
                </td>
                <td class="py-3 px-4 font-mono text-xs">{{ u.ip || u.register_ip || '-' }}</td>
                <td class="py-3 px-4"
                  :class="(u.shared_vip_days || u.vip_days_left) > 0 ? 'text-emerald-500 font-bold' : 'text-slate-400'">
                  {{ u.shared_vip_days ?? u.vip_days_left ?? 0 }} 天
                </td>
                <td class="py-3 px-4 font-mono text-xs font-bold">{{ u.referral_code || '-' }}</td>
                <td class="py-3 px-4 text-right space-x-1">
                  <button @click="openChargeModal(u)"
                    class="text-xs bg-emerald-50 text-emerald-600 px-2 py-1 rounded border border-emerald-100">
                    充天数
                  </button>
                  <button @click="openResetPwd(u)"
                    class="text-xs bg-amber-50 text-amber-600 px-2 py-1 rounded border border-amber-100">
                    重置密码
                  </button>
                  <button @click="openDeleteUser(u)"
                    class="text-xs bg-red-50 text-red-500 px-2 py-1 rounded border border-red-100">
                    删除
                  </button>
                </td>
              </tr>
              <tr v-if="!filteredUsers.length">
                <td colspan="7" class="py-10 text-center text-slate-400">暂无用户</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 充天数弹窗 -->
      <div v-if="chargeModalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4"
        @click.self="chargeModalVisible=false">
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 space-y-3">
          <h3 class="font-bold">充天数 · {{ chargeTarget?.username }}</h3>
          <p class="text-xs text-slate-400">正数增加，负数扣减</p>
          <input type="number" v-model.number="chargeDays"
            class="w-full border px-3 py-2 rounded-lg text-sm" placeholder="天数">
          <div class="flex justify-end gap-2">
            <button @click="chargeModalVisible=false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button @click="submitCharge" class="theme-bg text-white px-4 py-2 rounded-lg text-sm">确认</button>
          </div>
        </div>
      </div>

      <!-- 批量充天数 -->
      <div v-if="batchChargeVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4"
        @click.self="batchChargeVisible=false">
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 space-y-3">
          <h3 class="font-bold">批量充天数</h3>
          <p class="text-xs text-slate-400">已选 {{ selectedUserIds.length }} 人</p>
          <input type="number" v-model.number="batchDays"
            class="w-full border px-3 py-2 rounded-lg text-sm" placeholder="天数">
          <div class="flex justify-end gap-2">
            <button @click="batchChargeVisible=false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button @click="submitBatchCharge" class="theme-bg text-white px-4 py-2 rounded-lg text-sm">确认</button>
          </div>
        </div>
      </div>

      <!-- 重置密码 -->
      <div v-if="resetPwdVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4"
        @click.self="resetPwdVisible=false">
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 space-y-3">
          <h3 class="font-bold text-amber-600">重置密码 · {{ resetTarget?.username }}</h3>
          <p class="text-xs text-slate-400">请再次输入 Admin-Secret 确认</p>
          <input type="password" v-model="resetConfirmSecret"
            class="w-full border px-3 py-2 rounded-lg text-sm" placeholder="Admin-Secret">
          <div class="flex justify-end gap-2">
            <button @click="resetPwdVisible=false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button @click="submitResetPwd" class="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm">确认重置</button>
          </div>
        </div>
      </div>

      <!-- 删除用户 -->
      <div v-if="deleteUserVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4"
        @click.self="deleteUserVisible=false">
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 space-y-3">
          <h3 class="font-bold text-red-600">删除用户 · {{ deleteTarget?.username }}</h3>
          <p class="text-xs text-slate-400">请再次输入 Admin-Secret 确认，不可恢复</p>
          <input type="password" v-model="deleteConfirmSecret"
            class="w-full border px-3 py-2 rounded-lg text-sm" placeholder="Admin-Secret">
          <div class="flex justify-end gap-2">
            <button @click="deleteUserVisible=false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button @click="submitDeleteUser" class="bg-red-500 text-white px-4 py-2 rounded-lg text-sm">确认删除</button>
          </div>
        </div>
      </div>
    </div>
  `,
};
