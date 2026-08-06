/**
 * 波幅探长 - 数据看板分块组件
 * js/components/index/Dashboard.js
 */
import { store } from "../../store.js";
import { etfApi } from "../../api/etf.js";

const { ref, computed, onMounted } = Vue;

export default {
  name: "Dashboard",
  setup() {
    const loading = ref(false);
    const allData = ref([]);
    const chartsMap = ref({});
    const chartAsOfFromApi = ref("");
    const sharedWatchlist = ref([]);
    const freeEtfCodes = ref([]);

    const showDropdown = ref(false);
    const selectedMonday = ref("");
    const searchQuery = ref("");
    const expandedRowKey = ref(null);
    const sortColumn = ref(null);
    const sortOrder = ref("desc");

    // 日期处理辅助函数
    const isValidDate = (d) => d && typeof d === "string" && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(d.trim());
    const parseYMD = (s) => (isValidDate(s) ? s.trim().split(/[-/]/).map((v) => parseInt(v, 10)) : [0, 0, 0]);

    const getWeekDays = (dateStr) => {
      const [y, m, d] = parseYMD(dateStr);
      if (!y) return [];
      const dateObj = new Date(y, m - 1, d);
      const day = dateObj.getDay();
      const offset = day === 0 ? -6 : 1 - day;
      const monday = new Date(y, m - 1, d + offset);
      const days = [];
      for (let i = 0; i < 5; i++) {
        const temp = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
        days.push(`${temp.getFullYear()}-${String(temp.getMonth() + 1).padStart(2, "0")}-${String(temp.getDate()).padStart(2, "0")}`);
      }
      return days;
    };

    const getWeekNumberLabel = (mondayStr) => {
      const [y, m, d] = parseYMD(mondayStr);
      if (!d) return "";
      const firstDay = new Date(y, m - 1, 1);
      let dayOfWeek = firstDay.getDay() || 7;
      const weekNum = Math.ceil((d + (dayOfWeek - 1)) / 7);
      const map = ["一", "二", "三", "四", "五", "六"];
      return `第${map[weekNum - 1] || weekNum}周`;
    };

    // 可选周列表计算
    const availablePeriods = computed(() => {
      const periods = {};
      const validDates = [...new Set(allData.value.filter((i) => (i.day_status || i.week_status) && isValidDate(i.date)).map((i) => i.date))];
      
      validDates.forEach((dateStr) => {
        const wDays = getWeekDays(dateStr);
        if (!wDays.length) return;
        const monday = wDays[0];
        const [y, m] = parseYMD(monday);
        const monthKey = `${y}-${String(m).padStart(2, "0")}`;
        if (!periods[monthKey]) {
          periods[monthKey] = { monthKey, monthLabel: `${y}年${m}月`, weeksMap: {} };
        }
        if (!periods[monthKey].weeksMap[monday]) {
          periods[monthKey].weeksMap[monday] = { monday, weekLabel: getWeekNumberLabel(monday) };
        }
      });

      const result = Object.values(periods).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
      result.forEach((m) => {
        m.weeks = Object.values(m.weeksMap).sort((a, b) => b.monday.localeCompare(a.monday));
      });
      return result;
    });

    const currentPeriodLabel = computed(() => {
      for (const m of availablePeriods.value) {
        for (const w of m.weeks) {
          if (w.monday === selectedMonday.value) return `${parseYMD(w.monday)}月 · ${w.weekLabel}`;
        }
      }
      return "";
    });

    const selectWeek = (monday) => {
      selectedMonday.value = monday;
      showDropdown.value = false;
    };

    // 加载看板数据
    const initData = async () => {
      loading.value = true;
      try {
        const [data, chartsRes, sharedRes] = await Promise.all([
          etfApi.fetchEtfRawData().catch(() => []),
          etfApi.fetchChartsMap().catch(() => ({})),
          etfApi.fetchSharedWatchlist().catch(() => ({ data: [] })),
        ]);

        if (Array.isArray(data)) {
          allData.value = data;
        }
        chartsMap.value = chartsRes.charts || {};
        chartAsOfFromApi.value = chartsRes.chart_as_of || "";
        sharedWatchlist.value = sharedRes.data || [];

        if (availablePeriods.value.length > 0 && availablePeriods.value[0].weeks.length > 0) {
          selectedMonday.value = availablePeriods.value[0].weeks[0].monday;
        }
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    // 看板列表算法与过滤
    const sortedData = computed(() => {
      if (!selectedMonday.value) return [];
      const weekDays = getWeekDays(selectedMonday.value);
      if (weekDays.length < 5) return [];

      const etfMap = {};
      allData.value.forEach((item) => {
        if (!item.date) return;
        const idx = weekDays.indexOf(item.date);
        if (idx !== -1) {
          if (!etfMap[item.etf_code]) {
            etfMap[item.etf_code] = {
              etf_code: item.etf_code,
              etf_name: item.etf_name,
              days: [null, null, null, null, null],
              week_status: null,
            };
          }
          etfMap[item.etf_code].days[idx] = item;
          if (item.week_status && item.week_status !== "-" && item.week_status !== "--") {
            etfMap[item.etf_code].week_status = item.week_status;
          }
        }
      });

      let items = Object.values(etfMap);

      // 搜索过滤
      if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase().trim();
        items = items.filter(
          (i) => (i.etf_name && i.etf_name.toLowerCase().includes(q)) || (i.etf_code && i.etf_code.toLowerCase().includes(q))
        );
      }

      return items;
    });

    const openChart = (etfCode, type) => {
      if (!store.isVipActive) {
        if (confirm("查看高清指标图表需要通用 VIP 权限，是否前往开通？")) {
          window.location.hash = "#/plan";
        }
        return;
      }
      const imgUrl = `https://pub-973330e118204686a625fe51431d4336.r2.dev/charts/${etfCode}_${type}.png`;
      if (window.Viewer) {
        const img = new Image();
        img.src = imgUrl;
        const viewer = new window.Viewer(img, {
          hidden: () => viewer.destroy(),
          title: false,
          navbar: false,
        });
        viewer.show();
      } else {
        window.open(imgUrl, "_blank");
      }
    };

    const toggleRow = (item) => {
      expandedRowKey.value = expandedRowKey.value === item.etf_code ? null : item.etf_code;
    };

    const getColorClass = (status) => {
      if (!status || status === "-" || status === "--") return "text-slate-300";
      return status.includes("+") ? "text-red-500" : "text-emerald-500";
    };

    onMounted(() => {
      initData();
    });

    return {
      loading,
      searchQuery,
      showDropdown,
      availablePeriods,
      currentPeriodLabel,
      selectedMonday,
      sortedData,
      expandedRowKey,
      freeEtfCodes,
      selectWeek,
      openChart,
      toggleRow,
      getColorClass,
    };
  },
  template: `
    <div class="max-w-7xl mx-auto space-y-3 sm:space-y-4 select-none">
      <!-- 顶部筛选项 -->
      <div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div class="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 relative">
          <button @click.stop="showDropdown = !showDropdown"
                  class="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 rounded-xl">
            <span><i class="fa-regular fa-calendar mr-2 text-slate-400"></i>{{ currentPeriodLabel || '获取数据中...' }}</span>
            <i class="fa-solid fa-chevron-down text-slate-400 text-xs"></i>
          </button>
          
          <div v-if="showDropdown" @click.stop class="absolute left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-4 w-full sm:w-80">
            <div class="max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
              <div v-for="month in availablePeriods" :key="month.monthKey" class="mb-3 last:mb-0">
                <div class="text-xs font-bold text-slate-400 mb-2 border-b pb-1">{{ month.monthLabel }}</div>
                <div class="flex flex-wrap gap-2">
                  <button v-for="week in month.weeks" :key="week.monday" @click="selectWeek(week.monday)"
                          class="px-2.5 py-1 text-xs rounded-lg border transition-all"
                          :class="selectedMonday === week.monday ? 'theme-bg text-white border-transparent' : 'bg-slate-50 text-slate-600 border-slate-200'">
                    {{ week.weekLabel }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-slate-100 flex items-center sm:w-64">
          <i class="fa-solid fa-magnifying-glass text-slate-400 pl-3"></i>
          <input v-model="searchQuery" type="search" placeholder="搜索 代码/名称..." class="w-full bg-transparent border-none outline-none text-sm py-2.5 px-3">
        </div>
      </div>

      <!-- 加载与空状态 -->
      <div v-if="loading" class="text-center py-12 text-slate-400">
        <i class="fa-solid fa-spinner animate-spin text-2xl theme-text"></i>
        <p class="mt-2 text-sm">读取云端数据中...</p>
      </div>

      <div v-else-if="sortedData.length === 0" class="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-100">
        <i class="fa-solid fa-folder-open text-4xl mb-3 opacity-40"></i>
        <p>暂无相关行情数据</p>
      </div>

      <!-- 桌面端表格 -->
      <div v-else class="hidden sm:block bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div class="overflow-x-auto custom-scrollbar">
          <table class="w-full text-center border-collapse whitespace-nowrap min-w-max">
            <thead class="bg-slate-50 border-b border-slate-100 sticky top-0 z-30">
              <tr class="text-xs text-slate-600 font-bold select-none">
                <th class="py-3 px-4 text-left etf-name-column sticky left-0 bg-slate-50 z-40">标的名称</th>
                <th v-for="idx in 5" :key="idx" class="py-3 px-2">周{{ ['一','二','三','四','五'][idx-1] }}</th>
                <th class="py-3 px-4">周线</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50 text-sm">
              <tr v-for="item in sortedData" :key="item.etf_code" class="hover:bg-[#4da6a0]/5 transition-colors group cursor-pointer" @click="toggleRow(item)">
                <td class="p-3 text-left relative sticky left-0 bg-white group-hover:bg-[#f6faf9] z-10 etf-name-column">
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="font-bold text-slate-800 group-hover:theme-text">{{ item.etf_name }}</div>
                      <div class="text-[11px] text-slate-400 font-mono">{{ item.etf_code }}</div>
                    </div>
                    <i class="fa-solid text-[10px] text-slate-300 mr-2" :class="expandedRowKey === item.etf_code ? 'fa-chevron-down theme-text' : 'fa-chevron-right'"></i>
                  </div>
                </td>
                <td v-for="idx in 5" :key="idx" class="p-3 font-medium" :class="getColorClass(item.days[idx-1]?.day_status)">
                  <div class="flex items-center justify-center gap-1">
                    <span>{{ item.days[idx-1]?.day_status || '-' }}</span>
                    <i v-if="item.days[idx-1]" class="fa-regular fa-image text-slate-300 hover:text-blue-500 cursor-pointer text-xs" @click.stop="openChart(item.etf_code, 'daily')"></i>
                  </div>
                </td>
                <td class="p-3 font-medium" :class="getColorClass(item.week_status)">
                  <div class="flex items-center justify-center gap-1">
                    <span>{{ item.week_status || '-' }}</span>
                    <i class="fa-regular fa-image text-slate-300 hover:text-blue-500 cursor-pointer text-xs" @click.stop="openChart(item.etf_code, 'weekly')"></i>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
};
