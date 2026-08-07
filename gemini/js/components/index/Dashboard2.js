/**
 * 波幅探长 - 数据看板分块组件
 * js/components/index/Dashboard.js
 */
import { store } from "../../store.js";
import { etfApi } from "../../api/etf.js";

const { ref, reactive, computed, onMounted } = Vue;

export default {
  name: "Dashboard",
  setup() {
    const loading = ref(false);
    const allData = ref([]);
    const chartsMap = ref({});
    const sharedWatchlist = ref([]);
    
    const showDropdown = ref(false);
    const selectedMonday = ref("");
    const searchQuery = ref("");
    const expandedRowKey = ref(null);

    // 日线图表弹窗 (含日线与半日线切换)
    const dailyChartModalVisible = ref(false);
    const currentChartTarget = reactive({
      code: "",
      name: "",
      activeTab: "daily", // 'daily' | 'half_day'
    });

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

    const getStatusVal = (str) => {
      if (!str || typeof str !== "string" || str === "-" || str === "--") return -9999;
      const match = str.match(/[-+]?[0-9]*\.?[0-9]+/);
      return match ? parseFloat(match[0]) : -9999;
    };

    // 提取 Past 4 周的历史数据行 (展开 4 行数据)
    const getPastWeeks = (etf_code) => {
      if (!selectedMonday.value) return [];
      const pastData = allData.value.filter((item) => item.etf_code === etf_code && (item.day_status || item.week_status));
      const weekMap = {};
      pastData.forEach((item) => {
        if (!item.date || !isValidDate(item.date)) return;
        const wDays = getWeekDays(item.date);
        if (!wDays.length) return;
        const monday = wDays[0];
        if (monday === selectedMonday.value) return; // 排除当前周
        if (!weekMap[monday]) weekMap[monday] = { monday, days: [null, null, null, null, null], week_status: null };
        const idx = wDays.indexOf(item.date);
        if (idx !== -1) weekMap[monday].days[idx] = item;
        if (item.week_status && item.week_status !== "-" && item.week_status !== "--") weekMap[monday].week_status = item.week_status;
      });
      // 降序排序并截取过去 4 周
      return Object.values(weekMap).sort((a, b) => b.monday.localeCompare(a.monday)).slice(0, 4);
    };

    // 计算绝对值降序与 Top 3 免费列表
    const processedData = computed(() => {
      if (!selectedMonday.value) return { list: [], freeTop3Codes: [] };
      const weekDays = getWeekDays(selectedMonday.value);
      if (weekDays.length < 5) return { list: [], freeTop3Codes: [] };

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

      // 根据最新有效数据绝对值由大到小排序 (绝对值排序)
      items.sort((a, b) => {
        let latestIdx = 4;
        while (latestIdx >= 0) {
          const hasData = items.some((i) => i.days[latestIdx]?.day_status && i.days[latestIdx].day_status !== "-");
          if (hasData) break;
          latestIdx--;
        }
        if (latestIdx >= 0) {
          const valA = a.days[latestIdx]?.day_status ? Math.abs(getStatusVal(a.days[latestIdx].day_status)) : -9999;
          const valB = b.days[latestIdx]?.day_status ? Math.abs(getStatusVal(b.days[latestIdx].day_status)) : -9999;
          return valB - valA;
        }
        return 0;
      });

      // 提取最新绝对值 Top 3 标的代码作为免费看图标的 (所有人免费)
      const freeTop3Codes = items.slice(0, 3).map((i) => i.etf_code);

      // 关键字搜索过滤
      if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase().trim();
        items = items.filter(
          (i) => (i.etf_name && i.etf_name.toLowerCase().includes(q)) || (i.etf_code && i.etf_code.toLowerCase().includes(q))
        );
      }

      return { list: items, freeTop3Codes };
    });

    // 检查是否有权看图 (Top 3 免费或开启 VIP)
    const canViewChart = (etfCode) => {
      if (store.state.isVip) return true;
      return processedData.value.freeTop3Codes.includes(etfCode);
    };

    // 打开日线/半日线图表弹窗
    const openDailyChartModal = (item) => {
      if (!canViewChart(item.etf_code)) {
        if (confirm("此为 VIP 专属图表 (最新绝对值 Top 3 标的免费查看)。\n是否去开通通用 VIP？")) {
          window.location.hash = "#/plan";
        }
        return;
      }
      currentChartTarget.code = item.etf_code;
      currentChartTarget.name = item.etf_name || item.etf_code;
      currentChartTarget.activeTab = "daily";
      dailyChartModalVisible.value = true;
    };

    // 打开周线图表 (单张)
    const openWeeklyChart = (item) => {
      if (!canViewChart(item.etf_code)) {
        if (confirm("此为 VIP 专属图表 (最新绝对值 Top 3 标的免费查看)。\n是否去开通通用 VIP？")) {
          window.location.hash = "#/plan";
        }
        return;
      }
      const imgUrl = `https://pub-973330e118204686a625fe51431d4336.r2.dev/charts/${item.etf_code}_weekly.png`;
      showViewerImage(imgUrl);
    };

    const showViewerImage = (url) => {
      if (window.Viewer) {
        const img = new Image();
        img.src = url;
        const viewer = new window.Viewer(img, {
          hidden: () => viewer.destroy(),
          title: false,
          navbar: false,
        });
        viewer.show();
      } else {
        window.open(url, "_blank");
      }
    };

    const toggleRow = (item) => {
      expandedRowKey.value = expandedRowKey.value === item.etf_code ? null : item.etf_code;
    };

    const getColorClass = (status) => {
      if (!status || status === "-" || status === "--") return "text-slate-300";
      return status.includes("+") ? "text-red-500" : "text-emerald-500";
    };

    const initData = async () => {
      loading.value = true;
      try {
        const [data, chartsRes] = await Promise.all([
          etfApi.fetchEtfRawData().catch(() => []),
          etfApi.fetchChartsMap().catch(() => ({})),
        ]);

        if (Array.isArray(data)) allData.value = data;
        chartsMap.value = chartsRes.charts || {};

        if (availablePeriods.value.length > 0 && availablePeriods.value[0].weeks.length > 0) {
          selectedMonday.value = availablePeriods.value[0].weeks[0].monday;
        }
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
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
      processedData,
      expandedRowKey,
      dailyChartModalVisible,
      currentChartTarget,
      selectWeek,
      openDailyChartModal,
      openWeeklyChart,
      showViewerImage,
      toggleRow,
      getColorClass,
      getPastWeeks,
    };
  },
  template: `
    <div class="max-w-7xl mx-auto space-y-3 sm:space-y-4 select-none">
      <!-- 顶部筛选与搜索 -->
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
                          :class="selectedMonday === week.monday ? 'theme-bg text-white border-transparent font-bold' : 'bg-slate-50 text-slate-600 border-slate-200'">
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

      <div v-else-if="!processedData.list.length" class="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-100">
        <i class="fa-solid fa-folder-open text-4xl mb-3 opacity-40"></i>
        <p>暂无相关行情数据</p>
      </div>

      <!-- 看板表格 -->
      <div v-else class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div class="overflow-x-auto custom-scrollbar">
          <table class="w-full text-center border-collapse whitespace-nowrap min-w-max">
            <thead class="bg-slate-50 border-b border-slate-100 sticky top-0 z-30">
              <tr class="text-xs text-slate-600 font-bold select-none">
                <th class="py-3 px-4 text-left etf-name-column sticky left-0 bg-slate-50 z-40">标的名称 (按最新绝对值排序)</th>
                <th v-for="idx in 5" :key="idx" class="py-3 px-2">周{{ ['一','二','三','四','五'][idx-1] }}</th>
                <th class="py-3 px-4">周线</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50 text-sm">
              <template v-for="item in processedData.list" :key="item.etf_code">
                <!-- 主数据行 -->
                <tr class="hover:bg-[#4da6a0]/5 transition-colors group cursor-pointer" @click="toggleRow(item)">
                  <td class="p-3 text-left relative sticky left-0 bg-white group-hover:bg-[#f6faf9] z-10 etf-name-column">
                    <div v-if="processedData.freeTop3Codes.includes(item.etf_code)" class="absolute left-0 top-0 bottom-0 w-1 theme-bg"></div>
                    <div class="flex items-center justify-between">
                      <div>
                        <div class="font-bold text-slate-800 group-hover:theme-text flex items-center gap-1">
                          {{ item.etf_name }}
                          <span v-if="processedData.freeTop3Codes.includes(item.etf_code)" class="text-[9px] bg-orange-100 text-orange-600 px-1 py-0.2 rounded font-bold">Top3 免费</span>
                        </div>
                        <div class="text-[11px] text-slate-400 font-mono">{{ item.etf_code }}</div>
                      </div>
                      <i class="fa-solid text-[10px] text-slate-300 mr-2" :class="expandedRowKey === item.etf_code ? 'fa-chevron-down theme-text' : 'fa-chevron-right'"></i>
                    </div>
                  </td>
                  
                  <!-- 日线 5 天数据列 (点击日线列图标包含：日线 + 半日线两张图) -->
                  <td v-for="idx in 5" :key="idx" class="p-3 font-medium" :class="getColorClass(item.days[idx-1]?.day_status)">
                    <div class="flex items-center justify-center gap-1">
                      <span>{{ item.days[idx-1]?.day_status || '-' }}</span>
                      <i v-if="item.days[idx-1]" class="fa-regular fa-image text-slate-300 hover:text-blue-500 cursor-pointer text-xs"
                         title="查看日线/半日线图表" @click.stop="openDailyChartModal(item)"></i>
                    </div>
                  </td>

                  <!-- 周线数据列 (仅 1 张周线图表) -->
                  <td class="p-3 font-medium" :class="getColorClass(item.week_status)">
                    <div class="flex items-center justify-center gap-1">
                      <span>{{ item.week_status || '-' }}</span>
                      <i class="fa-regular fa-image text-slate-300 hover:text-blue-500 cursor-pointer text-xs"
                         title="查看周线图表" @click.stop="openWeeklyChart(item)"></i>
                    </div>
                  </td>
                </tr>

                <!-- 点击展开 4 周历史数据行 (展开 4 行数据) -->
                <template v-if="expandedRowKey === item.etf_code">
                  <tr v-for="week in getPastWeeks(item.etf_code)" :key="week.monday" class="bg-slate-50/80 border-b border-dashed border-slate-100 text-xs">
                    <td class="p-2.5 text-left sticky left-0 bg-slate-50/90 z-10 font-mono text-slate-400 pl-6">
                      <i class="fa-regular fa-clock mr-1"></i>{{ week.monday }}
                    </td>
                    <td v-for="idx in 5" :key="idx" class="p-2.5 font-medium" :class="getColorClass(week.days[idx-1]?.day_status)">
                      {{ week.days[idx-1]?.day_status || '-' }}
                    </td>
                    <td class="p-2.5 font-medium" :class="getColorClass(week.week_status)">
                      {{ week.week_status || '-' }}
                    </td>
                  </tr>
                </template>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 日线与半日线弹窗 (点击日线列触发) -->
      <div v-if="dailyChartModalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="dailyChartModalVisible = false">
        <div class="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl p-6 space-y-4">
          <div class="flex justify-between items-center border-b pb-3">
            <h3 class="font-bold text-slate-800">{{ currentChartTarget.name }} ({{ currentChartTarget.code }}) - 图表分析</h3>
            <button @click="dailyChartModalVisible = false" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <!-- 日线 / 半日线 选项卡切换 -->
          <div class="flex gap-2">
            <button @click="currentChartTarget.activeTab = 'daily'" class="flex-1 py-2 rounded-lg text-xs font-bold border transition-colors"
                    :class="currentChartTarget.activeTab === 'daily' ? 'theme-bg text-white border-transparent' : 'bg-slate-50 text-slate-600'">
              日线图表
            </button>
            <button @click="currentChartTarget.activeTab = 'half_day'" class="flex-1 py-2 rounded-lg text-xs font-bold border transition-colors"
                    :class="currentChartTarget.activeTab === 'half_day' ? 'theme-bg text-white border-transparent' : 'bg-slate-50 text-slate-600'">
              半日线图表
            </button>
          </div>

          <!-- 图表预览区 -->
          <div class="bg-slate-50 rounded-xl p-2 min-h-[300px] flex items-center justify-center border border-slate-100">
            <img :src="'https://pub-973330e118204686a625fe51431d4336.r2.dev/charts/' + currentChartTarget.code + '_' + currentChartTarget.activeTab + '.png'"
                 class="max-w-full h-auto rounded cursor-pointer" alt="图表" @click="showViewerImage($event.target.src)">
          </div>
        </div>
      </div>
    </div>
  `,
};
