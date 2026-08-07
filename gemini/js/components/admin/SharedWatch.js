/**
 * 波幅探长 - 后台【定制监控】分块组件 
 * js/components/admin/CustomWatch.js 
 */
import { store } from "../../store.js";
import { adminApi } from "../../api/admin.js";

const { ref, reactive, onMounted } = Vue;

export default {
  name: "CustomWatch",
  setup() {
    const customList = ref([]);
    const loading = ref(false);
    const searchQuery = ref("");

    const editVisible = ref(false);
    const editForm = reactive({
      id: null,
      etf_code: "",
      etf_name: "",
      status: "active",
      expireLocal: "",
    });

    const loadCustom = async () => {
      loading.value = true;
      try {
        const res = await adminApi.fetchCustomWatchlist();
        customList.value = res.data || [];
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    const filteredList = () => {
      if (!searchQuery.value) return customList.value;
      const q = searchQuery.value.toLowerCase().trim();
      return customList.value.filter(
        (w) =>
          (w.username && w.username.toLowerCase().includes(q)) ||
          (w.etf_code && w.etf_code.toLowerCase().includes(q)) ||
          (w.etf_name && w.etf_name.toLowerCase().includes(q))
      );
    };

    const toLocalInput = (ts) => {
      if (!ts) return "";
      const d = new Date(ts);
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    };

    const openEdit = (w) => {
      Object.assign(editForm, {
        id: w.id,
        etf_code: w.etf_code,
        etf_name: w.etf_name,
        status: w.status,
        expireLocal: toLocalInput(w.expire_at),
      });
      editVisible.value = true;
    };

    const submitCustom = async () => {
      try {
        const expire_at = editForm.expireLocal
          ? new Date(editForm.expireLocal).getTime()
          : null;
        await adminApi.saveCustomItem({
          id: editForm.id,
          etf_code: editForm.etf_code,
          etf_name: editForm.etf_name,
          status: editForm.status,
          expire_at,
        });
        store.showToast("保存成功");
        editVisible.value = false;
        await loadCustom();
      } catch (err) {
        store.showToast(err.message, "error");
      }
    };

    const deleteCustom = async (w) => {
      if (!confirm(`确认删除定制监控记录？\n用户：${w.username || w.user_id}\n标的：${w.etf_code}`)) return;
      try {
        await adminApi.deleteCustomItem(w.id);
        store.showToast("已删除");
        await loadCustom();
      } catch (err) {
        store.showToast(err.message, "error");
      }
    };

    const formatDate = (ts) => {
      if (!ts) return "-";
      const d = new Date(ts);
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    };

    const statusLabel = (s) => {
      const map = {
        active: "监控中",
        pending: "待支付",
        expired: "已过期",
      };
      return map[s] || s;
    };

    onMounted(loadCustom);

    return {
      customList,
      loading,
      searchQuery,
      filteredList,
      editVisible,
      editForm,
      loadCustom,
      openEdit,
      submitCustom,
      deleteCustom,
      formatDate,
      statusLabel,
    };
  },
  template: `
    <div class="space-y-4 select-none">
      <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 class="text-xl font-bold text-slate-800">定制监控管理</h2>
          <p class="text-xs text-slate-400 mt-0.5">管理付费用户的独立定制监控列表与有效期</p>
        </div>
        <div class="flex gap-2">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索用户 / 代码 / 名称"
            class="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:theme-border w-44"
          >
          <button @click="loadCustom" class="bg-white border px-3 py-2 rounded-lg text-sm hover:bg-slate-50">
            <i class="fa-solid fa-rotate-right" :class="{'animate-spin': loading}"></i>
          </button>
        </div>
      </div>

      <div class="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
        <div v-if="loading" class="text-center py-12 text-slate-400">
          <i class="fa-solid fa-circle-notch animate-spin text-2xl theme-text"></i>
        </div>
        <div v-else-if="!filteredList().length" class="text-center py-14 text-slate-400 text-sm">
          暂无定制监控数据
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm text-left whitespace-nowrap">
            <thead class="bg-slate-50 text-slate-500 border-b text-xs font-bold">
              <tr>
                <th class="py-3 px-4">用户</th>
                <th class="py-3 px-4">代码 / 名称</th>
                <th class="py-3 px-4">状态</th>
                <th class="py-3 px-4">到期时间</th>
                <th class="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="w in filteredList()" :key="w.id" class="hover:bg-slate-50">
                <td class="py-3 px-4 font-bold text-slate-800">{{ w.username || w.user_id }}</td>
                <td class="py-3 px-4">
                  <span class="font-mono font-bold">{{ w.etf_code }}</span>
                  <span class="text-xs text-slate-400 ml-1.5">{{ w.etf_name }}</span>
                </td>
                <td class="py-3 px-4">
                  <span
                    class="text-xs px-2.5 py-0.5 rounded-full font-bold"
                    :class="w.status === 'active'
                      ? 'bg-emerald-50 text-emerald-600'
                      : (w.status === 'pending' ? 'bg-orange-50 text-orange-600' : 'bg-slate-100 text-slate-400')"
                  >
                    {{ statusLabel(w.status) }}
                  </span>
                </td>
                <td class="py-3 px-4 text-xs font-mono text-slate-500">
                  {{ w.expire_at ? formatDate(w.expire_at) : '-' }}
                </td>
                <td class="py-3 px-4 text-right space-x-1">
                  <button @click="openEdit(w)" class="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded hover:bg-slate-200">编辑</button>
                  <button @click="deleteCustom(w)" class="text-xs bg-red-50 text-red-500 px-2.5 py-1 rounded hover:bg-red-100">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 编辑弹窗 -->
      <div v-if="editVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="editVisible = false">
        <div class="bg-white rounded-2xl w-full max-w-md p-6 space-y-3 shadow-2xl">
          <h3 class="font-bold text-slate-800">编辑定制标的</h3>
          <input v-model="editForm.etf_code" placeholder="标的代码" class="w-full border px-3 py-2 rounded-lg text-sm font-mono focus:theme-border outline-none">
          <input v-model="editForm.etf_name" placeholder="标的名称" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
          <select v-model="editForm.status" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
            <option value="active">监控中 (active)</option>
            <option value="pending">待支付 (pending)</option>
            <option value="expired">已过期 (expired)</option>
          </select>
          <div>
            <label class="text-xs text-slate-500 mb-1 block">到期时间</label>
            <input type="datetime-local" v-model="editForm.expireLocal" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button @click="editVisible = false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button @click="submitCustom" class="theme-bg text-white px-4 py-2 rounded-lg text-sm font-bold">保存</button>
          </div>
        </div>
      </div>
    </div>
  `,
};
