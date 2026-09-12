/* ========================= FILE: .\js\components\index\Dashboard.js ========================= */
/**
 * 波幅探长 - 数据看板（高转化变现优化版）
 * 1. 优化非 VIP 图表拦截体验：价值引导弹窗，注册送 3 天
 * 2. 标的打标：免费标的高亮，VIP 标的清晰指引
 */
import { store } from "../../store.js";
import { etfApi } from "../../api/etf.js";
import { request } from "../../api/http.js";
import { CONFIG } from "../../config.js";

const dashboardPrefsApi = {
  fetch: () => request("/api/user/dashboard-prefs"),
  toggleFavorite: (etfCode) =>
    request("/api/user/dashboard-prefs", {
      method: "POST",
      body: JSON.stringify({ action: "toggle_favorite", etf_code: etfCode }),
    }),
  saveOrder: (order, favorites) =>
    request("/api/user/dashboard-prefs", {
      method: "POST",
      body: JSON.stringify({ order, favorites }),
    }),
};

const { ref, reactive, computed, onMounted, nextTick, watch } = Vue;

function settingOn(val) {
  return val === "1" || val === 1 || val === true || val === "true";
}

const BASE_COLS = [
  { key: "d0", type: "day", dayIdx: 0, label: "周一" },
  { key: "d1", type: "day", dayIdx: 1, label: "周二" },
  { key: "d2", type: "day", dayIdx: 2, label: "周三" },
  { key: "d3", type: "day", dayIdx: 3, label: "周四" },
  { key: "d4", type: "day", dayIdx: 4, label: "周五" },
  { key: "week", type: "week", dayIdx: -1, label: "周线" },
];

export default {
  name: "Dashboard",
  setup() {
    const loading = ref(false);
    const allData = ref([]);
    const chartsMap = ref({});
    const globalChartDay = ref(null);
    const weeklyChartDay = ref(null);
    const sharedList = ref([]);
    const favCodes = ref([]);
    const userOrder = ref([]);
    const dragCode = ref(null);
    const prefsSaving = ref(false);

    const searchQuery = ref("");
    const sortColumn = ref(null);
    const sortOrder = ref("desc");

    const tipVisible = ref(false);
    const tipChannel = ref("wechat");
    const tableScrollEl = ref(null);

    // 核心优化：高转化率拦截弹窗状态
    const vipModal = reactive({
      visible: false,
      etfCode: "",
      etfName: "",
      periodText: "",
    });

    const scrollToLatestCol = async () => {
      await nextTick();
      const el = tableScrollEl.value;
      if (!el) return;
      try {
        el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
      } catch (_) {}
    };

    const settings = computed(() => store.state.publicSettings || {});
    const tipEnabled = computed(() => settingOn(settings.value.tip_enabled));

    const isImageUrl = (url) => {
      const u = String(url || "").trim();
      return !!(u && /^https?:\/\//i.test(u) && /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(u));
    };
    const tipWechatSrc = computed(() => {
      const u = String(settings.value.wechat_qr_url || settings.value.tip_wechat_qr_url || "").trim();
      return isImageUrl(u) ? u : "";
    });
    const tipAlipaySrc = computed(() => {
      const u = String(settings.value.alipay_qr_url || settings.value.tip_alipay_qr_url || "").trim();
      return isImageUrl(u) ? u : "";
    });

    const isValidDate = (d) => d && typeof d === "string" && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(d.trim());
    const parseYMD = (s) => (isValidDate(s) ? s.trim().split(/[-/]/).map((v) => parseInt(v, 10)) : [0, 0, 0]);
    const formatDateCN = (dateStr) => {
      if (!dateStr || !isValidDate(dateStr)) return "";
      const [, m, d] = parseYMD(dateStr);
      return `${m}月${d}日`;
    };

    const formatEtfName = (name) => {
      if (!name) return "";
      const m = String(name).trim().match(/^(.*?ETF)/i);
      return m ? m[1] : name;
    };

    const formatDayCell = (item) => {
      if (!item) return "-";
      const am = item.am_status && item.am_status !== "--" ? item.am_status : "-";
      const pm = item.pm_status && item.pm_status !== "--" ? item.pm_status : "-";
      const day = item.day_status && item.day_status !== "--" ? item.day_status : "-";
      if (am === "-" && pm === "-" && day === "-") return "-";
      return am + "/" + pm + "|" + day;
    };

    const chartDateTitle = (dateStr) => {
      const cn = formatDateCN(dateStr);
      return cn ? cn + "图表" : "图表";
    };
    const dataDateTitle = (dateStr, kind = "") => {
      const cn = formatDateCN(dateStr);
      return cn ? (kind ? cn + kind : cn) : kind || "";
    };
    const weekDataTitle = (item) => {
      if (!item || !item.week_status) return "";
      const cn = formatDateCN(item.week_status_date);
      return cn ? cn + "周线" : "周线";
    };
    const dailyChartTitle = (etfCode, colDate) => {
      const d = chartUpdateDay(etfCode) || globalChartDay.value || colDate;
      return chartDateTitle(d);
    };
    const weekChartTitle = () => {
      const d = weeklyChartDay.value;
      return d && isValidDate(d) ? chartDateTitle(d) : "周线图表";
    };
    const cellPrimaryStatus = (item) => {
      if (!item) return null;
      if (item.day_status && item.day_status !== "-" && item.day_status !== "--") return item.day_status;
      if (item.pm_status && item.pm_status !== "-" && item.pm_status !== "--") return item.pm_status;
      if (item.am_status && item.am_status !== "-" && item.am_status !== "--") return item.am_status;
      return null;
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

    const getStatusVal = (str) => {
      if (!str || typeof str !== "string" || str === "-" || str === "--") return -9999;
      const match = str.match(/[-+]?[0-9]*\.?[0-9]+/);
      return match ? parseFloat(match[0]) : -9999;
    };

    const calendarMonday = () => {
      const d = new Date();
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    const latestMonday = computed(() => {
      const validDates = [...new Set(allData.value.filter((i) => i.date && isValidDate(i.date)).map((i) => i.date))].sort();
      if (validDates.length) {
        const wDays = getWeekDays(validDates[validDates.length - 1]);
        if (wDays.length) return wDays[0];
      }
      return calendarMonday();
    });

    const bjYmd = (ms = Date.now()) => {
      try {
        return new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Shanghai",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(ms));
      } catch (_) {
        return new Date(ms).toISOString().slice(0, 10);
      }
    };

    const toBjDay = (val) => {
      if (val == null || val === "") return null;
      if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) return val.trim();
      let ts = Number(val);
      if (!ts || isNaN(ts)) ts = Date.parse(String(val));
      if (ts < 1e12) ts *= 1000;
      return bjYmd(ts);
    };

    const latestTradingDayBj = () => {
      for (let i = 0; i <= 7; i++) {
        const ms = Date.now() - i * 24 * 3600 * 1000;
        const day = bjYmd(ms);
        const wd = new Date(day + "T12:00:00+08:00").getDay();
        if (wd !== 0 && wd !== 6) return day;
      }
      return bjYmd(Date.now());
    };

    const resolveChartEntry = (code) => {
      if (code == null) return null;
      const rawCode = String(code);
      const key6 = rawCode.replace(/\D/g, "").slice(-6) || rawCode;
      const map = chartsMap.value || {};
      const raw = map[key6] || map[rawCode] || map[code];
      if (!raw) return null;
      if (typeof raw === "string") return { url: raw, updated_at: null };
      return { url: raw.chart_url || raw.url || "", updated_at: raw.updated_at || raw.last_modified || null };
    };

    const chartUpdateDay = (_code) => globalChartDay.value || null;

    const chartColIndexForCode = (etfCode) => {
      if (!latestMonday.value) return -1;
      const weekDays = getWeekDays(latestMonday.value);
      if (!weekDays.length) return -1;
      const day = chartUpdateDay(etfCode);
      if (!day) return -1;
      return weekDays.indexOf(day);
    };

    const showDailyChartIcon = (etfCode, colIdx) => {
      if (colIdx < 0) return false;
      let target = chartColIndexForCode(etfCode);
      if (target < 0 && globalChartDay.value && latestMonday.value) {
        const weekDays = getWeekDays(latestMonday.value);
        if (weekDays.length) {
          const wd = new Date(globalChartDay.value + "T12:00:00+08:00").getDay();
          if (wd === 0 || wd === 6) target = 4;
        }
      }
      return target === colIdx && target >= 0;
    };

    const resolveGlobalChartDay = async (sampleCodes = [], apiChartDate = null) => {
      const fromApi = toBjDay(apiChartDate);
      if (fromApi) {
        globalChartDay.value = fromApi;
        return fromApi;
      }
      globalChartDay.value = latestTradingDayBj();
      return globalChartDay.value;
    };

    const resolveWeeklyChartDay = async (apiWeeklyChartDate = null) => {
      const fromWeekly = toBjDay(apiWeeklyChartDate);
      if (fromWeekly) {
        weeklyChartDay.value = fromWeekly;
        return fromWeekly;
      }
      weeklyChartDay.value = latestTradingDayBj();
      return weeklyChartDay.value;
    };

    const handleSort = (column) => {
      if (sortColumn.value === column) {
        sortOrder.value = sortOrder.value === "desc" ? "asc" : "desc";
      } else {
        sortColumn.value = column;
        sortOrder.value = "desc";
      }
    };

    const isBlankStatus = (s) => !s || s === "-" || s === "--" || s === "None" || s === "null";
    const normCode = (c) => String(c || "").replace(/\D/g, "").slice(-6);

    const findWeekStatusForMonday = (etfCode, mondayStr) => {
      if (!mondayStr) return null;
      const want = normCode(etfCode);
      let best = null, bestDate = "";
      for (const item of allData.value) {
        if (normCode(item.etf_code) !== want) continue;
        if (!item.date || !isValidDate(item.date) || isBlankStatus(item.week_status)) continue;
        const wDays = getWeekDays(item.date);
        if (!wDays.length || wDays[0] !== mondayStr) continue;
        if (!bestDate || item.date >= bestDate) {
          bestDate = item.date;
          best = String(item.week_status).trim();
        }
      }
      return best ? { status: best, date: bestDate } : null;
    };

    const resolveLatestClosedWeekMonday = () => {
      let maxDate = "";
      for (const item of allData.value || []) {
        if (isBlankStatus(item.week_status)) continue;
        const d = item.date || item.week_status_date;
        if (d && isValidDate(d) && String(d).trim() > maxDate) maxDate = String(d).trim();
      }
      if (!maxDate) return "";
      const wDays = getWeekDays(maxDate);
      return wDays.length ? wDays[0] : "";
    };

    const weekdayIndexFromDate = (dateStr) => {
      if (!isValidDate(dateStr)) return -1;
      try {
        const wd = new Date(dateStr.trim() + "T12:00:00+08:00").getDay();
        return wd === 0 || wd === 6 ? -1 : wd - 1;
      } catch (_) {
        return -1;
      }
    };

    const quoteOk = (s) => !!(s && s !== "-" && s !== "--" && s !== "None" && s !== "null");
    const itemHasDailyQuote = (item) => item && (quoteOk(item.day_status) || quoteOk(item.am_status) || quoteOk(item.pm_status));

    const buildRecentTradingColDates = () => {
      const colDates = [null, null, null, null, null];
      for (const item of allData.value || []) {
        if (!item || !item.date || !isValidDate(item.date) || !itemHasDailyQuote(item)) continue;
        const idx = weekdayIndexFromDate(item.date);
        if (idx < 0) continue;
        const d = item.date.trim();
        if (!colDates[idx] || d > colDates[idx]) colDates[idx] = d;
      }
      let anchor = "";
      for (const d of colDates) { if (d && d > anchor) anchor = d; }
      if (!anchor) anchor = bjYmd(Date.now());
      for (let idx = 0; idx < 5; idx++) {
        if (colDates[idx]) continue;
        for (let back = 0; back <= 21; back++) {
          const ms = Date.parse(anchor + "T12:00:00+08:00") - back * 24 * 3600 * 1000;
          if (isNaN(ms)) break;
          const day = bjYmd(ms);
          if (weekdayIndexFromDate(day) === idx) {
            colDates[idx] = day;
            break;
          }
        }
      }
      return colDates;
    };

    const processedData = computed(() => {
      const empty = { list: [], freeTop3Codes: [], weekDays: [], weekStatusMonday: "", rankBy: "daily", rankDailyIdx: -1 };
      const colDates = buildRecentTradingColDates();
      const weekDays = colDates[0] ? colDates : (latestMonday.value ? getWeekDays(latestMonday.value) : []);
      if (!weekDays.length) return empty;

      const dateToIdx = new Map();
      weekDays.forEach((d, i) => { if (d) dateToIdx.set(d, i); });

      const etfMap = {};
      const ensureRow = (code, name) => {
        if (!etfMap[code]) {
          etfMap[code] = {
            etf_code: code,
            etf_name: name || code,
            days: [null, null, null, null, null],
            week_status: null,
            week_status_date: null,
            week_status_from: null,
          };
        } else if (name && !etfMap[code].etf_name) {
          etfMap[code].etf_name = name;
        }
        return etfMap[code];
      };

      allData.value.forEach((item) => {
        if (!item.date || !isValidDate(item.date)) return;
        const idx = dateToIdx.get(item.date.trim());
        if (idx === undefined) return;
        const code = normCode(item.etf_code) || item.etf_code;
        if (!code) return;
        const row = ensureRow(code, item.etf_name);
        row.days[idx] = item;
        if (item.etf_name) row.etf_name = item.etf_name;
      });

      (sharedList.value || []).forEach((s) => {
        const code = normCode(s.etf_code || s.code);
        if (code.length === 6) ensureRow(code, s.etf_name || s.name || code);
      });

      const closedWeekMonday = resolveLatestClosedWeekMonday();
      const closedWeekDays = closedWeekMonday ? getWeekDays(closedWeekMonday) : [];
      const closedWeekFriday = closedWeekDays.length >= 5 ? closedWeekDays[4] : "";
      Object.values(etfMap).forEach((row) => {
        const cur = closedWeekMonday ? findWeekStatusForMonday(row.etf_code, closedWeekMonday) : null;
        if (cur) {
          row.week_status = cur.status;
          row.week_status_date = closedWeekFriday || cur.date;
          row.week_status_from = "closed";
        }
      });

      let items = Object.values(etfMap);
      const hasStatus = (s) => !!(s && s !== "-" && s !== "--");
      const absDayVal = (row, dayIdx) => {
        if (dayIdx == null || dayIdx < 0) return -9999;
        const s = row.days?.[dayIdx]?.day_status;
        return hasStatus(s) ? Math.abs(getStatusVal(s)) : -9999;
      };
      const absWeekVal = (row) => (hasStatus(row.week_status) ? Math.abs(getStatusVal(row.week_status)) : -9999);

      let dailyColIdx = -1, dailyColDate = "";
      for (let idx = 0; idx < 5; idx++) {
        const d = weekDays[idx];
        if (d && d >= dailyColDate && items.some((i) => hasStatus(i.days?.[idx]?.day_status))) {
          dailyColDate = d;
          dailyColIdx = idx;
        }
      }

      // 免费 Top 3
      const freeTopN = 3;
      let freeTop3Codes = [];
      if (dailyColIdx >= 0) {
        freeTop3Codes = [...items]
          .filter((i) => absDayVal(i, dailyColIdx) > -9999)
          .sort((a, b) => absDayVal(b, dailyColIdx) - absDayVal(a, dailyColIdx))
          .slice(0, freeTopN)
          .map((i) => i.etf_code);
      }

      // 弹匣列
      let pivotIdx = dailyColIdx >= 0 ? dailyColIdx : 4;
      const n = BASE_COLS.length;
      const displayCols = [];
      for (let i = 1; i <= n; i++) {
        displayCols.push(BASE_COLS[(pivotIdx + i) % n]);
      }

      // 排序
      const freeSet = new Set(freeTop3Codes.map(String));
      items.sort((a, b) => {
        const ca = String(a.etf_code), cb = String(b.etf_code);
        const ga = freeSet.has(ca) ? 0 : 1;
        const gb = freeSet.has(cb) ? 0 : 1;
        if (ga !== gb) return ga - gb;
        return absDayVal(b, dailyColIdx) - absDayVal(a, dailyColIdx);
      });

      return {
        list: items,
        freeTop3Codes,
        weekDays,
        displayCols,
        latestColKey: displayCols[displayCols.length - 1].key,
      };
    });

    const visibleCols = computed(() => processedData.value?.displayCols || BASE_COLS);

    const canViewChart = (etfCode) => {
      if (store.state.isVip) return true;
      return processedData.value.freeTop3Codes.includes(etfCode);
    };

    // 拦截弹窗动作：导流注册或升级
    const triggerVipModal = (item, period = "日线/半日线") => {
      vipModal.etfCode = item.etf_code;
      vipModal.etfName = formatEtfName(item.etf_name);
      vipModal.periodText = period;
      vipModal.visible = true;
    };

    const handleRegisterAction = () => {
      vipModal.visible = false;
      store.state.authMode = "register";
      store.state.authModalVisible = true;
    };

    const handleUpgradeAction = () => {
      vipModal.visible = false;
      window.location.hash = "#/plan";
    };

    const openDailyChartViewer = async (item) => {
      if (!canViewChart(item.etf_code)) {
        triggerVipModal(item, "日线/半日线");
        return;
      }
      const code = String(item.etf_code || "").replace(/\D/g, "").slice(-6) || item.etf_code;
      const url = `https://pub-973330e118204686a625fe51431d4336.r2.dev/charts/${code}_daily.png`;
      window.open(url, "_blank");
    };

    const openWeeklyChartViewer = async (item) => {
      if (!canViewChart(item.etf_code)) {
        triggerVipModal(item, "周线");
        return;
      }
      const code = String(item.etf_code || "").replace(/\D/g, "").slice(-6) || item.etf_code;
      const url = `https://pub-973330e118204686a625fe51431d4336.r2.dev/charts/${code}_weekly.png`;
      window.open(url, "_blank");
    };

    const isFavorite = (code) => favCodes.value.includes(String(code).replace(/\D/g, "").slice(-6));

    const toggleFavorite = async (item, ev) => {
      if (ev) ev.stopPropagation();
      if (!store.state.isLoggedIn) {
        store.showToast("登录后可收藏标的", "error");
        return;
      }
      const code = String(item.etf_code || "").replace(/\D/g, "").slice(-6);
      try {
        const res = await dashboardPrefsApi.toggleFavorite(code);
        const on = !!(res && (res.favorite === true || res.favorite === 1));
        if (on) favCodes.value.push(code);
        else favCodes.value = favCodes.value.filter((c) => c !== code);
        store.showToast(on ? "已收藏" : "已取消收藏");
      } catch (err) {
        store.showToast(err.message || "收藏失败", "error");
      }
    };

    const getColorClass = (status) => {
      if (!status || status === "-" || status === "--") return "text-slate-300";
      return status.includes("+") ? "text-red-500" : "text-emerald-500";
    };

    onMounted(async () => {
      loading.value = true;
      try {
        const [data, chartsRes, sharedRes] = await Promise.all([
          etfApi.fetchEtfRawData().catch(() => []),
          etfApi.fetchChartsMap().catch(() => ({})),
          etfApi.fetchSharedWatchlist().catch(() => ({ data: [] })),
        ]);
        allData.value = Array.isArray(data) ? data : [];
        chartsMap.value = chartsRes.charts || chartsRes || {};
        sharedList.value = sharedRes.data || [];
        await resolveGlobalChartDay([], chartsRes?.chart_date);
        await resolveWeeklyChartDay(chartsRes?.weekly_chart_date);
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
        await scrollToLatestCol();
      }
    });

    return {
      store: store.state,
      loading,
      searchQuery,
      sortColumn,
      sortOrder,
      handleSort,
      processedData,
      visibleCols,
      formatEtfName,
      formatDayCell,
      dataDateTitle,
      dailyChartTitle,
      weekDataTitle,
      weekChartTitle,
      showDailyChartIcon,
      openDailyChartViewer,
      openWeeklyChartViewer,
      getColorClass,
      cellPrimaryStatus,
      isFavorite,
      toggleFavorite,
      tableScrollEl,
      tipEnabled,
      tipVisible,
      tipChannel,
      tipWechatSrc,
      tipAlipaySrc,
      settings,
      vipModal,
      handleRegisterAction,
      handleUpgradeAction,
    };
  },
  template: `
    <div class="max-w-7xl mx-auto space-y-3 sm:space-y-4 select-none">
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 flex items-center w-full">
        <i class="fa-solid fa-magnifying-glass text-slate-400 pl-3.5"></i>
        <input v-model="searchQuery" type="search" placeholder="搜索 标的代码/名称..." class="w-full bg-transparent border-none outline-none text-sm py-2.5 px-3">
      </div>

      <div v-if="loading" class="text-center py-12 text-slate-400">
        <i class="fa-solid fa-spinner animate-spin text-2xl theme-text"></i>
        <p class="mt-2 text-sm">读取量化云端数据中...</p>
      </div>

      <template v-else>
        <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div ref="tableScrollEl" class="overflow-x-auto custom-scrollbar dash-table-scroll">
            <table class="text-center border-collapse whitespace-nowrap w-full dash-board-table">
              <thead class="bg-slate-50 border-b border-slate-100">
                <tr class="text-xs text-slate-600 font-bold select-none">
                  <th class="py-3 px-2 sm:px-4 text-left etf-name-column dash-col-name sticky top-0 left-0 bg-slate-50 z-40 border-b border-r border-slate-200">
                    标的名称
                  </th>
                  <th v-for="col in visibleCols" :key="col.key" class="py-3 px-1.5 sm:px-2 sticky top-0 bg-slate-50 z-30 border-b border-slate-200">
                    {{ col.label }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50 text-sm">
                <tr v-for="item in processedData.list" :key="item.etf_code" class="hover:bg-[#4da6a0]/5 transition-colors group">
                  <td class="p-2 sm:p-3 text-left sticky left-0 bg-white group-hover:bg-[#f6faf9] z-10 etf-name-column dash-col-name border-r border-slate-100">
                    <div v-if="processedData.freeTop3Codes.includes(item.etf_code)" class="absolute left-0 top-0 bottom-0 w-1 theme-bg"></div>
                    <div class="flex items-start gap-1 min-w-0">
                      <button type="button" class="mt-0.5 shrink-0 p-0.5 leading-none" @click="toggleFavorite(item, $event)">
                        <i class="fa-solid fa-star text-sm" :class="isFavorite(item.etf_code) ? 'text-amber-400' : 'text-slate-300'"></i>
                      </button>
                      <div class="min-w-0 flex-1 overflow-hidden">
                        <div class="font-bold text-slate-800 flex items-center gap-1">
                          <span class="truncate text-[12px] sm:text-sm">{{ formatEtfName(item.etf_name) }}</span>
                          <span v-if="processedData.freeTop3Codes.includes(item.etf_code)" class="text-[10px] bg-emerald-100 text-emerald-700 px-1 py-0.2 rounded font-bold">限免</span>
                          <span v-else class="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-1 rounded font-bold">VIP</span>
                        </div>
                        <div class="text-[11px] text-slate-400 font-mono">{{ item.etf_code }}</div>
                      </div>
                    </div>
                  </td>

                  <td v-for="col in visibleCols" :key="col.key" class="p-1.5 sm:p-3 font-medium" :class="getColorClass(col.type==='week' ? item.week_status : cellPrimaryStatus(item.days[col.dayIdx]))">
                    <template v-if="col.type==='day'">
                      <div class="flex items-center justify-center gap-1">
                        <span class="text-[10px] sm:text-sm font-mono">{{ formatDayCell(item.days[col.dayIdx]) }}</span>
                        <i v-if="showDailyChartIcon(item.etf_code, col.dayIdx)"
                           class="fa-regular fa-image cursor-pointer text-sm sm:text-xs shrink-0 p-1"
                           :class="processedData.freeTop3Codes.includes(item.etf_code) || store.isVip ? 'text-slate-400 hover:text-blue-500' : 'text-amber-500 hover:text-amber-600'"
                           @click.stop="openDailyChartViewer(item)"></i>
                      </div>
                    </template>
                    <template v-else>
                      <div class="flex items-center justify-center gap-1">
                        <span class="text-[10px] sm:text-sm font-mono">{{ item.week_status || '-' }}</span>
                        <i class="fa-regular fa-image cursor-pointer text-sm sm:text-xs shrink-0 p-1"
                           :class="processedData.freeTop3Codes.includes(item.etf_code) || store.isVip ? 'text-slate-400 hover:text-blue-500' : 'text-amber-500 hover:text-amber-600'"
                           @click.stop="openWeeklyChartViewer(item)"></i>
                      </div>
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <p class="text-[11px] text-slate-400 text-center">
          标有「限免」的标的向所有访客开放全周期图表；其余标的为 VIP 专属。
        </p>
      </template>

      <!-- ===== 变现价值拦截弹窗 ===== -->
      <div v-if="vipModal.visible" class="fixed inset-0 modal-overlay z-[120] flex items-center justify-center p-4" @click.self="vipModal.visible=false">
        <div class="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-center">
          <div class="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto text-xl">
            <i class="fa-solid fa-crown"></i>
          </div>
          <div>
            <h3 class="text-lg font-bold text-slate-800">解锁【{{ vipModal.etfName }}】专属图表</h3>
            <p class="text-xs text-slate-500 mt-1">代码: {{ vipModal.etfCode }} | 包含半日线与日线真实波幅通道</p>
          </div>
          <div class="bg-slate-50 rounded-xl p-3.5 text-xs text-slate-600 text-left space-y-1.5 border border-slate-100">
            <div class="flex items-center gap-1.5 text-slate-700 font-bold">
              <i class="fa-solid fa-circle-check text-emerald-500"></i> 会员尊享权益：
            </div>
            <div>● 50+ 只主流 ETF 多周期异动监控与图表完整访问</div>
            <div>● 盘中半日线（11:30）异常收敛与突破抢先预警</div>
            <div>● 每月票选监控标的自选入池投票权</div>
          </div>
          <div class="space-y-2 pt-2">
            <button v-if="!store.isLoggedIn" @click="handleRegisterAction" class="w-full theme-bg text-white py-2.5 rounded-lg text-sm font-bold shadow-sm hover:opacity-90">
              立即免费注册（立赠 3 天 VIP 体验）
            </button>
            <button v-else @click="handleUpgradeAction" class="w-full theme-bg text-white py-2.5 rounded-lg text-sm font-bold shadow-sm hover:opacity-90">
              升级开通监控 VIP
            </button>
            <button @click="vipModal.visible=false" class="w-full py-1.5 text-xs text-slate-400">
              暂不解锁，继续浏览
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
};
