/**
 * 管理后台 · 优惠码
 * - 列表
 * - 新增 / 编辑 / 删除
 * - 百分比 / 固定金额，有效期，使用次数限制
 */
import {
  ref, reactive, onMounted,
} from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";
import { formatDate, toLocalInput } from "../../utils.js";

export const PromosView = {
  name: "AdminPromos",
  props: {
    fetchAdmin: { type: Function, required: true },
    showToast: { type: Function, required: true },
  },
  setup(props) {
    const promos = ref([]);
    const loading = ref(false);

    const promoModalVisible = ref(false);
    const promoForm = reactive({
      id: null,
      code: "",
      name: "",
      plan_id: "",
      discount_type: "percent",
      discount_value: 10,
      startLocal: "",
      endLocal: "",
      max_uses: null,
      max_per_user: 1,
      enabled: true,
    });

    const fetchPromos = async () => {
      loading.value = true;
      try {
        const d = await props.fetchAdmin("/api/admin/promos");
        if (d.success) promos.value = d.data || [];
      } catch (e) {
        props.showToast(e.message, "error");
      } finally {
        loading.value = false;
      }
    };

    const openPromoModal = (p = null) => {
      if (p) {
        Object.assign(promoForm, {
          id: p.id,
          code: p.code,
          name: p.name || "",
          plan_id: p.plan_id || "",
          discount_type: p.discount_type || "percent",
          discount_value: p.discount_value,
          startLocal: toLocalInput(p.start_at),
          endLocal: toLocalInput(p.end_at),
          max_uses: p.max_uses,
          max_per_user: p.max_per_user ?? 1,
          enabled: !!p.enabled,
        });
      } else {
        const now = Date.now();
        Object.assign(promoForm, {
          id: null,
          code: "",
          name: "",
          plan_id: "",
          discount_type: "percent",
          discount_value: 10,
          startLocal: toLocalInput(now),
          endLocal: toLocalInput(now + 7 * 86400000),
          max_uses: null,
          max_per_user: 1,
          enabled: true,
        });
      }
      promoModalVisible.value = true;
    };

    const submitPromo = async () => {
      if (!promoForm.code.trim()) {
        props.showToast("请填写优惠码", "error");
        return;
      }
      try {
        await props.fetchAdmin("/api/admin/promos", {
          method: "POST",
          body: JSON.stringify({
            id: promoForm.id,
            code: promoForm.code.trim().toUpperCase(),
            name: promoForm.name,
            plan_id: promoForm.plan_id || null,
            discount_type: promoForm.discount_type,
            discount_value: promoForm.discount_value,
            start_at: promoForm.startLocal
              ? new Date(promoForm.startLocal).getTime()
              : null,
            end_at: promoForm.endLocal
              ? new Date(promoForm.endLocal).getTime()
              : null,
            max_uses: promoForm.max_uses || null,
            max_per_user: promoForm.max_per_user,
            enabled: promoForm.enabled,
          }),
        });
        props.showToast("已保存", "success");
        promoModalVisible.value = false;
        fetchPromos();
      } catch (e) {
        props.showToast(e.message, "error");
      }
    };

    const deletePromo = async (p) => {
      if (!confirm(`删除 ${p.code}？`)) return;
      try {
        await props.fetchAdmin("/api/admin/promos", {
          method: "DELETE",
          body: JSON.stringify({ id: p.id }),
        });
        props.showToast("已删除", "success");
        fetchPromos();
      } catch (e) {
        props.showToast(e.message, "error");
      }
    };

    onMounted(fetchPromos);

    return {
      promos,
      loading,
      promoModalVisible,
      promoForm,
      openPromoModal,
      submitPromo,
      deletePromo,
      fetchPromos,
      formatDate,
    };
  },

  template: `
    <div class="space-y-4">
      <div class="flex justify-between gap-3">
        <h2 class="text-xl font-bold">优惠码</h2>
        <div class="flex gap-2">
          <button @click="openPromoModal()"
            class="theme-bg text-white text-sm px-3 py-2 rounded-lg">新增</button>
          <button @click="fetchPromos"
            class="bg-white border px-3 py-2 rounded-lg text-sm">
            <i class="fa-solid fa-rotate-right" :class="{'animate-spin': loading}"></i>
          </button>
        </div>
      </div>

      <div class="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-sm whitespace-nowrap">
            <thead class="bg-slate-50 text-slate-500 border-b">
              <tr>
                <th class="py-3 px-4 text-left">代码</th>
                <th class="py-3 px-4 text-left">名称</th>
                <th class="py-3 px-4 text-left">折扣</th>
                <th class="py-3 px-4 text-left">有效期</th>
                <th class="py-3 px-4 text-left">状态</th>
                <th class="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="p in promos" :key="p.id" class="hover:bg-slate-50">
                <td class="py-3 px-4 font-mono font-bold">{{ p.code }}</td>
                <td class="py-3 px-4">{{ p.name || '-' }}</td>
                <td class="py-3 px-4">
                  {{ p.discount_type === 'percent'
                    ? (p.discount_value + '%')
                    : ('¥' + p.discount_value) }}
                </td>
                <td class="py-3 px-4 text-xs">
                  {{ formatDate(p.start_at) }} ~ {{ formatDate(p.end_at) }}
                </td>
                <td class="py-3 px-4">
                  <span :class="p.enabled ? 'text-emerald-500' : 'text-slate-400'">
                    {{ p.enabled ? '启用' : '停用' }}
                  </span>
                </td>
                <td class="py-3 px-4 text-right space-x-1">
                  <button @click="openPromoModal(p)"
                    class="text-xs bg-slate-100 px-2 py-1 rounded">编辑</button>
                  <button @click="deletePromo(p)"
                    class="text-xs bg-red-50 text-red-500 px-2 py-1 rounded">删除</button>
                </td>
              </tr>
              <tr v-if="!promos.length">
                <td colspan="6" class="py-10 text-center text-slate-400">暂无</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 优惠码弹窗 -->
      <div v-if="promoModalVisible"
        class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4"
        @click.self="promoModalVisible=false">
        <div class="bg-white rounded-2xl w-full max-w-md p-6 space-y-3 max-h-[90vh] overflow-y-auto">
          <h3 class="font-bold">{{ promoForm.id ? '编辑' : '新增' }}优惠码</h3>
          <input v-model="promoForm.code" placeholder="代码"
            class="w-full border px-3 py-2 rounded-lg text-sm font-mono uppercase">
          <input v-model="promoForm.name" placeholder="名称"
            class="w-full border px-3 py-2 rounded-lg text-sm">
          <select v-model="promoForm.discount_type"
            class="w-full border px-3 py-2 rounded-lg text-sm">
            <option value="percent">百分比</option>
            <option value="fixed">固定金额</option>
          </select>
          <input type="number" v-model.number="promoForm.discount_value" placeholder="折扣值"
            class="w-full border px-3 py-2 rounded-lg text-sm">
          <input type="datetime-local" v-model="promoForm.startLocal"
            class="w-full border px-3 py-2 rounded-lg text-sm">
          <input type="datetime-local" v-model="promoForm.endLocal"
            class="w-full border px-3 py-2 rounded-lg text-sm">
          <input type="number" v-model.number="promoForm.max_uses"
            placeholder="总次数上限（空=不限）"
            class="w-full border px-3 py-2 rounded-lg text-sm">
          <input type="number" v-model.number="promoForm.max_per_user"
            placeholder="每用户次数"
            class="w-full border px-3 py-2 rounded-lg text-sm">
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" v-model="promoForm.enabled"> 启用
          </label>
          <div class="flex justify-end gap-2">
            <button @click="promoModalVisible=false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button @click="submitPromo"
              class="theme-bg text-white px-4 py-2 rounded-lg text-sm">保存</button>
          </div>
        </div>
      </div>
    </div>
  `,
};
