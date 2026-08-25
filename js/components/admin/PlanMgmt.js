/**
 * 管理后台 - 套餐管理（监控 VIP + 次数套餐）
 */
import { store } from "../../store.js";
import { adminApi } from "../../api/admin.js";

const { ref, reactive, onMounted, computed } = Vue;

export default {
  name: "PlanMgmt",
  setup() {
    const mainTab = ref("vip");
    const loading = ref(false);
    const plans = ref([]);
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
      /** 每用户可购买次数：0=不限制；1=仅一次；2=两次… */
      max_buy_times: 0,
      isEdit: false,
    });

    const creditPlans = ref([]);
    const creditForm = reactive({
      id: "",
      name: "",
      price: 10,
      credits: 10,
      tag: "",
      sort_order: 0,
      enabled: true,
      isEdit: false,
    });

    const filteredPlans = computed(() => plans.value || []);

    const loadPlans = async () => {
      loading.value = true;
      try {
        const res = await adminApi.fetchPlansAdmin();
        plans.value = res.data || res || [];
      } catch (e) {
        try {
          const res = await adminApi.fetchPlans?.() || await adminApi.request?.();
        } catch (_) {}
        store.showToast(e.message || "加载失败", "error");
      } finally {
        loading.value = false;
      }
    };

    // 兼容不同 adminApi 方法名
    const loadPlansSafe = async () => {
      loading.value = true;
      try {
        let res;
        if (adminApi.fetchPlansAdmin) res = await adminApi.fetchPlansAdmin();
        else if (adminApi.fetchPlans) res = await adminApi.fetchPlans();
        else {
          const { request } = await import("../../api/http.js");
          res = await request("/api/admin/plans");
        }
        plans.value = res.data || res || [];
      } catch (e) {
        store.showToast(e.message || "加载套餐失败", "error");
      } finally {
        loading.value = false;
      }
    };

    const loadCreditPlans = async () => {
      try {
        const res = await adminApi.fetchChartCreditPlans();
        creditPlans.value = res.data || [];
      } catch (e) {
        store.showToast(e.message || "加载次数套餐失败", "error");
      }
    };

    const openModal = (plan = null) => {
      if (plan) {
        Object.assign(planForm, {
          id: plan.id,
          name: plan.name,
          price: plan.price,
          days: plan.days,
          tag: plan.tag || "",
          sort_order: plan.sort_order || 0,
          enabled: plan.enabled !== 0,
          plan_type: plan.plan_type === "custom" ? "shared" : (plan.plan_type || "shared"),
          max_buy_times: Number(plan.max_buy_times ?? plan.per_user_limit ?? 0) || 0,
          isEdit: true,
        });
      } else {
        Object.assign(planForm, {
          id: "",
          name: "",
          price: 18.8,
          days: 30,
          tag: "",
          sort_order: plans.value.length,
          enabled: true,
          plan_type: "shared",
          max_buy_times: 0,
          isEdit: false,
        });
      }
      modalVisible.value = true;
    };

    const submitPlan = async () => {
      if (!planForm.name || !(Number(planForm.price) > 0) || !(Number(planForm.days) > 0)) {
        store.showToast("请填写完整套餐信息", "error");
        return;
      }
      try {
        const payload = {
          id: planForm.isEdit ? planForm.id : undefined,
          name: planForm.name,
          price: Number(planForm.price),
          days: Number(planForm.days),
          tag: planForm.tag || null,
          sort_order: Number(planForm.sort_order) || 0,
          enabled: !!planForm.enabled,
          plan_type: planForm.plan_type || "shared",
          max_buy_times: Math.max(0, parseInt(planForm.max_buy_times, 10) || 0),
          isEdit: planForm.isEdit,
        };
        if (adminApi.savePlan) await adminApi.savePlan(payload);
        else {
          const { request } = await import("../../api/http.js");
          await request("/api/admin/plans", { method: "POST", body: JSON.stringify(payload) });
        }
        store.showToast("已保存");
        modalVisible.value = false;
        await loadPlansSafe();
      } catch (e) {
        store.showToast(e.message || "保存失败", "error");
      }
    };

    const deletePlan = async (id) => {
      if (!confirm("确定删除该套餐？")) return;
      try {
        if (adminApi.deletePlan) await adminApi.deletePlan(id);
        else {
          const { request } = await import("../../api/http.js");
          await request("/api/admin/plans", { method: "DELETE", body: JSON.stringify({ id }) });
        }
        store.showToast("已删除");
        await loadPlansSafe();
      } catch (e) {
        store.showToast(e.message || "删除失败", "error");
      }
    };

    const getPlanTypeLabel = (type) => {
      if (type === "custom") return "（旧）定制";
      return "监控 VIP";
    };

    const resetCreditForm = () => {
      Object.assign(creditForm, {
        id: "",
        name: "",
        price: 10,
        credits: 10,
        tag: "",
        sort_order: creditPlans.value.length,
        enabled: true,
        isEdit: false,
      });
    };

    const editCreditPlan = (row) => {
      Object.assign(creditForm, {
        id: row.id,
        name: row.name,
        price: row.price,
        credits: row.credits,
        tag: row.tag || "",
        sort_order: row.sort_order || 0,
        enabled: row.enabled !== 0,
        isEdit: true,
      });
    };

    const saveCreditPlan = async () => {
      if (!creditForm.name || !(Number(creditForm.credits) > 0)) {
        store.showToast("请填写名称与次数", "error");
        return;
      }
      try {
        await adminApi.saveChartCreditPlan({
          id: creditForm.isEdit ? creditForm.id : undefined,
          name: creditForm.name,
          price: Number(creditForm.price),
          credits: Number(creditForm.credits),
          tag: creditForm.tag || null,
          sort_order: Number(creditForm.sort_order) || 0,
          enabled: !!creditForm.enabled,
        });
        store.showToast("次数套餐已保存");
        resetCreditForm();
        await loadCreditPlans();
      } catch (e) {
        store.showToast(e.message || "保存失败", "error");
      }
    };

    const deleteCreditPlan = async (id) => {
      if (!confirm("确定删除该次数套餐？")) return;
      try {
        await adminApi.deleteChartCreditPlan(id);
        store.showToast("已删除");
        await loadCreditPlans();
      } catch (e) {
        store.showToast(e.message || "删除失败", "error");
      }
    };

    onMounted(() => {
      loadPlansSafe();
      loadCreditPlans();
    });

    return {
      mainTab,
      loading,
      plans,
      planTypeFilter,
      filteredPlans,
      modalVisible,
      planForm,
      openModal,
      submitPlan,
      deletePlan,
      getPlanTypeLabel,
      creditPlans,
      creditForm,
      resetCreditForm,
      editCreditPlan,
      saveCreditPlan,
      deleteCreditPlan,
    };
  },
  template: `
    <div class="space-y-4 select-none">
      <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 class="text-xl font-bold text-slate-800">套餐管理</h2>
          <p class="text-xs text-slate-400 mt-0.5">监控 VIP 按天计费；次数套餐用于自主查询按次出图</p>
        </div>
        <div class="flex gap-2 text-xs font-bold">
          <button type="button" @click="mainTab='vip'" class="px-3 py-1.5 rounded-lg border"
                  :class="mainTab==='vip' ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600'">监控 VIP</button>
          <button type="button" @click="mainTab='credits'" class="px-3 py-1.5 rounded-lg border"
                  :class="mainTab==='credits' ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600'">次数套餐</button>
        </div>
      </div>

      <!-- 次数套餐 -->
      <div v-show="mainTab==='credits'" class="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div class="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-4 space-y-3">
          <div class="text-sm font-bold text-slate-700">{{ creditForm.isEdit ? '编辑次数套餐' : '新增次数套餐' }}</div>
          <input v-model="creditForm.name" placeholder="名称，如体验包" class="w-full border rounded-lg px-3 py-2 text-sm">
          <div class="grid grid-cols-2 gap-2">
            <input v-model.number="creditForm.price" type="number" min="0" step="0.1" placeholder="价格" class="border rounded-lg px-3 py-2 text-sm">
            <input v-model.number="creditForm.credits" type="number" min="1" placeholder="次数" class="border rounded-lg px-3 py-2 text-sm">
          </div>
          <input v-model="creditForm.tag" placeholder="角标（可选）" class="w-full border rounded-lg px-3 py-2 text-sm">
          <label class="text-xs flex items-center gap-2 text-slate-600"><input type="checkbox" v-model="creditForm.enabled"> 启用</label>
          <div class="flex gap-2">
            <button type="button" @click="saveCreditPlan" class="theme-bg text-white px-4 py-2 rounded-lg text-xs font-bold">保存</button>
            <button type="button" v-if="creditForm.isEdit" @click="resetCreditForm" class="bg-slate-100 px-4 py-2 rounded-lg text-xs">取消</button>
          </div>
        </div>
        <div class="lg:col-span-3 bg-white rounded-xl border border-slate-100 overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-xs text-slate-500 border-b">
              <tr>
                <th class="py-2.5 px-3 text-left">名称</th>
                <th class="py-2.5 px-3 text-left">价格</th>
                <th class="py-2.5 px-3 text-left">次数</th>
                <th class="py-2.5 px-3 text-left">状态</th>
                <th class="py-2.5 px-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="c in creditPlans" :key="c.id">
                <td class="py-2.5 px-3 font-bold">{{ c.name }}
                  <span v-if="c.tag" class="ml-1 text-[10px] text-orange-500">{{ c.tag }}</span>
                </td>
                <td class="py-2.5 px-3">¥{{ c.price }}</td>
                <td class="py-2.5 px-3 font-mono">{{ c.credits }}</td>
                <td class="py-2.5 px-3 text-xs">{{ c.enabled ? '启用' : '停用' }}</td>
                <td class="py-2.5 px-3 text-right space-x-2">
                  <button type="button" @click="editCreditPlan(c)" class="text-xs theme-text font-bold">编辑</button>
                  <button type="button" @click="deleteCreditPlan(c.id)" class="text-xs text-red-500">删除</button>
                </td>
              </tr>
              <tr v-if="!creditPlans.length">
                <td colspan="5" class="py-8 text-center text-slate-400 text-sm">暂无次数套餐</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 监控 VIP -->
      <div v-show="mainTab==='vip'">
        <div class="flex justify-end mb-3 gap-2">
          <button type="button" @click="openModal()" class="theme-bg text-white px-4 py-2 rounded-lg text-xs font-bold">新增套餐</button>
        </div>
        <div v-if="loading" class="text-center py-10 text-slate-400 text-sm">加载中…</div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="p in filteredPlans" :key="p.id" class="bg-white border border-slate-100 rounded-xl p-4 shadow-sm relative">
            <div v-if="p.tag" class="absolute top-0 right-0 bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-bl font-bold">{{ p.tag }}</div>
            <div class="text-slate-700 font-bold mb-1">{{ p.name }}</div>
            <div class="text-2xl font-light text-slate-800 mb-2"><span class="text-sm text-slate-400">¥</span> {{ p.price }}</div>
            <div class="text-xs text-slate-500 space-y-1">
              <div>有效期 {{ p.days }} 天 · 上架：{{ getPlanTypeLabel(p.plan_type) }}</div>
              <div v-if="Number(p.max_buy_times||0) > 0" class="text-amber-600">每用户限购 {{ p.max_buy_times }} 次</div>
              <div v-else class="text-slate-400">每用户不限购</div>
              <div :class="p.enabled ? 'text-emerald-600' : 'text-slate-400'">{{ p.enabled ? '启用' : '停用' }}</div>
            </div>
            <div class="mt-3 flex gap-2">
              <button type="button" @click="openModal(p)" class="text-xs theme-text font-bold">编辑</button>
              <button type="button" @click="deletePlan(p.id)" class="text-xs text-red-500">删除</button>
            </div>
          </div>
        </div>

        <div v-if="modalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="modalVisible=false">
          <div class="bg-white rounded-2xl w-full max-w-md p-6 space-y-3.5 shadow-2xl">
            <h3 class="font-bold text-slate-800">{{ planForm.isEdit ? '编辑套餐' : '新增套餐' }}</h3>
            <input v-model="planForm.name" placeholder="名称" class="w-full border rounded-lg px-3 py-2 text-sm">
            <div class="grid grid-cols-2 gap-2">
              <input v-model.number="planForm.price" type="number" placeholder="价格" class="border rounded-lg px-3 py-2 text-sm">
              <input v-model.number="planForm.days" type="number" placeholder="天数" class="border rounded-lg px-3 py-2 text-sm">
            </div>
            <input v-model="planForm.tag" placeholder="角标" class="w-full border rounded-lg px-3 py-2 text-sm">
            <select v-model="planForm.plan_type" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="shared">监控 VIP</option>
            </select>
            <div>
              <label class="text-xs text-slate-500 mb-1 block">每用户购买次数限制（0=不限制，特价活动可设 1 或 2）</label>
              <input v-model.number="planForm.max_buy_times" type="number" min="0" max="99" step="1"
                     placeholder="0=不限制" class="w-full border rounded-lg px-3 py-2 text-sm">
            </div>
            <label class="text-xs flex items-center gap-2"><input type="checkbox" v-model="planForm.enabled"> 启用</label>
            <div class="flex justify-end gap-2 pt-2">
              <button type="button" @click="modalVisible=false" class="text-sm text-slate-500 px-3 py-2">取消</button>
              <button type="button" @click="submitPlan" class="theme-bg text-white px-5 py-2 rounded-lg text-sm font-bold">保存</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};
