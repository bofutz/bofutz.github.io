/**
 * 管理后台 · 定制监控
 * - 列表查看
 * - 编辑代码/名称/状态/到期时间
 * - 删除
 */
import {
  ref, reactive, onMounted,
} from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";
import { formatDate, toLocalInput } from "../../utils.js";

export const CustomView = {
  name: "AdminCustom",
  props: {
    fetchAdmin: { type: Function, required: true },
    showToast: { type: Function, required: true },
  },
  setup(props) {
    const customList = ref([]);
    const loading = ref(false);

    const customEditVisible = ref(false);
    const customEdit = reactive({
      id: null,
      etf_code: "",
      etf_name: "",
      status: "active",
      expireLocal: "",
    });

    const fetchCustom = async () => {
      loading.value = true;
      try {
        const d = await props.fetchAdmin("/api/admin/watchlist/custom");
        if (d.success) customList.value = d.data || [];
      } catch (e) {
        props.showToast(e.message, "error");
      } finally {
        loading.value = false;
      }
    };

    const openCustomEdit = (w) => {
      Object.assign(customEdit, {
        id: w.id,
        etf_code: w.etf_code,
        etf_name: w.etf_name,
        status: w.status || "active",
        expireLocal: toLocalInput(w.expire_at),
      });
      customEditVisible.value = true;
    };

    const submitCustomEdit = async () => {
      try {
        const expire_at = customEdit.expireLocal
          ? new Date(customEdit.expireLocal).getTime()
          : null;
        await props.fetchAdmin("/api/admin/watchlist/custom", {
          method: "POST",
          body: JSON.stringify({
            id: customEdit.id,
            etf_code: customEdit.etf_code,
            etf_name: customEdit.etf_name,
            status: customEdit.status,
            expire_at,
          }),
        });
        props.showToast("已保存", "success");
        customEditVisible.value = false;
        fetchCustom();
      } catch (e) {
        props.showToast(e.message, "error");
      }
    };

    const deleteCustom = async (w) => {
      if (!confirm("删除该定制？")) return;
      try {
        await props.fetchAdmin("/api/admin/watchlist/custom", {
          method: "DELETE",
          body: JSON.stringify({ id: w.id }),
        });
        props.showToast("已删除", "success");
        fetchCustom();
      } catch (e) {
        props.showToast(e.message, "error");
      }
    };

    onMounted(fetchCustom);

    return {
      customList,
      loading,
      customEditVisible,
      customEdit,
      openCustomEdit,
      submitCustomEdit,
      deleteCustom,
      fetchCustom,
      formatDate,
    };
  },

  template: `
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row justify-between gap-3">
        <h2 class="text-xl font-bold">定制监控</h2>
        <button @click="fetchCustom" class="bg-white border px-3 py-2 rounded-lg text-sm">
          <i class="fa-solid fa-rotate-right" :class="{'animate-spin': loading}"></i>
        </button>
      </div>

      <div class="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-sm whitespace-nowrap">
            <thead class="bg-slate-50 text-slate-500 border-b">
              <tr>
                <th class="py-3 px-4 text-left">用户</th>
                <th class="py-3 px-4 text-left">代码/名称</th>
                <th class="py-3 px-4 text-left">状态</th>
                <th class="py-3 px-4 text-left">到期</th>
                <th class="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="w in customList" :key="w.id" class="hover:bg-slate-50">
                <td class="py-3 px-4">{{ w.username || w.user_id }}</td>
                <td class="py-3 px-4">
                  <span class="font-mono font-bold">{{ w.etf_code }}</span>
                  <span class="text-xs text-slate-400 ml-1">{{ w.etf_name }}</span>
                </td>
                <td class="py-3 px-4">
                  <span :class="w.status==='active'
                    ? 'text-emerald-500'
                    : (w.status==='pending' ? 'text-orange-500' : 'text-slate-400')">
                    {{ w.status }}
                  </span>
                </td>
                <td class="py-3 px-4 text-xs text-slate-400">
                  {{ w.expire_at ? formatDate(w.expire_at) : '-' }}
                </td>
                <td class="py-3 px-4 text-right space-x-1">
                  <button @click="openCustomEdit(w)"
                    class="text-xs bg-slate-100 px-2 py-1 rounded">编辑</button>
                  <button @click="deleteCustom(w)"
                    class="text-xs bg-red-50 text-red-500 px-2 py-1 rounded">删除</button>
                </td>
              </tr>
              <tr v-if="!customList.length">
                <td colspan="5" class="py-10 text-center text-slate-400">暂无</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 编辑弹窗 -->
      <div v-if="customEditVisible"
        class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4"
        @click.self="customEditVisible=false">
        <div class="bg-white rounded-2xl w-full max-w-md p-6 space-y-3">
          <h3 class="font-bold">编辑定制</h3>
          <input v-model="customEdit.etf_code"
            class="w-full border px-3 py-2 rounded-lg text-sm font-mono" placeholder="代码">
          <input v-model="customEdit.etf_name"
            class="w-full border px-3 py-2 rounded-lg text-sm" placeholder="名称">
          <select v-model="customEdit.status" class="w-full border px-3 py-2 rounded-lg text-sm">
            <option value="active">active</option>
            <option value="pending">pending</option>
            <option value="expired">expired</option>
          </select>
          <input type="datetime-local" v-model="customEdit.expireLocal"
            class="w-full border px-3 py-2 rounded-lg text-sm">
          <div class="flex justify-end gap-2">
            <button @click="customEditVisible=false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button @click="submitCustomEdit"
              class="theme-bg text-white px-4 py-2 rounded-lg text-sm">保存</button>
          </div>
        </div>
      </div>
    </div>
  `,
};
