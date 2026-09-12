/* ========================= FILE: .\js\components\index\Dashboard.js ========================= */

/**
 * 波幅探长 - 数据看板（画廊连续翻页 + 高转化拦截卡片）
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

const { ref, reactive, computed, onMounted, nextTick } = Vue;

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

    const searchQuery = ref("");
    const sortColumn = ref(null);
    const sortOrder = ref("desc");

    const tableScrollEl = ref(null);

    // 高转化变现拦截卡片状态
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

    const quoteOk = (s) => !(!s || s === "-" || s === "--" || s === "None" || s === "null");
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
      const empty = { list: [], freeTop3Codes: [], weekDays: [], displayCols: [], latestColKey: "d4" };
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
        }
      });

      let items = Object.values(etfMap);
      const hasStatus = (s) => !(!s || s === "-" || s === "--");
      const absDayVal = (row, dayIdx) => {
        if (dayIdx == null || dayIdx < 0) return -9999;
        const s = row.days?.[dayIdx]?.day_status;
        return hasStatus(s) ? Math.abs(getStatusVal(s)) : -9999;
      };

      let dailyColIdx = -1, dailyColDate = "";
      for (let idx = 0; idx < 5; idx++) {
        const d = weekDays[idx];
        if (d && d >= dailyColDate && items.some((i) => hasStatus(i.days?.[idx]?.day_status))) {
          dailyColDate = d;
          dailyColIdx = idx;
        }
      }

      const freeTopN = 3;
      let freeTop3Codes = [];
      if (dailyColIdx >= 0) {
        freeTop3Codes = [...items]
          .filter((i) => absDayVal(i, dailyColIdx) > -9999)
          .sort((a, b) => absDayVal(b, dailyColIdx) - absDayVal(a, dailyColIdx))
          .slice(0, freeTopN)
          .map((i) => i.etf_code);
      }

      let pivotIdx = dailyColIdx >= 0 ? dailyColIdx : 4;
      const n = BASE_COLS.length;
      const displayCols = [];
      for (let i = 1; i <= n; i++) {
        displayCols.push(BASE_COLS[(pivotIdx + i) % n]);
      }

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
    // Viewer.js 多图连续画廊与浮动翻页导航
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
      processedData,
      visibleCols,
      formatEtfName,
      formatDayCell,
      dailyChartTitle,
      weekChartTitle,
      showDailyChartIcon,
      openDailyChartViewer,
      openWeeklyChartViewer,
      getColorClass,
      cellPrimaryStatus,
      isFavorite,
      toggleFavorite,
      tableScrollEl,
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
                           :title="dailyChartTitle(item.etf_code, processedData.weekDays[col.dayIdx])"
                           @click.stop="openDailyChartViewer(item)"></i>
                      </div>
                    </template>
                    <template v-else>
                      <div class="flex items-center justify-center gap-1">
                        <span class="text-[10px] sm:text-sm font-mono">{{ item.week_status || '-' }}</span>
                        <i class="fa-regular fa-image cursor-pointer text-sm sm:text-xs shrink-0 p-1"
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
          标有「限免」的标的向所有访客开放全周期图表；点击图表可在当前页左右无缝翻页浏览全部标的通道图。
        </p>
      </template>

      <!-- ===== 高转化·变现拦截转化弹窗 ===== -->
      <div v-if="vipModal.visible" class="fixed inset-0 modal-overlay z-[120] flex items-center justify-center p-4" @click.self="vipModal.visible=false">
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4 text-center relative overflow-hidden border border-amber-100">
          <!-- 促销角标 -->
          <div class="absolute top-0 right-0 bg-gradient-to-l from-red-500 to-amber-500 text-white text-[10px] font-extrabold px-3 py-1 rounded-bl-xl shadow-sm tracking-wider">
            新春特惠·直降30%
          </div>

          <div class="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto text-xl ring-4 ring-amber-50">
            <i class="fa-solid fa-crown"></i>
          </div>

          <div>
            <h3 class="text-base font-extrabold text-slate-800">解锁【{{ vipModal.etfName }}】多空通道</h3>
            <p class="text-xs text-slate-400 mt-0.5">代码: {{ vipModal.etfCode }} · 含 11:30 半日线与日收盘图</p>
          </div>

          <!-- 核心权益与算账锚点 -->
          <div class="bg-gradient-to-b from-slate-50 to-amber-50/30 rounded-xl p-3 text-xs text-slate-600 text-left space-y-1.5 border border-slate-100">
            <div class="flex items-center justify-between text-slate-800 font-bold border-b border-slate-200/60 pb-1.5">
              <span>开通会员立即解锁：</span>
              <span class="text-red-500 font-extrabold">低至 0.6元/天</span>
            </div>
            <div class="flex items-center gap-1.5 pt-0.5">
              <i class="fa-solid fa-check text-emerald-500"></i>
              <span>全市场 50+ 热门 ETF 日线/半日线真实波幅</span>
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

          <!-- 促转化行动按钮 -->
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
    </div>
  `,
};
