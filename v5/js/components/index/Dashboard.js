/**
 * 波幅探长 - 数据看板 (v5.2 定制优化版)
 * 1. 搜索行快捷筛选顺序：最新异动、我的收藏、T+0、会员赞助（保留“全部”重置项）
 * 2. 赞助会员看板默认顺序：赞助标的 → 收藏 → TOP3 → 其它
 * 3. 非赞助会员看板默认顺序：收藏 → TOP3 → 其它
 * 4. 股票/ETF代码后标识：T+0 标的在代码后显示英文括号 (0)，非 T+0 标的不显示 (t+1)
 */
import { store } from "../../store.js";
import { etfApi } from "../../api/etf.js";
import { sponsorApi } from "../../api/sponsor.js";
import { dashboardPrefsApi } from "../../api/dashboardPrefs.js";
import { CONFIG, resolveTradeRule } from "../../config.js";

const { ref, reactive, computed, onMounted, nextTick, watch } = Vue;

const settingOn = (val) =>
  val === undefined || val === null || val === "" || val === "1" || val === 1 || val === true || val === "true";

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
    const mySponsoredCodes = ref([]);

    const favCodes = ref([]);
    const userOrder = ref([]);
    const dragCode = ref(null);
    const prefsSaving = ref(false);

    const searchQuery = ref("");
    const quickFilter = ref("all"); // all | active | fav | t0 | sponsored
    const sortColumn = ref(null);
    const sortOrder = ref("desc");

    const guestChartModal = reactive({ visible: false, etfCode: "", etfName: "" });
    const openGuestChartPrompt = (item) => {
      guestChartModal.etfCode = item?.etf_code || "";
      guestChartModal.etfName = formatEtfName(item?.etf_name) || item?.etf_code || "";
      guestChartModal.visible = true;
    };
    const goAuthFromPrompt = (mode = "register") => {
      guestChartModal.visible = false;
      store.state.authMode = mode;
      store.state.authModalVisible = true;
    };

    const setQuickFilter = (key) => {
      if (key === "fav" && !store.state.isLoggedIn) {
        goAuthFromPrompt("login");
        return;
      }
      quickFilter.value = quickFilter.value === key ? "all" : key;
    };

    const tipVisible = ref(false);
    const tipChannel = ref("wechat");
    const tipQuickAmounts = [6.66, 18.88, 38.88, 66.0, 88.88];
    const tipForm = reactive({ amount: "18.88", txId: "", note: "" });
    const tipSubmitting = ref(false);
    const formattedTipAmount = computed(() => {
      const n = parseFloat(tipForm.amount);
      return isNaN(n) || n <= 0 ? "0.00" : Math.min(99999, Math.max(0.01, n)).toFixed(2);
    });

    const settings = computed(() => store.state.publicSettings || {});
    const tipEnabled = computed(() => settingOn(settings.value.tip_enabled));
    const isImageUrl = (url) => {
      const u = String(url || "").trim();
      return u && /^https?:\/\//i.test(u) && /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(u);
    };
    const tipWechatSrc = computed(() => {
      const u = String(settings.value.wechat_qr_url || settings.value.tip_wechat_qr_url || "").trim();
      return isImageUrl(u) ? u : "";
    });
    const tipAlipaySrc = computed(() => {
      const u = String(settings.value.alipay_qr_url || settings.value.tip_alipay_qr_url || "").trim();
      return isImageUrl(u) ? u : "";
    });

    const openTipModal = (presetAmount = null) => {
      if (presetAmount != null) tipForm.amount = Number(presetAmount).toFixed(2);
      else if (!tipForm.amount || Number(tipForm.amount) <= 0) tipForm.amount = "18.88";
      tipForm.txId = "";
      tipForm.note = "";
      const defCh = settings.value.default_pay_channel || "wechat";
      tipChannel.value =
        defCh === "alipay" && tipAlipaySrc.value
          ? "alipay"
          : tipWechatSrc.value
          ? "wechat"
          : tipAlipaySrc.value
          ? "alipay"
          : "wechat";
      tipVisible.value = true;
    };

    const submitTipOrder = async () => {
      const amt = parseFloat(tipForm.amount);
      if (isNaN(amt) || amt <= 0) return store.showToast("请输入有效的打赏金额", "error");
      if (tipForm.txId && !/^\d{6}$/.test(tipForm.txId.trim())) {
        return store.showToast("支付单号后6位需为6位数字（或留空）", "error");
      }
      tipSubmitting.value = true;
      try {
        await sponsorApi.submitTip({
          amount: Number(amt.toFixed(2)),
          tx_id_last6: tipForm.txId.trim(),
          tip_note: tipForm.note.trim(),
        });
        store.showToast("非常感谢您的温暖打赏与支持！");
        tipVisible.value = false;
      } catch (e) {
        store.showToast(e.message || "提交失败", "error");
      } finally {
        tipSubmitting.value = false;
      }
    };

    const tableScrollEl = ref(null);
    const scrollToLatestCol = async () => {
      await nextTick();
      const el = tableScrollEl.value;
      if (el) {
        try {
          el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
        } catch (_) {}
      }
    };

    const isValidDate = (d) => d && typeof d === "string" && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(d.trim());
    const parseYMD = (s) => (isValidDate(s) ? s.trim().split(/[-/]/).map((v) => parseInt(v, 10)) : [0, 0, 0]);
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
      return am === "-" && pm === "-" && day === "-" ? "-" : `${am}/${pm}|${day}`;
    };
    const chartDateTitle = (dateStr) => (formatDateCN(dateStr) ? `${formatDateCN(dateStr)}图表` : "图表");
    const dataDateTitle = (dateStr, kind = "") => {
      const cn = formatDateCN(dateStr);
      return cn ? (kind ? cn + kind : cn) : kind || "";
    };
    const weekDataTitle = (item) => {
      if (!item || !item.week_status) return "";
      const cn = formatDateCN(item.week_status_date);
      return cn ? `${cn}周线` : "周线";
    };
    const dailyChartTitle = (etfCode, colDate) => chartDateTitle(globalChartDay.value || colDate);
    const weekChartTitle = () =>
      weeklyChartDay.value && isValidDate(weeklyChartDay.value) ? chartDateTitle(weeklyChartDay.value) : "周线图表";

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
      const day = new Date(y, m - 1, d).getDay();
      const offset = day === 0 ? -6 : 1 - day;
      const monday = new Date(y, m - 1, d + offset);
      return Array.from({ length: 5 }, (_, i) => {
        const t = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
        return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
      });
    };

    const getStatusVal = (str) => {
      if (!str || typeof str !== "string" || str === "-" || str === "--") return -9999;
      const match = str.match(/[-+]?[0-9]*\.?[0-9]+/);
      return match ? parseFloat(match[0]) : -9999;
    };

    const calendarMonday = () => {
      const d = new Date();
      const day = d.getDay();
      d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
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
      if (!ts || isNaN(ts)) {
        const parsed = Date.parse(String(val));
        if (isNaN(parsed)) return null;
        ts = parsed;
      } else if (ts < 1e12) ts *= 1000;
      return bjYmd(ts);
    };

    const latestTradingDayBj = () => {
      for (let i = 0; i <= 7; i++) {
        const day = bjYmd(Date.now() - i * 86400000);
        const wd = new Date(day + "T12:00:00+08:00").getDay();
        if (wd !== 0 && wd !== 6) return day;
      }
      return bjYmd(Date.now());
    };

    const resolveChartEntry = (code) => {
      if (code == null) return null;
      const rawCode = String(code);
      const key6 = rawCode.replace(/\D/g, "").slice(-6) || rawCode;
      const raw = (chartsMap.value || {})[key6] || (chartsMap.value || {})[rawCode];
      if (!raw) return null;
      return typeof raw === "string"
        ? { url: raw, updated_at: null }
        : { url: raw.chart_url || raw.url || "", updated_at: raw.updated_at || null };
    };

    const showDailyChartIcon = (etfCode, colIdx) => {
      if (colIdx < 0 || !latestMonday.value || !globalChartDay.value) return false;
      const weekDays = getWeekDays(latestMonday.value);
      let target = weekDays.indexOf(globalChartDay.value);
      if (target < 0) {
        const wd = new Date(globalChartDay.value + "T12:00:00+08:00").getDay();
        if (wd === 0 || wd === 6) target = 4;
      }
      return target === colIdx && target >= 0;
    };

    const normCode = (c) => String(c || "").replace(/\D/g, "").slice(-6);
    const isBlankStatus = (s) => !s || s === "-" || s === "--" || s === "None" || s === "null";

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

    const findWeekStatusForMonday = (etfCode, mondayStr) => {
      if (!mondayStr) return null;
      const want = normCode(etfCode);
      let best = null;
      let bestDate = "";
      for (const item of allData.value) {
        if (normCode(item.etf_code) !== want || !item.date || !isValidDate(item.date) || isBlankStatus(item.week_status)) continue;
        const wDays = getWeekDays(item.date);
        if (!wDays.length || wDays[0] !== mondayStr) continue;
        if (!bestDate || item.date >= bestDate) {
          bestDate = item.date;
          best = String(item.week_status).trim();
        }
      }
      return best ? { status: best, date: bestDate } : null;
    };

    const weekdayIndexFromDate = (dateStr) => {
      if (!isValidDate(dateStr)) return -1;
      const wd = new Date(dateStr.trim() + "T12:00:00+08:00").getDay();
      return wd === 0 || wd === 6 ? -1 : wd - 1;
    };

    const buildRecentTradingColDates = () => {
      const colDates = [null, null, null, null, null];
      for (const item of allData.value || []) {
        if (!item?.date || !isValidDate(item.date)) continue;
        if (isBlankStatus(item.day_status) && isBlankStatus(item.am_status) && isBlankStatus(item.pm_status)) continue;
        const idx = weekdayIndexFromDate(item.date);
        if (idx >= 0 && (!colDates[idx] || item.date.trim() > colDates[idx])) {
          colDates[idx] = item.date.trim();
        }
      }
      let anchor = colDates.reduce((acc, d) => (d && d > acc ? d : acc), "") || bjYmd(Date.now());
      for (let idx = 0; idx < 5; idx++) {
        if (colDates[idx]) continue;
        for (let back = 0; back <= 21; back++) {
          const ms = Date.parse(anchor + "T12:00:00+08:00") - back * 86400000;
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

    /** 判断某标的是否为当前登录会员本人赞助 */
    const isSponsoredByCurrentUser = (row) => {
      if (!store.state.isLoggedIn || !row) return false;
      const code = normCode(row.etf_code);
      if (mySponsoredCodes.value.includes(code)) return true;
      const myUid = Number(store.state.userId);
      if (myUid > 0) {
        if (Array.isArray(row.sponsor_user_ids) && row.sponsor_user_ids.map(Number).includes(myUid)) return true;
        if (Number(row.sponsor_user_id) === myUid) return true;
      }
      const myUname = String(store.state.username || "").trim().toLowerCase();
      if (myUname && Array.isArray(row.sponsor_usernames) && row.sponsor_usernames.includes(myUname)) {
        return true;
      }
      const myNick = String(store.state.nickname || "").trim();
      if (myNick && row.sponsor_name) {
        const names = String(row.sponsor_name).split("、").map((s) => s.trim());
        if (names.includes(myNick)) return true;
      }
      return false;
    };

    /** 解析看板展示的赞助者昵称：杜绝已设昵称却显示“热心会员” */
    const displaySponsorName = (row) => {
      if (!row) return "";
      const raw = String(row.sponsor_name || "").trim();
      if (isSponsoredByCurrentUser(row) && store.state.nickname) {
        const myNick = store.state.nickname.trim();
        if (!raw || raw === "热心会员") return myNick;
        if (raw.includes("热心会员")) return raw.replace(/热心会员/g, myNick);
      }
      return raw;
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

    const processedData = computed(() => {
      const colDates = buildRecentTradingColDates();
      if (!colDates.some(Boolean)) {
        const fb = latestMonday.value ? getWeekDays(latestMonday.value) : [];
        for (let i = 0; i < 5; i++) colDates[i] = fb[i] || null;
      }
      const weekDays = colDates;
      const dateToIdx = new Map();
      weekDays.forEach((d, i) => {
        if (d) dateToIdx.set(d, i);
      });

      const etfMap = {};
      const ensureRow = (code, name, extra = null) => {
        if (!etfMap[code]) {
          etfMap[code] = {
            etf_code: code,
            etf_name: name || code,
            days: [null, null, null, null, null],
            week_status: null,
            week_status_date: null,
            sponsor_name: extra?.sponsor_name || "",
            sponsor_user_id: extra?.sponsor_user_id || null,
            sponsor_user_ids: extra?.sponsor_user_ids || [],
            sponsor_usernames: extra?.sponsor_usernames || [],
            is_sponsored: !!extra?.is_sponsored || !!extra?.sponsor_name,
            trade_mode: extra?.trade_mode || "auto",
            source: extra?.source || "default",
          };
        } else {
          if (name && (!etfMap[code].etf_name || etfMap[code].etf_name === code)) {
            etfMap[code].etf_name = name;
          }
          if (extra?.sponsor_name) etfMap[code].sponsor_name = extra.sponsor_name;
          if (extra?.sponsor_user_id) etfMap[code].sponsor_user_id = extra.sponsor_user_id;
          if (extra?.sponsor_user_ids?.length) etfMap[code].sponsor_user_ids = extra.sponsor_user_ids;
          if (extra?.sponsor_usernames?.length) etfMap[code].sponsor_usernames = extra.sponsor_usernames;
          if (extra?.is_sponsored || extra?.sponsor_name) etfMap[code].is_sponsored = true;
          if (extra?.trade_mode && extra.trade_mode !== "auto") etfMap[code].trade_mode = extra.trade_mode;
          if (extra?.source === "sponsor") etfMap[code].source = "sponsor";
        }
        return etfMap[code];
      };

      allData.value.forEach((item) => {
        if (!item?.date || !isValidDate(item.date)) return;
        const idx = dateToIdx.get(item.date.trim());
        const code = normCode(item.etf_code);
        if (!code) return;
        const row = ensureRow(code, item.etf_name);
        if (idx !== undefined) row.days[idx] = item;
      });

      (sharedList.value || []).forEach((s) => {
        const code = normCode(s.etf_code || s.code);
        if (code.length !== 6) return;
        ensureRow(code, s.etf_name || s.name || code, s);
      });

      const closedWeekMonday = resolveLatestClosedWeekMonday();
      const closedWeekDays = closedWeekMonday ? getWeekDays(closedWeekMonday) : [];
      const closedWeekFriday = closedWeekDays.length >= 5 ? closedWeekDays[4] : "";

      Object.values(etfMap).forEach((row) => {
        const cur = closedWeekMonday ? findWeekStatusForMonday(row.etf_code, closedWeekMonday) : null;
        row.week_status = cur ? cur.status : null;
        row.week_status_date = cur ? closedWeekFriday || cur.date : null;
        row.trade_rule = resolveTradeRule(row.etf_code, row.etf_name, row.trade_mode);
        row.resolved_sponsor_name = displaySponsorName(row);
        row.is_my_sponsor = isSponsoredByCurrentUser(row);
      });

      let items = Object.values(etfMap);
      const hasStatus = (s) => !!(s && s !== "-" && s !== "--");
      const cellHasDay = (row, idx) => hasStatus(row.days?.[idx]?.day_status);
      const cellHasAny = (row, idx) =>
        cellHasDay(row, idx) || hasStatus(row.days?.[idx]?.am_status) || hasStatus(row.days?.[idx]?.pm_status);

      let latestIdx = -1;
      let latestDayDate = "";
      let dailyColIdx = -1;
      let dailyColDate = "";
      for (let idx = 0; idx < 5; idx++) {
        const d = weekDays[idx];
        if (d && d >= latestDayDate && items.some((i) => cellHasAny(i, idx))) {
          latestDayDate = d;
          latestIdx = idx;
        }
        if (d && d >= dailyColDate && items.some((i) => cellHasDay(i, idx))) {
          dailyColDate = d;
          dailyColIdx = idx;
        }
      }

      const hasAnyWeek = items.some((i) => hasStatus(i.week_status));
      const todayBj = bjYmd(Date.now());
      const wdToday = new Date(todayBj + "T12:00:00+08:00").getDay();
      const isWeekendBj = wdToday === 0 || wdToday === 6;

      let maxWeekStatusDate = "";
      for (const row of items) {
        if (hasStatus(row.week_status) && row.week_status_date > maxWeekStatusDate) {
          maxWeekStatusDate = row.week_status_date;
        }
      }
      const weeklyCollectDay = (weeklyChartDay.value && isValidDate(weeklyChartDay.value) && weeklyChartDay.value) || maxWeekStatusDate || "";
      const dailyCollectDay =
        (globalChartDay.value && isValidDate(globalChartDay.value) && globalChartDay.value) ||
        (latestIdx >= 0 && weekDays[latestIdx] ? weekDays[latestIdx] : "") ||
        "";

      let rankBy = "daily";
      if (hasAnyWeek && (isWeekendBj || (weeklyCollectDay && dailyCollectDay && weeklyCollectDay > dailyCollectDay) || weeklyCollectDay === todayBj)) {
        rankBy = "weekly";
      } else if (latestIdx < 0 && hasAnyWeek) {
        rankBy = "weekly";
      }

      const absDayVal = (row, idx) => {
        const s = row.days?.[idx]?.day_status;
        if (!hasStatus(s)) return -9999;
        const v = getStatusVal(s);
        return v === -9999 ? -9999 : Math.abs(v);
      };
      const absHalfVal = (row, idx) => {
        const item = row.days?.[idx];
        if (!item) return -9999;
        const pm = getStatusVal(item.pm_status);
        const am = getStatusVal(item.am_status);
        return Math.max(pm !== -9999 ? Math.abs(pm) : -9999, am !== -9999 ? Math.abs(am) : -9999);
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
        if (da !== db) return da === -9999 ? 1 : db === -9999 ? -1 : orderDesc ? db - da : da - db;
        const ha = absHalfVal(a, idx);
        const hb = absHalfVal(b, idx);
        if (ha !== hb) return ha === -9999 ? 1 : hb === -9999 ? -1 : orderDesc ? hb - ha : ha - hb;
        return String(a.etf_code || "").localeCompare(String(b.etf_code || ""));
      };

      const cmpWeekColumn = (a, b, orderDesc = true) => {
        const wa = absWeekVal(a);
        const wb = absWeekVal(b);
        if (wa !== wb) return wa === -9999 ? 1 : wb === -9999 ? -1 : orderDesc ? wb - wa : wa - wb;
        return String(a.etf_code || "").localeCompare(String(b.etf_code || ""));
      };

      const cmpDefaultRank = (a, b) => {
        if (rankBy === "weekly") return cmpWeekColumn(a, b, true);
        if (latestIdx >= 0) return cmpDayColumn(a, b, latestIdx, true);
        return String(a.etf_code || "").localeCompare(String(b.etf_code || ""));
      };

      const freeTopN = Math.max(1, parseInt(settings.value.free_top_n_charts, 10) || 3);
      let freeTop3Codes = [];
      if (rankBy === "weekly") {
        freeTop3Codes = [...items]
          .filter((i) => absWeekVal(i) > -9999)
          .sort((a, b) => absWeekVal(b) - absWeekVal(a) || String(a.etf_code).localeCompare(String(b.etf_code)))
          .slice(0, freeTopN)
          .map((i) => i.etf_code);
      } else if (dailyColIdx >= 0) {
        freeTop3Codes = [...items]
          .filter((i) => absDayVal(i, dailyColIdx) > -9999)
          .sort((a, b) => absDayVal(b, dailyColIdx) - absDayVal(a, dailyColIdx) || String(a.etf_code).localeCompare(String(b.etf_code)))
          .slice(0, freeTopN)
          .map((i) => i.etf_code);
      }

      const favSet = new Set(store.state.isLoggedIn ? (favCodes.value || []).map(String) : []);

      // 统计盘面信息
      const totalCount = items.length;
      const t0Count = items.filter((i) => i.trade_rule === "t+0").length;
      const sponsoredCount = items.filter((i) => i.is_sponsored || i.resolved_sponsor_name).length;
      const favCount = items.filter((i) => favSet.has(String(i.etf_code))).length;
      const activeTodayCount = items.filter((i) =>
        rankBy === "weekly" ? absWeekVal(i) > -9999 : latestIdx >= 0 && cellHasAny(i, latestIdx)
      ).length;

      // 排序逻辑：
      // 若手动点击列头排序，则按指定列排序；
      // 默认排序结构（严格按要求 2 & 3）：
      //   · 赞助会员-数据看板：赞助标的 (Group 0) → 收藏 (Group 1) → TOP3 (Group 2) → 其它 (Group 3)
      //   · 非赞助会员-数据看板：收藏 (Group 1) → TOP3 (Group 2) → 其它 (Group 3)
      if (sortColumn.value) {
        items.sort((a, b) => {
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
          return cmpDefaultRank(a, b);
        });
      } else {
        const freeSet = new Set(freeTop3Codes.map(String));
        const freeIdx = new Map(freeTop3Codes.map((c, i) => [String(c), i]));
        const orderMap = new Map((userOrder.value || []).map((c, i) => [String(c), i]));

        const groupOf = (row) => {
          const c = String(row.etf_code);
          if (row.is_my_sponsor) return 0; // 赞助会员本人赞助标的（最优先）
          if (favSet.has(c)) return 1;     // 我的收藏
          if (freeSet.has(c)) return 2;    // TOP3
          return 3;                        // 其它
        };

        items.sort((a, b) => {
          const ga = groupOf(a);
          const gb = groupOf(b);
          if (ga !== gb) return ga - gb;
          if (ga === 2) return (freeIdx.get(String(a.etf_code)) ?? 0) - (freeIdx.get(String(b.etf_code)) ?? 0);
          const primary = cmpDefaultRank(a, b);
          if (primary !== 0) return primary;
          if (orderMap.size) {
            const ia = orderMap.get(String(a.etf_code)) ?? 100000;
            const ib = orderMap.get(String(b.etf_code)) ?? 100000;
            if (ia !== ib) return ia - ib;
          }
          return 0;
        });
      }

      // 快捷筛选与搜索过滤（顺序：最新异动、我的收藏、T+0、会员赞助）
      if (quickFilter.value === "active") {
        items = items.filter((i) =>
          rankBy === "weekly" ? absWeekVal(i) > -9999 : latestIdx >= 0 && cellHasAny(i, latestIdx)
        );
      } else if (quickFilter.value === "fav") {
        items = items.filter((i) => favSet.has(String(i.etf_code)));
      } else if (quickFilter.value === "t0") {
        items = items.filter((i) => i.trade_rule === "t+0");
      } else if (quickFilter.value === "sponsored") {
        items = items.filter((i) => i.is_sponsored || i.resolved_sponsor_name);
      }

      if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase().trim();
        items = items.filter(
          (i) =>
            (i.etf_name && i.etf_name.toLowerCase().includes(q)) ||
            (i.etf_code && i.etf_code.toLowerCase().includes(q)) ||
            (i.resolved_sponsor_name && i.resolved_sponsor_name.toLowerCase().includes(q)) ||
            (i.trade_rule === "t+0" && (q === "0" || q === "(0)" || q.includes("t+0") || q.includes("t0")))
        );
      }

      let pivotIdx = 5;
      if (rankBy !== "weekly") {
        if (latestIdx >= 0) pivotIdx = latestIdx;
        else if (globalChartDay.value && weekDays.length) {
          const ci = weekDays.indexOf(globalChartDay.value);
          pivotIdx = ci >= 0 ? ci : 4;
        }
      }
      const displayCols = Array.from({ length: BASE_COLS.length }, (_, i) => BASE_COLS[(pivotIdx + 1 + i) % BASE_COLS.length]);

      return {
        list: items,
        freeTop3Codes,
        weekDays,
        rankBy,
        rankDailyIdx: rankBy === "daily" ? latestIdx : -1,
        displayCols,
        latestColKey: displayCols[displayCols.length - 1].key,
        stats: { totalCount, t0Count, sponsoredCount, favCount, activeTodayCount },
      };
    });

    const visibleCols = computed(() => processedData.value?.displayCols || BASE_COLS);
    const canViewChart = (etfCode) => store.state.isLoggedIn || processedData.value.freeTop3Codes.includes(etfCode);
    const isFavorite = (code) => (favCodes.value || []).includes(normCode(code));
    const canCustomizeBoard = computed(() => !!store.state.isLoggedIn);

    const copyCode = async (code, ev) => {
      if (ev) ev.stopPropagation();
      try {
        await navigator.clipboard.writeText(String(code));
        store.showToast(`已复制代码 ${code}`);
      } catch (_) {}
    };

    const loadDashboardPrefs = async () => {
      if (!canCustomizeBoard.value) {
        favCodes.value = [];
        userOrder.value = [];
        mySponsoredCodes.value = [];
        return;
      }
      try {
        const [prefRes, mineRes] = await Promise.all([
          dashboardPrefsApi.fetch().catch(() => ({})),
          sponsorApi.fetchMine().catch(() => ({ data: [] })),
        ]);
        const data = prefRes?.data || prefRes || {};
        favCodes.value = (data.favorites || []).map(normCode).filter((c) => c.length === 6);
        userOrder.value = (data.order || []).map(normCode);
        const now = Date.now();
        mySponsoredCodes.value = (mineRes?.data || [])
          .filter((r) => r.status === "active" && Number(r.expire_at) > now)
          .map((r) => normCode(r.etf_code))
          .filter(Boolean);
      } catch (_) {}
    };

    const toggleFavorite = async (item, ev) => {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      if (!canCustomizeBoard.value) return openGuestChartPrompt(item);
      const code = normCode(item.etf_code);
      if (code.length !== 6) return;
      try {
        const res = await dashboardPrefsApi.toggleFavorite(code);
        const on = !!(res && (res.favorite === true || res.favorite === 1));
        const cur = favCodes.value.slice();
        const idx = cur.indexOf(code);
        if (on && idx < 0) cur.push(code);
        if (!on && idx >= 0) cur.splice(idx, 1);
        favCodes.value = cur;
        store.showToast(on ? "已加入我的收藏" : "已取消收藏");
      } catch (err) {
        store.showToast(err.message || "收藏失败", "error");
      }
    };

    const onDragStart = (item, ev) => {
      if (!canCustomizeBoard.value) return ev.preventDefault();
      dragCode.value = String(item.etf_code);
      try {
        ev.dataTransfer.effectAllowed = "move";
        ev.dataTransfer.setData("text/plain", String(item.etf_code));
      } catch (_) {}
    };
    const onDragOver = (ev) => {
      if (canCustomizeBoard.value) ev.preventDefault();
    };
    const onDropRow = async (targetItem, ev) => {
      if (!canCustomizeBoard.value) return;
      ev.preventDefault();
      ev.stopPropagation();
      const from = dragCode.value || ev.dataTransfer?.getData("text/plain");
      const to = String(targetItem.etf_code);
      dragCode.value = null;
      if (!from || from === to) return;
      const next = (processedData.value.list || []).map((x) => String(x.etf_code));
      const fi = next.indexOf(String(from));
      const ti = next.indexOf(to);
      if (fi < 0 || ti < 0) return;
      next.splice(fi, 1);
      next.splice(ti, 0, String(from));
      userOrder.value = next;
      if (prefsSaving.value) return;
      prefsSaving.value = true;
      try {
        await dashboardPrefsApi.saveOrder(next, favCodes.value.slice());
      } catch (err) {
        store.showToast(err.message || "排序保存失败", "error");
      } finally {
        prefsSaving.value = false;
      }
    };

    const probeImage = (url) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
      });

    const probeImagesBatch = async (candidates, concurrency = 12) => {
      const out = [];
      let i = 0;
      const workers = Array.from({ length: Math.min(concurrency, Math.max(1, candidates.length)) }, async () => {
        while (i < candidates.length) {
          const idx = i++;
          const c = candidates[idx];
          if (c?.url && (await probeImage(c.url))) out.push({ ...c, _idx: idx });
        }
      });
      await Promise.all(workers);
      return out.sort((a, b) => a._idx - b._idx).map(({ _idx, ...rest }) => rest);
    };

    const ensureViewerNavStyle = () => {
      if (document.getElementById("bofutz-viewer-nav-style")) return;
      const style = document.createElement("style");
      style.id = "bofutz-viewer-nav-style";
      style.textContent = `
        .bofutz-viewer-nav { position:absolute; top:50%; transform:translateY(-50%); z-index:30; width:48px; height:48px; border-radius:999px; border:2px solid rgba(255,255,255,0.9); background:rgba(15,23,42,0.5); color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(6px); }
        .bofutz-viewer-nav:hover { background:rgba(15,23,42,0.75); }
        .bofutz-viewer-nav svg { width:20px; height:20px; fill:none; stroke:currentColor; stroke-width:2.6; stroke-linecap:round; stroke-linejoin:round; }
        .bofutz-viewer-prev { left:12px; } .bofutz-viewer-next { right:12px; }
      `;
      document.head.appendChild(style);
    };

    const showViewerWithMultiImages = (imgList, initialIndex = 0) => {
      if (!imgList?.length) return;
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
          loop: isMulti,
          initialViewIndex: Math.min(initialIndex, imgList.length - 1),
          ready() {
            if (!isMulti) return;
            const root = viewer.viewer || document.querySelector(".viewer-container");
            if (!root) return;
            const mkBtn = (cls, label, svg, fn) => {
              const b = document.createElement("button");
              b.type = "button";
              b.className = `bofutz-viewer-nav ${cls}`;
              b.setAttribute("aria-label", label);
              b.innerHTML = svg;
              b.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                fn();
              };
              root.appendChild(b);
            };
            mkBtn("bofutz-viewer-prev", "上一张", '<svg viewBox="0 0 24 24"><polyline points="15 6 9 12 15 18"></polyline></svg>', () => viewer.prev(true));
            mkBtn("bofutz-viewer-next", "下一张", '<svg viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"></polyline></svg>', () => viewer.next(true));
          },
        });
        viewer.show();
      } else {
        window.open(imgList[initialIndex]?.url, "_blank");
      }
    };

    const viewableBoardItems = () => (processedData.value?.list || []).filter((r) => r && canViewChart(r.etf_code));

    const openDailyChartViewer = async (item) => {
      if (!canViewChart(item.etf_code)) return openGuestChartPrompt(item);
      const rows = viewableBoardItems();
      if (!rows.length) return store.showToast("暂无可查看的图表", "error");
      store.showToast("正在加载图库…");
      const dayLabel = formatDateCN(globalChartDay.value) || "";
      const candidates = [];
      for (const row of rows) {
        const code = normCode(row.etf_code);
        const name = formatEtfName(row.etf_name) || code;
        const entry = resolveChartEntry(code);
        const r2Daily = `${CONFIG.R2_CHART_BASE}/${code}_daily.png`;
        const r2Half = `${CONFIG.R2_CHART_BASE}/${code}_half_day.png`;
        candidates.push({ title: `${name} (${code}) ${dayLabel}日线`.trim(), url: entry?.url || r2Daily, code, kind: "daily" });
        candidates.push({ title: `${name} (${code}) ${dayLabel}半日线`.trim(), url: r2Half, code, kind: "half_day" });
      }
      const images = await probeImagesBatch(candidates, 12);
      if (!images.length) return store.showToast("暂无可用日线/半日线图表", "error");
      const clickCode = normCode(item.etf_code);
      let idx = images.findIndex((g) => g.code === clickCode && g.kind === "daily");
      if (idx < 0) idx = Math.max(0, images.findIndex((g) => g.code === clickCode));
      showViewerWithMultiImages(images, idx);
    };

    const openWeeklyChartViewer = async (item) => {
      if (!canViewChart(item.etf_code)) return openGuestChartPrompt(item);
      const rows = viewableBoardItems();
      if (!rows.length) return store.showToast("暂无可查看的图表", "error");
      store.showToast("正在加载图库…");
      const candidates = rows.map((row) => {
        const code = normCode(row.etf_code);
        const name = formatEtfName(row.etf_name) || code;
        const dLabel = formatDateCN(weeklyChartDay.value || globalChartDay.value || row.week_status_date) || "";
        return { title: `${name} (${code}) ${dLabel}周线`.trim(), url: `${CONFIG.R2_CHART_BASE}/${code}_weekly.png`, code };
      });
      const images = await probeImagesBatch(candidates, 12);
      if (!images.length) return store.showToast("暂无可用周线图表", "error");
      const clickCode = normCode(item.etf_code);
      const idx = Math.max(0, images.findIndex((g) => g.code === clickCode));
      showViewerWithMultiImages(images, idx);
    };

    const getColorClass = (status) => {
      if (!status || status === "-" || status === "--") return "text-slate-300";
      return status.includes("+") ? "text-red-500" : "text-emerald-500";
    };

    const initData = async () => {
      loading.value = true;
      try {
        const [data, chartsRes, sharedRes] = await Promise.all([
          etfApi.fetchEtfRawData().catch(() => []),
          etfApi.fetchChartsMap().catch(() => ({})),
          etfApi.fetchWatchlist().catch(() => ({ data: [] })),
        ]);
        if (store.state.isLoggedIn) await loadDashboardPrefs();
        if (Array.isArray(data)) allData.value = data;
        chartsMap.value = chartsRes.charts || chartsRes || {};
        sharedList.value = Array.isArray(sharedRes?.data ?? sharedRes) ? (sharedRes?.data ?? sharedRes) : [];

        globalChartDay.value = toBjDay(chartsRes?.chart_date) || latestTradingDayBj();
        const monday = resolveLatestClosedWeekMonday();
        if (monday) {
          const [y, m, d] = parseYMD(monday);
          const sat = new Date(y, m - 1, d + 5);
          weeklyChartDay.value = `${sat.getFullYear()}-${String(sat.getMonth() + 1).padStart(2, "0")}-${String(sat.getDate()).padStart(2, "0")}`;
        }
      } catch (err) {
        store.showToast(err.message, "error");
      } finally {
        loading.value = false;
        await scrollToLatestCol();
      }
    };

    onMounted(async () => {
      await initData();
      setTimeout(scrollToLatestCol, 150);
    });

    watch(
      () => store.state.isLoggedIn,
      async (v) => {
        if (v) await loadDashboardPrefs();
        else {
          favCodes.value = [];
          userOrder.value = [];
          mySponsoredCodes.value = [];
          if (quickFilter.value === "fav") quickFilter.value = "all";
        }
      }
    );

    return {
      loading,
      searchQuery,
      quickFilter,
      setQuickFilter,
      sortColumn,
      sortOrder,
      handleSort,
      processedData,
      visibleCols,
      showDailyChartIcon,
      formatDateCN,
      formatEtfName,
      isFavorite,
      toggleFavorite,
      copyCode,
      onDragStart,
      onDragOver,
      onDropRow,
      canCustomizeBoard,
      dragCode,
      formatDayCell,
      dataDateTitle,
      dailyChartTitle,
      weekDataTitle,
      weekChartTitle,
      cellPrimaryStatus,
      openDailyChartViewer,
      openWeeklyChartViewer,
      getColorClass,
      guestChartModal,
      openGuestChartPrompt,
      goAuthFromPrompt,
      tipEnabled,
      tipVisible,
      tipChannel,
      tipQuickAmounts,
      tipForm,
      tipSubmitting,
      formattedTipAmount,
      openTipModal,
      submitTipOrder,
      tableScrollEl,
      tipWechatSrc,
      tipAlipaySrc,
      settings,
      store: store.state,
    };
  },
  template: `
    <div class="max-w-7xl mx-auto space-y-3 select-none">
      <!-- 搜索框 + 快捷筛选栏（严格按：最新异动，我的收藏，T+0，会员赞助） -->
      <div class="flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center justify-between">
        <div class="flex flex-col sm:flex-row gap-2 flex-1">
          <div class="bg-white rounded-xl shadow-sm border border-slate-100 flex items-center flex-1">
            <i class="fa-solid fa-magnifying-glass text-slate-400 pl-3.5 text-xs sm:text-sm"></i>
            <input v-model="searchQuery" type="search" placeholder="搜索代码 / 名称 / 赞助昵称 / (0)..."
                   class="w-full bg-transparent border-none outline-none text-xs sm:text-sm py-2.5 px-2.5">
            <button v-if="searchQuery" @click="searchQuery=''" class="text-slate-300 hover:text-slate-500 pr-3">
              <i class="fa-solid fa-circle-xmark text-xs"></i>
            </button>
          </div>

          <!-- 快捷过滤胶囊：最新异动 → 我的收藏 → T+0 → 会员赞助（再次点击可回到全部） -->
          <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 shrink-0">
            <button type="button" @click="setQuickFilter('active')"
                    class="px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition"
                    :class="quickFilter==='active' ? 'bg-rose-500 text-white border-transparent shadow-sm' : 'bg-white text-rose-600 border-rose-100 hover:bg-rose-50/50'">
              🔥 最新异动 ({{ processedData.stats?.activeTodayCount || 0 }})
            </button>
            <button type="button" @click="setQuickFilter('fav')"
                    class="px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition"
                    :class="quickFilter==='fav' ? 'bg-amber-400 text-slate-900 border-transparent shadow-sm' : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50'">
              ★ 我的收藏 ({{ processedData.stats?.favCount || 0 }})
            </button>
            <button type="button" @click="setQuickFilter('t0')"
                    class="px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition"
                    :class="quickFilter==='t0' ? 'bg-indigo-600 text-white border-transparent shadow-sm' : 'bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50/50'">
              ⚡ T+0 ({{ processedData.stats?.t0Count || 0 }})
            </button>
            <button type="button" @click="setQuickFilter('sponsored')"
                    class="px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition"
                    :class="quickFilter==='sponsored' ? 'bg-amber-500 text-white border-transparent shadow-sm' : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50/50'">
              ❤️ 会员赞助 ({{ processedData.stats?.sponsoredCount || 0 }})
            </button>
            <button v-if="quickFilter !== 'all'" type="button" @click="quickFilter='all'"
                    class="px-2 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                    title="显示全部标的">
              全部 ({{ processedData.stats?.totalCount || 0 }})
            </button>
          </div>
        </div>

        <div v-if="!store.isLoggedIn"
             class="bg-gradient-to-r from-[#4da6a0]/15 to-emerald-50 border border-[#4da6a0]/30 rounded-xl px-3 py-2 flex items-center justify-between gap-2 shrink-0">
          <span class="text-xs text-slate-700">
            <i class="fa-solid fa-unlock-keyhole theme-text mr-1"></i>
            <strong>免费注册</strong>解锁全部标的图表
          </span>
          <button type="button" @click="goAuthFromPrompt('register')"
                  class="theme-bg text-white text-xs font-bold px-3 py-1 rounded-lg shadow-sm hover:opacity-90 shrink-0">
            立即注册
          </button>
        </div>
      </div>

      <div v-if="loading" class="text-center py-12 text-slate-400">
        <i class="fa-solid fa-spinner animate-spin text-2xl theme-text"></i>
        <p class="mt-2 text-sm">正在同步云端波幅监控数据...</p>
      </div>

      <template v-else>
        <div v-if="!processedData.list.length" class="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-100">
          <i class="fa-solid fa-folder-open text-3xl mb-2 opacity-40"></i>
          <p class="text-sm">当前筛选条件下暂无相关行情数据</p>
          <button v-if="quickFilter!=='all' || searchQuery" @click="quickFilter='all'; searchQuery=''"
                  class="mt-3 text-xs theme-text font-bold hover:underline">
            重置筛选条件
          </button>
        </div>

        <div v-else class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div ref="tableScrollEl" class="overflow-x-auto custom-scrollbar dash-table-scroll">
            <table class="text-center border-collapse whitespace-nowrap w-full dash-board-table">
              <thead class="bg-slate-50 border-b border-slate-100">
                <tr class="text-xs text-slate-600 font-bold select-none">
                  <th class="py-2.5 sm:py-3 px-2 sm:px-3.5 text-left etf-name-column dash-col-name sticky top-0 left-0 bg-slate-50 z-40 cursor-pointer hover:bg-slate-100 transition-colors border-b border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
                      @click="handleSort('etf_name')">
                    标的名称 / 代码
                    <i v-if="sortColumn==='etf_name'" class="fa-solid text-[10px] ml-1" :class="sortOrder==='asc'?'fa-arrow-up':'fa-arrow-down'"></i>
                  </th>
                  <th v-for="col in visibleCols" :key="col.key"
                      class="py-2.5 sm:py-3 px-1 sm:px-2 sticky top-0 bg-slate-50 z-30 cursor-pointer hover:bg-slate-100 transition-colors border-b border-slate-200"
                      :class="col.type==='week' ? 'dash-col-week' : 'dash-col-day'"
                      @click="handleSort(col.type==='week' ? 'week_status' : col.key)">
                    <div>{{ col.label }}</div>
                    <div v-if="col.type==='day' && processedData.weekDays[col.dayIdx]" class="text-[9px] font-normal text-slate-400 font-mono leading-none mt-0.5">
                      {{ processedData.weekDays[col.dayIdx].slice(5) }}
                    </div>
                    <i v-if="sortColumn===(col.type==='week'?'week_status':col.key) || (!sortColumn && processedData.latestColKey===col.key)"
                       class="fa-solid text-[10px] ml-0.5"
                       :class="sortColumn===(col.type==='week'?'week_status':col.key) && sortOrder==='asc' ? 'fa-arrow-up' : 'fa-arrow-down'"></i>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50 text-sm">
                <tr v-for="item in processedData.list" :key="item.etf_code"
                    class="hover:bg-[#4da6a0]/5 transition-colors group"
                    :class="{ 'opacity-60': dragCode === item.etf_code, 'bg-amber-50/20': item.is_my_sponsor }"
                    :draggable="canCustomizeBoard ? true : false"
                    @dragstart="onDragStart(item, $event)"
                    @dragover="onDragOver($event)"
                    @drop="onDropRow(item, $event)">
                  <td class="p-1.5 sm:p-2.5 text-left relative sticky left-0 bg-white group-hover:bg-[#f6faf9] z-10 etf-name-column dash-col-name border-r border-slate-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                    <div v-if="item.is_my_sponsor" class="absolute left-0 top-0 bottom-0 w-1 bg-rose-500" title="您赞助的标的（已为您默认置顶）"></div>
                    <div v-else-if="processedData.freeTop3Codes.includes(item.etf_code)" class="absolute left-0 top-0 bottom-0 w-1 theme-bg"></div>

                    <div class="flex items-start gap-1 min-w-0">
                      <button type="button"
                              class="mt-0.5 shrink-0 p-0.5 leading-none"
                              :title="canCustomizeBoard ? (isFavorite(item.etf_code) ? '取消收藏' : '收藏') : '注册登录后可收藏'"
                              @click="toggleFavorite(item, $event)">
                        <i class="fa-solid fa-star text-xs sm:text-sm"
                           :class="isFavorite(item.etf_code) ? 'text-amber-400' : 'text-slate-300'"></i>
                      </button>

                      <div class="min-w-0 flex-1 overflow-hidden">
                        <!-- 第一行：标的名称 + 免费/置顶标识 -->
                        <div class="font-bold text-slate-800 group-hover:theme-text flex items-center gap-1 flex-nowrap">
                          <span v-if="canCustomizeBoard" class="hidden sm:inline text-slate-300 text-[10px] cursor-grab active:cursor-grabbing select-none shrink-0" title="拖动排序">⋮⋮</span>
                          <span class="truncate text-[12px] sm:text-sm leading-tight" :title="formatEtfName(item.etf_name)">{{ formatEtfName(item.etf_name) }}</span>
                          <span v-if="item.is_my_sponsor" class="text-[9px] bg-rose-100 text-rose-600 px-1 py-0.2 rounded font-bold shrink-0">我的赞助</span>
                          <span v-else-if="processedData.freeTop3Codes.includes(item.etf_code)" class="text-[9px] bg-orange-100 text-orange-600 px-1 py-0.2 rounded font-bold shrink-0">免费</span>
                        </div>

                        <!-- 第二行：股票代码 + T+0标示(0)（非T+0不写）+ 赞助者昵称徽章 -->
                        <div class="flex items-center gap-1 mt-0.5 flex-wrap">
                          <span class="text-[11px] text-slate-500 font-mono cursor-pointer hover:theme-text"
                                title="点击复制标的代码"
                                @click="copyCode(item.etf_code, $event)">{{ item.etf_code }}<span v-if="item.trade_rule === 't+0'" class="text-indigo-600 font-bold" title="支持 T+0 日内回转交易">(0)</span></span>

                          <span v-if="item.resolved_sponsor_name"
                                class="inline-flex items-center gap-0.5 text-[10px] bg-amber-50 text-amber-800 border border-amber-200/90 px-1.5 py-0.2 rounded font-bold max-w-[110px] sm:max-w-[140px] truncate"
                                :title="'感谢会员【' + item.resolved_sponsor_name + '】赞助监控该标的，全体用户免费共享'">
                            <i class="fa-solid fa-heart text-[8px] text-rose-500 shrink-0"></i>
                            <span class="truncate">{{ item.resolved_sponsor_name }} 赞助</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>

                  <td v-for="col in visibleCols" :key="col.key"
                      class="p-1 sm:p-2.5 font-medium"
                      :class="[
                        col.type==='week' ? 'dash-col-week' : 'dash-col-day',
                        getColorClass(col.type==='week' ? item.week_status : cellPrimaryStatus(item.days[col.dayIdx]))
                      ]">
                    <template v-if="col.type==='day'">
                      <div class="dash-cell-inner flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1"
                           :title="dataDateTitle(processedData.weekDays[col.dayIdx])">
                        <span class="text-[10px] sm:text-sm font-mono tracking-tight leading-tight">{{ formatDayCell(item.days[col.dayIdx]) }}</span>
                        <i v-if="showDailyChartIcon(item.etf_code, col.dayIdx)"
                           class="fa-regular fa-image text-slate-400 hover:text-blue-500 cursor-pointer text-xs sm:text-xs shrink-0 p-0.5"
                           :title="dailyChartTitle(item.etf_code, processedData.weekDays[col.dayIdx])"
                           @click.stop="openDailyChartViewer(item)"></i>
                      </div>
                    </template>
                    <template v-else>
                      <div class="dash-cell-inner flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1" :title="weekDataTitle(item)">
                        <span class="text-[10px] sm:text-sm font-mono leading-tight">{{ item.week_status || '-' }}</span>
                        <i class="fa-regular fa-image text-slate-400 hover:text-blue-500 cursor-pointer text-xs sm:text-xs shrink-0 p-0.5"
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

        <p class="text-[11px] text-slate-400 text-center leading-relaxed px-2">
          格式：上午/下午|日线；T+0 标的代码后标注 <strong>(0)</strong>。默认排序：赞助会员为「赞助标的 → 收藏 → TOP3 → 其它」，非赞助会员为「收藏 → TOP3 → 其它」。
        </p>

        <!-- 看板底部：温暖打赏卡片 -->
        <div v-if="tipEnabled"
             class="bg-gradient-to-br from-white via-amber-50/40 to-teal-50/30 rounded-2xl border border-amber-200/80 p-4 sm:p-6 shadow-sm">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="space-y-1.5">
              <div class="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-full">
                <i class="fa-solid fa-mug-hot text-amber-600"></i> 温暖打赏 · 共建免费监控工具
              </div>
              <h3 class="text-sm sm:text-lg font-bold text-slate-800">
                {{ settings.tip_note || '觉得波幅探长对您有帮助？请作者喝杯咖啡吧' }}
              </h3>
              <p class="text-xs text-slate-500 leading-relaxed">
                本站注册即可免费查看全量数据与图表。您可以输入任意金额打赏支持服务器与算力维护。
              </p>
            </div>

            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              <div class="flex items-center justify-center gap-1.5">
                <button v-for="amt in [6.66, 18.88, 66]" :key="amt" type="button"
                        @click="openTipModal(amt)"
                        class="flex-1 sm:flex-initial px-3 py-2 rounded-xl border border-amber-200 bg-white hover:bg-amber-50 text-xs font-bold text-amber-700 transition shadow-sm">
                  ¥{{ amt }}
                </button>
              </div>
              <button type="button" @click="openTipModal()"
                      class="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-md transition flex items-center justify-center gap-1.5">
                <i class="fa-solid fa-heart"></i>
                <span>输入金额打赏</span>
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- 未登录引导弹窗 -->
      <div v-if="guestChartModal.visible"
           class="fixed inset-0 modal-overlay z-[110] flex items-center justify-center p-4"
           @click.self="guestChartModal.visible = false">
        <div class="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative">
          <button type="button" @click="guestChartModal.visible = false"
                  class="absolute top-3 right-3 w-8 h-8 rounded-full text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center">
            <i class="fa-solid fa-xmark"></i>
          </button>
          <div class="bg-gradient-to-r from-[#4da6a0] to-teal-600 px-6 py-5 text-white text-center space-y-1.5">
            <div class="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-2">
              <i class="fa-solid fa-chart-line text-2xl text-white"></i>
            </div>
            <h3 class="text-lg font-extrabold tracking-wide">注册即可免费查看全部图表</h3>
            <p v-if="guestChartModal.etfName" class="text-xs text-white/90 font-medium">
              当前点击标的：{{ guestChartModal.etfName }} ({{ guestChartModal.etfCode }})
            </p>
          </div>
          <div class="p-6 space-y-4">
            <div class="bg-slate-50 rounded-xl p-4 space-y-2.5 text-xs text-slate-600 border border-slate-100">
              <div class="flex items-start gap-2.5">
                <i class="fa-solid fa-circle-check text-emerald-500 mt-0.5"></i>
                <span><strong>全量多周期图表免费看：</strong>注册登录即可免费查看所有标的的<strong>半日线、日线、周线</strong>趋势大图。</span>
              </div>
              <div class="flex items-start gap-2.5">
                <i class="fa-solid fa-circle-check text-emerald-500 mt-0.5"></i>
                <span><strong>赞助置顶与自选排序：</strong>赞助会员本人赞助的标的默认置顶，支持星标收藏与拖拽排序。</span>
              </div>
            </div>
            <div class="space-y-2">
              <button type="button" @click="goAuthFromPrompt('register')"
                      class="w-full theme-bg text-white font-bold py-3 rounded-xl text-sm shadow-md hover:opacity-95 transition">
                立即免费注册（30秒完成）
              </button>
              <button type="button" @click="goAuthFromPrompt('login')"
                      class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition">
                已有账号？直接登录
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 打赏弹窗 -->
      <div v-if="tipVisible"
           class="fixed inset-0 modal-overlay z-[110] flex items-center justify-center p-4"
           @click.self="tipVisible = false">
        <div class="bg-white rounded-2xl w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div class="flex items-center gap-2">
              <span class="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                <i class="fa-solid fa-mug-hot"></i>
              </span>
              <div>
                <h3 class="font-bold text-slate-800 text-base">打赏支持</h3>
                <p class="text-[11px] text-slate-400">金额随心输入 · 感谢您支持波幅探长</p>
              </div>
            </div>
            <button type="button" @click="tipVisible = false" class="text-slate-400 hover:text-slate-600">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="space-y-2">
            <label class="text-xs font-bold text-slate-600 block">输入打赏金额（元）或点击快捷金额</label>
            <div class="relative flex items-center">
              <span class="absolute left-3.5 text-lg font-bold text-slate-400">¥</span>
              <input v-model="tipForm.amount" type="number" step="0.01" min="0.01" placeholder="输入打赏金额"
                     class="w-full border-2 border-amber-300 focus:border-amber-500 rounded-xl pl-8 pr-4 py-2 text-lg font-extrabold font-mono text-slate-800 outline-none">
            </div>
            <div class="flex flex-wrap gap-1.5 pt-1">
              <button v-for="q in tipQuickAmounts" :key="q" type="button"
                      @click="tipForm.amount = q.toFixed(2)"
                      class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition"
                      :class="Number(tipForm.amount) === q ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-50 text-slate-600 border-slate-200'">
                ¥{{ q }}
              </button>
            </div>
          </div>

          <div class="bg-amber-50/70 border border-amber-100 rounded-xl py-2.5 px-4 text-center">
            <div class="text-[11px] text-amber-700">当前打赏金额</div>
            <div class="text-2xl sm:text-3xl font-extrabold text-red-500 font-mono">¥ {{ formattedTipAmount }}</div>
          </div>

          <div class="flex justify-center gap-2" v-if="tipWechatSrc || tipAlipaySrc">
            <button type="button" v-if="tipWechatSrc" @click="tipChannel='wechat'"
                    class="px-4 py-1.5 rounded-full text-xs font-bold border transition"
                    :class="tipChannel==='wechat' ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600 border-slate-200'">
              <i class="fa-brands fa-weixin mr-1"></i>微信支付
            </button>
            <button type="button" v-if="tipAlipaySrc" @click="tipChannel='alipay'"
                    class="px-4 py-1.5 rounded-full text-xs font-bold border transition"
                    :class="tipChannel==='alipay' ? 'theme-bg text-white border-transparent' : 'bg-white text-slate-600 border-slate-200'">
              <i class="fa-brands fa-alipay mr-1"></i>支付宝
            </button>
          </div>

          <div class="flex justify-center">
            <div v-if="tipChannel==='wechat' && tipWechatSrc" class="space-y-1 text-center">
              <img :src="tipWechatSrc" class="w-40 h-40 sm:w-44 sm:h-44 object-contain border rounded-xl mx-auto p-1 bg-white shadow-sm" alt="微信收款码">
              <div class="text-[11px] text-slate-500">请使用微信扫码并输入 <strong>¥{{ formattedTipAmount }}</strong></div>
            </div>
            <div v-else-if="tipChannel==='alipay' && tipAlipaySrc" class="space-y-1 text-center">
              <img :src="tipAlipaySrc" class="w-40 h-40 sm:w-44 sm:h-44 object-contain border rounded-xl mx-auto p-1 bg-white shadow-sm" alt="支付宝收款码">
              <div class="text-[11px] text-slate-500">请使用支付宝扫码并输入 <strong>¥{{ formattedTipAmount }}</strong></div>
            </div>
            <p v-else class="text-xs text-slate-400 py-6">管理员尚未在后台配置收款码图片</p>
          </div>

          <div class="space-y-2 pt-1 border-t border-slate-100">
            <input v-model="tipForm.note" type="text" maxlength="60" placeholder="给作者留句话吧（选填）"
                   class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:theme-border outline-none">
            <input v-model="tipForm.txId" type="text" maxlength="6" placeholder="支付单号后 6 位（选填，便于核对致谢）"
                   class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:theme-border outline-none">
          </div>

          <div class="flex justify-end gap-2 pt-1">
            <button type="button" @click="tipVisible = false" class="px-4 py-2 text-xs text-slate-500">关闭</button>
            <button type="button" @click="submitTipOrder" :disabled="tipSubmitting"
                    class="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-sm disabled:opacity-50">
              {{ tipSubmitting ? '提交中...' : '我已完成打赏' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
};
