/**
 * 波幅探长 - 数据看板（整合版）
 * - 通用表：免费 TOP3 + VIP 全量
 * - 数据与图表分列：行情按采集日、图表按更新日落在对应周几列
 * - 打赏入口（后台 tip_enabled）
 * js/components/index/Dashboard.js
 */
import { store } from "../../store.js";
import { etfApi } from "../../api/etf.js";
import { watchlistApi } from "../../api/watchlist.js";
import { CONFIG } from "../../config.js";

const { ref, computed, onMounted } = Vue;

function settingOn(val) {
  return val === "1" || val === 1 || val === true || val === "true";
}

export default {
  name: "Dashboard",
  setup() {
    const loading = ref(false);
    const allData = ref([]);
    const chartsMap = ref({});
    /** 图表统一采集日 YYYY-MM-DD（北京）；仅来自 updated_at 或 R2 Last-Modified，绝不使用「今天」凑数 */
    const globalChartDay = ref(null);
    const customList = ref([]);
    const sharedList = ref([]);  // 通用监控全量（无论是否触发）

    const searchQuery = ref("");
    const expandedRowKey = ref(null);
    const sortColumn = ref(null);
    const sortOrder = ref("desc");

    const tipVisible = ref(false);

    const settings = computed(() => store.state.publicSettings || {});
    const tipEnabled = computed(() => settingOn(settings.value.tip_enabled));

    const isImageUrl = (url) => {
      if (!url || typeof url !== "string") return false;
      return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url.trim());
    };
    const linkToQrSrc = (url) =>
      `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(
        String(url).trim()
      )}`;
    const tipWechatSrc = computed(() => {
      const u = settings.value.tip_wechat_qr_url || "";
      if (!u) return "";
      return isImageUrl(u) ? u : linkToQrSrc(u);
    });
    const tipAlipaySrc = computed(() => {
      const u = settings.value.tip_alipay_qr_url || "";
      if (!u) return "";
      return isImageUrl(u) ? u : linkToQrSrc(u);
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

    /** 看板单元格：上午/下午|日线 */
    const formatDayCell = (item) => {
      if (!item) return "-";
      const am = item.am_status && item.am_status !== "--" ? item.am_status : "-";
      const pm = item.pm_status && item.pm_status !== "--" ? item.pm_status : "-";
      const day = item.day_status && item.day_status !== "--" ? item.day_status : "-";
      if (am === "-" && pm === "-" && day === "-") return "-";
      return am + "/" + pm + "|" + day;
    };

    /** 图表 icon 悬停：x月x日图表 */
    const chartDateTitle = (dateStr) => {
      if (!dateStr || !isValidDate(dateStr)) return "图表";
      const parts = String(dateStr).split("-");
      if (parts.length < 3) return "图表";
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (!m || !d) return "图表";
      return m + "月" + d + "日图表";
    };

    /** 单元格主色：优先日线，其次下午、上午 */
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

    const shiftMonday = (mondayStr, weeksBack) => {
      const [y, m, d] = parseYMD(mondayStr);
      if (!y) return "";
      const dt = new Date(y, m - 1, d - weeksBack * 7);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
        dt.getDate()
      ).padStart(2, "0")}`;
    };

    const getStatusVal = (str) => {
      if (!str || typeof str !== "string" || str === "-" || str === "--") return -9999;
      const match = str.match(/[-+]?[0-9]*\.?[0-9]+/);
      return match ? parseFloat(match[0]) : -9999;
    };

    /** 本周一（本地日历），行情为空时仍能展示监控列表 */
    const calendarMonday = () => {
      const d = new Date();
      const day = d.getDay(); // 0=Sun
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    };

    const latestMonday = computed(() => {
      // 优先：行情里最新有效日期所在周；否则用本周一（保证无触发也出表）
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

    const latestDailyColIndex = computed(() => {
      if (!latestMonday.value) return -1;
      const weekDays = getWeekDays(latestMonday.value);
      for (let idx = 4; idx >= 0; idx--) {
        const dateStr = weekDays[idx];
        const has = allData.value.some(
          (i) =>
            i.date === dateStr &&
            i.day_status &&
            i.day_status !== "-" &&
            i.day_status !== "--"
        );
        if (has) return idx;
      }
      return -1;
    });

    const R2_CHART_BASE = "https://pub-973330e118204686a625fe51431d4336.r2.dev/charts";

    /** 北京日历 YYYY-MM-DD */
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

    /** 北京最近交易日：若今天是工作日用今天，否则往前找（周末用周五） */
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

    /**
     * 图表采集日（整表统一）：
     * 只认 globalChartDay（来自接口 chart_date = R2 文件日）
     * 绝不在这里用「今天」
     */
    const chartUpdateDay = (_code) => globalChartDay.value || null;

    const chartColIndexForCode = (etfCode) => {
      if (!latestMonday.value) return -1;
      const weekDays = getWeekDays(latestMonday.value);
      if (!weekDays.length) return -1;
      const day = chartUpdateDay(etfCode);
      if (!day) return -1;
      return weekDays.indexOf(day);
    };

    const hasChartForCode = (etfCode) => {
      const e = resolveChartEntry(etfCode);
      return !!(e && e.url);
    };

    /** 采集日对应列才显示；有采集日就显示（不依赖 charts 是否非空） */
    const showDailyChartIcon = (etfCode, colIdx) => {
      if (colIdx < 0) return false;
      const target = chartColIndexForCode(etfCode);
      return target === colIdx && target >= 0;
    };

    /**
     * 解析全局图表采集日
     * 优先级：接口 chart_date > charts 内 max(updated_at) > 北京最近交易日（今天若工作日）
     * （浏览器无法可靠读 R2 Last-Modified，故不以浏览器 HEAD 为准）
     */
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
      // 兜底：北京最近交易日（工作日=今天；与「每日出图」一致，避免永远偏前一天）
      globalChartDay.value = latestTradingDayBj();
      return globalChartDay.value;
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

    const findWeekStatusForMonday = (etfCode, mondayStr) => {
      if (!mondayStr) return null;
      const days = getWeekDays(mondayStr);
      for (const item of allData.value) {
        if (item.etf_code !== etfCode) continue;
        if (!item.date || !days.includes(item.date)) continue;
        if (item.week_status && item.week_status !== "-" && item.week_status !== "--") {
          return item.week_status;
        }
      }
      return null;
    };

    const hasCurrentWeekStatus = (etfMap) =>
      Object.values(etfMap).some((r) => r.week_status_from === "current");

    /** 从全量行情中拼出某一代码本周行 */
    const buildRowForCode = (etfCode, etfName) => {
      if (!latestMonday.value) return null;
      const weekDays = getWeekDays(latestMonday.value);
      if (weekDays.length < 5) return null;
      const prevMonday = shiftMonday(latestMonday.value, 1);
      const row = {
        etf_code: etfCode,
        etf_name: etfName || etfCode,
        days: [null, null, null, null, null],
        week_status: null,
        week_status_from: null,
      };
      allData.value.forEach((item) => {
        if (item.etf_code !== etfCode || !item.date) return;
        const idx = weekDays.indexOf(item.date);
        if (idx === -1) return;
        row.days[idx] = item;
        if (item.week_status && item.week_status !== "-" && item.week_status !== "--") {
          row.week_status = item.week_status;
          row.week_status_from = "current";
        }
        if (item.etf_name) row.etf_name = item.etf_name;
      });
      if (!row.week_status) {
        const prev = findWeekStatusForMonday(etfCode, prevMonday);
        if (prev) {
          row.week_status = prev;
          row.week_status_from = "prev";
        }
      }
      return row;
    };

    const processedData = computed(() => {
      const empty = {
        list: [],
        freeTop3Codes: [],
        weekDays: [],
        weekStatusMonday: "",
        rankBy: "daily",
        rankDailyIdx: -1,
      };
      if (!latestMonday.value) return empty;

      const weekDays = getWeekDays(latestMonday.value);
      if (weekDays.length < 5) return empty;

      const prevMonday = shiftMonday(latestMonday.value, 1);
      const etfMap = {};
      allData.value.forEach((item) => {
        if (!item.date) return;
        const idx = weekDays.indexOf(item.date);
        if (idx === -1) return;
        if (!etfMap[item.etf_code]) {
          etfMap[item.etf_code] = {
            etf_code: item.etf_code,
            etf_name: item.etf_name,
            days: [null, null, null, null, null],
            week_status: null,
            week_status_from: null,
          };
        }
        etfMap[item.etf_code].days[idx] = item;
        if (item.week_status && item.week_status !== "-" && item.week_status !== "--") {
          etfMap[item.etf_code].week_status = item.week_status;
          etfMap[item.etf_code].week_status_from = "current";
        }
      });

      Object.values(etfMap).forEach((row) => {
        if (!row.week_status) {
          const prev = findWeekStatusForMonday(row.etf_code, prevMonday);
          if (prev) {
            row.week_status = prev;
            row.week_status_from = "prev";
          }
        }
      });

      const weekStatusMonday = hasCurrentWeekStatus(etfMap)
        ? latestMonday.value
        : prevMonday;

      // ★ 关键并入通用监控列表：无触发数据的标的也要占一行（可看图表）
      (sharedList.value || []).forEach((s) => {
        const code = String(s.etf_code || s.code || "").replace(/\D/g, "").slice(-6);
        if (code.length !== 6) return;
        if (!etfMap[code]) {
          etfMap[code] = {
            etf_code: code,
            etf_name: s.etf_name || s.name || code,
            days: [null, null, null, null, null],
            week_status: null,
            week_status_from: null,
          };
        } else if ((s.etf_name || s.name) && !etfMap[code].etf_name) {
          etfMap[code].etf_name = s.etf_name || s.name;
        }
      });

      // 行情里出现过、但不在本周格子里的代码也并入（跨周兜底）
      allData.value.forEach((item) => {
        const code = String(item.etf_code || "").replace(/\D/g, "").slice(-6);
        if (code.length !== 6) return;
        if (!etfMap[code]) {
          etfMap[code] = {
            etf_code: code,
            etf_name: item.etf_name || code,
            days: [null, null, null, null, null],
            week_status: null,
            week_status_from: null,
          };
        }
      });

      let items = Object.values(etfMap);

      let latestIdx = 4;
      while (latestIdx >= 0) {
        const has = items.some(
          (i) => i.days[latestIdx]?.day_status && i.days[latestIdx].day_status !== "-"
        );
        if (has) break;
        latestIdx--;
      }

      const useWeeklyRank = hasCurrentWeekStatus(etfMap);
      const rankBy = useWeeklyRank ? "weekly" : "daily";

      const absRankVal = (row) => {
        if (useWeeklyRank) {
          return row.week_status ? Math.abs(getStatusVal(row.week_status)) : -9999;
        }
        if (latestIdx < 0) return -9999;
        const s = row.days[latestIdx]?.day_status;
        return s && s !== "-" ? Math.abs(getStatusVal(s)) : -9999;
      };

      const sortedByAbs = [...items].sort((a, b) => absRankVal(b) - absRankVal(a));
      const freeTop3Codes = sortedByAbs
        .filter((i) => absRankVal(i) > -9999)
        .slice(0, 3)
        .map((i) => i.etf_code);

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
            const valA = getStatusVal(a.week_status);
            const valB = getStatusVal(b.week_status);
            if (valA === -9999 && valB !== -9999) return 1;
            if (valB === -9999 && valA !== -9999) return -1;
            return sortOrder.value === "desc" ? valB - valA : valA - valB;
          }
        }
        return absRankVal(b) - absRankVal(a);
      });

      if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase().trim();
        items = items.filter(
          (i) =>
            (i.etf_name && i.etf_name.toLowerCase().includes(q)) ||
            (i.etf_code && i.etf_code.toLowerCase().includes(q))
        );
      }

      return {
        list: items,
        freeTop3Codes,
        weekDays,
        weekStatusMonday,
        rankBy,
        rankDailyIdx: latestIdx,
      };
    });

    /** 定制标的：合并行情行 */
    const customRows = computed(() => {
      if (!store.state.isLoggedIn || !customList.value.length) return [];
      const now = Date.now();
      return customList.value
        .filter((c) => c.status === "active" && (!c.expire_at || c.expire_at > now))
        .map((c) => {
          const row = buildRowForCode(c.etf_code, c.etf_name);
          return {
            ...(row || {
              etf_code: c.etf_code,
              etf_name: c.etf_name || c.etf_code,
              days: [null, null, null, null, null],
              week_status: null,
              week_status_from: null,
            }),
            _customMeta: c,
          };
        });
    });

    const canViewChart = (etfCode, isCustom = false) => {
      if (isCustom) return true; // 有效定制期内可看图
      if (store.state.isVip) return true;
      return processedData.value.freeTop3Codes.includes(etfCode);
    };

    const getPastWeeks = (etf_code) => {
      if (!latestMonday.value) return [];
      const pastData = allData.value.filter(
        (item) => item.etf_code === etf_code && (item.day_status || item.week_status || item.am_status || item.pm_status)
      );
      const weekMap = {};
      pastData.forEach((item) => {
        if (!item.date || !isValidDate(item.date)) return;
        const wDays = getWeekDays(item.date);
        if (!wDays.length) return;
        const monday = wDays[0];
        if (monday === latestMonday.value) return;
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
      return Object.values(weekMap)
        .sort((a, b) => b.monday.localeCompare(a.monday))
        .slice(0, 4);
    };

    const probeImage = (url) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
      });

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
        const viewer = new window.Viewer(container, {
          hidden: () => {
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
            zoomIn: 1,
            zoomOut: 1,
            oneToOne: 1,
            reset: 1,
            prev: isMulti ? 1 : 0,
            play: 0,
            next: isMulti ? 1 : 0,
            rotateLeft: 0,
            rotateRight: 0,
            flipHorizontal: 0,
            flipVertical: 0,
          },
        });
        viewer.show();
      } else {
        window.open(imgList[initialIndex]?.url, "_blank");
      }
    };

    const openDailyChartViewer = async (item, isCustom = false) => {
      if (!canViewChart(item.etf_code, isCustom)) {
        if (confirm("此为 VIP 专属图表 (免费标的除外)。\n是否去开通监控 VIP？")) {
          window.location.hash = "#/plan";
        }
        return;
      }
      const entry = resolveChartEntry(item.etf_code);
      const r2Daily = `https://pub-973330e118204686a625fe51431d4336.r2.dev/charts/${item.etf_code}_daily.png`;
      const r2Half = `https://pub-973330e118204686a625fe51431d4336.r2.dev/charts/${item.etf_code}_half_day.png`;
      // 默认半日线在前、日线在后（可左右翻页）
      const candidates = [
        {
          title: `${item.etf_name} (${item.etf_code}) 半日线图表`,
          url: r2Half,
        },
        {
          title: `${item.etf_name} (${item.etf_code}) 日线图表`,
          url: (entry && entry.url) || r2Daily,
        },
      ];
      if (entry && entry.url && entry.url !== r2Daily) {
        candidates.push({
          title: `${item.etf_name} (${item.etf_code}) 日线图表(库)`,
          url: entry.url,
        });
      }
      const images = [];
      for (const c of candidates) {
        if (await probeImage(c.url)) images.push(c);
      }
      if (!images.length) {
        store.showToast("暂无可用日线图表", "error");
        return;
      }
      showViewerWithMultiImages(images, 0);
    };

    const openWeeklyChartViewer = async (item, isCustom = false) => {
      if (!canViewChart(item.etf_code, isCustom)) {
        if (confirm("此为 VIP 专属图表 (免费标的除外)。\n是否去开通通用 VIP？")) {
          window.location.hash = "#/plan";
        }
        return;
      }
      const images = [
        {
          title: `${item.etf_name} (${item.etf_code}) 周线图表`,
          url: `https://pub-973330e118204686a625fe51431d4336.r2.dev/charts/${item.etf_code}_weekly.png`,
        },
      ];
      if (!(await probeImage(images[0].url))) {
        store.showToast("暂无可用周线图表", "error");
        return;
      }
      showViewerWithMultiImages(images, 0);
    };

    const toggleRow = (item) => {
      expandedRowKey.value = expandedRowKey.value === item.etf_code ? null : item.etf_code;
    };

    const getColorClass = (status) => {
      if (!status || status === "-" || status === "--") return "text-slate-300";
      return status.includes("+") ? "text-red-500" : "text-emerald-500";
    };

    const formatExpire = (ts) => {
      if (!ts) return "";
      const d = new Date(ts);
      if (isNaN(d.getTime())) return "";
      return `${d.getMonth() + 1}/${d.getDate()}到期`;
    };

    const initData = async () => {
      loading.value = true;
      try {
        const tasks = [
          etfApi.fetchEtfRawData().catch(() => []),
          etfApi.fetchChartsMap().catch(() => ({})),
          etfApi.fetchSharedWatchlist().catch(() => ({ data: [] })),
        ];
        if (store.state.isLoggedIn) {
          tasks.push(watchlistApi.fetchUserCustomWatchlist().catch(() => ({ data: [] })));
        }
        const results = await Promise.all(tasks);
        const data = results[0];
        const chartsRes = results[1];
        const sharedRes = results[2];
        if (Array.isArray(data)) allData.value = data;
        chartsMap.value = chartsRes.charts || chartsRes || {};
        const sharedRaw = sharedRes?.data ?? sharedRes;
        sharedList.value = Array.isArray(sharedRaw) ? sharedRaw : [];
        if (store.state.isLoggedIn && results[3]) {
          const raw = results[3].data ?? results[3];
          customList.value = Array.isArray(raw) ? raw : [];
        }
        const sampleCodes = (sharedList.value || [])
          .map((s) => s.etf_code || s.code)
          .concat((allData.value || []).map((i) => i.etf_code));
        await resolveGlobalChartDay(sampleCodes, chartsRes && chartsRes.chart_date);
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
      }
    };

    onMounted(initData);

    return {
      loading,
      searchQuery,
      sortColumn,
      sortOrder,
      handleSort,
      processedData,
      customRows,
      latestDailyColIndex,
      chartColIndexForCode,
      hasChartForCode,
      showDailyChartIcon,
      chartUpdateDay,
      globalChartDay,
      expandedRowKey,
      formatDateCN,
      formatDayCell,
      chartDateTitle,
      cellPrimaryStatus,
      formatExpire,
      openDailyChartViewer,
      openWeeklyChartViewer,
      toggleRow,
      getColorClass,
      getPastWeeks,
      tipEnabled,
      tipVisible,
      tipWechatSrc,
      tipAlipaySrc,
      settings,
      store: store.state,
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
        <p class="mt-2 text-sm">读取云端数据中...</p>
      </div>

      <template v-else>
        <!-- 定制监控已下线 -->



        <!-- ===== 通用数据表 ===== -->
        <div v-if="!processedData.list.length" class="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-100">
          <i class="fa-solid fa-folder-open text-4xl mb-3 opacity-40"></i>
          <p>暂无相关行情数据</p>
        </div>

        <div v-else class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div class="overflow-x-auto custom-scrollbar">
            <table class="w-full text-center border-collapse whitespace-nowrap min-w-max">
              <thead class="bg-slate-50 border-b border-slate-100">
                <tr class="text-xs text-slate-600 font-bold select-none">
                  <th class="py-3 px-4 text-left etf-name-column sticky top-0 left-0 bg-slate-50 z-40 cursor-pointer hover:bg-slate-100 transition-colors border-b border-slate-200" @click="handleSort('etf_name')">
                    标的名称
                    <i v-if="sortColumn==='etf_name'" class="fa-solid text-[10px] ml-1" :class="sortOrder==='asc'?'fa-arrow-up':'fa-arrow-down'"></i>
                  </th>
                  <th v-for="idx in 5" :key="idx" class="py-3 px-2 sticky top-0 bg-slate-50 z-30 cursor-pointer hover:bg-slate-100 transition-colors border-b border-slate-200" @click="handleSort('d'+(idx-1))">
                    周{{ ['一','二','三','四','五'][idx-1] }}
                    <i v-if="sortColumn==='d'+(idx-1)" class="fa-solid text-[10px] ml-1" :class="sortOrder==='asc'?'fa-arrow-up':'fa-arrow-down'"></i>
                  </th>
                  <th class="py-3 px-4 sticky top-0 bg-slate-50 z-30 cursor-pointer hover:bg-slate-100 transition-colors border-b border-slate-200" @click="handleSort('week_status')">
                    周线
                    <i v-if="sortColumn==='week_status'" class="fa-solid text-[10px] ml-1" :class="sortOrder==='asc'?'fa-arrow-up':'fa-arrow-down'"></i>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50 text-sm">
                <template v-for="item in processedData.list" :key="item.etf_code">
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

                    <td v-for="idx in 5" :key="idx" class="p-3 font-medium" :class="getColorClass(cellPrimaryStatus(item.days[idx-1]))">
                      <div class="flex items-center justify-center gap-1">
                        <span class="text-[11px] sm:text-sm font-mono tracking-tight">{{ formatDayCell(item.days[idx-1]) }}</span>
                        <i v-if="showDailyChartIcon(item.etf_code, idx - 1)"
                           class="fa-regular fa-image text-slate-300 hover:text-blue-500 cursor-pointer text-xs shrink-0"
                           :title="chartDateTitle(chartUpdateDay(item.etf_code) || processedData.weekDays[idx-1])"
                           @click.stop="openDailyChartViewer(item, false)"></i>
                      </div>
                    </td>

                    <td class="p-3 font-medium" :class="getColorClass(item.week_status)">
                      <div class="flex items-center justify-center gap-1"
                           :title="item.week_status_from === 'prev'
                             ? ('上周周线 · ' + (processedData.weekStatusMonday || ''))
                             : (processedData.weekStatusMonday || '')">
                        <span>{{ item.week_status || '-' }}</span>
                        <i class="fa-regular fa-image text-slate-300 hover:text-blue-500 cursor-pointer text-xs"
                           :title="(item.week_status_from === 'prev' ? '上周' : '') + (chartDateTitle(processedData.weekStatusMonday) || '周线图表')"
                           @click.stop="openWeeklyChartViewer(item, false)"></i>
                      </div>
                    </td>
                  </tr>

                  <template v-if="expandedRowKey === item.etf_code">
                    <tr v-for="week in getPastWeeks(item.etf_code)" :key="week.monday" class="bg-slate-50/80 border-b border-dashed border-slate-100 text-xs">
                      <td class="p-2.5 text-left sticky left-0 bg-slate-50/90 z-10 font-mono text-slate-400 pl-6">
                        <i class="fa-regular fa-clock mr-1"></i>{{ week.monday }}
                      </td>
                      <td v-for="idx in 5" :key="idx" class="p-2.5 font-medium font-mono text-[11px]" :class="getColorClass(cellPrimaryStatus(week.days[idx-1]))" :title="formatDateCN(week.days[idx-1]?.date)">
                        {{ formatDayCell(week.days[idx-1]) }}
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

        <p class="text-[11px] text-slate-400 text-center">
          单元格格式：上午/下午|日线。未触发显示 “-”。行情按采集日落列；图表按更新日落列（与触发数据独立）。日线用于排序与免费 Top3。
        </p>

        <!-- 打赏入口 -->
        <div v-if="tipEnabled" class="text-center pt-2">
          <button type="button" @click="tipVisible = true"
                  class="text-xs text-slate-400 hover:theme-text underline">
            {{ settings.tip_note || '觉得有用？请作者喝杯咖啡' }}
          </button>
        </div>
      </template>

      <!-- 打赏弹层 -->
      <div v-if="tipVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="tipVisible = false">
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl text-center">
          <h3 class="font-bold text-slate-800">感谢支持</h3>
          <p class="text-xs text-slate-500">{{ settings.tip_note || '自愿打赏，不解锁任何权限' }}</p>
          <div class="flex justify-center gap-4 flex-wrap">
            <div v-if="tipWechatSrc" class="space-y-1">
              <img :src="tipWechatSrc" class="w-28 h-28 object-contain border rounded-lg" alt="微信">
              <div class="text-[11px] text-slate-500">微信</div>
            </div>
            <div v-if="tipAlipaySrc" class="space-y-1">
              <img :src="tipAlipaySrc" class="w-28 h-28 object-contain border rounded-lg" alt="支付宝">
              <div class="text-[11px] text-slate-500">支付宝</div>
            </div>
            <p v-if="!tipWechatSrc && !tipAlipaySrc" class="text-xs text-slate-400">后台尚未配置打赏收款码</p>
          </div>
          <button type="button" @click="tipVisible = false" class="text-sm text-slate-500">关闭</button>
        </div>
      </div>
    </div>
  `,
};
