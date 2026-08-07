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
    
    const searchQuery = ref("");
    const expandedRowKey = ref(null);
    const sortColumn = ref(null);
    const sortOrder = ref("desc");

    // 全屏图表大图预览 Modal
    const chartViewerVisible = ref(false);
    const currentViewerTarget = reactive({ code: "", name: "" });
    const currentViewerImages = ref([]); // [{ title: '日线图表', url: '...' }, { title: '半日线图表', url: '...' }]
    const currentViewerIndex = ref(0);

    const isValidDate = (d) => d && typeof d === "string" && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(d.trim());
    const parseYMD = (s) => (isValidDate(s) ? s.trim().split(/[-/]/).map((v) => parseInt(v, 10)) : [0, 0, 0]);

    // 格式化日期为 "X月X日"
    const formatDateCN = (dateStr) => {
      if (!dateStr || !isValidDate(dateStr)) return "";
      const [y, m, d] = parseYMD(dateStr);
      return `${m}月${d}日`;
    };

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

    // 自动获取最新数据所在的周一
    const latestMonday = computed(() => {
      const validDates = [...new Set(allData.value.filter((i) => (i.day_status || i.week_status) && isValidDate(i.date)).map((i) => i.date))].sort();
      if (!validDates.length) return "";
      const lastDate = validDates[validDates.length - 1];
      const wDays = getWeekDays(lastDate);
      return wDays.length ? wDays[0] : "";
    });

    // 计算最新的日线数据列索引 (仅在最新列显示 Icon)
    const latestDailyColIndex = computed(() => {
      if (!latestMonday.value) return -1;
      const weekDays = getWeekDays(latestMonday.value);
      let lastIdx = -1;
      for (let idx = 4; idx >= 0; idx--) {
        const dateStr = weekDays[idx];
        const hasData = allData.value.some(
          (i) => i.date === dateStr && i.day_status && i.day_status !== "-" && i.day_status !== "--"
        );
        if (hasData) {
          lastIdx = idx;
          break;
        }
      }
      return lastIdx;
    });

    const getStatusVal = (str) => {
      if (!str || typeof str !== "string" || str === "-" || str === "--") return -9999;
      const match = str.match(/[-+]?[0-9]*\.?[0-9]+/);
      return match ? parseFloat(match[0]) : -9999;
    };

    // 排序逻辑
    const handleSort = (column) => {
      if (sortColumn.value === column) {
        if (sortOrder.value === "desc") sortOrder.value = "asc";
        else { sortColumn.value = null; sortOrder.value = "desc"; }
      } else {
        sortColumn.value = column;
        sortOrder.value = "desc";
      }
    };

    // 提取 Past 4 周的历史数据行
    const getPastWeeks = (etf_code) => {
      if (!latestMonday.value) return [];
      const pastData = allData.value.filter((item) => item.etf_code === etf_code && (item.day_status || item.week_status));
      const weekMap = {};
      pastData.forEach((item) => {
        if (!item.date || !isValidDate(item.date)) return;
        const wDays = getWeekDays(item.date);
        if (!wDays.length) return;
        const monday = wDays[0];
        if (monday === latestMonday.value) return;
        if (!weekMap[monday]) weekMap[monday] = { monday, days: [null, null, null, null, null], week_status: null };
        const idx = wDays.indexOf(item.date);
        if (idx !== -1) weekMap[monday].days[idx] = item;
        if (item.week_status && item.week_status !== "-" && item.week_status !== "--") weekMap[monday].week_status = item.week_status;
      });
      return Object.values(weekMap).sort((a, b) => b.monday.localeCompare(a.monday)).slice(0, 4);
    };

    // 处理数据、锁定 Top3 免费标的、支持全列排序
    const processedData = computed(() => {
      if (!latestMonday.value) return { list: [], freeTop3Codes: [], weekDays: [] };
      const weekDays = getWeekDays(latestMonday.value);
      if (weekDays.length < 5) return { list: [], freeTop3Codes: [], weekDays: [] };

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

      // 1. 先按绝对值降序算出并【绝对锁死】 Top 3 免费标的 (不受后续列排序与搜索影响)
      const sortedByAbs = [...items].sort((a, b) => {
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
      const freeTop3Codes = sortedByAbs.slice(0, 3).map((i) => i.etf_code);

      // 2. 根据用户点击的列头进行自由排序
      items.sort((a, b) => {
        if (sortColumn.value) {
          if (sortColumn.value === "etf_name") {
            const cmp = (a.etf_name || "").localeCompare(b.etf_name || "", "zh-CN");
            return sortOrder.value === "asc" ? cmp : -cmp;
          }
          if (sortColumn.value.startsWith("d")) {
            const idx = parseInt(sortColumn.value.substring(1), 10);
            const valA = a.days[idx] ? getStatusVal(a.days[idx].day_status) : -9999;
            const valB = b.days[idx] ? getStatusVal(b.days[idx].day_status) : -9999;
            if (valA === -9999 && valB !== -9999) return 1;
            if (valB === -9999 && valA !== -9999) return -1;
            return sortOrder.value === "desc" ? valB - valA : valA - valB;
          }
          if (sortColumn.value === "week_status") {
            const valA = getStatusVal(a.week_status), valB = getStatusVal(b.week_status);
            if (valA === -9999 && valB !== -9999) return 1;
            if (valB === -9999 && valA !== -9999) return -1;
            return sortOrder.value === "desc" ? valB - valA : valA - valB;
          }
        } else {
          // 默认按最新列绝对值降序
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
        }
        return 0;
      });

      // 3. 关键字搜索过滤
      if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase().trim();
        items = items.filter(
          (i) => (i.etf_name && i.etf_name.toLowerCase().includes(q)) || (i.etf_code && i.etf_code.toLowerCase().includes(q))
        );
      }

      return { list: items, freeTop3Codes, weekDays };
    });

    const canViewChart = (etfCode) => {
      if (store.state.isVip) return true;
      return processedData.value.freeTop3Codes.includes(etfCode);
    };

    // 点击日线图表：全屏黑色沉浸式大图查看 (包含日线 + 半日线，可通过 < 和 > 翻页)
    const openDailyChartViewer = (item) => {
      if (!canViewChart(item.etf_code)) {
        if (confirm("此为 VIP 专属图表 (免费标的除外)。\n是否去开通通用 VIP？")) {
          window.location.hash = "#/plan";
        }
        return;
      }
      currentViewerTarget.code = item.etf_code;
      currentViewerTarget.name = item.etf_name || item.etf_code;
      currentViewerImages.value = [
        { title: "日线图表", url: `https://pub-973330e118204686a625fe51431d4336.r2.dev/charts/${item.etf_code}_daily.png` },
        { title: "半日线图表", url: `https://pub-973330e118204686a625fe51431d4336.r2.dev/charts/${item.etf_code}_half_day.png` }
      ];
      currentViewerIndex.value = 0;
      chartViewerVisible.value = true;
    };

    // 点击周线图表：全屏单张图表查看
    const openWeeklyChartViewer = (item) => {
      if (!canViewChart(item.etf_code)) {
        if (confirm("此为 VIP 专属图表 (免费标的除外)。\n是否去开通通用 VIP？")) {
          window.location.hash = "#/plan";
        }
        return;
      }
      currentViewerTarget.code = item.etf_code;
      currentViewerTarget.name = item.etf_name || item.etf_code;
      currentViewerImages.value = [
        { title: "周线图表", url: `https://pub-973330e118204686a625fe51431d4336.r2.dev/charts/${item.etf_code}_weekly.png` }
      ];
      currentViewerIndex.value = 0;
      chartViewerVisible.value = true;
    };

    // 翻页控制 (< 上一张 / > 下一张)
    const prevViewerImage = () => {
      if (currentViewerImages.value.length <= 1) return;
      currentViewerIndex.value = (currentViewerIndex.value - 1 + currentViewerImages.value.length) % currentViewerImages.value.length;
    };

    const nextViewerImage = () => {
      if (currentViewerImages.value.length <= 1) return;
      currentViewerIndex.value = (currentViewerIndex.value + 1) % currentViewerImages.value.length;
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
      sortColumn,
      sortOrder,
      handleSort,
      processedData,
      latestDailyColIndex,
      expandedRowKey,
      chartViewerVisible,
      currentViewerTarget,
      currentViewerImages,
      currentViewerIndex,
      formatDateCN,
      openDailyChartViewer,
      openWeeklyChartViewer,
      prevViewerImage,
      nextViewerImage,
      toggleRow,
      getColorClass,
      getPastWeeks,
    };
  },
  template: `
    <div class="max-w-7xl mx-auto space-y-3 sm:space-y-4 select-none">
      <!-- 顶部保留精致搜索框 (彻底精简) -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 flex items-center w-full">
        <i class="fa-solid fa-magnifying-glass text-slate-400 pl-3.5"></i>
        <input v-model="searchQuery" type="search" placeholder="搜索 标的代码/名称..." class="w-full bg-transparent border-none outline-none text-sm py-2.5 px-3">
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

      <!-- 看板表格 (所有列支持点击排序) -->
      <div v-else class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div class="overflow-x-auto custom-scrollbar">
          <table class="w-full text-center border-collapse whitespace-nowrap min-w-max">
            <thead class="bg-slate-50 border-b border-slate-100 sticky top-0 z-30">
              <tr class="text-xs text-slate-600 font-bold select-none">
                <th class="py-3 px-4 text-left etf-name-column sticky left-0 bg-slate-50 z-40 cursor-pointer hover:bg-slate-100 transition-colors" @click="handleSort('etf_name')">
                  标的名称
                  <i v-if="sortColumn==='etf_name'" class="fa-solid text-[10px] ml-1" :class="sortOrder==='asc'?'fa-arrow-up':'fa-arrow-down'"></i>
                </th>
                <th v-for="idx in 5" :key="idx" class="py-3 px-2 cursor-pointer hover:bg-slate-100 transition-colors" @click="handleSort('d'+(idx-1))">
                  周{{ ['一','二','三','四','五'][idx-1] }}
                  <i v-if="sortColumn==='d'+(idx-1)" class="fa-solid text-[10px] ml-1" :class="sortOrder==='asc'?'fa-arrow-up':'fa-arrow-down'"></i>
                </th>
                <th class="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors" @click="handleSort('week_status')">
                  周线
                  <i v-if="sortColumn==='week_status'" class="fa-solid text-[10px] ml-1" :class="sortOrder==='asc'?'fa-arrow-up':'fa-arrow-down'"></i>
                </th>
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
                          <span v-if="processedData.freeTop3Codes.includes(item.etf_code)" class="text-[9px] bg-orange-100 text-orange-600 px-1 py-0.2 rounded font-bold">免费</span>
                        </div>
                        <div class="text-[11px] text-slate-400 font-mono">{{ item.etf_code }}</div>
                      </div>
                      <i class="fa-solid text-[10px] text-slate-300 mr-2" :class="expandedRowKey === item.etf_code ? 'fa-chevron-down theme-text' : 'fa-chevron-right'"></i>
                    </div>
                  </td>
                  
                  <!-- 日线 5 天数据列 (悬停显示 X月X日；仅最新有效日线列显示 Icon) -->
                  <td v-for="idx in 5" :key="idx" class="p-3 font-medium" :class="getColorClass(item.days[idx-1]?.day_status)">
                    <div class="flex items-center justify-center gap-1" :title="formatDateCN(item.days[idx-1]?.date)">
                      <span>{{ item.days[idx-1]?.day_status || '-' }}</span>
                      <i v-if="idx - 1 === latestDailyColIndex"
                         class="fa-regular fa-image text-slate-300 hover:text-blue-500 cursor-pointer text-xs"
                         :title="formatDateCN(item.days[idx-1]?.date)"
                         @click.stop="openDailyChartViewer(item)"></i>
                    </div>
                  </td>

                  <!-- 周线数据列 (Icon 始终保留；悬停显示对应交易日日期 X月X日) -->
                  <td class="p-3 font-medium" :class="getColorClass(item.week_status)">
                    <div class="flex items-center justify-center gap-1" :title="formatDateCN(processedData.weekDays)">
                      <span>{{ item.week_status || '-' }}</span>
                      <i class="fa-regular fa-image text-slate-300 hover:text-blue-500 cursor-pointer text-xs"
                         :title="formatDateCN(processedData.weekDays)"
                         @click.stop="openWeeklyChartViewer(item)"></i>
                    </div>
                  </td>
                </tr>

                <!-- 点击展开 4 周历史数据行 -->
                <template v-if="expandedRowKey === item.etf_code">
                  <tr v-for="week in getPastWeeks(item.etf_code)" :key="week.monday" class="bg-slate-50/80 border-b border-dashed border-slate-100 text-xs">
                    <td class="p-2.5 text-left sticky left-0 bg-slate-50/90 z-10 font-mono text-slate-400 pl-6">
                      <i class="fa-regular fa-clock mr-1"></i>{{ week.monday }}
                    </td>
                    <td v-for="idx in 5" :key="idx" class="p-2.5 font-medium" :class="getColorClass(week.days[idx-1]?.day_status)" :title="formatDateCN(week.days[idx-1]?.date)">
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

      <!-- 全屏图表大图预览 Overlay (包含带圆圈大号的 < 与 > 左右翻页按钮) -->
      <div v-if="chartViewerVisible" class="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-6 select-none" @click.self="chartViewerVisible = false">
        <!-- 顶部名称与关闭按钮 -->
        <div class="absolute top-4 left-4 right-4 flex justify-between items-center text-white z-20">
          <div class="flex items-center gap-2 bg-black/50 px-3.5 py-1.5 rounded-full backdrop-blur-md text-xs sm:text-sm font-medium">
            <span class="font-bold">{{ currentViewerTarget.name }}</span>
            <span class="text-slate-300 font-mono">({{ currentViewerTarget.code }})</span>
            <span class="bg-white/20 px-2 py-0.5 rounded text-[11px] ml-1">{{ currentViewerImages[currentViewerIndex]?.title }}</span>
          </div>
          <button @click="chartViewerVisible = false" class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/30 text-white flex items-center justify-center text-lg transition-colors">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- 左翻页按钮 < -->
        <button v-if="currentViewerImages.length > 1" @click.stop="prevViewerImage" class="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-all z-20 text-xl sm:text-2xl backdrop-blur-md shadow-2xl">
          <i class="fa-solid fa-chevron-left"></i>
        </button>

        <!-- 当前大图 -->
        <div class="max-w-full max-h-full flex items-center justify-center p-2">
          <img :src="currentViewerImages[currentViewerIndex]?.url" class="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl transition-all duration-200" alt="图表">
        </div>

        <!-- 右翻页按钮 > -->
        <button v-if="currentViewerImages.length > 1" @click.stop="nextViewerImage" class="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-all z-20 text-xl sm:text-2xl backdrop-blur-md shadow-2xl">
          <i class="fa-solid fa-chevron-right"></i>
        </button>

        <!-- 底部页码提示 (1 / 2) -->
        <div v-if="currentViewerImages.length > 1" class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white/80 text-xs px-3.5 py-1 rounded-full backdrop-blur-md font-mono">
          {{ currentViewerIndex + 1 }} / {{ currentViewerImages.length }}
        </div>
      </div>
    </div>
  `,
};
