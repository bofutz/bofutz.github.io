/**
 * 数据看板
 * - 周期选择 / 搜索 / 排序
 * - 通用VIP / 定制 / 免费 TopN 过滤
 * - 日线 icon 按 chart_as_of 落列
 * - 桌面表格 + 手机卡片
 */
import {
  ref, computed, watch, onMounted,
} from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";
import { API_BASE } from "../../config.js";
import {
  isValidDate, parseYear, parseMonth, parseDay,
  getWeekDays, getWeekNumberInMonth,
  getDayTooltip, getWeekTooltip,
  getStatusVal, getColorClass,
  formatMobileStatus, getMobileStatusClass,
  pureCode,
} from "../../utils.js";
import { isLoggedIn, isVip, updateVipDays } from "../../auth.js";

export const DashboardView = {
  name: "DashboardView",
  props: {
    publicSettings: { type: Object, default: () => ({}) },
    navigate: { type: Function, required: true },
    openAuth: { type: Function, required: true },
  },
  setup(props) {
    const loading = ref(false);
    const allData = ref([]);
    const chartsMap = ref({});
    const chartAsOfFromApi = ref("");
    const showDropdown = ref(false);
    const selectedMonday = ref("");
    const searchQuery = ref("");
    const expandedRowKey = ref(null);
    const sortColumn = ref(null);
    const sortOrder = ref("desc");
    const sharedWatchlist = ref([]);
    const customWatchlist = ref([]);
    const freeEtfCodes = ref([]);

    let currentViewer = null;

    const freeTopN = computed(() => parseInt(props.publicSettings.free_top_n_charts, 10) || 3);

    // ---------- 周期 ----------
    const uniqueDatesSet = computed(() => {
      const validDates = allData.value
        .filter((i) => (i.day_status || i.week_status) && isValidDate(i.date))
        .map((i) => i.date);
      return new Set(validDates);
    });

    const availablePeriods = computed(() => {
      const periods = {};
      [...uniqueDatesSet.value].forEach((dateStr) => {
        const wDays = getWeekDays(dateStr);
        if (!wDays.length) return;
        const monday = wDays[0];
        const y = parseYear(monday), m = parseMonth(monday);
        const monthKey = `${y}-${String(m).padStart(2, "0")}`;
        if (!periods[monthKey]) {
          periods[monthKey] = { monthKey, monthLabel: `${y}年${m}月`, weeksMap: {} };
        }
        if (!periods[monthKey].weeksMap[monday]) {
          periods[monthKey].weeksMap[monday] = {
            monday,
            weekLabel: getWeekNumberInMonth(monday),
          };
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
          if (w.monday === selectedMonday.value) {
            return `${parseMonth(w.monday)}月 · ${w.weekLabel}`;
          }
        }
      }
      return "";
    });

    const selectWeek = (mondayStr) => {
      selectedMonday.value = mondayStr;
      showDropdown.value = false;
    };

    // ---------- 日线 icon 落列 ----------
    const chartAsOfDate = computed(() => {
      if (chartAsOfFromApi.value && isValidDate(chartAsOfFromApi.value)) {
        return chartAsOfFromApi.value;
      }
      let best = "";
      for (const item of allData.value) {
        if (!item.date || !isValidDate(item.date)) continue;
        if (!item.day_status || item.day_status === "-" || item.day_status === "--") continue;
        if (item.date > best) best = item.date;
      }
      return best;
    });

    const latestDailyColIndex = computed(() => {
      if (!selectedMonday.value || !chartAsOfDate.value) return -1;
      const weekDays = getWeekDays(selectedMonday.value);
      if (weekDays.length < 5) return -1;
      return weekDays.indexOf(chartAsOfDate.value);
    });

    const isDailyChartColumn = (idx) =>
      idx === latestDailyColIndex.value && latestDailyColIndex.value >= 0;

    const getColumnDateLabel = (idx) => {
      if (!selectedMonday.value) return "";
      const weekDays = getWeekDays(selectedMonday.value);
      if (!weekDays[idx]) return "";
      return getDayTooltip(weekDays[idx]) || weekDays[idx];
    };

    // ---------- 排序 ----------
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

    // ---------- 核心数据行 ----------
    const sortedData = computed(() => {
      if (!selectedMonday.value) return [];
      const weekDays = getWeekDays(selectedMonday.value);
      if (weekDays.length < 5) return [];
      const fridayDate = weekDays[4];
      const y = parseYear(fridayDate), m = parseMonth(fridayDate), d = parseDay(fridayDate);
      if (!y) return [];
      const friday16 = new Date(y, m - 1, d, 16, 0, 0);
      const isPastFriday16 = Date.now() >= friday16.getTime();
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
          if (
            isPastFriday16 &&
            item.week_status &&
            item.week_status !== "-" &&
            item.week_status !== "--"
          ) {
            etfMap[item.etf_code].week_status = item.week_status;
          }
        }
      });

      // 未过周五 16:00 时，周线取上一周
      if (!isPastFriday16) {
        const my = parseYear(weekDays[0]), mm = parseMonth(weekDays[0]), md = parseDay(weekDays[0]);
        const curMon = new Date(my, mm - 1, md);
        const prevMon = new Date(curMon.getTime() - 7 * 86400000);
        const prevMondayStr = `${prevMon.getFullYear()}-${String(prevMon.getMonth() + 1).padStart(2, "0")}-${String(prevMon.getDate()).padStart(2, "0")}`;
        const prevWeekDates = getWeekDays(prevMondayStr);
        const lastWeekStatusMap = {};
        allData.value.forEach((item) => {
          if (!item.date) return;
          if (
            prevWeekDates.includes(item.date) &&
            item.week_status &&
            item.week_status !== "-" &&
            item.week_status !== "--"
          ) {
            lastWeekStatusMap[item.etf_code] = item.week_status;
          }
        });
        for (const code in lastWeekStatusMap) {
          if (!etfMap[code]) {
            const etfItem = allData.value.find((i) => i.etf_code === code);
            etfMap[code] = {
              etf_code: code,
              etf_name: etfItem ? etfItem.etf_name : code,
              days: [null, null, null, null, null],
              week_status: null,
            };
          }
          etfMap[code].week_status = lastWeekStatusMap[code];
        }
      }

      // 从行情 etfMap 取一行（支持纯数字代码对齐）
      const pickFromMap = (code) => {
        if (etfMap[code]) return etfMap[code];
        const pure = pureCode(code);
        if (pure) {
          for (const k of Object.keys(etfMap)) {
            if (pureCode(k) === pure || k === pure) return etfMap[k];
          }
        }
        return null;
      };

      const rowFromShared = (w) => {
        const hit = pickFromMap(w.etf_code);
        if (hit) {
          return {
            ...hit,
            etf_code: w.etf_code,
            etf_name: w.etf_name || hit.etf_name || w.etf_code,
          };
        }
        return {
          etf_code: w.etf_code,
          etf_name: w.etf_name || w.etf_code,
          days: [null, null, null, null, null],
          week_status: null,
        };
      };

      // 仅启用的通用标的（若接口无 enabled 字段则全部保留）
      const sharedEnabled = (sharedWatchlist.value || []).filter(
        (w) => w.enabled === undefined || w.enabled === true || w.enabled === 1
      );

      let validItems = [];

      if (isLoggedIn.value && isVip.value) {
        // ★ 通用 VIP：以通用监控列表为主表（无数据也显示，可点图表）
        if (sharedEnabled.length > 0) {
          validItems = sharedEnabled.map(rowFromShared);
        } else {
          // 列表尚未加载时，先展示有行情的
          validItems = Object.values(etfMap).filter((item) => {
            const hasDay = item.days.some(
              (d) => d && d.day_status && d.day_status !== "-" && d.day_status !== "--"
            );
            const hasWeek =
              item.week_status && item.week_status !== "-" && item.week_status !== "--";
            return (
              hasDay ||
              hasWeek ||
              (chartsMap.value && chartsMap.value.hasOwnProperty(item.etf_code))
            );
          });
        }
      } else if (isLoggedIn.value && !isVip.value) {
        const activeCustom = (customWatchlist.value || []).filter(
          (w) => w.status === "active" || w.status === "pending"
        );
        if (activeCustom.length > 0) {
          const freeSet = new Set(freeEtfCodes.value);
          const seen = new Set();
          for (const w of activeCustom) {
            const row = rowFromShared(w);
            if (!seen.has(row.etf_code)) {
              validItems.push(row);
              seen.add(row.etf_code);
            }
          }
          // 附带免费 TopN
          for (const code of freeEtfCodes.value) {
            if (seen.has(code)) continue;
            const hit = pickFromMap(code);
            if (hit) {
              validItems.push(hit);
              seen.add(code);
            } else {
              validItems.push({
                etf_code: code,
                etf_name: code,
                days: [null, null, null, null, null],
                week_status: null,
              });
              seen.add(code);
            }
          }
        } else if (sharedEnabled.length > 0) {
          // 无定制：仍展示全部通用列表（图表权限由 openChart 控制）
          validItems = sharedEnabled.map(rowFromShared);
        } else {
          validItems = Object.values(etfMap).filter((item) => {
            const hasDay = item.days.some(
              (d) => d && d.day_status && d.day_status !== "-" && d.day_status !== "--"
            );
            const hasWeek =
              item.week_status && item.week_status !== "-" && item.week_status !== "--";
            return hasDay || hasWeek;
          });
        }
      } else {
        // 游客：全部通用列表（无数据也显示；图表仅免费 TopN 可点）
        if (sharedEnabled.length > 0) {
          validItems = sharedEnabled.map(rowFromShared);
        } else {
          validItems = Object.values(etfMap).filter((item) => {
            const hasDay = item.days.some(
              (d) => d && d.day_status && d.day_status !== "-" && d.day_status !== "--"
            );
            const hasWeek =
              item.week_status && item.week_status !== "-" && item.week_status !== "--";
            return hasDay || hasWeek;
          });
        }
      }

      if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase().trim();
        validItems = validItems.filter(
          (item) =>
            (item.etf_name && item.etf_name.toLowerCase().includes(q)) ||
            (item.etf_code && item.etf_code.toLowerCase().includes(q))
        );
      }

      validItems.sort((a, b) => {
        if (sortColumn.value) {
          // 手动点列头：按该列排序
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
            const valA = getStatusVal(a.week_status);
            const valB = getStatusVal(b.week_status);
            if (valA === -9999 && valB !== -9999) return 1;
            if (valB === -9999 && valA !== -9999) return -1;
            return sortOrder.value === "desc" ? valB - valA : valA - valB;
          }
          return 0;
        }

        // 默认：以「最新图表日」那一列绝对值从大到小；无日数据再用周线绝对值
        let latestIdx = latestDailyColIndex.value;
        if (latestIdx < 0) {
          latestIdx = 4;
          while (latestIdx >= 0) {
            const hasData = validItems.some(
              (i) =>
                i.days[latestIdx] &&
                i.days[latestIdx].day_status &&
                i.days[latestIdx].day_status !== "-" &&
                i.days[latestIdx].day_status !== "--"
            );
            if (hasData) break;
            latestIdx--;
          }
        }

        const dayAbs = (item) => {
          if (latestIdx < 0) return -9999;
          const st = item.days[latestIdx]?.day_status;
          if (!st || st === "-" || st === "--") return -9999;
          return Math.abs(getStatusVal(st));
        };
        const weekAbs = (item) => {
          if (!item.week_status || item.week_status === "-" || item.week_status === "--") {
            return -9999;
          }
          return Math.abs(getStatusVal(item.week_status));
        };

        const aDay = dayAbs(a);
        const bDay = dayAbs(b);
        if (aDay !== -9999 || bDay !== -9999) {
          if (aDay !== -9999 && bDay !== -9999) return bDay - aDay;
          if (aDay !== -9999) return -1;
          if (bDay !== -9999) return 1;
        }

        const aWk = weekAbs(a);
        const bWk = weekAbs(b);
        if (aWk !== -9999 && bWk !== -9999) return bWk - aWk;
        if (aWk !== -9999) return -1;
        if (bWk !== -9999) return 1;
        return 0;
      });

      return validItems;
    });

    const toggleRow = (item) => {
      expandedRowKey.value = expandedRowKey.value === item.etf_code ? null : item.etf_code;
    };

    const getPastWeeks = (etf_code) => {
      if (!selectedMonday.value) return [];
      const pastData = allData.value.filter(
        (item) => item.etf_code === etf_code && (item.day_status || item.week_status)
      );
      const weekMap = {};
      pastData.forEach((item) => {
        if (!item.date || !isValidDate(item.date)) return;
        const wDays = getWeekDays(item.date);
        if (!wDays.length) return;
        const monday = wDays[0];
        if (monday === selectedMonday.value) return;
        if (!weekMap[monday]) {
          weekMap[monday] = {
            monday,
            days: [null, null, null, null, null],
            week_status: null,
          };
        }
        const idx = wDays.indexOf(item.date);
        if (idx !== -1) weekMap[monday].days[idx] = item;
        if (item.week_status && item.week_status !== "-" && item.week_status !== "--") {
          weekMap[monday].week_status = item.week_status;
        }
      });
      return Object.values(weekMap).sort((a, b) => b.monday.localeCompare(a.monday));
    };

    // ---------- 图表 ----------
    const openChart = (etfCode, type) => {
      if (isLoggedIn.value && isVip.value) {
        showViewer(etfCode, type);
        return;
      }
      const isInFreeList = freeEtfCodes.value.includes(etfCode);
      const isMyCustom = (customWatchlist.value || []).some(
        (w) =>
          (w.status === "active" || w.status === "pending") &&
          pureCode(w.etf_code) === pureCode(etfCode)
      );
      if (isInFreeList || (isLoggedIn.value && isMyCustom)) {
        showViewer(etfCode, type);
        return;
      }
      if (confirm("此为「通用监控」VIP专属图表。\n是否去开通通用VIP？")) {
        if (!isLoggedIn.value) props.openAuth("login");
        else props.navigate("#/plan");
      }
    };

    const showViewer = (etfCode, type) => {
      const codes = [etfCode, pureCode(etfCode)].filter(Boolean);
      let imgUrl = null;
      for (const c of codes) {
        const specificKey = `${c}_${type}`;
        if (chartsMap.value?.[specificKey]) {
          imgUrl = chartsMap.value[specificKey];
          break;
        }
        if (chartsMap.value?.[c]?.[type]) {
          imgUrl = chartsMap.value[c][type];
          break;
        }
        if (typeof chartsMap.value?.[c] === "string") {
          const raw = chartsMap.value[c];
          if (type === "weekly") {
            imgUrl = raw.includes("_daily")
              ? raw.replace("_daily", "_weekly")
              : raw.replace(/\.png$/i, "_weekly.png");
          } else {
            imgUrl = raw;
          }
          break;
        }
      }
      if (!imgUrl) {
        const c = pureCode(etfCode) || etfCode;
        imgUrl =
          type === "weekly"
            ? `https://pub-973330e118204686a625fe51431d4336.r2.dev/charts/${c}_weekly.png`
            : `https://pub-973330e118204686a625fe51431d4336.r2.dev/charts/${c}_daily.png`;
      }
      const image = new Image();
      image.src = imgUrl.split("?")[0];
      if (currentViewer) currentViewer.destroy();
      currentViewer = new Viewer(image, {
        hidden: () => {
          currentViewer.destroy();
          currentViewer = null;
        },
        navbar: false,
        title: false,
        button: true,
        backdrop: true,
      });
      currentViewer.show();
    };

    // ---------- 免费 TopN ----------
    const computeLockedFreeTop = () => {
      const n = freeTopN.value;
      const rows = allData.value || [];
      if (!rows.length) {
        freeEtfCodes.value = [];
        return;
      }
      let latestMonday = "";
      if (availablePeriods.value.length > 0 && availablePeriods.value[0].weeks?.length > 0) {
        latestMonday = availablePeriods.value[0].weeks[0].monday;
      }
      if (!latestMonday) {
        freeEtfCodes.value = [];
        return;
      }
      const weekDays = getWeekDays(latestMonday);
      if (weekDays.length < 5) {
        freeEtfCodes.value = [];
        return;
      }
      const sharedCodes = sharedWatchlist.value.length
        ? new Set(sharedWatchlist.value.map((w) => w.etf_code))
        : null;
      const inScope = (code) => !sharedCodes || sharedCodes.has(code);

      const fridayDate = weekDays[4];
      const fy = parseYear(fridayDate), fm = parseMonth(fridayDate), fd = parseDay(fridayDate);
      const isPastFriday16 = fy
        ? Date.now() >= new Date(fy, fm - 1, fd, 16, 0, 0).getTime()
        : false;

      const etfMap = {};
      rows.forEach((item) => {
        if (!inScope(item.etf_code) || !item.date) return;
        const idx = weekDays.indexOf(item.date);
        if (idx === -1) return;
        if (!etfMap[item.etf_code]) {
          etfMap[item.etf_code] = {
            etf_code: item.etf_code,
            days: [null, null, null, null, null],
            week_status: null,
          };
        }
        etfMap[item.etf_code].days[idx] = item;
        if (
          isPastFriday16 &&
          item.week_status &&
          item.week_status !== "-" &&
          item.week_status !== "--"
        ) {
          etfMap[item.etf_code].week_status = item.week_status;
        }
      });

      if (!isPastFriday16) {
        const my = parseYear(weekDays[0]), mm = parseMonth(weekDays[0]), md = parseDay(weekDays[0]);
        const curMon = new Date(my, mm - 1, md);
        const prevMon = new Date(curMon.getTime() - 7 * 86400000);
        const prevMondayStr = `${prevMon.getFullYear()}-${String(prevMon.getMonth() + 1).padStart(2, "0")}-${String(prevMon.getDate()).padStart(2, "0")}`;
        const prevWeekDates = getWeekDays(prevMondayStr);
        rows.forEach((item) => {
          if (!inScope(item.etf_code)) return;
          if (!prevWeekDates.includes(item.date)) return;
          if (!item.week_status || item.week_status === "-" || item.week_status === "--") return;
          if (!etfMap[item.etf_code]) {
            etfMap[item.etf_code] = {
              etf_code: item.etf_code,
              days: [null, null, null, null, null],
              week_status: null,
            };
          }
          etfMap[item.etf_code].week_status = item.week_status;
        });
      }

      let items = Object.values(etfMap).filter((item) => {
        const hasDay = item.days.some(
          (d) => d && d.day_status && d.day_status !== "-" && d.day_status !== "--"
        );
        const hasWeek = item.week_status && item.week_status !== "-" && item.week_status !== "--";
        return hasDay || hasWeek;
      });

      // 与看板默认排序一致：先「最新图表日」列绝对值，再周线绝对值
      let latestIdx = -1;
      // 与 etfMap 同一周（最新周），保证免费 TopN 始终对应当前行情排序
      if (latestMonday && chartAsOfDate.value) {
        const wd = getWeekDays(latestMonday);
        latestIdx = wd.indexOf(chartAsOfDate.value);
      }
      if (latestIdx < 0) {
        latestIdx = 4;
        while (latestIdx >= 0) {
          const hasData = items.some(
            (i) =>
              i.days[latestIdx] &&
              i.days[latestIdx].day_status &&
              i.days[latestIdx].day_status !== "-" &&
              i.days[latestIdx].day_status !== "--"
          );
          if (hasData) break;
          latestIdx--;
        }
      }

      items.sort((a, b) => {
        const dayAbs = (item) => {
          if (latestIdx < 0) return -9999;
          const st = item.days[latestIdx]?.day_status;
          if (!st || st === "-" || st === "--") return -9999;
          return Math.abs(getStatusVal(st));
        };
        const weekAbs = (item) => {
          if (!item.week_status || item.week_status === "-" || item.week_status === "--") {
            return -9999;
          }
          return Math.abs(getStatusVal(item.week_status));
        };

        const aDay = dayAbs(a);
        const bDay = dayAbs(b);
        if (aDay !== -9999 || bDay !== -9999) {
          if (aDay !== -9999 && bDay !== -9999) return bDay - aDay;
          if (aDay !== -9999) return -1;
          if (bDay !== -9999) return 1;
        }

        const aWk = weekAbs(a);
        const bWk = weekAbs(b);
        if (aWk !== -9999 && bWk !== -9999) return bWk - aWk;
        if (aWk !== -9999) return -1;
        if (bWk !== -9999) return 1;
        return 0;
      });

      freeEtfCodes.value = items.slice(0, n).map((i) => i.etf_code);
    };

    // ---------- 数据拉取 ----------
    const fetchSharedWatchlist = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/watchlist/shared`);
        const data = await res.json();
        if (data.success) sharedWatchlist.value = data.data || [];
      } catch (_) {}
    };

    const fetchCustomWatchlist = async () => {
      if (!isLoggedIn.value) {
        customWatchlist.value = [];
        return;
      }
      try {
        const token = localStorage.getItem("etf_token");
        const res = await fetch(`${API_BASE}/api/watchlist/custom`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const data = await res.json();
        if (data.success) customWatchlist.value = data.data || [];
        else customWatchlist.value = [];
      } catch (_) {
        customWatchlist.value = [];
      }
    };

    const fetchChartsMap = async () => {
      try {
        const token = localStorage.getItem("etf_token");
        const headers = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${API_BASE}/api/etfs`, { headers });
        if (res.ok) {
          const data = await res.json();
          chartsMap.value = data.charts || {};
          chartAsOfFromApi.value =
            data.chart_as_of && isValidDate(data.chart_as_of) ? data.chart_as_of : "";
          if (isLoggedIn.value) {
            if (data.shared_vip_days != null) {
              updateVipDays(data.shared_vip_days);
            }
          }
        }
      } catch (_) {}
    };

    const fetchData = async () => {
      loading.value = true;
      try {
        const [res1] = await Promise.all([
          fetch(atob("aHR0cHM6Ly9ldGYuaGFoYWd3LmV1Lm9yZy8=")).catch(() => null),
          fetchChartsMap(),
          fetchSharedWatchlist(),
          fetchCustomWatchlist(),
        ]);
        if (res1 && res1.ok) {
          const data = await res1.json();
          if (Array.isArray(data)) {
            allData.value = data;
            if (
              availablePeriods.value.length > 0 &&
              availablePeriods.value[0].weeks.length > 0
            ) {
              selectedMonday.value = availablePeriods.value[0].weeks[0].monday;
            }
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        loading.value = false;
      }
    };

    watch(
      [
        allData,
        sharedWatchlist,
        availablePeriods,
        selectedMonday,
        chartAsOfDate,
        () => props.publicSettings.free_top_n_charts,
      ],
      () => computeLockedFreeTop(),
      { deep: true }
    );

    watch(isLoggedIn, (v) => {
      if (v) fetchCustomWatchlist();
      else customWatchlist.value = [];
    });

    onMounted(() => {
      fetchData();
    });

    return {
      loading,
      sortedData,
      showDropdown,
      searchQuery,
      availablePeriods,
      currentPeriodLabel,
      selectWeek,
      selectedMonday,
      sortColumn,
      sortOrder,
      handleSort,
      expandedRowKey,
      toggleRow,
      getPastWeeks,
      openChart,
      getColorClass,
      isDailyChartColumn,
      getColumnDateLabel,
      chartAsOfDate,
      formatMobileStatus,
      getMobileStatusClass,
      getDayTooltip,
      getWeekTooltip,
      getMobileDayDate: getDayTooltip,
      getMobileWeekDate: getWeekTooltip,
      freeEtfCodes,
    };
  },

  template: `
    <div class="max-w-7xl mx-auto space-y-3 sm:space-y-4">
      <!-- 周期 + 搜索 -->
      <div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div class="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 relative">
          <button @click.stop="showDropdown = !showDropdown"
            class="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 rounded-xl">
            <span>
              <i class="fa-regular fa-calendar mr-2 text-slate-400"></i>
              {{ currentPeriodLabel || '历史数据加载中...' }}
            </span>
            <i class="fa-solid fa-chevron-down text-slate-400 text-xs"></i>
          </button>
          <div v-if="showDropdown" @click.stop
            class="absolute left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-4 w-full sm:w-80">
            <div class="max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
              <div v-for="month in availablePeriods" :key="month.monthKey" class="mb-3 last:mb-0">
                <div class="text-xs font-bold text-slate-400 mb-2 border-b pb-1">{{ month.monthLabel }}</div>
                <div class="flex flex-wrap gap-2">
                  <button v-for="week in month.weeks" :key="week.monday"
                    @click="selectWeek(week.monday)"
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
          <input v-model="searchQuery" type="search" autocomplete="new-password"
            placeholder="搜索 标的代码/名称..."
            class="w-full bg-transparent border-none outline-none text-sm py-2.5 px-3">
        </div>
      </div>

      <div v-if="loading" class="text-center py-12 text-slate-400">
        <i class="fa-solid fa-spinner animate-spin text-2xl"></i>
        <p class="mt-2 text-sm">读取云端数据中...</p>
      </div>
      <div v-else-if="sortedData.length === 0" class="text-center py-12 text-slate-400">
        <i class="fa-solid fa-folder-open text-4xl mb-3 opacity-50"></i>
        <p>该周期暂无相关数据</p>
      </div>
      <div v-else>
        <!-- 桌面表格 -->
        <div class="hidden sm:block bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div class="overflow-x-auto custom-scrollbar">
            <table class="w-full text-center border-collapse whitespace-nowrap min-w-max">
              <thead class="bg-slate-50 border-b border-slate-100 sticky top-0 z-30">
                <tr class="text-xs text-slate-600 font-bold select-none">
                  <th class="py-3 px-4 text-left cursor-pointer hover:bg-slate-100 sticky left-0 bg-slate-50 z-40 etf-name-column"
                    @click="handleSort('etf_name')">标的名称</th>
                  <th v-for="idx in 5" :key="idx" class="py-3 px-2 cursor-pointer hover:bg-slate-100"
                    @click="handleSort('d'+(idx-1))">周{{ ['一','二','三','四','五'][idx-1] }}</th>
                  <th class="py-3 px-4 cursor-pointer hover:bg-slate-100" @click="handleSort('week_status')">周线</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50 text-sm">
                <template v-for="item in sortedData" :key="item.etf_code">
                  <tr class="hover:bg-[#4da6a0]/5 transition-colors group cursor-pointer" @click="toggleRow(item)">
                    <td class="p-3 text-left relative sticky left-0 bg-white group-hover:bg-[#f6faf9] z-10 etf-name-column shadow-[1px_0_0_0_#f1f5f9]">
                      <div v-if="freeEtfCodes.includes(item.etf_code)" class="absolute left-0 top-0 bottom-0 w-1 theme-bg"></div>
                      <div class="flex items-center justify-between">
                        <div class="flex flex-col">
                          <div class="font-bold text-slate-800 flex items-center group-hover:theme-text">
                            {{ item.etf_name }}
                            <span v-if="freeEtfCodes.includes(item.etf_code)"
                              class="text-[9px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded ml-1 font-normal">免费</span>
                          </div>
                          <div class="text-[11px] text-slate-400 font-mono">{{ item.etf_code }}</div>
                        </div>
                        <i class="fa-solid text-[10px] text-slate-300"
                          :class="expandedRowKey === item.etf_code ? 'fa-chevron-down theme-text' : 'fa-chevron-right'"></i>
                      </div>
                    </td>
                    <td v-for="idx in 5" :key="idx" class="p-3 font-medium"
                      :class="getColorClass(item.days[idx-1]?.day_status)">
                      <div class="flex items-center justify-center gap-1">
                        <span v-if="item.days[idx-1]?.day_status && item.days[idx-1].day_status !== '-' && item.days[idx-1].day_status !== '--'"
                          :title="getDayTooltip(item.days[idx-1].date)">{{ item.days[idx-1].day_status }}</span>
                        <span v-else>-</span>
                        <i v-if="isDailyChartColumn(idx-1)"
                          class="fa-regular fa-image text-slate-300 chart-icon cursor-pointer text-[12px]"
                          :title="'日线图表 · ' + getColumnDateLabel(idx-1)"
                          @click.stop="openChart(item.etf_code, 'daily')"></i>
                      </div>
                    </td>
                    <td class="p-3">
                      <div class="flex items-center justify-center gap-1 font-medium" :class="getColorClass(item.week_status)">
                        <span v-if="item.week_status && item.week_status !== '-' && item.week_status !== '--'"
                          :title="getWeekTooltip(selectedMonday)">{{ item.week_status }}</span>
                        <span v-else>-</span>
                        <i class="fa-regular fa-image text-slate-300 chart-icon cursor-pointer text-[12px]"
                          :title="'周线图表 · ' + getWeekTooltip(selectedMonday)"
                          @click.stop="openChart(item.etf_code, 'weekly')"></i>
                      </div>
                    </td>
                  </tr>
                  <template v-if="expandedRowKey === item.etf_code">
                    <tr v-for="week in getPastWeeks(item.etf_code)" :key="week.monday"
                      class="bg-slate-50/80 border-b border-dashed border-slate-100" @click.stop>
                      <td class="p-3 sticky left-0 bg-slate-50/80 z-10 etf-name-column"></td>
                      <td v-for="idx in 5" :key="idx" class="p-3 text-xs"
                        :class="getColorClass(week.days[idx-1]?.day_status)">
                        <span v-if="week.days[idx-1]?.day_status && week.days[idx-1].day_status !== '-' && week.days[idx-1].day_status !== '--'">
                          {{ week.days[idx-1].day_status }}
                        </span>
                        <span v-else>-</span>
                      </td>
                      <td class="p-3 text-xs" :class="getColorClass(week.week_status)">
                        <span v-if="week.week_status && week.week_status !== '-' && week.week_status !== '--'">
                          {{ week.week_status }}
                        </span>
                        <span v-else>-</span>
                      </td>
                    </tr>
                  </template>
                </template>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 手机卡片 -->
        <div class="sm:hidden space-y-2.5">
          <div v-for="item in sortedData" :key="item.etf_code" class="m-card">
            <div class="px-3.5 py-2.5 flex items-center justify-between" @click="toggleRow(item)">
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="text-[15px] font-bold text-slate-800 font-mono">{{ item.etf_code }}</span>
                    <span v-if="freeEtfCodes.includes(item.etf_code)"
                      class="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full shrink-0">免费</span>
                  </div>
                  <div class="text-[13px] text-slate-500 truncate mt-0.5">{{ item.etf_name }}</div>
                </div>
              </div>
              <i class="fa-solid text-xs text-slate-300 shrink-0 ml-2"
                :class="expandedRowKey === item.etf_code ? 'fa-chevron-down theme-text' : 'fa-chevron-right'"></i>
            </div>
            <div class="m-day-grid border-t border-slate-50">
              <div v-for="idx in 5" :key="idx" class="m-day-cell">
                <div class="text-[10px] text-slate-400 font-medium">周{{ ['一','二','三','四','五'][idx-1] }}</div>
                <div v-if="item.days[idx-1]?.date" class="text-[9px] text-slate-300 mt-0.5">
                  {{ getMobileDayDate(item.days[idx-1].date) }}
                </div>
                <div class="flex items-center justify-center gap-0.5 mt-1">
                  <span class="text-[13px] font-bold leading-none"
                    :class="getMobileStatusClass(item.days[idx-1]?.day_status)">
                    {{ formatMobileStatus(item.days[idx-1]?.day_status) }}
                  </span>
                  <i v-if="isDailyChartColumn(idx-1)"
                    class="fa-regular fa-image text-slate-400 text-[10px] chart-icon"
                    :title="'日线 · ' + getColumnDateLabel(idx-1)"
                    @click.stop="openChart(item.etf_code, 'daily')"></i>
                </div>
              </div>
              <div class="m-day-cell">
                <div class="text-[10px] text-slate-500 font-bold">周线</div>
                <div class="text-[9px] text-slate-400 mt-0.5">{{ getMobileWeekDate(selectedMonday) }}</div>
                <div class="flex items-center justify-center gap-0.5 mt-1">
                  <span class="text-[13px] font-bold leading-none" :class="getMobileStatusClass(item.week_status)">
                    {{ formatMobileStatus(item.week_status) }}
                  </span>
                  <i class="fa-regular fa-image text-slate-400 text-[10px] chart-icon"
                    :title="'周线 · ' + getWeekTooltip(selectedMonday)"
                    @click.stop="openChart(item.etf_code, 'weekly')"></i>
                </div>
              </div>
            </div>
            <div v-if="expandedRowKey === item.etf_code" class="border-t border-slate-100 bg-slate-50/60">
              <div v-for="week in getPastWeeks(item.etf_code)" :key="week.monday"
                class="px-2 py-2 border-b border-slate-100/80 last:border-0">
                <div class="m-day-grid">
                  <div v-for="idx in 5" :key="idx" class="text-center py-1">
                    <div v-if="week.days[idx-1]?.date" class="text-[9px] text-slate-400">
                      {{ getMobileDayDate(week.days[idx-1].date) }}
                    </div>
                    <div class="text-[12px] font-bold mt-0.5"
                      :class="getMobileStatusClass(week.days[idx-1]?.day_status)">
                      {{ formatMobileStatus(week.days[idx-1]?.day_status) }}
                    </div>
                  </div>
                  <div class="text-center py-1 bg-[#4da6a0]/10 rounded-md">
                    <div class="text-[9px] text-slate-400">{{ getMobileWeekDate(week.monday) }}</div>
                    <div class="text-[12px] font-bold mt-0.5" :class="getMobileStatusClass(week.week_status)">
                      {{ formatMobileStatus(week.week_status) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};
