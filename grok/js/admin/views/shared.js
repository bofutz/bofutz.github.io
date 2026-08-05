/**
 * 管理后台 · 通用监控列表
 * - 增删改
 * - 批量导入（代码,名称）
 */
import {
  ref, reactive, onMounted,
} from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";

export const SharedView = {
  name: "AdminShared",
  props: {
    fetchAdmin: { type: Function, required: true },
    showToast: { type: Function, required: true },
  },
  setup(props) {
    const sharedList = ref([]);
    const loading = ref(false);

    const sharedModalVisible = ref(false);
    const sharedForm = reactive({
      id: null,
      etf_code: "",
      etf_name: "",
      sort_order: 0,
      enabled: true,
      note: "",
    });

    const showBatchImport = ref(false);
    const batchImportText = ref("");

    const fetchShared = async () => {
      loading.value = true;
      try {
        const d = await props.fetchAdmin("/api/admin/watchlist/shared");
        if (d.success) sharedList.value = d.data || [];
      } catch (e) {
        props.showToast(e.message, "error");
      } finally {
        loading.value = false;
      }
    };

    const openSharedModal = (w = null) => {
      if (w) {
        Object.assign(sharedForm, {
          id: w.id,
          etf_code: w.etf_code,
          etf_name: w.etf_name,
          sort_order: w.sort_order || 0,
          enabled: !!w.enabled,
          note: w.note || "",
        });
      } else {
        Object.assign(sharedForm, {
          id: null,
          etf_code: "",
          etf_name: "",
          sort_order: 0,
          enabled: true,
          note: "",
        });
      }
      sharedModalVisible.value = true;
    };

    const submitShared = async () => {
      if (!sharedForm.etf_code.trim()) {
        props.showToast("请填写代码", "error");
        return;
      }
      try {
        await props.fetchAdmin("/api/admin/watchlist/shared", {
          method: "POST",
          body: JSON.stringify(sharedForm),
        });
        props.showToast("已保存", "success");
        sharedModalVisible.value = false;
        fetchShared();
      } catch (e) {
        props.showToast(e.message, "error");
      }
    };

    const deleteShared = async (w) => {
      if (!confirm(`删除 ${w.etf_code}？`)) return;
      try {
        await props.fetchAdmin("/api/admin/watchlist/shared", {
          method: "DELETE",
          body: JSON.stringify({ id: w.id }),
        });
        props.showToast("已删除", "success");
        fetchShared();
      } catch (e) {
        props.showToast(e.message, "error");
      }
    };

    const submitBatchImport = async () => {
      const items = batchImportText.value
        .split("\n")
        .map((line) => {
          const parts = line
            .split(/[,，\t]/)
            .map((s) => s.trim())
            .filter(Boolean);
          if (!parts.length) return null;
          return { etf_code: parts[0], etf_name: parts[1] || parts[0] };
        })
        .filter(Boolean);

      if (!items.length) {
        props.showToast("请填写导入内容", "error");
        return;
      }

      try {
        const d = await props.fetchAdmin("/api/admin/watchlist/shared/batch", {
          method: "POST",
          body: JSON.stringify({ items }),
        });
        props.showToast(`新增 ${d.added ?? 0}，跳过 ${d.skipped ?? 0}`, "success");
        showBatchImport.value = false;
        batchImportText.value = "";
        fetchShared();
      } catch (e) {
        props.showToast(e.message, "error");
      }
    };

    onMounted(fetchShared);

    return {
      sharedList,
      loading,
      sharedModalVisible,
      sharedForm,
      openSharedModal,
      submitShared,
      deleteShared,
      showBatchImport,
      batchImportText,
      submitBatchImport,
      fetchShared,
    };
  },

  template: `
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row justify-between gap-3">
        <h2 class="text-xl font-bold">通用监控列表</h2>
        <div class="flex gap-2">
          <button @click="showBatchImport=true"
            class="text-sm bg-slate-100 px-3 py-2 rounded-lg">批量导入</button>
          <button @click="openSharedModal()"
            class="theme-bg text-white text-sm px-3 py-2 rounded-lg">添加</button>
          <button @click="fetchShared"
            class="bg-white border px-3 py-2 rounded-lg text-sm">
            <i class="fa-solid fa-rotate-right" :class="{'animate-spin': loading}"></i>
          </button>
        </div>
      </div>

      <div class="bg-white border rounded-xl overflow-hidden shadow-sm">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-500 border-b">
            <tr>
              <th class="py-3 px-4 text-left">代码</th>
              <th class="py-3 px-4 text-left">名称</th>
              <th class="py-3 px-4 text-left">排序</th>
              <th class="py-3 px-4 text-left">状态</th>
              <th class="py-3 px-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="w in sharedList" :key="w.id" class="hover:bg-slate-50">
              <td class="py-3 px-4 font-mono font-bold">{{ w.etf_code }}</td>
              <td class="py-3 px-4">{{ w.etf_name }}</td>
              <td class="py-3 px-4">{{ w.sort_order || 0 }}</td>
              <td class="py-3 px-4">
                <span :class="w.enabled ? 'text-emerald-500' : 'text-slate-400'">
                  {{ w.enabled ? '启用' : '停用' }}
                </span>
              </td>
              <td class="py-3 px-4 text-right space-x-1">
                <button @click="openSharedModal(w)"
                  class="text-xs bg-slate-100 px-2 py-1 rounded">编辑</button>
                <button @click="deleteShared(w)"
                  class="text-xs bg-red-50 text-red-500 px-2 py-1 rounded">删除</button>
              </td>
            </tr>
            <tr v-if="!sharedList.length">
              <td colspan="5" class="py-10 text-center text-slate-400">暂无</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 编辑/添加弹窗 -->
      <div v-if="sharedModalVisible"
        class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4"
        @click.self="sharedModalVisible=false">
        <div class="bg-white rounded-2xl w-full max-w-md p-6 space-y-3">
          <h3 class="font-bold">{{ sharedForm.id ? '编辑' : '添加' }}通用标的</h3>
          <input v-model="sharedForm.etf_code" placeholder="代码"
            class="w-full border px-3 py-2 rounded-lg text-sm font-mono">
          <input v-model="sharedForm.etf_name" placeholder="名称"
            class="w-full border px-3 py-2 rounded-lg text-sm">
          <input type="number" v-model.number="sharedForm.sort_order" placeholder="排序"
            class="w-full border px-3 py-2 rounded-lg text-sm">
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" v-model="sharedForm.enabled"> 启用
          </label>
          <div class="flex justify-end gap-2">
            <button @click="sharedModalVisible=false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button @click="submitShared" class="theme-bg text-white px-4 py-2 rounded-lg text-sm">保存</button>
          </div>
        </div>
      </div>

      <!-- 批量导入 -->
      <div v-if="showBatchImport"
        class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4"
        @click.self="showBatchImport=false">
        <div class="bg-white rounded-2xl w-full max-w-md p-6 space-y-3">
          <h3 class="font-bold">批量导入通用标的</h3>
          <p class="text-xs text-slate-400">每行：代码,名称（或仅代码）</p>
          <textarea v-model="batchImportText" rows="8"
            class="w-full border px-3 py-2 rounded-lg text-sm font-mono"></textarea>
          <div class="flex justify-end gap-2">
            <button @click="showBatchImport=false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button @click="submitBatchImport" class="theme-bg text-white px-4 py-2 rounded-lg text-sm">导入</button>
          </div>
        </div>
      </div>
    </div>
  `,
};
