/**
 * 波幅探长 - 后台【套餐管理】分块组件
 * js/components/admin/PlanMgmt.js
 */
import { store } from "../../store.js";
import { adminApi } from "../../api/admin.js";

const { ref, reactive, computed, onMounted } = Vue;

export default {
  name: "PlanMgmt",
  setup() {
    const plans = ref([]);
    const loading = ref(false);
    const planTypeFilter = ref("all");

    const modalVisible = ref(false);
    const planForm = reactive({
      id: "",
      name: "",
      price: 18.8,
      days: 30,
      tag: "",
      sort_order: 0,
      enabled: true,
      plan_type: "shared",
      isEdit: false,
    });

    const loadPlans = async () => {
      loading.value = true;
      try {
        const res = await adminApi.fetchPlans();
        plans.value = res.data || [];
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    const filteredPlans = computed(() => {
      if (planTypeFilter.value === "all") return plans.value;
      return plans.value.filter((p) => (p.plan_type || "both") === planTypeFilter.value);
    });

    const openModal = (p = null) => {
      if (p) {
        Object.assign(planForm, {
          ...p,
          enabled: !!p.enabled,
          plan_type: p.plan_type || "both",
          isEdit: true,
        });
      } else {
        Object.assign(planForm, {
          id: "",
          name: "",
          price: 18.8,
          days: 30,
          tag: "",
          sort_order: 0,
          enabled: true,
          plan_type: "shared",
          isEdit: false,
        });
      }
      modalVisible.value = true;
    };

    const submitPlan = async () => {
      if (!planForm.name.trim()) {
        store.showToast("套餐名称不能为空", "error");
        return;
      }
      try {
        await adminApi.savePlan(planForm);
        store.showToast("套餐保存成功");
        modalVisible.value = false;
        await loadPlans();
      } catch (err) {
        store.showToast(err.message, "error");
      }
    };

    const deletePlan = async (p) => {
      if (!confirm(`确认删除套餐「${p.name}」？`)) return;
      try {
        await adminApi.deletePlan(p.id);
        store.showToast("套餐已删除");
        await loadPlans();
      } catch (err) {
        store.showToast(err.message, "error");
      }
    };

    const getPlanTypeLabel = (type) => {
      const map = {
        shared: "监控 VIP",
        custom: "（旧）定制",
        both: "监控 VIP",
      };
      return map[type] || "监控 VIP";
    };

    onMounted(loadPlans);

    return {
      loading,
      planTypeFilter,
      filteredPlans,
      modalVisible,
      planForm,
      loadPlans,
      openModal,
      submitPlan,
      deletePlan,
      getPlanTypeLabel,
    };
  },
  template: `
    <div class="space-y-4 select-none">
      <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 class="text-xl font-bold text-slate-800">套餐管理</h2>
          <p class="text-xs text-slate-400 mt-0.5">
            管理「监控 VIP」按天套餐（图表查询次数请到「自主查询」页配置）
          </p>
        </div>
        <div class="flex gap-2 flex-wrap">
          <div class="flex bg-white border border-slate-200 rounded-lg overflow-hidden text-xs">
            <button
              v-for="s in [{k:'all',t:'全部'},{k:'shared',t:'监控'},{k:'both',t:'监控(both)'}]"
              :key="s.k"
              @click="planTypeFilter = s.k"
              class="px-3 py-2 border-l first:border-0"
              :class="planTypeFilter === s.k ? 'theme-bg text-white font-bold' : 'text-slate-600 hover:bg-slate-50'"
            >
              {{ s.t }}
            </button>
          </div>
          <button @click="openModal()" class="theme-bg text-white text-sm px-3.5 py-2 rounded-lg font-bold hover:opacity-90">
            新增套餐
          </button>
        </div>
      </div>

      <div v-if="loading" class="text-center py-12 text-slate-400">
        <i class="fa-solid fa-circle-notch animate-spin text-2xl theme-text"></i>
      </div>
      <div v-else-if="!filteredPlans.length" class="text-center py-14 text-slate-400 text-sm bg-white rounded-xl border border-slate-100">
        暂无套餐，请点击上方「新增套餐」
      </div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="p in filteredPlans"
          :key="p.id"
          class="bg-white border border-slate-100 rounded-xl p-4 shadow-sm relative space-y-2"
        >
          <span
            v-if="p.tag"
            class="absolute top-0 right-0 bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-bl font-bold"
          >
            {{ p.tag }}
          </span>
          <div class="font-bold text-slate-800 text-base">{{ p.name }}</div>
          <div class="text-2xl font-light text-slate-800">¥ {{ p.price }}</div>
          <div class="text-xs text-slate-400">
            有效期 {{ p.days }} 天 · 上架范围：
            <span class="font-bold theme-text">{{ getPlanTypeLabel(p.plan_type) }}</span>
          </div>
          <div class="pt-2 flex gap-2 border-t border-slate-50 items-center">
            <button @click="openModal(p)" class="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded hover:bg-slate-200">编辑</button>
            <button @click="deletePlan(p)" class="text-xs bg-red-50 text-red-500 px-2.5 py-1 rounded hover:bg-red-100">删除</button>
            <span class="text-[10px] ml-auto font-bold" :class="p.enabled ? 'text-emerald-500' : 'text-slate-400'">
              {{ p.enabled ? '启用' : '停用' }}
            </span>
          </div>
        </div>
      </div>

      <!-- 新增/编辑弹窗 -->
      <div v-if="modalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="modalVisible = false">
        <div class="bg-white rounded-2xl w-full max-w-md p-6 space-y-3.5 shadow-2xl">
          <h3 class="font-bold text-slate-800">{{ planForm.isEdit ? '编辑套餐' : '新增套餐' }}</h3>
          <input
            v-model="planForm.name"
            placeholder="套餐名称（例如：月卡）"
            class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none"
          >
          <div class="grid grid-cols-2 gap-2">
            <input type="number" v-model.number="planForm.price" placeholder="价格（元）" class="border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
            <input type="number" v-model.number="planForm.days" placeholder="有效期（天）" class="border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
          </div>

          <div>
            <label class="text-xs text-slate-500 mb-1 block font-bold">前台上架范围</label>
            <select v-model="planForm.plan_type" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none font-medium">
              <option value="shared">监控 VIP</option>
              <option value="both">监控 VIP（兼容 both）</option>
            </select>
          </div>

          <input v-model="planForm.tag" placeholder="角标文案（选填）" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
          <input type="number" v-model.number="planForm.sort_order" placeholder="排序" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
          <label class="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" v-model="planForm.enabled"> 启用套餐
          </label>

          <div class="flex justify-end gap-2 pt-2">
            <button @click="modalVisible = false" class="px-4 py-2 text-sm text-slate-500">取消</button>
            <button @click="submitPlan" class="theme-bg text-white px-5 py-2 rounded-lg text-sm font-bold">保存</button>
          </div>
        </div>
      </div>
    </div>
  `,
};
