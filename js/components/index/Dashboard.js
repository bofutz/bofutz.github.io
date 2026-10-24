/**
 * 波幅探长 - 首页数据看板 (js/components/index/Dashboard.js)
 * 严格保留与修复：
 * 1. “赞助”全部改为“定制”，“会员赞助”改为“定制分享”，彻底移除股票代码后的赞助署名及点赞功能
 * 2. 标的排序规则：
 *    - 定制标的的会员：定制标的 -> 收藏 -> 最近异动 -> 其它
 *    - 非定制标的用户：收藏 -> 最近异动 -> 分享的定制标的 -> 其它
 *    - 组内严格按最右列（最新采集数据）数值绝对值从大到小排列，先日线数据，再半日线数据
 * 3. 免费标的：由后台设定（free_top_n_charts）控制，按最新列波幅取前 N 名
 * 4. 共有6列（周一至周五5列 + 周六周线1列），最新数据列永远放在最右列，有新日期数据所有列正序前移循环轮换
 * 5. 修复图表 ICON 挂在昨天的问题：严格根据图表实际更新日期（或最新采集日）绑定到对应列
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
  { key: "week", type: "week", dayIdx: 5, label: "周六(周线)" },
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
    const sharedCustomMap = ref({});
    const myCustomCodes = ref([]);

    const favCodes = ref([]);
    const userOrder = ref([]);
    const dragCode = ref(null);
    const prefsSaving = ref(false);

    const searchQuery = ref("");
    const quickFilter = ref("all");
    const sortColumn = ref(null);
    const sortOrder = ref("desc");

    const settings = computed(() => store.state.publicSettings || {});

    const promoBanner = computed(() => {
      const s = settings.value;
      const enabled = s.ad_enabled === "1" || s.ad_enabled === 1 || s.ad_enabled === true;
      const text = String(s.ad_content || s.ad_title || "").trim();
      const link = String(s.ad_link_url || "").trim();
      return { visible: enabled && !!text, text, link };
    });

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
    const normCode = (c) => String(c || "").replace(/\D/g, "").slice(-6);
    const isBlankStatus = (s) => !s || s === "-" || s === "--" || s === "None" || s === "null";

    const parseStatusParts = (raw) => {
      if (isBlankStatus(raw)) return { text: "-", dir: 0 };
      const s = String(raw).trim().replace(/△/g, "▲").replace(/▽/g, "▼");
      let dir = 0;
      if (s.includes("▲") || s.includes("+")) dir = 1;
      else if (s.includes("▼") || (s.includes("-") && s !== "-")) dir = -1;
      else {
        const num = parseFloat(s);
        if (!isNaN(num) && num !== 0) dir = num > 0 ? 1 : -1;
      }
      return { text: s, dir };
    };

    const getDayCellSegments = (item) => {
      if (!item) return null;
      const amRaw = item.am_status && item.am_status !== "--" ? item.am_status : "-";
      const pmRaw = item.pm_status && item.pm_status !== "--" ? item.pm_status : "-";
      const dayRaw = item.day_status && item.day_status !== "--" ? item.day_status : "-";
      if (amRaw === "-" && pmRaw === "-" && dayRaw === "-") return null;
      return {
        am: parseStatusParts(amRaw),
        pm: parseStatusParts(pmRaw),
        day: parseStatusParts(dayRaw),
      };
    };

    const getWeekCellSegment = (weekStatus) => {
      if (isBlankStatus(weekStatus)) return null;
      return parseStatusParts(weekStatus);
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
    const dailyChartTitle = (etfCode, colDate) => chartDateTitle(colDate || globalChartDay.value);
    const weekChartTitle = () =>
      weeklyChartDay.value && isValidDate(weeklyChartDay.value) ? chartDateTitle(weeklyChartDay.value) : "周线图表";

    const getWeekDays = (dateStr) => {
      const [y, m, d] = parseYMD(dateStr);
      if (!y) return [];
      const day = new Date(y, m - 1, d).getDay();
      const offset = day === 0 ? -6 : 1 - day;
      const monday = new Date(y, m - 1, d + offset);
      return Array.from({ length: 6 }, (_, i) => {
        const t = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
        return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
      });
    };

    const getStatusVal = (str) => {
      if (!str || typeof str !== "string" || str === "-" || str === "--") return -9999;
      const match = str.match(/[-+]?[0-9]*\.?[0-9]+/);
      if (match) return parseFloat(match[0]);
      if (str.includes("▲") || str.includes("△")) return 0.001;
      if (str.includes("▼") || str.includes("▽")) return -0.001;
      return -9999;
    };

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
      if (typeof val === "string" && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(val.trim())) {
        const parts = val.trim().split(/[-/]/);
        return `${parts[0]}-${String(parts[1]).padStart(2, "0")}-${String(parts[2]).padStart(2, "0")}`;
      }
      let ts = Number(val);
      if (!ts || isNaN(ts)) {
        const parsed = Date.parse(String(val));
        if (isNaN(parsed)) return null;
        ts = parsed;
      } else if (ts < 1e12) ts *= 1000;
      return bjYmd(ts);
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

    /**
     * 【关键修复】图表 ICON 显示逻辑：
     * 1. 如果标的有独立的 updated_at，且落在某一列日期，显示在该列；
     * 2. 否则如果系统配置了 globalChartDay，显示在该日期的列；
     * 3. 兜底保护：只要最新交易日（如10-23）已有日线/半日线数据且该标的有数据，图表直接呈现在最新日线列，绝不错留在昨天！
     */
    const showDailyChartIcon = (etfCode, colDayIdx) => {
      if (colDayIdx < 0 || colDayIdx > 4) return false;
      const pd = processedData.value;
      if (!pd) return false;
      const colDate = pd.weekDays[colDayIdx];
      if (!colDate) return false;

      const entry = resolveChartEntry(etfCode);
      const entryDay = entry?.updated_at ? toBjDay(entry.updated_at) : null;
      const gDay = globalChartDay.value && isValidDate(globalChartDay.value) ? toBjDay(globalChartDay.value) : "";

      // 明确有时间戳的情况
      if (entryDay && pd.weekDays.includes(entryDay)) {
        return entryDay === colDate;
      }
      if (gDay && pd.weekDays.includes(gDay)) {
        return gDay === colDate;
      }

      // 如果后端图表接口时间未带或为当天，直接绑定到最新的日线列
      const latestDailyIdx = pd.latestDailyIdx;
      return colDayIdx === latestDailyIdx;
    };

    const weekdayIndexFromDate = (dateStr) => {
      if (!isValidDate(dateStr)) return -1;
      const wd = new Date(dateStr.trim() + "T12:00:00+08:00").getDay();
      if (wd === 0) return -1;
      if (wd === 6) return 5;
      return wd - 1;
    };

    const isCustomByCurrentUser = (row) => {
      if (!store.state.isLoggedIn || !row) return false;
      const code = normCode(row.etf_code);
      if (myCustomCodes.value.includes(code)) return true;
      return !!row.is_my_custom;
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
      let maxDailyDate = "";
      let maxWeekDate = "";
      allData.value.forEach((item) => {
        if (!item?.date || !isValidDate(item.date)) return;
        const d = item.date.trim();
        if (!isBlankStatus(item.day_status) || !isBlankStatus(item.am_status) || !isBlankStatus(item.pm_status)) {
          if (d > maxDailyDate) maxDailyDate = d;
        }
        if (!isBlankStatus(item.week_status)) {
          if (d > maxWeekDate) maxWeekDate = d;
        }
      });

      // 确定最新采集日期
      let latestColIdx = 4;
      let latestDate = maxDailyDate || maxWeekDate || bjYmd(Date.now());
      if (maxWeekDate && maxWeekDate >= maxDailyDate) {
        const wd = new Date(maxWeekDate + "T12:00:00+08:00").getDay();
        if (wd === 6 || wd === 0 || maxWeekDate > maxDailyDate) {
          latestColIdx = 5;
          latestDate = maxWeekDate;
        } else {
          latestColIdx = weekdayIndexFromDate(maxDailyDate);
        }
      } else if (maxDailyDate) {
        const idx = weekdayIndexFromDate(maxDailyDate);
        latestColIdx = idx >= 0 ? idx : 4;
      }

      // 获取当前周的日期序列（周一到周六）
      const weekDays = getWeekDays(latestDate);

      // 计算日线最新那一列的索引（0~4），供图表图标精准匹配
      let latestDailyIdx = 4;
      if (maxDailyDate) {
        const dIdx = weekDays.indexOf(maxDailyDate);
        if (dIdx >= 0 && dIdx <= 4) latestDailyIdx = dIdx;
      }

      const defaultOrderMap = new Map();
      let sharedSeq = 0;
      (sharedList.value || []).forEach((s) => {
        const c = normCode(s.etf_code || s.code);
        if (!c || defaultOrderMap.has(c)) return;
        const baseWeight = s.source === "custom" || s.source === "sponsor" ? 100000 : 0;
        defaultOrderMap.set(c, baseWeight + sharedSeq++);
      });

      const etfMap = {};
      const ensureRow = (code, name, extra = null) => {
        const spInfo = (sharedCustomMap.value || {})[code];
        if (!etfMap[code]) {
          etfMap[code] = {
            etf_code: code,
            etf_name: name || extra?.etf_name || spInfo?.etf_name || code,
            days: [null, null, null, null, null],
            week_status: null,
            week_status_date: null,
            custom_id: extra?.custom_id || spInfo?.id || null,
            is_my_custom: !!extra?.is_my_custom || myCustomCodes.value.includes(code),
            is_shared_custom: !!extra?.is_shared_custom || !!spInfo,
            trade_mode: extra?.trade_mode || spInfo?.trade_mode || "auto",
            source: extra?.source || "default",
            default_rank: defaultOrderMap.has(code) ? defaultOrderMap.get(code) : 999999,
          };
        } else {
          if (name && (!etfMap[code].etf_name || etfMap[code].etf_name === code)) {
            etfMap[code].etf_name = name;
          }
          if (extra?.custom_id || spInfo?.id) {
            etfMap[code].custom_id = extra?.custom_id || spInfo?.id;
          }
          if (extra?.is_my_custom || myCustomCodes.value.includes(code)) {
            etfMap[code].is_my_custom = true;
          }
          if (extra?.is_shared_custom || spInfo) {
            etfMap[code].is_shared_custom = true;
          }
          if (extra?.trade_mode && extra.trade_mode !== "auto") {
            etfMap[code].trade_mode = extra.trade_mode;
          }
          if (extra?.source === "custom" || extra?.source === "sponsor") {
            etfMap[code].source = "custom";
          }
          if (defaultOrderMap.has(code)) {
            etfMap[code].default_rank = defaultOrderMap.get(code);
          }
        }
        return etfMap[code];
      };

      (sharedList.value || []).forEach((s) => {
        const code = normCode(s.etf_code || s.code);
        if (code.length === 6) ensureRow(code, s.etf_name || s.name || code, s);
      });

      allData.value.forEach((item) => {
        if (!item?.date || !isValidDate(item.date)) return;
        const code = normCode(item.etf_code);
        if (!code) return;
        const row = ensureRow(code, item.etf_name);
        const itemIdx = weekDays.indexOf(item.date.trim());
        if (itemIdx >= 0 && itemIdx <= 4) {
          row.days[itemIdx] = item;
        }
        if (!isBlankStatus(item.week_status)) {
          if (!row.week_status_date || item.date >= row.week_status_date) {
            row.week_status = item.week_status;
            row.week_status_date = item.date;
          }
        }
      });

      Object.values(etfMap).forEach((row) => {
        row.trade_rule = resolveTradeRule(row.etf_code, row.etf_name, row.trade_mode);
        row.is_my_custom = isCustomByCurrentUser(row);
      });

      let items = Object.values(etfMap);

      const absDayVal = (row, idx) => {
        const s = row.days?.[idx]?.day_status;
        if (isBlankStatus(s)) return -9999;
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
        if (isBlankStatus(s)) return -9999;
        const v = getStatusVal(s);
        return v === -9999 ? -9999 : Math.abs(v);
      };

      const cmpDefaultWatchlistOrder = (a, b) => {
        const ra = a.default_rank ?? 999999;
        const rb = b.default_rank ?? 999999;
        if (ra !== rb) return ra - rb;
        return String(a.etf_code || "").localeCompare(String(b.etf_code || ""));
      };

      const cmpDayColumnStrict = (a, b, idx, isDesc = true) => {
        const da = absDayVal(a, idx);
        const db = absDayVal(b, idx);
        if (da !== db) {
          if (da === -9999) return 1;
          if (db === -9999) return -1;
          return isDesc ? db - da : da - db;
        }
        const ha = absHalfVal(a, idx);
        const hb = absHalfVal(b, idx);
        if (ha !== hb) {
          if (ha === -9999) return 1;
          if (hb === -9999) return -1;
          return isDesc ? hb - ha : ha - hb;
        }
        return cmpDefaultWatchlistOrder(a, b);
      };

      const cmpWeekColumnStrict = (a, b, isDesc = true) => {
        const wa = absWeekVal(a);
        const wb = absWeekVal(b);
        if (wa !== wb) {
          if (wa === -9999) return 1;
          if (wb === -9999) return -1;
          return isDesc ? wb - wa : wa - wb;
        }
        return cmpDefaultWatchlistOrder(a, b);
      };

      // 6列循环轮播前移：以最新采集列为最右列 (下标 5)
      const displayCols = Array.from({ length: 6 }, (_, i) => {
        const colIdx = (latestColIdx + 1 + i) % 6;
        return BASE_COLS[colIdx];
      });
      const latestCol = displayCols[5];

      const cmpLatestColActiveRank = (a, b) => {
        if (latestCol.type === "week") {
          return cmpWeekColumnStrict(a, b, true);
        } else {
          return cmpDayColumnStrict(a, b, latestCol.dayIdx, true);
        }
      };

      const isLatestActive = (row) => {
        if (latestCol.type === "week") {
          return absWeekVal(row) > -9999;
        } else {
          return absDayVal(row, latestCol.dayIdx) > -9999 || absHalfVal(row, latestCol.dayIdx) > -9999;
        }
      };

      const favSet = new Set(store.state.isLoggedIn ? (favCodes.value || []).map(String) : []);
      const isCustomMember =
        store.state.isLoggedIn &&
        (myCustomCodes.value.length > 0 || items.some((i) => i.is_my_custom));

      const groupOf = (row) => {
        const c = String(row.etf_code);
        if (isCustomMember) {
          if (row.is_my_custom) return 0;
          if (favSet.has(c)) return 1;
          if (isLatestActive(row)) return 2;
          return 3;
        } else {
          if (store.state.isLoggedIn && favSet.has(c)) return 0;
          if (isLatestActive(row)) return 1;
          if (row.is_shared_custom) return 2;
          return 3;
        }
      };

      if (sortColumn.value) {
        items.sort((a, b) => {
          if (sortColumn.value === "etf_name") {
            const cmp = (a.etf_name || "").localeCompare(b.etf_name || "", "zh-CN");
            return sortOrder.value === "asc" ? cmp : -cmp;
          }
          if (sortColumn.value.startsWith("d")) {
            const idx = parseInt(sortColumn.value.substring(1), 10);
            return cmpDayColumnStrict(a, b, idx, sortOrder.value !== "asc");
          }
          if (sortColumn.value === "week_status") {
            return cmpWeekColumnStrict(a, b, sortOrder.value !== "asc");
          }
          return cmpLatestColActiveRank(a, b);
        });
      } else {
        items.sort((a, b) => {
          const ga = groupOf(a);
          const gb = groupOf(b);
          if (ga !== gb) return ga - gb;
          const ampCmp = cmpLatestColActiveRank(a, b);
          if (ampCmp !== 0) return ampCmp;
          return cmpDefaultWatchlistOrder(a, b);
        });
      }

      const freeTopN = Math.max(1, parseInt(settings.value.free_top_n_charts, 10) || 3);
      const freeTopCodes = [...items]
        .filter((i) => isLatestActive(i))
        .sort(cmpLatestColActiveRank)
        .slice(0, freeTopN)
        .map((i) => i.etf_code);

      const totalCount = items.length;
      const t0Count = items.filter((i) => i.trade_rule === "t+0").length;
      const sharedCustomCount = items.filter((i) => i.is_shared_custom).length;
      const favCount = items.filter((i) => favSet.has(String(i.etf_code))).length;
      const activeTodayCount = items.filter((i) => isLatestActive(i)).length;

      if (quickFilter.value === "active") {
        items = items.filter((i) => isLatestActive(i));
      } else if (quickFilter.value === "fav") {
        items = items.filter((i) => favSet.has(String(i.etf_code)));
      } else if (quickFilter.value === "t0") {
        items = items.filter((i) => i.trade_rule === "t+0");
      } else if (quickFilter.value === "shared_custom") {
        items = items.filter((i) => i.is_shared_custom);
      }

      if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase().trim();
        items = items.filter(
          (i) =>
            (i.etf_name && i.etf_name.toLowerCase().includes(q)) ||
            (i.etf_code && i.etf_code.toLowerCase().includes(q)) ||
            (i.trade_rule === "t+0" && (q.includes("t+0") || q.includes("t0")))
        );
      }

      return {
        list: items,
        freeTopCodes,
        weekDays,
        latestDailyIdx,
        displayCols,
        latestColKey: latestCol.key,
        stats: { totalCount, t0Count, sharedCustomCount, favCount, activeTodayCount },
      };
    });

    const visibleCols = computed(() => processedData.value?.displayCols || BASE_COLS);
    const canViewChart = (etfCode) => store.state.isLoggedIn || processedData.value.freeTopCodes.includes(etfCode);
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
        myCustomCodes.value = [];
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
        const myActive = (mineRes?.data || []).filter(
          (r) => r.status === "active" && Number(r.expire_at) > now
        );
        myCustomCodes.value = myActive.map((r) => normCode(r.etf_code)).filter(Boolean);
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

    const openDailyChartViewer = async (item, colDate = "") => {
      if (!canViewChart(item.etf_code)) return openGuestChartPrompt(item);
      const rows = viewableBoardItems();
      if (!rows.length) return store.showToast("暂无可查看的图表", "error");
      store.showToast("正在加载图库…");
      const dayLabel = formatDateCN(colDate) || "";
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
        const dLabel = formatDateCN(row.week_status_date || weeklyChartDay.value || globalChartDay.value) || "";
        return { title: `${name} (${code}) ${dLabel}周线`.trim(), url: `${CONFIG.R2_CHART_BASE}/${code}_weekly.png`, code };
      });
      const images = await probeImagesBatch(candidates, 12);
      if (!images.length) return store.showToast("暂无可用周线图表", "error");
      const clickCode = normCode(item.etf_code);
      const idx = Math.max(0, images.findIndex((g) => g.code === clickCode));
      showViewerWithMultiImages(images, idx);
    };

    const getPartColorClass = (part) => {
      if (!part || part.text === "-") return "text-slate-300";
      if (part.dir > 0) return "text-red-500 font-bold";
      if (part.dir < 0) return "text-emerald-600 font-bold";
      return "text-slate-500";
    };

    const initData = async () => {
      loading.value = true;
      try {
        const [data, chartsRes, sharedRes, activeSpRes] = await Promise.all([
          etfApi.fetchEtfRawData().catch(() => []),
          etfApi.fetchChartsMap().catch(() => ({})),
          etfApi.fetchWatchlist().catch(() => ({ data: [] })),
          sponsorApi.fetchActive().catch(() => ({ data: [] })),
        ]);
        if (store.state.isLoggedIn) await loadDashboardPrefs();
        if (Array.isArray(data)) allData.value = data;
        chartsMap.value = chartsRes.charts || chartsRes || {};
        sharedList.value = Array.isArray(sharedRes?.data ?? sharedRes) ? (sharedRes?.data ?? sharedRes) : [];

        const spMap = {};
        const activeArr = Array.isArray(activeSpRes?.data ?? activeSpRes)
          ? (activeSpRes?.data ?? activeSpRes)
          : [];
        for (const r of activeArr) {
          const c = normCode(r.etf_code);
          if (c && !spMap[c]) spMap[c] = { ...r };
        }
        sharedCustomMap.value = spMap;

        // 兼容 chart_date 或 data.chart_date
        const rawChartDate = chartsRes?.chart_date || chartsRes?.data?.chart_date || null;
        globalChartDay.value = toBjDay(rawChartDate) || null;
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
        if (v) {
          await loadDashboardPrefs();
        } else {
          favCodes.value = [];
          userOrder.value = [];
          myCustomCodes.value = [];
          if (quickFilter.value === "fav") quickFilter.value = "all";
        }
        const sharedRes = await etfApi.fetchWatchlist().catch(() => ({ data: [] }));
        sharedList.value = Array.isArray(sharedRes?.data ?? sharedRes) ? (sharedRes?.data ?? sharedRes) : [];
      }
    );

    return {
      loading,
      promoBanner,
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
      getDayCellSegments,
      getWeekCellSegment,
      dataDateTitle,
      dailyChartTitle,
      weekDataTitle,
      weekChartTitle,
      openDailyChartViewer,
      openWeeklyChartViewer,
      getPartColorClass,
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
      <div v-if="promoBanner.visible"
           class="bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 border border-orange-200/90 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-sm">
        <div class="flex items-center gap-2 min-w-0 text-xs sm:text-sm font-bold text-orange-800">
          <span class="w-6 h-6 rounded-lg bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-sm">
            <i class="fa-solid fa-bullhorn text-xs"></i>
          </span>
          <span class="break-words leading-snug">{{ promoBanner.text }}</span>
        </div>
        <a v-if="promoBanner.link" :href="promoBanner.link"
           class="text-xs font-bold text-orange-600 hover:text-orange-700 bg-white border border-orange-200 px-2.5 py-1 rounded-lg shrink-0 no-underline shadow-sm">
          立即前往 <i class="fa-solid fa-angle-right ml-0.5"></i>
        </a>
      </div>

      <div class="flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center justify-between">
        <div class="flex flex-col sm:flex-row gap-2 flex-1">
          <div class="bg-white rounded-xl shadow-sm border border-slate-100 flex items-center flex-1">
            <i class="fa-solid fa-magnifying-glass text-slate-400 pl-3.5 text-xs sm:text-sm"></i>
            <input v-model="searchQuery" type="search" placeholder="搜索代码 / 名称 / T+0..."
                   class="w-full bg-transparent border-none outline-none text-xs sm:text-sm py-2.5 px-2.5">
            <button v-if="searchQuery" @click="searchQuery=''" class="text-slate-300 hover:text-slate-500 pr-3">
              <i class="fa-solid fa-circle-xmark text-xs"></i>
            </button>
          </div>

          <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 shrink-0">
            <button type="button" @click="setQuickFilter('active')"
                    class="px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition"
                    :class="quickFilter==='active' ? 'bg-rose-500 text-white border-transparent shadow-sm' : 'bg-white text-rose-600 border-rose-100 hover:bg-rose-50/50'">
              🔥 最近异动 ({{ processedData.stats?.activeTodayCount || 0 }})
            </button>
            <button type="button" @click="setQuickFilter('fav')"
                    class="px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition"
                    :class="quickFilter==='fav' ? 'bg-amber-400 text-slate-900 border-transparent shadow-sm' : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50'">
              ★ 我的收藏 ({{ processedData.stats?.favCount || 0 }})
            </button>
            <button type="button" @click="setQuickFilter('t0')"
                    class="px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition"
                    :class="quickFilter==='t0' ? 'bg-red-500 text-white border-transparent shadow-sm' : 'bg-white text-red-600 border-red-100 hover:bg-red-50/50'">
              ⚡ T+0 ({{ processedData.stats?.t0Count || 0 }})
            </button>
            <button type="button" @click="setQuickFilter('shared_custom')"
                    class="px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition"
                    :class="quickFilter==='shared_custom' ? 'bg-teal-600 text-white border-transparent shadow-sm' : 'bg-white text-teal-700 border-teal-200 hover:bg-teal-50/50'">
              🎯 定制分享 ({{ processedData.stats?.sharedCustomCount || 0 }})
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
            <strong>注册</strong>解锁全部标的图表
          </span>
          <button type="button" @click="goAuthFromPrompt('register')"
                  class="theme-bg text-white text-xs font-bold px-3 py-1 rounded-lg shadow-sm hover:opacity-90 shrink-0">
            注册
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
                  <!-- 6列循环轮播展示表头 -->
                  <th v-for="(col, cIdx) in visibleCols" :key="col.key"
                      class="py-2.5 sm:py-3 px-1 sm:px-2 sticky top-0 bg-slate-50 z-30 cursor-pointer hover:bg-slate-100 transition-colors border-b border-slate-200"
                      :class="[
                        col.type==='week' ? 'dash-col-week' : 'dash-col-day',
                        cIdx === 5 ? 'bg-teal-50/70 text-teal-800' : ''
                      ]"
                      @click="handleSort(col.type==='week' ? 'week_status' : col.key)">
                    <div class="flex items-center justify-center gap-0.5">
                      <span>{{ col.label }}</span>
                      <span v-if="cIdx === 5" class="text-[9px] bg-[#4da6a0] text-white px-1 py-0.2 rounded font-bold">最新</span>
                    </div>
                    <div v-if="processedData.weekDays[col.dayIdx]" class="text-[9px] font-normal text-slate-400 font-mono leading-none mt-0.5">
                      {{ processedData.weekDays[col.dayIdx].slice(5) }}
                    </div>
                    <i v-if="sortColumn===(col.type==='week'?'week_status':col.key) || (!sortColumn && cIdx === 5)"
                       class="fa-solid text-[10px] ml-0.5"
                       :class="sortColumn===(col.type==='week'?'week_status':col.key) && sortOrder==='asc' ? 'fa-arrow-up' : 'fa-arrow-down'"></i>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50 text-sm">
                <tr v-for="item in processedData.list" :key="item.etf_code"
                    class="hover:bg-[#4da6a0]/5 transition-colors group"
                    :class="{ 'opacity-60': dragCode === item.etf_code, 'bg-teal-50/20': item.is_my_custom }"
                    :draggable="canCustomizeBoard ? true : false"
                    @dragstart="onDragStart(item, $event)"
                    @dragover="onDragOver($event)"
                    @drop="onDropRow(item, $event)">
                  <td class="p-1.5 sm:p-2.5 text-left relative sticky left-0 bg-white group-hover:bg-[#f6faf9] z-10 etf-name-column dash-col-name border-r border-slate-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                    <div v-if="item.is_my_custom" class="absolute left-0 top-0 bottom-0 w-1 bg-rose-500" title="您定制的标的（置顶）"></div>
                    <div v-else-if="processedData.freeTopCodes.includes(item.etf_code)" class="absolute left-0 top-0 bottom-0 w-1 theme-bg"></div>

                    <div class="flex items-start gap-1 min-w-0">
                      <button type="button"
                              class="mt-0.5 shrink-0 p-0.5 leading-none"
                              :title="canCustomizeBoard ? (isFavorite(item.etf_code) ? '取消收藏' : '收藏') : '注册登录后可收藏'"
                              @click="toggleFavorite(item, $event)">
                        <i class="fa-solid fa-star text-xs sm:text-sm"
                           :class="isFavorite(item.etf_code) ? 'text-amber-400' : 'text-slate-300'"></i>
                      </button>

                      <div class="min-w-0 flex-1 overflow-hidden">
                        <div class="font-bold text-slate-800 group-hover:theme-text flex items-center gap-1 flex-nowrap">
                          <span v-if="canCustomizeBoard" class="hidden sm:inline text-slate-300 text-[10px] cursor-grab active:cursor-grabbing select-none shrink-0" title="拖动排序">⋮⋮</span>
                          <span class="truncate text-[12px] sm:text-sm leading-tight" :title="formatEtfName(item.etf_name)">{{ formatEtfName(item.etf_name) }}</span>
                          <span v-if="item.is_my_custom" class="text-[9px] bg-rose-100 text-rose-600 px-1 py-0.2 rounded font-bold shrink-0">定制</span>
                          <span v-else-if="item.is_shared_custom" class="text-[9px] bg-teal-50 text-teal-700 border border-teal-200 px-1 py-0.2 rounded font-bold shrink-0">定制</span>
                          <span v-else-if="processedData.freeTopCodes.includes(item.etf_code)" class="text-[9px] bg-orange-100 text-orange-600 px-1 py-0.2 rounded font-bold shrink-0">免费</span>
                        </div>

                        <div class="flex items-center gap-1.5 mt-0.5">
                          <span class="text-[11px] font-mono cursor-pointer hover:underline"
                                :class="item.trade_rule === 't+0' ? 'text-red-500 font-bold' : 'text-slate-500'"
                                :title="(item.trade_rule === 't+0' ? 'T+0 标的' : 'T+1 标的') + ' · 点击复制代码'"
                                @click="copyCode(item.etf_code, $event)">{{ item.etf_code }}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  <!-- 6列循环数据单元格 -->
                  <td v-for="(col, cIdx) in visibleCols" :key="col.key"
                      class="p-1 sm:p-2.5 font-medium"
                      :class="[
                        col.type==='week' ? 'dash-col-week' : 'dash-col-day',
                        cIdx === 5 ? 'bg-teal-50/20' : ''
                      ]">
                    <template v-if="col.type==='day'">
                      <div class="dash-cell-inner flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1"
                           :title="dataDateTitle(processedData.weekDays[col.dayIdx])">
                        <template v-if="getDayCellSegments(item.days[col.dayIdx])">
                          <span class="text-[10px] sm:text-sm font-mono tracking-tight leading-tight inline-flex items-center">
                            <span :class="getPartColorClass(getDayCellSegments(item.days[col.dayIdx]).am)">{{ getDayCellSegments(item.days[col.dayIdx]).am.text }}</span>
                            <span class="text-slate-300 mx-0.5">/</span>
                            <span :class="getPartColorClass(getDayCellSegments(item.days[col.dayIdx]).pm)">{{ getDayCellSegments(item.days[col.dayIdx]).pm.text }}</span>
                            <span class="text-slate-300 mx-0.5">|</span>
                            <span :class="getPartColorClass(getDayCellSegments(item.days[col.dayIdx]).day)">{{ getDayCellSegments(item.days[col.dayIdx]).day.text }}</span>
                          </span>
                        </template>
                        <span v-else class="text-[10px] sm:text-sm font-mono text-slate-300 leading-tight">-</span>

                        <!-- 图表严格显示在对应的日期列（最新日线自动精准落位） -->
                        <i v-if="showDailyChartIcon(item.etf_code, col.dayIdx)"
                           class="fa-regular fa-image text-slate-400 hover:text-blue-500 cursor-pointer text-xs sm:text-xs shrink-0 p-0.5"
                           :title="dailyChartTitle(item.etf_code, processedData.weekDays[col.dayIdx])"
                           @click.stop="openDailyChartViewer(item, processedData.weekDays[col.dayIdx])"></i>
                      </div>
                    </template>
                    <template v-else>
                      <div class="dash-cell-inner flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1" :title="weekDataTitle(item)">
                        <template v-if="getWeekCellSegment(item.week_status)">
                          <span class="text-[10px] sm:text-sm font-mono leading-tight inline-flex items-center"
                                :class="getPartColorClass(getWeekCellSegment(item.week_status))">{{ getWeekCellSegment(item.week_status).text }}</span>
                        </template>
                        <span v-else class="text-[10px] sm:text-sm font-mono text-slate-300 leading-tight">-</span>

                        <i v-if="item.week_status"
                           class="fa-regular fa-image text-slate-400 hover:text-blue-500 cursor-pointer text-xs sm:text-xs shrink-0 p-0.5"
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

        <!-- 页面下方使用说明 -->
        <div class="bg-amber-50/95 border border-amber-300 rounded-lg px-3 py-1.5 text-center shadow-sm">
          <p style="font-size: 10px;" class="font-bold text-slate-800 leading-snug tracking-normal">
            <span class="text-amber-700"><i class="fa-solid fa-circle-info mr-1"></i>使用说明：</span>
            格式：<span class="font-mono text-slate-900">上午/下午|日线</span>；
            <span class="text-red-500">红正三角（▲）</span>代表上穿半日/日线中间线，行情启动<span class="text-emerald-600">绿倒三角（▼）</span>代表下穿半日/日线中间线，行情结束；
            <span class="text-red-500">红色代码</span>代表 T+0 标的，其余为 T+1 标的。
          </p>
        </div>

        <!-- 打赏卡片 -->
        <div v-if="tipEnabled"
             class="bg-gradient-to-br from-white via-amber-50/40 to-teal-50/30 rounded-2xl border border-amber-200/80 p-4 sm:p-6 shadow-sm">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="space-y-1.5">
              <div class="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-full">
                <i class="fa-solid fa-mug-hot text-amber-600"></i> 温暖打赏 · 共建监控工具
              </div>
              <h3 class="text-sm sm:text-lg font-bold text-slate-800">
                {{ settings.tip_note || '觉得波幅探长对您有帮助？请作者喝杯咖啡吧' }}
              </h3>
              <p class="text-xs text-slate-500 leading-relaxed">
                本站注册即可查看全量数据与图表。您可以输入任意金额打赏支持服务器与算力维护。
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
            <h3 class="text-lg font-extrabold tracking-wide">注册即可查看全部图表</h3>
            <p v-if="guestChartModal.etfName" class="text-xs text-white/90 font-medium">
              当前点击标的：{{ guestChartModal.etfName }} ({{ guestChartModal.etfCode }})
            </p>
          </div>
          <div class="p-6 space-y-4">
            <div class="bg-slate-50 rounded-xl p-4 space-y-2.5 text-xs text-slate-600 border border-slate-100">
              <div class="flex items-start gap-2.5">
                <i class="fa-solid fa-circle-check text-emerald-500 mt-0.5"></i>
                <span><strong>全量多周期图表开放：</strong>注册登录即可查看所有标的的<strong>半日线、日线、周线</strong>趋势大图。</span>
              </div>
              <div class="flex items-start gap-2.5">
                <i class="fa-solid fa-circle-check text-emerald-500 mt-0.5"></i>
                <span><strong>专属定制与自选排序：</strong>会员定制标的默认仅自己可见并置顶，支持自主选择是否分享及星标收藏。</span>
              </div>
            </div>
            <div class="space-y-2">
              <button type="button" @click="goAuthFromPrompt('register')"
                      class="w-full theme-bg text-white font-bold py-3 rounded-xl text-sm shadow-md hover:opacity-95 transition">
                立即注册（30秒完成）
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
