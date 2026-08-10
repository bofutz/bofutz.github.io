/**
 * 波幅探长 - 后台用户管理（整合版）
 * - 列表展示 VIP 天数 / 等级
 * - 充值天数、批量充值、重置密码、删除
 * - 手动设置会员等级 0~4
 * js/components/admin/UserMgmt.js
 */
import { store } from "../../store.js";
import { adminApi } from "../../api/admin.js";
import { CONFIG } from "../../config.js";

const { ref, reactive, computed, onMounted } = Vue;

export default {
  name: "UserMgmt",
  setup() {
    const loading = ref(false);
    const users = ref([]);
    const keyword = ref("");
    const selected = ref([]);

    const chargeModal = reactive({
      visible: false,
      userId: null,
      username: "",
      mode: "add", // add | set
      days: 30,
    });
    const levelModal = reactive({
      visible: false,
      userId: null,
      username: "",
      vipLevel: 0,
    });
    const actionLoading = ref(false);

    const levelLabel = (lv) => {
      const map = CONFIG.VIP_LEVEL_LABELS || {};
      return map[lv] || `Lv.${lv}`;
    };

    const filtered = computed(() => {
      const q = keyword.value.trim().toLowerCase();
      if (!q) return users.value;
      return users.value.filter(
        (u) =>
          (u.username && u.username.toLowerCase().includes(q)) ||
          (u.referral_code && u.referral_code.toLowerCase().includes(q)) ||
          String(u.id).includes(q)
      );
    });

    const loadUsers = async () => {
      loading.value = true;
      try {
        const res = await adminApi.fetchUsers();
        users.value = res.data || res || [];
        selected.value = [];
      } catch (err) {
        store.showToast(err.message || "加载失败", "error");
      } finally {
        loading.value = false;
      }
    };

    const toggleSelect = (id) => {
      const i = selected.value.indexOf(id);
      if (i >= 0) selected.value.splice(i, 1);
      else selected.value.push(id);
    };

    const toggleSelectAll = () => {
      if (selected.value.length === filtered.value.length) {
        selected.value = [];
      } else {
        selected.value = filtered.value.map((u) => u.id);
      }
    };

    const openCharge = (user, mode = "add") => {
      chargeModal.visible = true;
      chargeModal.userId = user.id;
      chargeModal.username = user.username;
      chargeModal.mode = mode;
      chargeModal.days = mode === "set" ? user.shared_vip_days || user.vip_days_left || 0 : 30;
    };

    const submitCharge = async () => {
      if (!chargeModal.userId) return;
      const days = parseInt(chargeModal.days, 10);
      if (isNaN(days)) {
        store.showToast("请输入有效天数", "error");
        return;
      }
      actionLoading.value = true;
      try {
        if (chargeModal.mode === "set") {
          await adminApi.chargeUser(chargeModal.userId, 0, days);
        } else {
          await adminApi.chargeUser(chargeModal.userId, days, null);
        }
        store.showToast("已更新 VIP 天数");
        chargeModal.visible = false;
        await loadUsers();
      } catch (err) {
        store.showToast(err.message || "操作失败", "error");
      } finally {
        actionLoading.value = false;
      }
    };

    const openLevel = (user) => {
      levelModal.visible = true;
      levelModal.userId = user.id;
      levelModal.username = user.username;
      levelModal.vipLevel = user.vip_level || 0;
    };

    const submitLevel = async () => {
      if (!levelModal.userId) return;
      actionLoading.value = true;
      try {
        await adminApi.setUserLevel(levelModal.userId, levelModal.vipLevel);
        store.showToast("等级已更新");
        levelModal.visible = false;
        await loadUsers();
      } catch (err) {
        store.showToast(err.message || "操作失败", "error");
      } finally {
        actionLoading.value = false;
      }
    };

    const batchCharge = async () => {
      if (!selected.value.length) {
        store.showToast("请先勾选用户", "error");
        return;
      }
      const days = parseInt(prompt("给选中用户增加天数（可为负）：", "7"), 10);
      if (isNaN(days) || days === 0) return;
      if (!confirm(`确认为 ${selected.value.length} 人调整 ${days} 天？`)) return;
      actionLoading.value = true;
      try {
        await adminApi.batchChargeUsers(selected.value, days);
        store.showToast("批量调整完成");
        await loadUsers();
      } catch (err) {
        store.showToast(err.message || "失败", "error");
      } finally {
        actionLoading.value = false;
      }
    };

    const resetPwd = async (user) => {
      const secret = prompt(`重置 ${user.username} 密码为 bofutz\n请输入管理密钥确认：`);
      if (!secret) return;
      actionLoading.value = true;
      try {
        await adminApi.resetPassword(user.id, secret);
        store.showToast("密码已重置为 bofutz");
      } catch (err) {
        store.showToast(err.message || "失败", "error");
      } finally {
        actionLoading.value = false;
      }
    };

    const removeUser = async (user) => {
      if (!confirm(`确认删除用户 ${user.username}？此操作不可恢复。`)) return;
      const secret = prompt("请输入管理密钥确认删除：");
      if (!secret) return;
      actionLoading.value = true;
      try {
        await adminApi.deleteUser(user.id, secret);
        store.showToast("用户已删除");
        await loadUsers();
      } catch (err) {
        store.showToast(err.message || "失败", "error");
      } finally {
        actionLoading.value = false;
      }
    };

    const formatDate = (ts) => {
      if (!ts) return "-";
      const d = new Date(ts);
      if (isNaN(d.getTime())) return "-";
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    };

    const vipDays = (u) => u.shared_vip_days ?? u.vip_days_left ?? 0;

    onMounted(loadUsers);

    return {
      loading,
      users,
      filtered,
      keyword,
      selected,
      chargeModal,
      levelModal,
      actionLoading,
      levelLabel,
      loadUsers,
      toggleSelect,
      toggleSelectAll,
      openCharge,
      submitCharge,
      openLevel,
      submitLevel,
      batchCharge,
      resetPwd,
      removeUser,
      formatDate,
      vipDays,
    };
  },
  template: `
    <div class="space-y-4 select-none">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 class="text-lg font-bold text-slate-800">用户管理</h2>
        <div class="flex flex-wrap gap-2">
          <input v-model="keyword" type="search" placeholder="搜索账号 / 邀请码 / ID"
                 class="border rounded-lg px-3 py-1.5 text-sm w-full sm:w-56 focus:theme-border outline-none">
          <button @click="batchCharge" :disabled="!selected.length || actionLoading"
                  class="text-xs px-3 py-1.5 rounded-lg border font-bold disabled:opacity-40 hover:bg-slate-50">
            批量调天数
          </button>
          <button @click="loadUsers" class="text-xs px-3 py-1.5 rounded-lg border hover:bg-slate-50">
            <i class="fa-solid fa-rotate-right"></i>
          </button>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div v-if="loading" class="text-center py-12 text-slate-400 text-sm">
          <i class="fa-solid fa-spinner animate-spin mr-2"></i>加载中...
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm text-left whitespace-nowrap">
            <thead class="bg-slate-50 text-xs text-slate-500 border-b">
              <tr>
                <th class="py-2.5 px-3 w-10">
                  <input type="checkbox" :checked="selected.length && selected.length===filtered.length"
                         @change="toggleSelectAll">
                </th>
                <th class="py-2.5 px-3">ID</th>
                <th class="py-2.5 px-3">账号</th>
                <th class="py-2.5 px-3">等级</th>
                <th class="py-2.5 px-3">VIP 天</th>
                <th class="py-2.5 px-3">邀请码</th>
                <th class="py-2.5 px-3">注册</th>
                <th class="py-2.5 px-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="u in filtered" :key="u.id" class="hover:bg-slate-50/80">
                <td class="py-2.5 px-3">
                  <input type="checkbox" :checked="selected.includes(u.id)" @change="toggleSelect(u.id)">
                </td>
                <td class="py-2.5 px-3 font-mono text-xs text-slate-400">{{ u.id }}</td>
                <td class="py-2.5 px-3 font-medium text-slate-800 max-w-[160px] truncate">{{ u.username }}</td>
                <td class="py-2.5 px-3">
                  <button type="button" @click="openLevel(u)"
                          class="text-xs px-2 py-0.5 rounded-full border font-bold"
                          :class="(u.vip_level||0)>0 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-slate-50 text-slate-400 border-slate-100'">
                    Lv.{{ u.vip_level || 0 }}
                  </button>
                </td>
                <td class="py-2.5 px-3 font-bold font-mono"
                    :class="vipDays(u) > 0 ? 'text-emerald-600' : 'text-slate-400'">
                  {{ vipDays(u) }}
                </td>
                <td class="py-2.5 px-3 font-mono text-xs text-slate-500">{{ u.referral_code || '-' }}</td>
                <td class="py-2.5 px-3 text-xs text-slate-400">{{ formatDate(u.created_at) }}</td>
                <td class="py-2.5 px-3 text-right space-x-1">
                  <button @click="openCharge(u,'add')" class="text-xs theme-text hover:underline">+天</button>
                  <button @click="openCharge(u,'set')" class="text-xs text-slate-500 hover:underline">设天</button>
                  <button @click="resetPwd(u)" class="text-xs text-amber-600 hover:underline">重置密</button>
                  <button @click="removeUser(u)" class="text-xs text-red-500 hover:underline">删</button>
                </td>
              </tr>
              <tr v-if="!filtered.length">
                <td colspan="8" class="py-10 text-center text-slate-400 text-sm">暂无用户</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 充天数 -->
      <div v-if="chargeModal.visible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4"
           @click.self="chargeModal.visible=false">
        <div class="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-xl">
          <h3 class="font-bold text-slate-800">
            {{ chargeModal.mode === 'set' ? '设定 VIP 天数' : '增减 VIP 天数' }}
          </h3>
          <p class="text-xs text-slate-500">用户：{{ chargeModal.username }}</p>
          <input v-model.number="chargeModal.days" type="number" class="w-full border rounded-lg px-3 py-2 text-sm">
          <div class="flex justify-end gap-2">
            <button @click="chargeModal.visible=false" class="text-sm text-slate-500 px-3 py-2">取消</button>
            <button @click="submitCharge" :disabled="actionLoading"
                    class="theme-bg text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">
              确认
            </button>
          </div>
        </div>
      </div>

      <!-- 设等级 -->
      <div v-if="levelModal.visible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4"
           @click.self="levelModal.visible=false">
        <div class="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-xl">
          <h3 class="font-bold text-slate-800">设置会员等级</h3>
          <p class="text-xs text-slate-500">用户：{{ levelModal.username }}</p>
          <select v-model.number="levelModal.vipLevel" class="w-full border rounded-lg px-3 py-2 text-sm">
            <option :value="0">Lv.0 普通用户</option>
            <option :value="1">Lv.1 月卡会员</option>
            <option :value="2">Lv.2 季卡会员</option>
            <option :value="3">Lv.3 半年会员</option>
            <option :value="4">Lv.4 年卡会员</option>
          </select>
          <p class="text-[11px] text-slate-400">审核通用套餐订单时会按天数自动抬升等级；此处可手动覆盖。</p>
          <div class="flex justify-end gap-2">
            <button @click="levelModal.visible=false" class="text-sm text-slate-500 px-3 py-2">取消</button>
            <button @click="submitLevel" :disabled="actionLoading"
                    class="theme-bg text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">
              保存等级
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
};
