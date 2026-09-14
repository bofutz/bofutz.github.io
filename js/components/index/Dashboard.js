/* ========================= FILE: js/components/index/Dashboard.js ========================= */

/**
 * 波幅探长 - 数据看板（完整还原原版标的排列与限免规则 + 高转化拦截与连续画廊）
 * js/components/index/Dashboard.js
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

/** 基准列序：周一..周五、周线（0..4 day，-1 week） */
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
    
    // 会员收藏 / 自定义拖拽排序
    const favCodes = ref([]);
    const userOrder = ref([]);
    const dragCode = ref(null);
    const prefsSaving = ref(false);

    // 搜索与排序
    const searchQuery = ref("");
    const sortColumn = ref(null);
    const sortOrder = ref("desc");

    // 打赏与滚动
    const tipVisible = ref(false);
    const tipChannel = ref("wechat");
    const tableScrollEl = ref(null);

    // VIP 转化拦截弹窗状态
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
      if (!u || !/^https?:\/\//i.test(u)) return false;
      return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(u);
    };

    const tipWechatSrc = computed(() => {
      const u = String(settings.value.wechat_qr_url || settings.value.tip_wechat_qr_url || "").trim();
      return isImageUrl(u) ? u : "";
    });
    const tipAlipaySrc = computed(() => {
      const u = String(settings.value.alipay_qr_url || settings.value.tip_alipay_qr_url || "").trim();
      return isImageUrl(u) ? u : "";
    });

    const isValidDate = (d) =>
      d && typeof d === "string" && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(d.trim());

    const parseYMD = (s) =>
      isValidDate(s) ? s.trim().split(/[-/]/).map((v) => parseInt(v, 10)) : [0, 0, 0];

    const formatDateCN = (dateStr) => {
      if (!dateStr || !isValidDate(dateStr)) return "";
      const [, m, d] = parseYMD(dateStr);
      return `${m}月${d}日`;
    };

    const formatEtfName = (name) => {
      if (!name) return "";
      const s = String(name).trim();
      const m = s.match(/^(.*?ETF)/i);
      return m ? m[1] : s;
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
      if (!cn) return kind || "";
      return kind ? cn + kind : cn;
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
      if (d && isValidDate(d)) return chartDateTitle(d);
      return "周线图表";
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
        days.push(
          `${temp.getFullYear()}-${String(temp.getMonth() + 1).padStart(2, "0")}-${String(
            temp.getDate()
          ).padStart(2, "0")}`
        );
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
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    };

    const latestMonday = computed(() => {
      const validDates = [
        ...new Set(
          allData.value
            .filter((i) => i.date && isValidDate(i.date))
            .map((i) => i.date)
        ),
      ].sort();
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
      if (!ts || isNaN(ts)) {
        const parsed = Date.parse(String(val));
        if (isNaN(parsed)) return null;
        ts = parsed;
      }
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
      return {
        url: raw.chart_url || raw.url || "",
        updated_at: raw.updated_at || raw.last_modified || null,
      };
    };

    const chartUpdateDay = (_code) => globalChartDay.value || null;

    const chartColIndexForCode = (etfCode) => {
      if (!latestMonday.value) return -1;
      const weekDays = getWeekDays(latestMonday.value);
      if (!weekDays.length) return -1;
      const day = chartUpdateDay(etfCode);
      if (!day) return -1;
      const idx = weekDays.indexOf(day);
      if (idx >= 0) return idx;
      return -1;
    };

    const showDailyChartIcon = (etfCode, colIdx) => {
      if (colIdx < 0) return false;
      let target = chartColIndexForCode(etfCode);
      if (target < 0 && globalChartDay.value && latestMonday.value) {
        const weekDays = getWeekDays(latestMonday.value);
        const day = globalChartDay.value;
        if (day && weekDays.length) {
          const wd = new Date(day + "T12:00:00+08:00").getDay();
          if (wd === 0 || wd === 6) {
            target = 4;
          }
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
      let maxTs = 0;
      Object.values(chartsMap.value || {}).forEach((raw) => {
        if (!raw || typeof raw === "string") return;
        const u = raw.updated_at || raw.last_modified;
        if (u == null || u === "") return;
        let ts = Number(u);
        if (!ts || isNaN(ts)) ts = Date.parse(String(u));
        else if (ts < 1e12) ts *= 1000;
        if (ts && !isNaN(ts) && ts > maxTs) maxTs = ts;
      });
      if (maxTs > 0) {
        globalChartDay.value = bjYmd(maxTs);
        return globalChartDay.value;
      }
      globalChartDay.value = latestTradingDayBj();
      return globalChartDay.value;
    };

    const lastSaturdayBj = () => {
      for (let i = 0; i <= 13; i++) {
        const ms = Date.now() - i * 24 * 3600 * 1000;
        const day = bjYmd(ms);
        const wd = new Date(day + "T12:00:00+08:00").getDay();
        if (wd === 6) return day;
      }
      return bjYmd(Date.now());
    };

    const resolveWeeklyChartDay = async (apiWeeklyChartDate = null, _apiChartDate = null) => {
      const fromWeekly = toBjDay(apiWeeklyChartDate);
      if (fromWeekly) {
        weeklyChartDay.value = fromWeekly;
        return fromWeekly;
      }
      const monday = resolveLatestClosedWeekMonday();
      if (monday) {
        const [y, m, d] = parseYMD(monday);
        if (y) {
          const sat = new Date(y, m - 1, d + 5);
          const satStr = `${sat.getFullYear()}-${String(sat.getMonth() + 1).padStart(2, "0")}-${String(sat.getDate()).padStart(2, "0")}`;
          weeklyChartDay.value = satStr;
          return satStr;
        }
      }
      weeklyChartDay.value = lastSaturdayBj();
      return weeklyChartDay.value;
    };

    const handleSort = (column) => {
      if (sortColumn.value === column) {
        if (sortOrder.value === "desc") sortOrder.value = "asc";
        else {
          sortColumn.value = null;
          sortOrder.value = "desc";
        }
      } else {
        sortColumn.value = column;
        sortOrder.value = "desc";
      }
    };

    const isBlankStatus = (s) =>
      !s || s === "-" || s === "--" || s === "None" || s === "null";

    const normCode = (c) =>
      String(c || "")
        .replace(/\D/g, "")
        .slice(-6);

    const findWeekStatusForMonday = (etfCode, mondayStr) => {
      if (!mondayStr) return null;
      const want = normCode(etfCode);
      let best = null;
      let bestDate = "";
      for (const item of allData.value) {
        if (normCode(item.etf_code) !== want) continue;
        if (!item.date || !isValidDate(item.date)) continue;
        if (isBlankStatus(item.week_status)) continue;
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
        if (d && isValidDate(d) && String(d).trim() > maxDate)
          maxDate = String(d).trim();
      }
      if (!maxDate) return "";
      const wDays = getWeekDays(maxDate);
      return wDays.length ? wDays[0] : "";
    };

    const weekdayIndexFromDate = (dateStr) => {
      if (!isValidDate(dateStr)) return -1;
      try {
        const wd = new Date(dateStr.trim() + "T12:00:00+08:00").getDay();
        if (wd === 0 || wd === 6) return -1;
        return wd - 1;
      } catch (_) {
        return -1;
      }
    };

    const quoteOk = (s) =>
      !!(s && s !== "-" && s !== "--" && s !== "None" && s !== "null");

    const itemHasDailyQuote = (item) =>
      item &&
      (quoteOk(item.day_status) ||
        quoteOk(item.am_status) ||
        quoteOk(item.pm_status));

    const buildRecentTradingColDates = () => {
      const colDates = [null, null, null, null, null];
      for (const item of allData.value || []) {
        if (!item || !item.date || !isValidDate(item.date)) continue;
        if (!itemHasDailyQuote(item)) continue;
        const idx = weekdayIndexFromDate(item.date);
        if (idx < 0) continue;
        const d = item.date.trim();
        if (!colDates[idx] || d > colDates[idx]) colDates[idx] = d;
      }
      let anchor = "";
      for (const d of colDates) {
        if (d && d > anchor) anchor = d;
      }
      if (!anchor) anchor = bjYmd(Date.now());
      for (let idx = 0; idx < 5; idx++) {
        if (colDates[idx]) continue;
        for (let back = 0; back <= 21; back++) {
          const ms =
            Date.parse(anchor + "T12:00:00+08:00") - back * 24 * 3600 * 1000;
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

    // ============================================================
    // 标的排列与限免计算（完全沿用原版 dashboard-grok.js 逻辑）
    // ============================================================
    const processedData = computed(() => {
      const empty = {
        list: [],
        freeTop3Codes: [],
        weekDays: [],
        weekStatusMonday: "",
        rankBy: "daily",
        rankDailyIdx: -1,
        displayCols: BASE_COLS.slice(),
        latestColKey: "d4",
      };

      const colDates = buildRecentTradingColDates();
      if (!colDates[0] && !colDates[1] && !colDates[2] && !colDates[3] && !colDates[4]) {
        const fb = latestMonday.value ? getWeekDays(latestMonday.value) : [];
        if (fb.length < 5) return empty;
        for (let i = 0; i < 5; i++) colDates[i] = fb[i];
      }
      const weekDays = colDates;

      const dateToIdx = new Map();
      weekDays.forEach((d, i) => {
        if (d) dateToIdx.set(d, i);
      });

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

      // ① 灌入日线数据
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

      // ② 并入通用监控列表
      (sharedList.value || []).forEach((s) => {
        const code = normCode(s.etf_code || s.code);
        if (code.length !== 6) return;
        ensureRow(code, s.etf_name || s.name || code);
      });

      // ③ 行情里出现过的代码兜底建行
      allData.value.forEach((item) => {
        const code = normCode(item.etf_code);
        if (code.length !== 6) return;
        ensureRow(code, item.etf_name || code);
      });

      // ④ 周线统一为闭合周
      const closedWeekMonday = resolveLatestClosedWeekMonday();
      const closedWeekDays = closedWeekMonday ? getWeekDays(closedWeekMonday) : [];
      const closedWeekFriday = closedWeekDays.length >= 5 ? closedWeekDays[4] : "";
      Object.values(etfMap).forEach((row) => {
        const cur = closedWeekMonday
          ? findWeekStatusForMonday(row.etf_code, closedWeekMonday)
          : null;
        if (cur) {
          row.week_status = cur.status;
          row.week_status_date = closedWeekFriday || cur.date;
          row.week_status_from = "closed";
        } else {
          row.week_status = null;
          row.week_status_date = null;
          row.week_status_from = null;
        }
      });

      const weekStatusMonday = closedWeekMonday || latestMonday.value;
      let items = Object.values(etfMap);

      const hasStatus = (s) => !(!s || s === "-" || s === "--");
      const cellHasDay = (row, idx) => hasStatus(row.days?.[idx]?.day_status);
      const cellHasHalf = (row, idx) => {
        const c = row.days?.[idx];
        return !(!c || (!hasStatus(c.am_status) && !hasStatus(c.pm_status)));
      };
      const cellHasAny = (row, idx) => cellHasDay(row, idx) || cellHasHalf(row, idx);

      // 最新日线列 = colDates 中日期最大的那一列
      let latestIdx = -1;
      let latestDayDate = "";
      for (let idx = 0; idx < 5; idx++) {
        const d = weekDays[idx];
        if (d && d >= latestDayDate && items.some((i) => cellHasAny(i, idx))) {
          latestDayDate = d;
          latestIdx = idx;
        }
      }

      // 日线波幅列（有日线状态的最新列）
      let dailyColIdx = -1;
      let dailyColDate = "";
      for (let idx = 0; idx < 5; idx++) {
        const d = weekDays[idx];
        if (d && d >= dailyColDate && items.some((i) => cellHasDay(i, idx))) {
          dailyColDate = d;
          dailyColIdx = idx;
        }
      }

      const hasAnyWeek = items.some((i) => hasStatus(i.week_status));

      // 判断采集日优先级与周末周线模式
      const todayBj = bjYmd(Date.now());
      let isWeekendBj = false;
      try {
        const wd = new Date(todayBj + "T12:00:00+08:00").getDay();
        isWeekendBj = wd === 0 || wd === 6;
      } catch (_) {}

      let maxWeekStatusDate = "";
      for (const row of items) {
        if (!hasStatus(row.week_status)) continue;
        const d = row.week_status_date;
        if (d && isValidDate(d) && d > maxWeekStatusDate) maxWeekStatusDate = d;
      }
      const weeklyCollectDay =
        (weeklyChartDay.value && isValidDate(weeklyChartDay.value) && weeklyChartDay.value) ||
        maxWeekStatusDate ||
        "";
      const dailyCollectDay =
        (globalChartDay.value && isValidDate(globalChartDay.value) && globalChartDay.value) ||
        (latestIdx >= 0 && weekDays[latestIdx] ? weekDays[latestIdx] : "") ||
        "";

      let rankBy = "daily";
      if (hasAnyWeek && isWeekendBj) {
        rankBy = "weekly";
      } else if (hasAnyWeek && weeklyCollectDay && dailyCollectDay && weeklyCollectDay > dailyCollectDay) {
        rankBy = "weekly";
      } else if (hasAnyWeek && weeklyCollectDay && weeklyCollectDay === todayBj) {
        rankBy = "weekly";
      } else if (latestIdx >= 0) {
        rankBy = "daily";
      } else if (hasAnyWeek) {
        rankBy = "weekly";
      }

      const absDayVal = (row, dayIdx) => {
        if (dayIdx == null || dayIdx < 0) return -9999;
        const s = row.days?.[dayIdx]?.day_status;
        if (!hasStatus(s)) return -9999;
        const v = getStatusVal(s);
        return v === -9999 ? -9999 : Math.abs(v);
      };

      const absHalfVal = (row, dayIdx) => {
        if (dayIdx == null || dayIdx < 0) return -9999;
        const item = row.days?.[dayIdx];
        if (!item) return -9999;
        const pm = getStatusVal(item.pm_status);
        const am = getStatusVal(item.am_status);
        let best = -9999;
        if (pm !== -9999) best = Math.max(best, Math.abs(pm));
        if (am !== -9999) best = Math.max(best, Math.abs(am));
        return best;
      };

      const absWeekVal = (row) => {
        const s = row.week_status;
        if (!hasStatus(s)) return -9999;
        const v = getStatusVal(s);
        return v === -9999 ? -9999 : Math.abs(v);
      };

      const cmpDayColumn = (a, b, idx, orderDesc = true) => {
        const da = absDayVal(a, idx);
        const db = absDayVal(b, idx);
        if (da !== db) {
          if (da === -9999) return 1;
          if (db === -9999) return -1;
          return orderDesc ? db - da : da - db;
        }
        const ha = absHalfVal(a, idx);
        const hb = absHalfVal(b, idx);
        if (ha !== hb) {
          if (ha === -9999) return 1;
          if (hb === -9999) return -1;
          return orderDesc ? hb - ha : ha - hb;
        }
        return String(a.etf_code || "").localeCompare(String(b.etf_code || ""));
      };

      const cmpWeekColumn = (a, b, orderDesc = true) => {
        const wa = absWeekVal(a);
        const wb = absWeekVal(b);
        if (wa !== wb) {
          if (wa === -9999) return 1;
          if (wb === -9999) return -1;
          return orderDesc ? wb - wa : wa - wb;
        }
        return String(a.etf_code || "").localeCompare(String(b.etf_code || ""));
      };

      const cmpDefaultRank = (a, b) => {
        if (rankBy === "weekly") return cmpWeekColumn(a, b, true);
        if (latestIdx >= 0) return cmpDayColumn(a, b, latestIdx, true);
        return String(a.etf_code || "").localeCompare(String(b.etf_code || ""));
      };

      // 原版免费看图 TOP3 规则（完全还原）：周线模式用周线排，日线模式用日线排
      const freeTopN = 3;
      let freeTop3Codes = [];
      if (rankBy === "weekly") {
        freeTop3Codes = [...items]
          .filter((i) => absWeekVal(i) > -9999)
          .sort((a, b) => {
            const d = absWeekVal(b) - absWeekVal(a);
            if (d !== 0) return d;
            return String(a.etf_code || "").localeCompare(String(b.etf_code || ""));
          })
          .slice(0, freeTopN)
          .map((i) => i.etf_code);
      } else if (dailyColIdx >= 0) {
        freeTop3Codes = [...items]
          .filter((i) => absDayVal(i, dailyColIdx) > -9999)
          .sort((a, b) => {
            const d = absDayVal(b, dailyColIdx) - absDayVal(a, dailyColIdx);
            if (d !== 0) return d;
            return String(a.etf_code || "").localeCompare(String(b.etf_code || ""));
          })
          .slice(0, freeTopN)
          .map((i) => i.etf_code);
      }

      // 手动点击表头排序处理
      items.sort((a, b) => {
        if (sortColumn.value) {
          if (sortColumn.value === "etf_name") {
            const cmp = (a.etf_name || "").localeCompare(b.etf_name || "", "zh-CN");
            return sortOrder.value === "asc" ? cmp : -cmp;
          }
          if (sortColumn.value.startsWith("d")) {
            const idx = parseInt(sortColumn.value.substring(1), 10);
            return cmpDayColumn(a, b, idx, sortOrder.value !== "asc");
          }
          if (sortColumn.value === "week_status") {
            return cmpWeekColumn(a, b, sortOrder.value !== "asc");
          }
        }
        return cmpDefaultRank(a, b);
      });

      // 搜索过滤
      if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase().trim();
        items = items.filter(
          (i) =>
            (i.etf_name && i.etf_name.toLowerCase().includes(q)) ||
            (i.etf_code && i.etf_code.toLowerCase().includes(q))
        );
      }

      // 标的默认排列顺序（完全还原原版）：
      // 1. 周线模式：整表纯按周线波动绝对值降序排列；
      // 2. 日线模式：【免费 TOP3】 -> 【VIP 收藏】 -> 【其余标的】，组内按最新采集排序与拖拽序
      if (!sortColumn.value) {
        if (rankBy === "weekly") {
          items.sort((a, b) => cmpWeekColumn(a, b, true));
        } else {
          const freeSet = new Set((freeTop3Codes || []).map((c) => String(c)));
          const freeIdx = new Map(
            (freeTop3Codes || []).map((c, i) => [String(c), i])
          );
          const favSet = new Set(
            store.state.isLoggedIn && store.state.isVip
              ? (Array.isArray(favCodes.value) ? favCodes.value : []).map((c) =>
                  String(c)
                )
              : []
          );
          const orderMap = new Map(
            (Array.isArray(userOrder.value) ? userOrder.value : []).map((c, i) => [
              String(c),
              i,
            ])
          );
          const groupOf = (code) => {
            const c = String(code);
            if (freeSet.has(c)) return 0;
            if (favSet.has(c)) return 1;
            return 2;
          };
          items.sort((a, b) => {
            const ca = String(a.etf_code);
            const cb = String(b.etf_code);
            const ga = groupOf(ca);
            const gb = groupOf(cb);
            if (ga !== gb) return ga - gb;
            if (ga === 0) {
              return (freeIdx.get(ca) ?? 0) - (freeIdx.get(cb) ?? 0);
            }
            const primary = cmpDefaultRank(a, b);
            if (primary !== 0) return primary;
            if (orderMap.size) {
              const ia = orderMap.has(ca) ? orderMap.get(ca) : 100000;
              const ib = orderMap.has(cb) ? orderMap.get(cb) : 100000;
              if (ia !== ib) return ia - ib;
            }
            return 0;
          });
        }
      }

      // 列弹匣轮转（最右为最新列）
      let pivotIdx = 5;
      if (rankBy === "weekly") {
        pivotIdx = 5;
      } else if (latestIdx >= 0) {
        pivotIdx = latestIdx;
      } else if (globalChartDay.value && weekDays.length) {
        const ci = weekDays.indexOf(globalChartDay.value);
        if (ci >= 0) pivotIdx = ci;
        else {
          try {
            const wd = new Date(globalChartDay.value + "T12:00:00+08:00").getDay();
            if (wd === 0 || wd === 6) pivotIdx = 4;
          } catch (_) {}
        }
      }
      const n = BASE_COLS.length;
      const displayCols = [];
      for (let i = 1; i <= n; i++) {
        displayCols.push(BASE_COLS[(pivotIdx + i) % n]);
      }
      const latestColKey = displayCols[displayCols.length - 1].key;

      return {
        list: items,
        freeTop3Codes,
        weekDays,
        weekStatusMonday,
        rankBy,
        rankDailyIdx: rankBy === "daily" ? latestIdx : -1,
        displayCols,
        latestColKey,
      };
    });

    const visibleCols = computed(() => {
      const pd = processedData.value;
      return pd && pd.displayCols && pd.displayCols.length
        ? pd.displayCols
        : BASE_COLS.slice();
    });

    const canViewChart = (etfCode) => {
      if (store.state.isVip) return true;
      return (processedData.value.freeTop3Codes || []).includes(etfCode);
    };

    const triggerVipModal = (item, period = "日线/半日线") => {
      vipModal.etfCode = item.etf_code;
      vipModal.etfName = formatEtfName(item.etf_name);
      vipModal.periodText = period;
      vipModal.visible = true;
    };

    const handleRegisterAction = async () => {
      vipModal.visible = false;
      store.state.menuOpen = false;
      store.state.userMenuOpen = false;
      await nextTick();
      store.state.authModalVisible = true;
    };

    const handleUpgradeAction = () => {
      vipModal.visible = false;
      window.location.hash = "#/plan";
    };

    // ============================================================
    // 会员自定义排版与拖拽排序
    // ============================================================
    const isFavorite = (code) => {
      const list = Array.isArray(favCodes.value) ? favCodes.value : [];
      const c = String(code || "").replace(/\D/g, "").slice(-6);
      return !(!c || !list.includes(c));
    };

    const canCustomizeBoard = computed(
      () => !(!store.state.isLoggedIn || !store.state.isVip)
    );

    const loadDashboardPrefs = async () => {
      if (!canCustomizeBoard.value) {
        favCodes.value = [];
        userOrder.value = [];
        return;
      }
      try {
        const res = await dashboardPrefsApi.fetch();
        const data = (res && res.data) || res || {};
        favCodes.value = (data.favorites || [])
          .map((c) => String(c).replace(/\D/g, "").slice(-6))
          .filter((c) => c.length === 6);
        userOrder.value = (data.order || []).map((c) =>
          String(c).replace(/\D/g, "").slice(-6)
        );
      } catch (e) {
        console.log("dashboard prefs", e && e.message);
      }
    };

    const toggleFavorite = async (item, ev) => {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      if (!canCustomizeBoard.value) {
        store.showToast("登录会员后可收藏标的", "error");
        return;
      }
      const code = String(item.etf_code || "").replace(/\D/g, "").slice(-6);
      if (code.length !== 6) return;
      try {
        const res = await dashboardPrefsApi.toggleFavorite(code);
        const on = !(!res || (res.favorite !== true && res.favorite !== 1));
        const cur = Array.isArray(favCodes.value) ? favCodes.value.slice() : [];
        const idx = cur.indexOf(code);
        if (on && idx < 0) cur.push(code);
        if (!on && idx >= 0) cur.splice(idx, 1);
        favCodes.value = cur;
        store.showToast(on ? "已收藏" : "已取消收藏");
      } catch (err) {
        store.showToast(err.message || "收藏失败", "error");
      }
    };

    const onDragStart = (item, ev) => {
      if (!canCustomizeBoard.value) {
        ev.preventDefault();
        return;
      }
      dragCode.value = String(item.etf_code);
      try {
        ev.dataTransfer.effectAllowed = "move";
        ev.dataTransfer.setData("text/plain", String(item.etf_code));
      } catch (_) {}
    };

    const onDragOver = (ev) => {
      if (!canCustomizeBoard.value) return;
      ev.preventDefault();
      try {
        ev.dataTransfer.dropEffect = "move";
      } catch (_) {}
    };

    const onDropRow = async (targetItem, ev) => {
      if (!canCustomizeBoard.value) return;
      ev.preventDefault();
      ev.stopPropagation();
      const from =
        dragCode.value ||
        (ev.dataTransfer && ev.dataTransfer.getData("text/plain"));
      const to = String(targetItem.etf_code);
      dragCode.value = null;
      if (!from || from === to) return;

      const list = (processedData.value.list || []).map((x) => String(x.etf_code));
      const next = list.slice();
      const fi = next.indexOf(String(from));
      const ti = next.indexOf(to);
      if (fi < 0 || ti < 0) return;
      next.splice(fi, 1);
      next.splice(ti, 0, String(from));
      userOrder.value = next;
      if (prefsSaving.value) return;
      prefsSaving.value = true;
      try {
        await dashboardPrefsApi.saveOrder(next, Array.from(favCodes.value));
      } catch (err) {
        store.showToast(err.message || "排序保存失败", "error");
      } finally {
        prefsSaving.value = false;
      }
    };

    // ============================================================
    // 画廊浏览与连续翻页导航
    // ============================================================
    const probeImage = (url) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
      });

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
          box-shadow: 0 6px 20px rgba(0,0,0,.28); -webkit-tap-highlight-color: transparent;
          user-select: none; backdrop-filter: blur(6px);
          transition: background .15s ease, transform .15s ease, border-color .15s ease;
          padding: 0;
        }
        .bofutz-viewer-nav:hover { background: rgba(15, 23, 42, 0.7); border-color: #fff; }
        .bofutz-viewer-nav:active { transform: translateY(-50%) scale(0.94); }
        .bofutz-viewer-nav svg {
          width: 22px; height: 22px; display: block; fill: none;
          stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round;
        }
        .bofutz-viewer-prev { left: 16px; }
        .bofutz-viewer-next { right: 16px; }
        @media (max-width: 640px) {
          .bofutz-viewer-nav { width: 46px; height: 46px; }
          .bofutz-viewer-nav svg { width: 20px; height: 20px; }
          .bofutz-viewer-prev { left: 8px; }
          .bofutz-viewer-next { right: 8px; }
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
        img.alt = item.title;
        container.appendChild(img);
      });
      document.body.appendChild(container);
      const isMulti = imgList.length > 1;
      if (window.Viewer) {
        ensureViewerNavStyle();
        let navPrev = null, navNext = null;
        const clearNav = () => {
          try {
            navPrev && navPrev.remove();
            navNext && navNext.remove();
          } catch (_) {}
          navPrev = navNext = null;
        };
        const viewer = new window.Viewer(container, {
          hidden: () => {
            clearNav();
            viewer.destroy();
            container.remove();
          },
          title: true,
          navbar: isMulti,
          tooltip: true,
          movable: true,
          zoomable: true,
          rotatable: false,
          scalable: false,
          transition: true,
          keyboard: isMulti,
          loop: isMulti,
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
            navPrev.setAttribute("aria-label", "上一张");
            navPrev.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="15 6 9 12 15 18"></polyline></svg>';
            navPrev.addEventListener("click", (e) => {
              e.preventDefault(); e.stopPropagation();
              try { viewer.prev(true); } catch (_) {}
            });
            navNext = document.createElement("button");
            navNext.type = "button";
            navNext.className = "bofutz-viewer-nav bofutz-viewer-next";
            navNext.setAttribute("aria-label", "下一张");
            navNext.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"></polyline></svg>';
            navNext.addEventListener("click", (e) => {
              e.preventDefault(); e.stopPropagation();
              try { viewer.next(true); } catch (_) {}
            });
            root.appendChild(navPrev);
            root.appendChild(navNext);
          },
        });
        viewer.show();
      } else {
        window.open(imgList[initialIndex]?.url, "_blank");
      }
    };

    const viewableBoardItems = () => {
      const list = processedData.value?.list || [];
      return list.filter((row) => row && canViewChart(row.etf_code));
    };

    const probeImagesBatch = async (candidates, concurrency = 12) => {
      const out = [];
      let i = 0;
      const workers = Array.from({ length: Math.min(concurrency, Math.max(1, candidates.length)) }, async () => {
        while (i < candidates.length) {
          const idx = i++;
          const c = candidates[idx];
          if (c && c.url && (await probeImage(c.url))) out.push({ ...c, _idx: idx });
        }
      });
      await Promise.all(workers);
      out.sort((a, b) => a._idx - b._idx);
      return out.map(({ _idx, ...rest }) => rest);
    };

    const openDailyChartViewer = async (item) => {
      if (!canViewChart(item.etf_code)) {
        triggerVipModal(item, "日线/半日线");
        return;
      }
      const rows = viewableBoardItems();
      if (!rows.length) {
        store.showToast("暂无可查看的图表", "error");
        return;
      }
      store.showToast("正在加载画廊图库…");
      const dayLabel = formatDateCN(chartUpdateDay(item.etf_code) || globalChartDay.value) || "";
      const candidates = [];
      for (const row of rows) {
        const code = String(row.etf_code || "").replace(/\D/g, "").slice(-6) || row.etf_code;
        const name = formatEtfName(row.etf_name) || code;
        const entry = resolveChartEntry(code);
        const r2Daily = `https://pub-973330e118204686a625fe51431d4336.r2.dev/charts/${code}_daily.png`;
        const r2Half = `https://pub-973330e118204686a625fe51431d4336.r2.dev/charts/${code}_half_day.png`;
        const dailyUrl = (entry && entry.url) || r2Daily;
        const rowDayLabel = formatDateCN(chartUpdateDay(code) || globalChartDay.value) || dayLabel;
        candidates.push({
          title: `${name} (${code}) ${rowDayLabel}日线`.replace(/\s+/g, " ").trim(),
          url: dailyUrl,
          code,
          kind: "daily",
        });
        if (entry && entry.url && entry.url !== r2Daily) {
          candidates.push({
            title: `${name} (${code}) ${rowDayLabel}日线(R2)`.replace(/\s+/g, " ").trim(),
            url: r2Daily,
            code,
            kind: "daily_r2",
          });
        }
        candidates.push({
          title: `${name} (${code}) ${rowDayLabel}半日线`.replace(/\s+/g, " ").trim(),
          url: r2Half,
          code,
          kind: "half_day",
        });
      }
      const images = await probeImagesBatch(candidates, 12);
      if (!images.length) {
        store.showToast("暂无可用日线/半日线图表", "error");
        return;
      }
      const clickCode = String(item.etf_code || "").replace(/\D/g, "").slice(-6) || item.etf_code;
      let idx = images.findIndex((g) => g.code === clickCode && g.kind === "daily");
      if (idx < 0) idx = images.findIndex((g) => g.code === clickCode);
      if (idx < 0) idx = 0;
      showViewerWithMultiImages(images, idx);
    };

    const openWeeklyChartViewer = async (item) => {
      if (!canViewChart(item.etf_code)) {
        triggerVipModal(item, "周线");
        return;
      }
      const rows = viewableBoardItems();
      if (!rows.length) {
        store.showToast("暂无可查看的图表", "error");
        return;
      }
      store.showToast("正在加载周线画廊…");
      const candidates = [];
      for (const row of rows) {
        const code = String(row.etf_code || "").replace(/\D/g, "").slice(-6) || row.etf_code;
        const name = formatEtfName(row.etf_name) || code;
        const rowDayLabel = formatDateCN(weeklyChartDay.value || globalChartDay.value || row.week_status_date) || "";
        candidates.push({
          title: `${name} (${code}) ${rowDayLabel}周线`.replace(/\s+/g, " ").trim(),
          url: `https://pub-973330e118204686a625fe51431d4336.r2.dev/charts/${code}_weekly.png`,
          code,
          kind: "weekly",
        });
      }
      const images = await probeImagesBatch(candidates, 12);
      if (!images.length) {
        store.showToast("暂无可用周线图表", "error");
        return;
      }
      const clickCode = String(item.etf_code || "").replace(/\D/g, "").slice(-6) || item.etf_code;
      let idx = images.findIndex((g) => g.code === clickCode);
      if (idx < 0) idx = 0;
      showViewerWithMultiImages(images, idx);
    };

    const getColorClass = (status) => {
      if (!status || status === "-" || status === "--") return "text-slate-300";
      if (status.includes("+") || status.includes("▲")) return "text-red-500";
      if (status.includes("-") || status.includes("▼")) return "text-emerald-500";
      return "text-slate-300";
    };

    const initData = async () => {
      loading.value = true;
      try {
        const tasks = [
          etfApi.fetchEtfRawData().catch(() => []),
          etfApi.fetchChartsMap().catch(() => ({})),
          etfApi.fetchSharedWatchlist().catch(() => ({ data: [] })),
        ];
        const results = await Promise.all(tasks);
        try {
          if (store.state.isLoggedIn && store.state.isVip) {
            await loadDashboardPrefs();
          } else {
            favCodes.value = [];
            userOrder.value = [];
          }
        } catch (_) {
          favCodes.value = [];
          userOrder.value = [];
        }
        const data = results[0];
        const chartsRes = results[1];
        const sharedRes = results[2];
        if (Array.isArray(data)) allData.value = data;
        chartsMap.value = chartsRes.charts || chartsRes || {};
        const sharedRaw = sharedRes?.data ?? sharedRes;
        sharedList.value = Array.isArray(sharedRaw) ? sharedRaw : [];
        const sampleCodes = (sharedList.value || [])
          .map((s) => s.etf_code || s.code)
          .concat((allData.value || []).map((i) => i.etf_code));
        await resolveGlobalChartDay(sampleCodes, chartsRes && chartsRes.chart_date);
        await resolveWeeklyChartDay(
          chartsRes && (chartsRes.weekly_chart_date || chartsRes.week_chart_date),
          chartsRes && chartsRes.chart_date
        );
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
        await scrollToLatestCol();
      }
    };

    onMounted(async () => {
      await initData();
      setTimeout(scrollToLatestCol, 120);
      setTimeout(scrollToLatestCol, 400);
    });

    watch(
      () => [
        processedData.value.rankDailyIdx,
        processedData.value.latestColKey,
        globalChartDay.value,
        loading.value,
      ],
      () => {
        if (!loading.value) setTimeout(scrollToLatestCol, 80);
      }
    );

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
      weekDataTitle,
      dailyChartTitle,
      weekChartTitle,
      showDailyChartIcon,
      openDailyChartViewer,
      openWeeklyChartViewer,
      getColorClass,
      cellPrimaryStatus,
      isFavorite,
      toggleFavorite,
      onDragStart,
      onDragOver,
      onDropRow,
      canCustomizeBoard,
      dragCode,
      tableScrollEl,
      settings,
      tipEnabled,
      tipVisible,
      tipChannel,
      tipWechatSrc,
      tipAlipaySrc,
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
        <p class="mt-2 text-sm">读取云端量化数据中...</p>
      </div>

      <template v-else>
        <!-- ===== 数据看板表格 ===== -->
        <div v-if="!processedData.list.length" class="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-100">
          <i class="fa-solid fa-folder-open text-4xl mb-3 opacity-40"></i>
          <p>暂无相关行情数据</p>
        </div>

        <div v-else class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div ref="tableScrollEl" class="overflow-x-auto custom-scrollbar dash-table-scroll">
            <table class="text-center border-collapse whitespace-nowrap w-full dash-board-table">
              <thead class="bg-slate-50 border-b border-slate-100">
                <tr class="text-xs text-slate-600 font-bold select-none">
                  <th class="py-3 px-2 sm:px-4 text-left etf-name-column dash-col-name sticky top-0 left-0 bg-slate-50 z-40 cursor-pointer hover:bg-slate-100 transition-colors border-b border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]" @click="handleSort('etf_name')">
                    标的名称
                    <i v-if="sortColumn==='etf_name'" class="fa-solid text-[10px] ml-1" :class="sortOrder==='asc'?'fa-arrow-up':'fa-arrow-down'"></i>
                  </th>
                  <th v-for="col in visibleCols" :key="col.key"
                      class="py-3 px-1.5 sm:px-2 sticky top-0 bg-slate-50 z-30 cursor-pointer hover:bg-slate-100 transition-colors border-b border-slate-200"
                      :class="col.type==='week' ? 'dash-col-week' : 'dash-col-day'"
                      @click="handleSort(col.type==='week' ? 'week_status' : col.key)">
                    {{ col.label }}
                    <i v-if="sortColumn===(col.type==='week'?'week_status':col.key) || (!sortColumn && processedData.latestColKey===col.key)"
                       class="fa-solid text-[10px] ml-1"
                       :class="sortColumn===(col.type==='week'?'week_status':col.key) && sortOrder==='asc' ? 'fa-arrow-up' : 'fa-arrow-down'"></i>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50 text-sm">
                <tr v-for="item in processedData.list" :key="item.etf_code"
                    class="hover:bg-[#4da6a0]/5 transition-colors group"
                    :class="{ 'opacity-60': dragCode === item.etf_code }"
                    :draggable="canCustomizeBoard ? true : false"
                    @dragstart="onDragStart(item, $event)"
                    @dragover="onDragOver($event)"
                    @drop="onDropRow(item, $event)">
                  <td class="p-2 sm:p-3 text-left relative sticky left-0 bg-white group-hover:bg-[#f6faf9] z-10 etf-name-column dash-col-name border-r border-slate-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                    <div v-if="processedData.freeTop3Codes.includes(item.etf_code)" class="absolute left-0 top-0 bottom-0 w-1 theme-bg"></div>
                    <div class="flex items-start gap-1 min-w-0">
                      <button type="button"
                              class="mt-0.5 shrink-0 p-0.5 leading-none"
                              :title="canCustomizeBoard ? (isFavorite(item.etf_code) ? '取消收藏' : '收藏') : '会员可收藏'"
                              @click="toggleFavorite(item, $event)">
                        <i class="fa-solid fa-star text-sm"
                           :class="isFavorite(item.etf_code) ? 'text-amber-400' : 'text-slate-300'"></i>
                      </button>
                      <div class="min-w-0 flex-1 overflow-hidden">
                        <div class="font-bold text-slate-800 flex items-center gap-1">
                          <span v-if="canCustomizeBoard" class="text-slate-300 text-[10px] cursor-grab active:cursor-grabbing select-none shrink-0" title="拖动排序">⋮⋮</span>
                          <span class="truncate text-[12px] sm:text-sm leading-tight" :title="formatEtfName(item.etf_name)">{{ formatEtfName(item.etf_name) }}</span>
                          <span v-if="processedData.freeTop3Codes.includes(item.etf_code)" class="text-[10px] bg-emerald-100 text-emerald-700 px-1 py-0.2 rounded font-bold shrink-0">限免</span>
                          <span v-else class="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-1 rounded font-bold shrink-0">VIP</span>
                        </div>
                        <div class="text-[11px] text-slate-400 font-mono">{{ item.etf_code }}</div>
                      </div>
                    </div>
                  </td>

                  <td v-for="col in visibleCols" :key="col.key"
                      class="p-1.5 sm:p-3 font-medium"
                      :class="[
                        col.type==='week' ? 'dash-col-week' : 'dash-col-day',
                        getColorClass(col.type==='week' ? item.week_status : cellPrimaryStatus(item.days[col.dayIdx]))
                      ]">
                    <template v-if="col.type==='day'">
                      <div class="dash-cell-inner flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1"
                           :title="dataDateTitle(processedData.weekDays[col.dayIdx])">
                        <span class="text-[10px] sm:text-sm font-mono tracking-tight leading-tight">{{ formatDayCell(item.days[col.dayIdx]) }}</span>
                        <i v-if="showDailyChartIcon(item.etf_code, col.dayIdx)"
                           class="fa-regular fa-image cursor-pointer text-sm sm:text-xs shrink-0 p-1"
                           :class="processedData.freeTop3Codes.includes(item.etf_code) || store.isVip ? 'text-slate-400 hover:text-blue-500' : 'text-amber-500 hover:text-amber-600'"
                           :title="dailyChartTitle(item.etf_code, processedData.weekDays[col.dayIdx])"
                           @click.stop="openDailyChartViewer(item)"></i>
                      </div>
                    </template>
                    <template v-else>
                      <div class="dash-cell-inner flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1" :title="weekDataTitle(item)">
                        <span class="text-[10px] sm:text-sm font-mono leading-tight">{{ item.week_status || '-' }}</span>
                        <i class="fa-regular fa-image cursor-pointer text-sm sm:text-xs shrink-0 p-1 -m-0.5"
                           :class="processedData.freeTop3Codes.includes(item.etf_code) || store.isVip ? 'text-slate-400 hover:text-blue-500' : 'text-amber-500 hover:text-amber-600'"
                           :title="weekChartTitle()"
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
          标有「限免」的标的向所有访客开放全周期图表；支持表头点击排序及左右无缝翻页浏览全部标的通道图。
        </p>

        <!-- 打赏入口（兼容后台 tip_enabled） -->
        <div v-if="tipEnabled" class="text-center pt-2">
          <button type="button" @click="tipChannel = tipWechatSrc ? 'wechat' : (tipAlipaySrc ? 'alipay' : 'wechat'); tipVisible = true"
                  class="text-xs text-slate-400 hover:theme-text underline">
            {{ settings.tip_note || '觉得有用？请作者喝杯咖啡' }}
          </button>
        </div>
      </template>

      <!-- ===== 高转化·变现拦截转化弹窗 ===== -->
      <div v-if="vipModal.visible" class="fixed inset-0 modal-overlay z-[120] flex items-center justify-center p-4" @click.self="vipModal.visible=false">
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4 text-center relative overflow-hidden border border-amber-100">
          <div class="absolute top-0 right-0 bg-gradient-to-l from-red-500 to-amber-500 text-white text-[10px] font-extrabold px-3 py-1 rounded-bl-xl shadow-sm tracking-wider">
            特惠开通·全解锁
          </div>

          <div class="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto text-xl ring-4 ring-amber-50">
            <i class="fa-solid fa-crown"></i>
          </div>

          <div>
            <h3 class="text-base font-extrabold text-slate-800">解锁【{{ vipModal.etfName }}】多空通道</h3>
            <p class="text-xs text-slate-400 mt-0.5">代码: {{ vipModal.etfCode }} · 含 11:30 半日线与日收盘图</p>
          </div>

          <div class="bg-gradient-to-b from-slate-50 to-amber-50/30 rounded-xl p-3 text-xs text-slate-600 text-left space-y-1.5 border border-slate-100">
            <div class="flex items-center justify-between text-slate-800 font-bold border-b border-slate-200/60 pb-1.5">
              <span>开通会员立即解锁：</span>
              <span class="text-red-500 font-extrabold">低至 0.6元/天</span>
            </div>
            <div class="flex items-center gap-1.5 pt-0.5">
              <i class="fa-solid fa-check text-emerald-500"></i>
              <span>全市场热门标的日线/半日线真实波幅</span>
            </div>
            <div class="flex items-center gap-1.5">
              <i class="fa-solid fa-check text-emerald-500"></i>
              <span>盘中 11:30 异常收敛突破优先提示</span>
            </div>
            <div class="flex items-center gap-1.5">
              <i class="fa-solid fa-check text-emerald-500"></i>
              <span>专属客服工单与标的票选入池权</span>
            </div>
          </div>

          <div class="space-y-2 pt-1">
            <template v-if="!store.isLoggedIn">
              <button type="button" @click="handleRegisterAction" 
                      class="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white py-2.5 rounded-xl text-sm font-bold shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5">
                <i class="fa-brands fa-weixin text-base"></i> 微信扫码·立领 3 天 VIP
              </button>
            </template>
            <template v-else>
              <button type="button" @click="handleUpgradeAction" 
                      class="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white py-2.5 rounded-xl text-sm font-bold shadow-md shadow-orange-500/20 flex items-center justify-center gap-1.5">
                <i class="fa-solid fa-bolt"></i> 立即开通（享新手专享价）
              </button>
            </template>
            <button type="button" @click="vipModal.visible=false" class="w-full py-1 text-xs text-slate-400 hover:text-slate-600">
              暂不解锁，仅看 3 只限免标的
            </button>
          </div>
        </div>
      </div>

      <!-- ===== 打赏弹层 ===== -->
      <div v-if="tipVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="tipVisible = false">
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl text-center">
          <h3 class="font-bold text-slate-800">感谢支持</h3>
          <p class="text-xs text-slate-500">{{ settings.tip_note || '自愿打赏，不解锁任何权限' }}</p>
          <div class="flex justify-center gap-2 mb-1" v-if="tipWechatSrc || tipAlipaySrc">
            <button type="button" v-if="tipWechatSrc" @click="tipChannel='wechat'"
                    class="px-3 py-1 rounded-full text-xs border transition"
                    :class="tipChannel==='wechat' ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600 border-slate-200'">微信</button>
            <button type="button" v-if="tipAlipaySrc" @click="tipChannel='alipay'"
                    class="px-3 py-1 rounded-full text-xs border transition"
                    :class="tipChannel==='alipay' ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600 border-slate-200'">支付宝</button>
          </div>
          <div class="flex justify-center">
            <div v-if="tipChannel==='wechat' && tipWechatSrc" class="space-y-1">
              <img :src="tipWechatSrc" class="w-40 h-40 object-contain border rounded-lg mx-auto" alt="微信收款码">
              <div class="text-[11px] text-slate-500">微信扫码</div>
            </div>
            <div v-else-if="tipChannel==='alipay' && tipAlipaySrc" class="space-y-1">
              <img :src="tipAlipaySrc" class="w-40 h-40 object-contain border rounded-lg mx-auto" alt="支付宝收款码">
              <div class="text-[11px] text-slate-500">支付宝扫码</div>
            </div>
            <p v-else class="text-xs text-slate-400">后台尚未配置打赏收款码</p>
          </div>
          <button type="button" @click="tipVisible = false" class="text-sm text-slate-500">关闭</button>
        </div>
      </div>
    </div>
  `,
};
