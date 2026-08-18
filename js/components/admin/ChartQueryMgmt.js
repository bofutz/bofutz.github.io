/**
 * 管理后台 - 自主查询单 + 次数套餐
 */
import { adminApi } from "../../api/admin.js";
import { store } from "../../store.js";

const { ref, reactive, onMounted, computed } = Vue;

export default {
  name: "ChartQueryMgmt",
  setup() {
    const subTab = ref("queries"); // 仅查询单；次数套餐已迁至套餐管理
    const loading = ref(false);
    const queries = ref([]);

    const statusFilter = ref("");

    const INTERVAL_LABELS = {
      half_day_closed: "最新收盘·半日线",
      half_day_next: "下一收盘·半日线",
      daily_closed: "最新收盘·日线",
      daily_next: "下一收盘·日线",
      weekly_closed: "最新收盘·周线",
      weekly_next: "下一收盘·周线",
      half_day: "最新收盘·半日线",
      half: "最新收盘·半日线",
      daily: "最新收盘·日线",
      day: "最新收盘·日线",
      weekly: "最新收盘·周线",
      week: "最新收盘·周线",
    };
    const intervalLabel = (k) => INTERVAL_LABELS[String(k || "").toLowerCase()] || k || "—";

    const ensureViewerNavStyle = () => {
      if (document.getElementById("bofutz-viewer-nav-style")) return;
      const style = document.createElement("style");
      style.id = "bofutz-viewer-nav-style";
      style.textContent = `
        .bofutz-viewer-nav {
          position: absolute; top: 50%; transform: translateY(-50%); z-index: 30;
          width: 52px; height: 52px; border-radius: 999px;
          border: 2.5px solid rgba(255,255,255,0.92);
          background: rgba(15, 23, 42, 0.45); color: #fff;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 6px 20px rgba(0,0,0,.28); backdrop-filter: blur(6px);
          -webkit-tap-highlight-color: transparent; user-select: none; padding: 0;
        }
        .bofutz-viewer-nav:hover { background: rgba(15, 23, 42, 0.7); }
        .bofutz-viewer-nav svg { width: 22px; height: 22px; fill: none; stroke: currentColor;
          stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
        .bofutz-viewer-prev { left: 16px; } .bofutz-viewer-next { right: 16px; }
        @media (max-width: 640px) {
          .bofutz-viewer-nav { width: 46px; height: 46px; }
          .bofutz-viewer-prev { left: 8px; } .bofutz-viewer-next { right: 8px; }
        }
      `;
      document.head.appendChild(style);
    };

    const showViewerWithMultiImages = (imgList, initialIndex = 0) => {
      if (!imgList || !imgList.length) return;
      const container = document.createElement("div");
      container.style.display = "none";
      imgList.forEach((item) => {
        const img = document.createElement("img");
        img.src = item.url;
        img.alt = item.title || "";
        container.appendChild(img);
      });
      document.body.appendChild(container);
      const isMulti = imgList.length > 1;
      if (window.Viewer) {
        ensureViewerNavStyle();
        let navPrev = null, navNext = null;
        const clearNav = () => {
          try { navPrev && navPrev.remove(); navNext && navNext.remove(); } catch (_) {}
          navPrev = navNext = null;
        };
        const viewer = new window.Viewer(container, {
          hidden: () => { clearNav(); viewer.destroy(); container.remove(); },
          title: (image) => image.alt || "",
          navbar: isMulti, tooltip: true, movable: true, zoomable: true,
          rotatable: false, scalable: false, transition: true,
          keyboard: isMulti, loop: isMulti,
          initialViewIndex: Math.min(initialIndex, imgList.length - 1),
          toolbar: {
            zoomIn: 1, zoomOut: 1, oneToOne: 1, reset: 1,
            prev: isMulti ? 1 : 0, play: 0, next: isMulti ? 1 : 0,
            rotateLeft: 0, rotateRight: 0, flipHorizontal: 0, flipVertical: 0,
          },
          ready() {
            if (!isMulti) return;
            const root = (viewer && viewer.viewer) || document.querySelector(".viewer-container");
            if (!root) return;
            if (getComputedStyle(root).position === "static") root.style.position = "relative";
            clearNav();
            navPrev = document.createElement("button");
            navPrev.type = "button";
            navPrev.className = "bofutz-viewer-nav bofutz-viewer-prev";
            navPrev.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="15 6 9 12 15 18"></polyline></svg>';
            navPrev.onclick = (e) => { e.preventDefault(); e.stopPropagation(); try { viewer.prev(true); } catch (_) {} };
            navNext = document.createElement("button");
            navNext.type = "button";
            navNext.className = "bofutz-viewer-nav bofutz-viewer-next";
            navNext.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"></polyline></svg>';
            navNext.onclick = (e) => { e.preventDefault(); e.stopPropagation(); try { viewer.next(true); } catch (_) {} };
            root.appendChild(navPrev);
            root.appendChild(navNext);
          },
        });
        viewer.show();
      } else {
        window.open(imgList[initialIndex]?.url, "_blank");
      }
    };

    /** 打开当前单，并尽量带上同用户同代码的其它周期图便于翻页 */
    const openChartGallery = (row) => {
      if (!row || !row.chart_url) return;
      const code = String(row.etf_code || "");
      const same = (queries.value || []).filter(
        (q) => q.chart_url && String(q.etf_code) === code && q.status === "done"
      );
      const order = {
        half_day_closed: 0, half_day_next: 1, half_day: 0, half: 0,
        daily_closed: 2, daily_next: 3, daily: 2, day: 2,
        weekly_closed: 4, weekly_next: 5, weekly: 4, week: 4,
      };
      same.sort((a, b) => (order[a.interval] ?? 9) - (order[b.interval] ?? 9));
      const list = (same.length ? same : [row]).map((q) => ({
        url: q.chart_url,
        title: `${q.etf_name || ""} (${q.etf_code}) ${intervalLabel(q.interval)}`.trim(),
      }));
      const idx = Math.max(0, list.findIndex((x) => x.url === row.chart_url));
      showViewerWithMultiImages(list, idx);
    };

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
      intervalLabel,
      openChartGallery,
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
          <p class="text-xs text-slate-400 mt-0.5">用户出图排队单（次数套餐请到「套餐管理」）</p>
        </div>
        <div class="flex gap-2 text-xs">
          <button @click="subTab='queries'; loadQueries()" class="px-3 py-1.5 rounded-lg border font-bold"
                  :class="subTab==='queries'?'theme-bg text-white border-transparent':'bg-white'">
            查询单 <span v-if="pendingCount" class="ml-1 opacity-90">({{ pendingCount }}待生成)</span>
          </button>
<!-- 次数套餐已移至 套餐管理 -->
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
                <th class="py-2.5 px-3">状态</th>
                <th class="py-2.5 px-3">提交</th>
                <th class="py-2.5 px-3">有效期</th>
                <th class="py-2.5 px-3 text-right">图表</th>
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
                  <button type="button" v-if="q.chart_url" @click="openChartGallery(q)"
                          class="text-xs theme-text font-bold hover:underline">{{ intervalLabel(q.interval) }}</button>
                  <span v-else class="text-xs text-slate-300">—</span>
                </td>
              </tr>
              <tr v-if="!queries.length">
                <td colspan="7" class="py-10 text-center text-slate-400 text-sm">暂无记录</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 次数套餐已移至套餐管理 -->
      <div v-if="false" class="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div class="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-4 space-y-3">
          <div class="text-sm font-bold text-slate-700">{{ editing ? '编辑套餐' : '新增次数套餐' }}</div>
          <div>
            <label class="text-[11px] text-slate-500">名称</label>
            <input v-model="planForm.name" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="如：体验包">
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[11px] text-slate-500">价格（元）</label>
              <input v-model.number="planForm.price" type="number" min="0" class="w-full border rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="text-[11px] text-slate-500">次数</label>
              <input v-model.number="planForm.credits" type="number" min="1" class="w-full border rounded-lg px-3 py-2 text-sm">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[11px] text-slate-500">角标</label>
              <input v-model="planForm.tag" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="推荐">
            </div>
            <div>
              <label class="text-[11px] text-slate-500">排序</label>
              <input v-model.number="planForm.sort_order" type="number" class="w-full border rounded-lg px-3 py-2 text-sm">
            </div>
          </div>
          <label class="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" v-model="planForm.enabled"> 启用
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
