/**
 * 波幅探长 - 后台【用户管理】组件
 * 已移除安全问题列，支持管理用户展示昵称（赞助署名）、重置密码、删除与清理不活跃账号
 */
import { store } from "../../store.js";
import { adminApi } from "../../api/admin.js";

const { ref, reactive, computed, onMounted } = Vue;

export default {
  name: "UserMgmt",
  emits: ["refresh-stats"],
  setup(_, { emit }) {
    const loading = ref(false);
    const users = ref([]);
    const keyword = ref("");
    const actionLoading = ref(false);

    const nickModal = reactive({
      visible: false,
      userId: null,
      username: "",
      nickname: "",
    });

    const filtered = computed(() => {
      const q = keyword.value.trim().toLowerCase();
      if (!q) return users.value;
      return users.value.filter(
        (u) =>
          (u.username && u.username.toLowerCase().includes(q)) ||
          (u.nickname && u.nickname.toLowerCase().includes(q)) ||
          String(u.id).includes(q)
      );
    });

    const loadUsers = async () => {
      loading.value = true;
      try {
        const res = await adminApi.fetchUsers();
        users.value = res.data || res || [];
        emit("refresh-stats");
      } catch (err) {
        store.showToast(err.message || "加载失败", "error");
      } finally {
        loading.value = false;
      }
    };

    const openNickModal = (user) => {
      nickModal.visible = true;
      nickModal.userId = user.id;
      nickModal.username = user.username;
      nickModal.nickname = user.nickname || "";
    };

    const submitNickname = async () => {
      if (!nickModal.userId) return;
      actionLoading.value = true;
      try {
        await adminApi.updateUserNickname(nickModal.userId, nickModal.nickname.trim());
        store.showToast("用户昵称已更新并同步至其赞助标的");
        nickModal.visible = false;
        await loadUsers();
      } catch (err) {
        store.showToast(err.message || "更新失败", "error");
      } finally {
        actionLoading.value = false;
      }
    };

    const purgeInactive = async () => {
      const days = parseInt(prompt("清理多少天未登录的用户？（至少30）", "180"), 10);
      if (isNaN(days) || days < 30) return;
      const secret = prompt("先预览：输入管理密钥（不会真正删除）");
      if (!secret) return;
      try {
        const preview = await adminApi.purgeInactiveUsers(days, secret, true);
        const n = preview.count || 0;
        if (!n) {
          store.showToast(`没有超过 ${days} 天未登录的用户`);
          return;
        }
        if (!confirm(`预览：将删除约 ${n} 个不活跃用户。确认继续删除？`)) return;
        const secret2 = prompt("再次输入管理密钥以确认删除");
        if (!secret2) return;
        const res = await adminApi.purgeInactiveUsers(days, secret2, false);
        store.showToast(`已删除 ${res.deleted || 0} 个不活跃用户`);
        await loadUsers();
      } catch (err) {
        store.showToast(err.message || "清理失败", "error");
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

    onMounted(loadUsers);

    return {
      loading,
      users,
      filtered,
      keyword,
      nickModal,
      actionLoading,
      loadUsers,
      openNickModal,
      submitNickname,
      purgeInactive,
      resetPwd,
      removeUser,
      formatDate,
    };
  },
  template: `
    <div class="space-y-4 select-none">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-bold text-slate-800">用户管理</h2>
          <p class="text-xs text-slate-400 mt-0.5">查看注册邮箱用户、管理赞助展示昵称、重置密码与清理不活跃账号</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <input v-model="keyword" type="search" placeholder="搜索注册邮箱 / 昵称 / ID"
                 class="border rounded-lg px-3 py-1.5 text-sm w-full sm:w-56 focus:theme-border outline-none">
          <button @click="purgeInactive" class="text-xs px-3 py-1.5 rounded-lg border text-amber-700 font-bold hover:bg-amber-50">
            清理不活跃
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
                <th class="py-2.5 px-4">ID</th>
                <th class="py-2.5 px-4">注册邮箱</th>
                <th class="py-2.5 px-4">展示昵称（赞助署名）</th>
                <th class="py-2.5 px-4">有效赞助</th>
                <th class="py-2.5 px-4">注册日期</th>
                <th class="py-2.5 px-4">最后登录</th>
                <th class="py-2.5 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="u in filtered" :key="u.id" class="hover:bg-slate-50/80">
                <td class="py-2.5 px-4 font-mono text-xs text-slate-400">{{ u.id }}</td>
                <td class="py-2.5 px-4 font-medium text-slate-800 max-w-[220px] truncate font-mono text-xs">{{ u.username }}</td>
                <td class="py-2.5 px-4">
                  <span v-if="u.nickname" class="font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-xs">
                    {{ u.nickname }} 赞助
                  </span>
                  <span v-else class="text-xs text-slate-400">未设置</span>
                </td>
                <td class="py-2.5 px-4 font-mono font-bold"
                    :class="(u.active_sponsors || 0) > 0 ? 'text-emerald-600' : 'text-slate-400'">
                  {{ u.active_sponsors || 0 }} 只
                </td>
                <td class="py-2.5 px-4 text-xs text-slate-400 font-mono">{{ formatDate(u.created_at) }}</td>
                <td class="py-2.5 px-4 text-xs text-slate-400 font-mono">{{ formatDate(u.last_login_at) }}</td>
                <td class="py-2.5 px-4 text-right space-x-2">
                  <button @click="openNickModal(u)" class="text-xs theme-text font-bold hover:underline">改昵称</button>
                  <button @click="resetPwd(u)" class="text-xs text-slate-500 hover:underline">重置密码</button>
                  <button @click="removeUser(u)" class="text-xs text-red-500 hover:underline">删除</button>
                </td>
              </tr>
              <tr v-if="!filtered.length">
                <td colspan="7" class="py-10 text-center text-slate-400 text-sm">暂无用户</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 修改昵称弹窗 -->
      <div v-if="nickModal.visible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4"
           @click.self="nickModal.visible=false">
        <div class="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-xl">
          <h3 class="font-bold text-slate-800">修改用户展示昵称</h3>
          <p class="text-xs text-slate-500">注册邮箱：{{ nickModal.username }}</p>
          <input v-model="nickModal.nickname" type="text" maxlength="16" placeholder="输入新昵称（如：老李）"
                 class="w-full border rounded-lg px-3 py-2 text-sm focus:theme-border outline-none"
                 @keyup.enter="submitNickname">
          <div class="flex justify-end gap-2">
            <button @click="nickModal.visible=false" class="text-sm text-slate-500 px-3 py-2">取消</button>
            <button @click="submitNickname" :disabled="actionLoading"
                    class="theme-bg text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
};
