/**
 * 管理后台 · 套餐管理
 * - 通用 / 定制筛选
 * - 新增 / 编辑 / 删除
 * - 定制为「套餐总价」，不按只数乘价
 */
import {
  ref, reactive, computed, onMounted,
} from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";

export const PlansView = {
  name: "AdminPlans",
  props: {
    fetchAdmin: { type: Function, required: true },
    showToast: { type: Function, required: true },
  },
  setup(props) {
    const plans = ref([]);
    const planTypeFilter = ref("all");
    const planModalVisible = ref(false);
    const planForm = reactive({
      id: "",
      name: "",
      price: 0,
      days: 0,
      tag: "",
      sort_order: 0,
      enabled: true,
      plan_type: "shared",
      isEdit: false,
    });

    const filteredPlans = computed(() => {
      if (planTypeFilter.value === "all") return plans.value;
      return plans.value.filter(
        (p) => (p.plan_type || "shared") === planTypeFilter.value
      );
    });

    const fetchPlans = async () => {
      try {
        const d = await props.fetchAdmin("/api/admin/plans");
        if (d.success) plans.value = d.data || [];
      } catch (e) {
        props.showToast(e.message, "error");
      }
    };

    const openPlanModal = (p = null) => {
      if (p) {
        Object.assign(planForm, {
          ...p,
          enabled: !!p.enabled,
          plan_type: p.plan_type || "shared",
          isEdit: true,
        });
      } else {
        Object.assign(planForm, {
          id: "",
          name: "",
          price: 0,
          days: 0,
          tag: "",
          sort_order: 0,
          enabled: true,
          plan_type: "shared",
          isEdit: false,
        });
      }
      planModalVisible.value = true;
    };

    const submitPlan = async () => {
      if (!planForm.name || planForm.price == null || !planForm.days) {
        props.showToast("请填写名称、价格、天数", "error");
        return;
      }
      try {
        await props.fetchAdmin("/api/admin/plans", {
          method: "POST",
          body: JSON.stringify(planForm),
        });
        props.showToast("已保存", "success");
        planModalVisible.value = false;
        fetchPlans();
      } catch (e) {
        props.showToast(e.message, "error");
      }
    };

    const deletePlan = async (p) => {
      if (!confirm(`删除套餐 ${p.name}？`)) return;
      try {
        await props.fetchAdmin("/api/admin/plans", {
          method: "DELETE",
          body: JSON.stringify({ id: p.id }),
        });
        props.showToast("已删除", "success");
        fetchPlans();
      } catch (e) {
        props.showToast(e.message, "error");
      }
    };

    onMounted(fetchPlans);

    return {
      plans,
      planTypeFilter,
      filteredPlans,
      planModalVisible,
      planForm,
      openPlanModal,
      submitPlan,
      deletePlan,
    };
  },

  template: `
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h2 class="text-xl font-bold">套餐管理</h2>
          <p class="text-xs text-slate-400">
            通用与定制套餐独立配置。定制为「套餐总价」，含系统设置中的最多只数（默认 3 只），不按只数乘价。
          </p>
        </div>
        <div class="flex gap-2">
          <div class="flex bg-white border rounded-lg overflow-hidden text-xs">
            <button
              v-for="s in [
                {k:'all',t:'全部'},
                {k:'shared',t:'通用'},
                {k:'custom',t:'定制'}
              ]"
              :key="s.k"
              @click="planTypeFilter=s.k"
              class="px-3 py-2 border-l first:border-0"
              :class="planTypeFilter===s.k ? 'theme-bg text-white' : 'text-slate-600'"
            >{{ s.t }}</button>
          </div>
          <button @click="openPlanModal()" class="theme-bg text-white text-sm px-3 py-2 rounded-lg">
            新增套餐
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div v-for="p in filteredPlans" :key="p.id"
          class="bg-white border rounded-xl p-4 shadow-sm relative">
          <span v-if="p.tag"
            class="absolute top-0 right-0 bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-bl">
            {{ p.tag }}
          </span>
          <div class="font-bold text-slate-800">{{ p.name }}</div>
          <div class="text-2xl font-light mt-1">
            ¥{{ p.price }}
            <span class="text-xs text-slate-400">
              {{ (p.plan_type||'shared')==='custom' ? '（套餐总价）' : '' }}
            </span>
          </div>
          <div class="text-xs text-slate-400 mt-1">
            {{ p.days }} 天 ·
            {{ (p.plan_type||'shared')==='custom' ? '定制' : '通用' }} ·
            排序 {{ p.sort_order || 0 }}
          </div>
          <div class="mt-3 flex gap-2">
            <button @click="openPlanModal(p)" class="text-xs bg-slate-100 px-2 py-1 rounded">编辑</button>
            <button @click="deletePlan(p)" class="text-xs bg-red-50 text-red-500 px-2 py-1 rounded">删除</button>
            <span class="text-[10px] ml-auto self-center"
              :class="p.enabled ? 'text-emerald-500' : 'text-slate-400'">
              {{ p.enabled ? '启用' : '停用' }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="!filteredPlans.length" class="text-center py-10 text-slate-400 text-sm">
        暂无套餐
      </div>

      <!-- 套餐弹窗 -->
      <div v-if="planModalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4"
        @click.self="planModalVisible=false">
        <div class="bg-white rounded-2xl w-full max-w-md p-6 space-y-3">
          <h3 class="font-bold">{{ planForm.isEdit ? '编辑套餐' : '新增套餐' }}</h3>
          <input v-model="planForm.name" placeholder="名称"
            class="w-full border px-3 py-2 rounded-lg text-sm">
          <div class="grid grid-cols-2 gap-2">
            <input type="number" v-model.number="planForm.price" placeholder="价格"
              class="border px-3 py-2 rounded-lg text-sm">
            <input type="number" v-model.number="planForm.days" placeholder="天数"
              class="border px-3 py-2 rounded-lg text-sm">
          </div>
          <select v-model="planForm.plan_type" class="w-full border px-3 py-2 rounded-lg text-sm">
            <option value="shared">通用</option>
            <option value="custom">定制（套餐总价）</option>
          </select>
          <input v-model="planForm.tag" placeholder="角标（选填）"
            class="w-full border px-3 py-2 rounded-lg text-sm">
          <input type="number" v-model.number="planForm.sort_order" placeholder="排序"
            class="w-full border px-3 py-2 rounded-lg text-sm">
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" v-model="planForm.enabled"> 启用
          </label>
          <div class="flex justify-end gap-2">
            <button @click="planModalVisible=false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button @click="submitPlan" class="theme-bg text-white px-4 py-2 rounded-lg text-sm">保存</button>
          </div>
        </div>
      </div>
    </div>
  `,
};
