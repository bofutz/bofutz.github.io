/**
 * 后台 - 自主查询次数套餐（从原 PlanMgmt 拆出）
 */
import { store } from "../../store.js";
import { adminApi } from "../../api/admin.js";

const { ref, reactive, onMounted } = Vue;

export default {
  name: "CreditPlanMgmt",
  setup() {
    const creditPlans = ref([]);
    const form = reactive({
      id: "", name: "", price: 10, credits: 10, tag: "", sort_order: 0, enabled: true, isEdit: false,
    });

    const load = async () => {
      try {
        const res = await adminApi.fetchChartCreditPlans();
        creditPlans.value = res.data || [];
      } catch (e) {
        store.showToast(e.message || "加载失败", "error");
      }
    };

    const reset = () => {
      Object.assign(form, {
        id: "", name: "", price: 10, credits: 10, tag: "",
        sort_order: creditPlans.value.length, enabled: true, isEdit: false,
      });
    };

    const edit = (row) => {
      Object.assign(form, {
        id: row.id, name: row.name, price: row.price, credits: row.credits,
        tag: row.tag || "", sort_order: row.sort_order || 0,
        enabled: row.enabled !== 0, isEdit: true,
      });
    };

    const save = async () => {
      if (!form.name || !(Number(form.credits) > 0)) {
        store.showToast("请填写名称与次数", "error");
        return;
      }
      try {
        await adminApi.saveChartCreditPlan({
          id: form.isEdit ? form.id : undefined,
          name: form.name,
          price: Number(form.price),
          credits: Number(form.credits),
          tag: form.tag || null,
          sort_order: Number(form.sort_order) || 0,
          enabled: !!form.enabled,
        });
        store.showToast("已保存");
        reset();
        await load();
      } catch (e) {
        store.showToast(e.message || "保存失败", "error");
      }
    };

    const del = async (id) => {
      if (!confirm("确定删除？")) return;
      try {
        await adminApi.deleteChartCreditPlan(id);
        store.showToast("已删除");
        await load();
      } catch (e) {
        store.showToast(e.message || "删除失败", "error");
      }
    };

    onMounted(load);
    return { creditPlans, form, reset, edit, save, del };
  },
  template: `
    <div class="space-y-4">
      <h2 class="text-xl font-bold text-slate-800">次数套餐</h2>
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div class="lg:col-span-2 bg-white rounded-xl border p-4 space-y-3">
          <div class="text-sm font-bold">{{ form.isEdit ? '编辑' : '新增' }}次数套餐</div>
          <input v-model="form.name" placeholder="名称" class="w-full border rounded-lg px-3 py-2 text-sm">
          <div class="grid grid-cols-2 gap-2">
            <input v-model.number="form.price" type="number" min="0" step="0.1" placeholder="价格" class="border rounded-lg px-3 py-2 text-sm">
            <input v-model.number="form.credits" type="number" min="1" placeholder="次数" class="border rounded-lg px-3 py-2 text-sm">
          </div>
          <input v-model="form.tag" placeholder="角标" class="w-full border rounded-lg px-3 py-2 text-sm">
          <label class="text-xs flex items-center gap-2"><input type="checkbox" v-model="form.enabled"> 启用</label>
          <div class="flex gap-2">
            <button @click="save" class="theme-bg text-white px-4 py-2 rounded-lg text-xs font-bold">保存</button>
            <button v-if="form.isEdit" @click="reset" class="bg-slate-100 px-4 py-2 rounded-lg text-xs">取消</button>
          </div>
        </div>
        <div class="lg:col-span-3 bg-white rounded-xl border overflow-hidden">
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
            <tbody class="divide-y">
              <tr v-for="c in creditPlans" :key="c.id">
                <td class="py-2.5 px-3 font-bold">{{ c.name }}
                  <span v-if="c.tag" class="ml-1 text-[10px] text-orange-500">{{ c.tag }}</span>
                </td>
                <td class="py-2.5 px-3">¥{{ c.price }}</td>
                <td class="py-2.5 px-3 font-mono">{{ c.credits }}</td>
                <td class="py-2.5 px-3 text-xs">{{ c.enabled ? '启用' : '停用' }}</td>
                <td class="py-2.5 px-3 text-right space-x-2">
                  <button @click="edit(c)" class="text-xs theme-text font-bold">编辑</button>
                  <button @click="del(c.id)" class="text-xs text-red-500">删除</button>
                </td>
              </tr>
              <tr v-if="!creditPlans.length">
                <td colspan="5" class="py-8 text-center text-slate-400">暂无套餐</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
};
