/**
 * 管理后台 - 自主查询单 + 次数套餐
 */
import { adminApi } from "../../api/admin.js";
import { store } from "../../store.js";

// 修复：使用 window.Vue 防止静态代码检查工具报 no-undef 错误
const { ref, reactive, onMounted, computed } = window.Vue;

export default {
  name: "ChartQueryMgmt",
  setup() {
    const subTab = ref("queries"); // queries | plans
    const loading = ref(false);
    const queries = ref([]);
    const statusFilter = ref("");
    const creditPlans = ref([]);
    const planForm = reactive({
      id: "",
      name: "",
      price: 10,
      credits: 10,
      tag: "",
      sort_order: 0,
      enabled: true,
    });
    const editing = ref(false);

    const loadQueries = async () => {
      loading.value = true;
      try {
        const res = await adminApi.fetchChartQueries(statusFilter.value);
        queries.value = res.data || [];
      } catch (e) {
        store.showToast(e.message || "加载失败", "error");
      } finally {
        loading.value = false;
      }
    };

    const loadPlans = async () => {
      try {
        const res = await adminApi.fetchChartCreditPlans();
        creditPlans.value = res.data || [];
      } catch (e) {
        store.showToast(e.message || "加载套餐失败", "error");
      }
    };

    const statusLabel = (s) =>
      ({ pending: "排队中", processing: "生成中", done: "已完成", failed: "失败" }[s] || s);

    const formatTime = (ts) => {
      if (!ts) return "-";
      const d = new Date(Number(ts));
      if (isNaN(d.getTime())) return "-";
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    };

    const resetPlanForm = () => {
      editing.value = false;
      Object.assign(planForm, {
        id: "",
        name: "",
        price: 10,
        credits: 10,
        tag: "",
        sort_order: creditPlans.value.length,
        enabled: true,
      });
    };

    const editPlan = (p) => {
      editing.value = true;
      Object.assign(planForm, {
        id: p.id,
        name: p.name,
        price: p.price,
        credits: p.credits,
        tag: p.tag || "",
        sort_order: p.sort_order || 0,
        enabled: p.enabled !== 0,
      });
    };

    const savePlan = async () => {
      if (!planForm.name || !(Number(planForm.credits) > 0)) {
        store.showToast("请填写名称与次数", "error");
        return;
      }
      try {
        await adminApi.saveChartCreditPlan({
          id: editing.value ? planForm.id : undefined,
          new_id: !editing.value ? planForm.id || undefined : undefined,
          name: planForm.name,
          price: Number(planForm.price),
          credits: Number(planForm.credits),
          tag: planForm.tag || null,
          sort_order: Number(planForm.sort_order) || 0,
          enabled: !!planForm.enabled,
        });
        store.showToast("已保存");
        resetPlanForm();
        await loadPlans();
      } catch (e) {
        store.showToast(e.message || "保存失败", "error");
      }
    };

    const delPlan = async (id) => {
      if (!confirm("确定删除该次数套餐？")) return;
      try {
        await adminApi.deleteChartCreditPlan(id);
        store.showToast("已删除");
        await loadPlans();
      } catch (e) {
        store.showToast(e.message || "删除失败", "error");
      }
    };

    const pendingCount = computed(
      () => queries.value.filter((q) => q.status === "pending").length
    );

    onMounted(async () => {
      await Promise.all([loadQueries(), loadPlans()]);
    });

    return {
      subTab,
      loading,
      queries,
      statusFilter,
      creditPlans,
      planForm,
      editing,
      loadQueries,
      loadPlans,
      statusLabel,
      formatTime,
      resetPlanForm,
      editPlan,
      savePlan,
      delPlan,
      pendingCount,
    };
  },
  template: `
    <div class="space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-bold text-slate-800">自主查询</h2>
          <p class="text-xs text-slate-400 mt-0.5">次数套餐与用户出图排队单（与监控 VIP 独立计费）</p>
        </div>
        <div class="flex gap-2 text-xs">
          <button @click="subTab='queries'; loadQueries()" class="px-3 py-1.5 rounded-lg border font-bold"
                  :class="subTab==='queries'?'theme-bg text-white border-transparent':'bg-white'">
            查询单 <span v-if="pendingCount" class="ml-1 opacity-90">({{ pendingCount }}待生成)</span>
          </button>
          <button @click="subTab='plans'; loadPlans()" class="px-3 py-1.5 rounded-lg border font-bold"
                  :class="subTab==='plans'?'theme-bg text-white border-transparent':'bg-white'">
            次数套餐
          </button>
        </div>
      </div>

      <!-- 查询单 -->
      <div v-if="subTab==='queries'" class="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div class="px-4 py-3 border-b flex flex-wrap gap-2 items-center justify-between">
          <select v-model="statusFilter" @change="loadQueries" class="border rounded-lg px-2 py-1.5 text-xs">
            <option value="">全部状态</option>
            <option value="pending">排队中</option>
            <option value="done">已完成</option>
            <option value="failed">失败</option>
          </select>
          <button @click="loadQueries" class="text-xs text-slate-500 hover:theme-text">
            <i class="fa-solid fa-rotate-right mr-1"></i>刷新
          </button>
        </div>
        <div v-if="loading" class="py-12 text-center text-slate-400 text-sm">加载中…</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm text-left whitespace-nowrap">
            <thead class="bg-slate-50 text-xs text-slate-500 border-b">
              <tr>
                <th class="py-2.5 px-3">ID</th>
                <th class="py-2.5 px-3">用户</th>
                <th class="py-2.5 px-3">代码</th>
                <th class="py-2.5 px-3">周期</th>
                <th class="py-2.5 px-3">状态</th>
                <th class="py-2.5 px-3">提交</th>
                <th class="py-2.5 px-3">有效期</th>
                <th class="py-2.5 px-3">图表</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="q in queries" :key="q.id" class="hover:bg-slate-50/80">
                <td class="py-2 px-3 font-mono text-xs">{{ q.id }}</td>
                <td class="py-2 px-3 text-xs">{{ q.username || q.user_id }}</td>
                <td class="py-2 px-3">
                  <div class="font-mono font-bold">{{ q.etf_code }}</div>
                  <div class="text-[11px] text-slate-400">{{ q.etf_name }}</div>
                </td>
                <td class="py-2 px-3 text-xs">{{ q.interval }}</td>
                <td class="py-2 px-3">
                  <span class="text-[11px] font-bold px-2 py-0.5 rounded-full"
                        :class="{
                          'bg-orange-50 text-orange-600': q.status==='pending',
                          'bg-emerald-50 text-emerald-600': q.status==='done',
                          'bg-slate-100 text-slate-400': q.status==='failed'
                        }">{{ statusLabel(q.status) }}</span>
                </td>
                <td class="py-2 px-3 text-xs font-mono text-slate-400">{{ formatTime(q.created_at) }}</td>
                <td class="py-2 px-3 text-xs font-mono text-slate-400">{{ formatTime(q.expire_at) }}</td>
                <td class="py-2 px-3">
                  <a v-if="q.chart_url" :href="q.chart_url" target="_blank" class="text-xs theme-text font-bold">打开</a>
                  <span v-else class="text-xs text-slate-300">—</span>
                </td>
              </tr>
              <tr v-if="!queries.length">
                <td colspan="8" class="py-10 text-center text-slate-400 text-sm">暂无记录</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 次数套餐 -->
      <div v-else class="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div class="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-4 space-y-3">
          <div class="text-sm font-bold text-slate-700">{{ editing ? '编辑套餐' : '新增次数套餐' }}</div>
          <div>
            <label class="text-[11px] text-slate-500">名称</label>
            <input v-model="planForm.name" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="如：体验包" />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[11px] text-slate-500">价格（元）</label>
              <input v-model.number="planForm.price" type="number" min="0" class="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-[11px] text-slate-500">次数</label>
              <input v-model.number="planForm.credits" type="number" min="1" class="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[11px] text-slate-500">角标</label>
              <input v-model="planForm.tag" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="推荐" />
            </div>
            <div>
              <label class="text-[11px] text-slate-500">排序</label>
              <input v-model.number="planForm.sort_order" type="number" class="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <label class="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" v-model="planForm.enabled" /> 启用
          </label>
          <div class="flex gap-2">
            <button @click="savePlan" class="theme-bg text-white px-4 py-2 rounded-lg text-xs font-bold">保存</button>
            <button v-if="editing" @click="resetPlanForm" class="bg-slate-100 px-4 py-2 rounded-lg text-xs">取消</button>
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
            <tbody class="divide-y">
              <tr v-for="p in creditPlans" :key="p.id">
                <td class="py-2.5 px-3">
                  <span class="font-bold">{{ p.name }}</span>
                  <span v-if="p.tag" class="ml-1 text-[10px] bg-orange-100 text-orange-600 px-1 rounded">{{ p.tag }}</span>
                </td>
                <td class="py-2.5 px-3">¥{{ p.price }}</td>
                <td class="py-2.5 px-3 font-mono">{{ p.credits }}</td>
                <td class="py-2.5 px-3 text-xs">{{ p.enabled ? '启用' : '停用' }}</td>
                <td class="py-2.5 px-3 text-right space-x-2">
                  <button @click="editPlan(p)" class="text-xs theme-text font-bold">编辑</button>
                  <button @click="delPlan(p.id)" class="text-xs text-red-500">删除</button>
                </td>
              </tr>
              <tr v-if="!creditPlans.length">
                <td colspan="5" class="py-8 text-center text-slate-400 text-sm">暂无套餐</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
};
