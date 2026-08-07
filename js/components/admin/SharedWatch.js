/**
 * 波幅探长 - 后台【通用监控列表】分块组件
 * js/components/admin/SharedWatch.js
 */
import { store } from "../../store.js";
import { adminApi } from "../../api/admin.js";

const { ref, reactive, onMounted } = Vue;

export default {
  name: "SharedWatch",
  setup() {
    const sharedList = ref([]);
    const loading = ref(false);
    const searchQuery = ref("");

    const modalVisible = ref(false);
    const form = reactive({
      id: null,
      etf_code: "",
      etf_name: "",
      sort_order: 0,
      enabled: true,
    });

    const batchImportVisible = ref(false);
    const batchText = ref("");

    const loadShared = async () => {
      loading.value = true;
      try {
        const res = await adminApi.fetchSharedWatchlist();
        sharedList.value = res.data || [];
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    const filteredList = () => {
      if (!searchQuery.value) return sharedList.value;
      const q = searchQuery.value.toLowerCase().trim();
      return sharedList.value.filter(
        (w) =>
          (w.etf_code && w.etf_code.toLowerCase().includes(q)) ||
          (w.etf_name && w.etf_name.toLowerCase().includes(q))
      );
    };

    const openModal = (item = null) => {
      if (item) {
        Object.assign(form, { ...item, enabled: !!item.enabled });
      } else {
        Object.assign(form, {
          id: null,
          etf_code: "",
          etf_name: "",
          sort_order: 0,
          enabled: true,
        });
      }
      modalVisible.value = true;
    };

    const submitShared = async () => {
      if (!form.etf_code.trim()) {
        store.showToast("标的代码不能为空", "error");
        return;
      }
      try {
        await adminApi.saveSharedItem(form);
        store.showToast("保存成功");
        modalVisible.value = false;
        await loadShared();
      } catch (err) {
        store.showToast(err.message, "error");
      }
    };

    const submitBatchImport = async () => {
      if (!batchText.value.trim()) return;
      const items = batchText.value
        .split("\n")
        .map((line) => {
          const parts = line.split(/[,，\t]/).map((s) => s.trim()).filter(Boolean);
          if (!parts.length) return null;
          return {
            etf_code: parts[0],
            etf_name: parts[1] || parts[0],
          };
        })
        .filter(Boolean);

      if (!items.length) {
        store.showToast("未解析到有效数据", "error");
        return;
      }

      try {
        const res = await adminApi.batchImportShared(items);
        store.showToast(`批量导入成功！新增 ${res.added || 0} 只，跳过 ${res.skipped || 0} 只`);
        batchImportVisible.value = false;
        batchText.value = "";
        await loadShared();
      } catch (err) {
        store.showToast(err.message, "error");
      }
    };

    const deleteItem = async (w) => {
      if (!confirm(`确认删除通用标的 ${w.etf_code}？`)) return;
      try {
        await adminApi.deleteSharedItem(w.id);
        store.showToast("已删除");
        await loadShared();
      } catch (err) {
        store.showToast(err.message, "error");
      }
    };

    onMounted(loadShared);

    return {
      sharedList,
      loading,
      searchQuery,
      filteredList,
      modalVisible,
      form,
      batchImportVisible,
      batchText,
      loadShared,
      openModal,
      submitShared,
      submitBatchImport,
      deleteItem,
    };
  },
  template: `
    <div class="space-y-4 select-none">
      <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 class="text-xl font-bold text-slate-800">通用监控列表</h2>
          <p class="text-xs text-slate-400 mt-0.5">管理前台通用公开监控标的 · 支持批量导入</p>
        </div>
        <div class="flex gap-2 flex-wrap">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索代码 / 名称"
            class="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:theme-border w-40"
          >
          <button @click="batchImportVisible = true" class="text-xs bg-slate-100 text-slate-700 px-3 py-2 rounded-lg font-bold hover:bg-slate-200">
            批量导入
          </button>
          <button @click="openModal()" class="theme-bg text-white text-sm px-3.5 py-2 rounded-lg font-bold hover:opacity-90">
            添加标的
          </button>
          <button @click="loadShared" class="bg-white border px-3 py-2 rounded-lg text-sm hover:bg-slate-50">
            <i class="fa-solid fa-rotate-right" :class="{'animate-spin': loading}"></i>
          </button>
        </div>
      </div>

      <div class="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
        <div v-if="loading" class="text-center py-12 text-slate-400">
          <i class="fa-solid fa-circle-notch animate-spin text-2xl theme-text"></i>
        </div>
        <div v-else-if="!filteredList().length" class="text-center py-14 text-slate-400 text-sm">
          暂无通用标的
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm text-left whitespace-nowrap">
            <thead class="bg-slate-50 text-slate-500 border-b text-xs font-bold">
              <tr>
                <th class="py-3 px-4">代码</th>
                <th class="py-3 px-4">名称</th>
                <th class="py-3 px-4">排序</th>
                <th class="py-3 px-4">状态</th>
                <th class="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="w in filteredList()" :key="w.id" class="hover:bg-slate-50">
                <td class="py-3 px-4 font-mono font-bold text-slate-800">{{ w.etf_code }}</td>
                <td class="py-3 px-4 font-medium">{{ w.etf_name }}</td>
                <td class="py-3 px-4 font-mono text-xs">{{ w.sort_order || 0 }}</td>
                <td class="py-3 px-4">
                  <span :class="w.enabled ? 'text-emerald-500 font-bold' : 'text-slate-400'">
                    {{ w.enabled ? '启用' : '停用' }}
                  </span>
                </td>
                <td class="py-3 px-4 text-right space-x-1">
                  <button @click="openModal(w)" class="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded hover:bg-slate-200">编辑</button>
                  <button @click="deleteItem(w)" class="text-xs bg-red-50 text-red-500 px-2.5 py-1 rounded hover:bg-red-100">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 单条编辑弹窗 -->
      <div v-if="modalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="modalVisible = false">
        <div class="bg-white rounded-2xl w-full max-w-md p-6 space-y-3 shadow-2xl">
          <h3 class="font-bold text-slate-800">{{ form.id ? '编辑' : '添加' }}通用标的</h3>
          <input v-model="form.etf_code" placeholder="标的代码（例如：510300）" class="w-full border px-3 py-2 rounded-lg text-sm font-mono focus:theme-border outline-none">
          <input v-model="form.etf_name" placeholder="标的名称（例如：沪深300ETF）" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
          <input type="number" v-model.number="form.sort_order" placeholder="排序" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
          <label class="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" v-model="form.enabled"> 启用
          </label>
          <div class="flex justify-end gap-2 pt-2">
            <button @click="modalVisible = false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button @click="submitShared" class="theme-bg text-white px-4 py-2 rounded-lg text-sm font-bold">保存</button>
          </div>
        </div>
      </div>

      <!-- 批量导入弹窗 -->
      <div v-if="batchImportVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="batchImportVisible = false">
        <div class="bg-white rounded-2xl w-full max-w-md p-6 space-y-3 shadow-2xl">
          <h3 class="font-bold text-slate-800">批量导入通用标的</h3>
          <p class="text-xs text-slate-400">每行格式：代码,名称（示例：510300,沪深300ETF）</p>
          <textarea
            v-model="batchText"
            rows="8"
            placeholder="510300,沪深300ETF&#10;159915,创业板ETF"
            class="w-full border px-3 py-2 rounded-lg text-sm font-mono focus:theme-border outline-none"
          ></textarea>
          <div class="flex justify-end gap-2 pt-2">
            <button @click="batchImportVisible = false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button @click="submitBatchImport" class="theme-bg text-white px-4 py-2 rounded-lg text-sm font-bold">导入</button>
          </div>
        </div>
      </div>
    </div>
  `,
};
