/**
 * 波幅探长 - 后台【优惠码管理】分块组件
 * js/components/admin/PromoMgmt.js
 */
import { store } from "../../store.js";
import { adminApi } from "../../api/admin.js";

const { ref, reactive, onMounted } = Vue;

export default {
  name: "PromoMgmt",
  setup() {
    const promos = ref([]);
    const loading = ref(false);

    const modalVisible = ref(false);
    const promoForm = reactive({
      id: null,
      code: "",
      name: "",
      discount_type: "percent",
      discount_value: 10,
      startLocal: "",
      endLocal: "",
      enabled: true,
    });

    const loadPromos = async () => {
      loading.value = true;
      try {
        const res = await adminApi.fetchPromos();
        // 兜底：隐藏已软删记录（兼容旧接口未过滤）
        if (res && Array.isArray(res.data)) {
          res.data = res.data.filter(
            (x) =>
              !(String(x.name || "").startsWith("__DELETED__") ||
                String(x.code || "").startsWith("__del_"))
          );
        }
        promos.value = res.data || [];
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    const toLocalInput = (ts) => {
      if (!ts) return "";
      const d = new Date(ts);
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    };

    const openModal = (p = null) => {
      const now = Date.now();
      if (p) {
        Object.assign(promoForm, {
          id: p.id,
          code: p.code,
          name: p.name || "",
          discount_type: p.discount_type,
          discount_value: p.discount_value,
          startLocal: toLocalInput(p.start_at),
          endLocal: toLocalInput(p.end_at),
          enabled: !!p.enabled,
        });
      } else {
        Object.assign(promoForm, {
          id: null,
          code: "",
          name: "",
          discount_type: "percent",
          discount_value: 10,
          startLocal: toLocalInput(now),
          endLocal: toLocalInput(now + 7 * 86400000),
          enabled: true,
        });
      }
      modalVisible.value = true;
    };

    const submitPromo = async () => {
      if (!promoForm.code.trim()) {
        store.showToast("优惠码不能为空", "error");
        return;
      }
      try {
        await adminApi.savePromo({
          id: promoForm.id,
          code: promoForm.code.trim().toUpperCase(),
          name: promoForm.name,
          discount_type: promoForm.discount_type,
          discount_value: promoForm.discount_value,
          start_at: new Date(promoForm.startLocal).getTime(),
          end_at: new Date(promoForm.endLocal).getTime(),
          enabled: promoForm.enabled,
        });
        store.showToast("保存成功");
        modalVisible.value = false;
        await loadPromos();
      } catch (err) {
        store.showToast(err.message, "error");
      }
    };

    const deletePromo = async (p) => {
      if (!confirm(`确认删除优惠码 ${p.code}？`)) return;
      try {
        await adminApi.deletePromo(p.id);
        store.showToast("已删除");
        await loadPromos();
      } catch (err) {
        store.showToast(err.message, "error");
      }
    };

    const formatDate = (ts) => {
      if (!ts) return "-";
      const d = new Date(ts);
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    };

    onMounted(loadPromos);

    return {
      promos,
      loading,
      modalVisible,
      promoForm,
      loadPromos,
      openModal,
      submitPromo,
      deletePromo,
      formatDate,
    };
  },
  template: `
    <div class="space-y-4 select-none">
      <div class="flex justify-between items-center">
        <div>
          <h2 class="text-xl font-bold text-slate-800">优惠码管理</h2>
          <p class="text-xs text-slate-400 mt-0.5">设置全网优惠码、折扣力度、有效期与使用限制</p>
        </div>
        <div class="flex gap-2">
          <button @click="openModal()" class="theme-bg text-white text-sm px-3.5 py-2 rounded-lg font-bold hover:opacity-90">
            新增优惠码
          </button>
          <button @click="loadPromos" class="bg-white border px-3 py-2 rounded-lg text-sm hover:bg-slate-50">
            <i class="fa-solid fa-rotate-right" :class="{'animate-spin': loading}"></i>
          </button>
        </div>
      </div>

      <div class="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
        <div v-if="loading" class="text-center py-12 text-slate-400">
          <i class="fa-solid fa-circle-notch animate-spin text-2xl theme-text"></i>
        </div>
        <div v-else-if="!promos.length" class="text-center py-14 text-slate-400 text-sm">
          暂无优惠码数据
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm text-left whitespace-nowrap">
            <thead class="bg-slate-50 text-slate-500 border-b text-xs font-bold">
              <tr>
                <th class="py-3 px-4">代码</th>
                <th class="py-3 px-4">名称</th>
                <th class="py-3 px-4">折扣</th>
                <th class="py-3 px-4">有效期</th>
                <th class="py-3 px-4">状态</th>
                <th class="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="p in promos" :key="p.id" class="hover:bg-slate-50">
                <td class="py-3 px-4 font-mono font-bold text-slate-800">{{ p.code }}</td>
                <td class="py-3 px-4 font-medium">{{ p.name || '-' }}</td>
                <td class="py-3 px-4 font-bold text-orange-500 font-mono">
                  {{ p.discount_type === 'percent' ? (p.discount_value + '% 折扣') : ('¥' + p.discount_value + ' 减免') }}
                </td>
                <td class="py-3 px-4 text-xs font-mono text-slate-500">
                  {{ formatDate(p.start_at) }} ~ {{ formatDate(p.end_at) }}
                </td>
                <td class="py-3 px-4">
                  <span :class="p.enabled ? 'text-emerald-500 font-bold' : 'text-slate-400'">
                    {{ p.enabled ? '启用' : '停用' }}
                  </span>
                </td>
                <td class="py-3 px-4 text-right space-x-1">
                  <button @click="openModal(p)" class="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded hover:bg-slate-200">编辑</button>
                  <button @click="deletePromo(p)" class="text-xs bg-red-50 text-red-500 px-2.5 py-1 rounded hover:bg-red-100">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 编辑/新增弹窗 -->
      <div v-if="modalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="modalVisible = false">
        <div class="bg-white rounded-2xl w-full max-w-md p-6 space-y-3 shadow-2xl">
          <h3 class="font-bold text-slate-800">{{ promoForm.id ? '编辑' : '新增' }}优惠码</h3>
          <input
            v-model="promoForm.code"
            placeholder="代码（例如：DISCOUNT10）"
            class="w-full border px-3 py-2 rounded-lg text-sm font-mono uppercase focus:theme-border outline-none"
          >
          <input
            v-model="promoForm.name"
            placeholder="名称（例如：新人优惠）"
            class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none"
          >

          <div class="grid grid-cols-2 gap-2">
            <select v-model="promoForm.discount_type" class="border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
              <option value="percent">百分比 (%)</option>
              <option value="fixed">固定金额 (元)</option>
            </select>
            <input
              type="number"
              v-model.number="promoForm.discount_value"
              placeholder="折扣值"
              class="border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none"
            >
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[10px] text-slate-400 block mb-0.5">生效开始</label>
              <input type="datetime-local" v-model="promoForm.startLocal" class="w-full border px-2 py-1.5 rounded-lg text-xs focus:theme-border outline-none">
            </div>
            <div>
              <label class="text-[10px] text-slate-400 block mb-0.5">生效截止</label>
              <input type="datetime-local" v-model="promoForm.endLocal" class="w-full border px-2 py-1.5 rounded-lg text-xs focus:theme-border outline-none">
            </div>
          </div>

          <label class="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" v-model="promoForm.enabled"> 启用状态
          </label>

          <div class="flex justify-end gap-2 pt-2">
            <button @click="modalVisible = false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button @click="submitPromo" class="theme-bg text-white px-4 py-2 rounded-lg text-sm font-bold">保存</button>
          </div>
        </div>
      </div>
    </div>
  `,
};
