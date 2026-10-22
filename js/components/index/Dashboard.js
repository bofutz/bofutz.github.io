/**
 * 波幅探长 - 首页数据看板
 * 核心改进：
 * 1. 标的默认排序规则：
 *    - 没登录时：最新异动 -> 剩下的按后台「默认监控列表」顺序排列
 *    - 未赞助已登录：收藏 -> 剩余最新异动 -> 按后台「默认监控列表」顺序排列
 *    - 赞助已登录：赞助 -> 收藏 -> 剩余最新异动 -> 按后台「默认监控列表」顺序排列
 * 2. 赞助标的署名修复：自动过滤“匿名会员/热心会员”占位词，优先展示真实昵称「(昵称) 赞助」（如“老李 赞助”），支持点击一次即点赞一次
 * 3. 后台开启优惠活动提醒广告时，在「搜索代码 / 名称...」输入框正上方展示文字提醒广告
 * 4. T+0 股票/ETF代码显示为红色，T+1 保持不变；不在代码后面加(0)
 */
import { store } from "../../store.js";
import { etfApi } from "../../api/etf.js";
import { authApi } from "../../api/auth.js";
import { sponsorApi } from "../../api/sponsor.js";
import { dashboardPrefsApi } from "../../api/dashboardPrefs.js";
import { CONFIG, resolveTradeRule } from "../../config.js";

const { ref, reactive, computed, onMounted, nextTick, watch } = Vue;

const settingOn = (val) =>
  val === undefined || val === null || val === "" || val === "1" || val === 1 || val === true || val === "true";

/** 判断是否为无效的占位赞助名 */
const isPlaceholderSponsorName = (name) => {
  const s = String(name || "").trim();
  return !s || s === "匿名会员" || s === "热心会员" || s === "匿名" || s === "会员";
};

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
    const activeSponsorsMap = ref({});
    const mySponsoredCodes = ref([]);

    const favCodes = ref([]);
    const userOrder = ref([]);
    const dragCode = ref(null);
    const prefsSaving = ref(false);

    const searchQuery = ref("");
    const quickFilter = ref("all");
    const sortColumn = ref(null);
    const sortOrder = ref("desc");

    const settings = computed(() => store.state.publicSettings || {});

    /** 首页搜索框上方优惠活动文字提醒广告 */
    const promoBanner = computed(() => {
      const s = settings.value;
      const enabled = s.ad_enabled === "1" || s.ad_enabled === 1 || s.ad_enabled === true;
      const text = String(s.ad_content || s.ad_title || "").trim();
      const link = String(s.ad_link_url || "").trim();
      return {
        visible: enabled && !!text,
        text,
        link,
      };
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
      if (myUname) {
        if (Array.isArray(row.sponsor_usernames) && row.sponsor_usernames.includes(myUname)) return true;
        if (String(row.sponsor_username || "").trim().toLowerCase() === myUname) return true;
      }
      const myNick = String(store.state.nickname || "").trim();
      if (myNick && row.sponsor_name) {
        const names = String(row.sponsor_name).split("、").map((s) => s.trim());
        if (names.includes(myNick)) return true;
      }
      return false;
    };

    /**
     * 解析赞助标的展示署名：
     * 1. 过滤掉“匿名会员”、“热心会员”等占位名，优先取真实昵称（nickname / sponsor_nickname / sponsor_name）
     * 2. 若是当前登录用户本人赞助（或当前用户设置了昵称且原记录为占位符），优先使用当前用户的昵称或本地缓存昵称
     * 3. 若有邮箱账号，取邮箱 @ 前缀兜底
     */
    const displaySponsorName = (row) => {
      if (!row) return "";
      const code = normCode(row.etf_code);
      const activeSp = (activeSponsorsMap.value || {})[code];
      const hasSponsorRecord =
        !!row.sponsor_id ||
        !!row.is_sponsored ||
        !!row.sponsor_name ||
        !!activeSp;
      if (!hasSponsorRecord) return "";

      const myNick = String(
        store.state.nickname ||
          localStorage.getItem(CONFIG.STORAGE_KEYS.NICKNAME) ||
          localStorage.getItem("etf_sponsor_fallback_nick") ||
          ""
      ).trim();

      // 若是当前登录会员本人赞助，且本人有昵称，直接展示本人昵称
      if (isSponsoredByCurrentUser(row) && myNick && !isPlaceholderSponsorName(myNick)) {
        return myNick;
      }

      // 依次从 activeSponsorsMap、row 字段中寻找有效非占位昵称
      const candidates = [
        row.sponsor_nickname,
        row.nickname,
        activeSp?.nickname,
        activeSp?.sponsor_nickname,
        activeSp?.sponsor_name,
        row.sponsor_name,
      ];

      for (const cand of candidates) {
        if (!cand) continue;
        const parts = String(cand)
          .split("、")
          .map((s) => s.trim())
          .filter((s) => !isPlaceholderSponsorName(s));
        if (parts.length > 0) {
          return parts.join("、");
        }
      }

      // 尝试用赞助者关联邮箱前缀
      const uname = String(
        row.sponsor_username ||
          activeSp?.username ||
          (Array.isArray(row.sponsor_usernames) && row.sponsor_usernames[0]) ||
          ""
      ).trim();
      if (uname) {
        const prefix = uname.includes("@") ? uname.split("@")[0] : uname;
        if (prefix && !isPlaceholderSponsorName(prefix)) return prefix;
      }

      // 若后端记录因旧版 bug 被存成了“匿名会员”，而本地或当前账号已有真实昵称，则用真实昵称兜底展示
      if (myNick && !isPlaceholderSponsorName(myNick)) {
        return myNick;
      }
      if (isSponsoredByCurrentUser(row)) {
        const disp = store.getDisplayName ? store.getDisplayName() : "";
        if (disp && !isPlaceholderSponsorName(disp)) return disp;
      }

      return String(row.sponsor_name || activeSp?.sponsor_name || "").trim();
    };

    /** 点击「(昵称) 赞助」徽章一次，即相当于点赞一次 */
    const likeSponsorOnBoard = async (item, ev) => {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      if (!item || !item.resolved_sponsor_name) return;

      item.like_count = (Number(item.like_count) || 0) + 1;
      const targetShared = (sharedList.value || []).find(
        (s) => normCode(s.etf_code || s.code) === normCode(item.etf_code)
      );
      if (targetShared) {
        targetShared.like_count = (Number(targetShared.like_count) || 0) + 1;
      }

      try {
        const res = await sponsorApi.like(item.sponsor_id, item.etf_code);
        if (res && res.like_count != null && targetShared) {
          targetShared.like_count = Number(res.like_count);
        }
        store.showToast(`已为「${item.resolved_sponsor_name}」点赞！`);
      } catch (e) {
        store.showToast(e.message || "点赞失败", "error");
      }
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

      // 记录后台「默认监控列表」的顺序索引
      // sharedList 由 /api/watchlist 返回时，默认监控列表已按 sort_order ASC, id ASC 排在最前
      const defaultOrderMap = new Map();
      let sharedSeq = 0;
      (sharedList.value || []).forEach((s) => {
        const c = normCode(s.etf_code || s.code);
        if (!c || defaultOrderMap.has(c)) return;
        const baseWeight = s.source === "sponsor" ? 100000 : 0;
        defaultOrderMap.set(c, baseWeight + sharedSeq++);
      });

      const etfMap = {};
      const ensureRow = (code, name, extra = null) => {
        const spInfo = (activeSponsorsMap.value || {})[code];
        if (!etfMap[code]) {
          etfMap[code] = {
            etf_code: code,
            etf_name: name || extra?.etf_name || spInfo?.etf_name || code,
            days: [null, null, null, null, null],
            week_status: null,
            week_status_date: null,
            sponsor_id: extra?.sponsor_id || spInfo?.id || null,
            sponsor_name: extra?.sponsor_name || spInfo?.sponsor_name || "",
            sponsor_nickname: extra?.nickname || extra?.sponsor_nickname || spInfo?.nickname || "",
            sponsor_username: extra?.username || spInfo?.username || "",
            sponsor_user_id: extra?.sponsor_user_id || spInfo?.user_id || null,
            sponsor_user_ids: extra?.sponsor_user_ids || (spInfo?.user_id ? [String(spInfo.user_id)] : []),
            sponsor_usernames:
              extra?.sponsor_usernames || (spInfo?.username ? [String(spInfo.username).toLowerCase()] : []),
            like_count: Number(extra?.like_count ?? spInfo?.like_count ?? 0) || 0,
            is_sponsored:
              !!extra?.is_sponsored || !!extra?.sponsor_name || !!extra?.sponsor_id || !!spInfo,
            trade_mode: extra?.trade_mode || spInfo?.trade_mode || "auto",
            source: extra?.source || "default",
            default_rank: defaultOrderMap.has(code) ? defaultOrderMap.get(code) : 999999,
          };
        } else {
          if (name && (!etfMap[code].etf_name || etfMap[code].etf_name === code)) {
            etfMap[code].etf_name = name;
          }
          if (extra?.sponsor_id || spInfo?.id) {
            etfMap[code].sponsor_id = extra?.sponsor_id || spInfo?.id;
          }
          if (extra?.sponsor_name || spInfo?.sponsor_name) {
            const candidateName = extra?.sponsor_name || spInfo?.sponsor_name;
            if (isPlaceholderSponsorName(etfMap[code].sponsor_name) || !isPlaceholderSponsorName(candidateName)) {
              etfMap[code].sponsor_name = candidateName;
            }
          }
          if (extra?.nickname || extra?.sponsor_nickname || spInfo?.nickname) {
            etfMap[code].sponsor_nickname =
              extra?.nickname || extra?.sponsor_nickname || spInfo?.nickname;
          }
          if (extra?.username || spInfo?.username) {
            etfMap[code].sponsor_username = extra?.username || spInfo?.username;
          }
          if (extra?.sponsor_user_id || spInfo?.user_id) {
            etfMap[code].sponsor_user_id = extra?.sponsor_user_id || spInfo?.user_id;
          }
          if (extra?.sponsor_user_ids?.length) {
            etfMap[code].sponsor_user_ids = extra.sponsor_user_ids;
          }
          if (extra?.sponsor_usernames?.length) {
            etfMap[code].sponsor_usernames = extra.sponsor_usernames;
          }
          if (extra?.like_count != null || spInfo?.like_count != null) {
            etfMap[code].like_count = Number(extra?.like_count ?? spInfo?.like_count) || 0;
          }
          if (extra?.is_sponsored || extra?.sponsor_name || extra?.sponsor_id || spInfo) {
            etfMap[code].is_sponsored = true;
          }
          if (extra?.trade_mode && extra.trade_mode !== "auto") {
            etfMap[code].trade_mode = extra.trade_mode;
          }
          if (extra?.source === "sponsor") {
            etfMap[code].source = "sponsor";
          }
          if (defaultOrderMap.has(code)) {
            etfMap[code].default_rank = defaultOrderMap.get(code);
          }
        }
        return etfMap[code];
      };

      (sharedList.value || []).forEach((s) => {
        const code = normCode(s.etf_code || s.code);
        if (code.length !== 6) return;
        ensureRow(code, s.etf_name || s.name || code, s);
      });

      allData.value.forEach((item) => {
        if (!item?.date || !isValidDate(item.date)) return;
        const idx = dateToIdx.get(item.date.trim());
        const code = normCode(item.etf_code);
        if (!code) return;
        const row = ensureRow(code, item.etf_name);
        if (idx !== undefined) row.days[idx] = item;
      });

      const closedWeekMonday = resolveLatestClosedWeekMonday();
      const closedWeekDays = closedWeekMonday ? getWeekDays(closedWeekMonday) : [];
      const closedWeekFriday = closedWeekDays.length >= 5 ? closedWeekDays[4] : "";

      Object.values(etfMap).forEach((row) => {
        const cur = closedWeekMonday ? findWeekStatusForMonday(row.etf_code, closedWeekMonday) : null;
        row.week_status = cur ? cur.status : null;
        row.week_status_date = cur ? closedWeekFriday || cur.date : null;
        row.trade_rule = resolveTradeRule(row.etf_code, row.etf_name, row.trade_mode);
        row.is_my_sponsor = isSponsoredByCurrentUser(row);
        row.resolved_sponsor_name = displaySponsorName(row);
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

      /** 按后台「默认监控列表」顺序排列比较器 */
      const cmpDefaultWatchlistOrder = (a, b) => {
        const ra = a.default_rank ?? 999999;
        const rb = b.default_rank ?? 999999;
        if (ra !== rb) return ra - rb;
        return String(a.etf_code || "").localeCompare(String(b.etf_code || ""));
      };

      const cmpDayColumn = (a, b, idx, orderDesc = true) => {
        const da = absDayVal(a, idx);
        const db = absDayVal(b, idx);
        if (da !== db) return da === -9999 ? 1 : db === -9999 ? -1 : orderDesc ? db - da : da - db;
        const ha = absHalfVal(a, idx);
        const hb = absHalfVal(b, idx);
        if (ha !== hb) return ha === -9999 ? 1 : hb === -9999 ? -1 : orderDesc ? hb - ha : ha - hb;
        return cmpDefaultWatchlistOrder(a, b);
      };

      const cmpWeekColumn = (a, b, orderDesc = true) => {
        const wa = absWeekVal(a);
        const wb = absWeekVal(b);
        if (wa !== wb) return wa === -9999 ? 1 : wb === -9999 ? -1 : orderDesc ? wb - wa : wa - wb;
        return cmpDefaultWatchlistOrder(a, b);
      };

      /** 最新异动内部排序（按最新异动波幅绝对值从大到小，相同时按默认监控列表顺序） */
      const cmpLatestActiveRank = (a, b) => {
        if (rankBy === "weekly") return cmpWeekColumn(a, b, true);
        if (latestIdx >= 0) return cmpDayColumn(a, b, latestIdx, true);
        return cmpDefaultWatchlistOrder(a, b);
      };

      /** 判断标的是否属于「最新异动」 */
      const isLatestActive = (row) =>
        rankBy === "weekly" ? absWeekVal(row) > -9999 : latestIdx >= 0 && cellHasAny(row, latestIdx);

      const freeTopN = Math.max(1, parseInt(settings.value.free_top_n_charts, 10) || 3);
      let freeTop3Codes = [];
      if (rankBy === "weekly") {
        freeTop3Codes = [...items]
          .filter((i) => absWeekVal(i) > -9999)
          .sort((a, b) => cmpWeekColumn(a, b, true))
          .slice(0, freeTopN)
          .map((i) => i.etf_code);
      } else if (dailyColIdx >= 0) {
        freeTop3Codes = [...items]
          .filter((i) => absDayVal(i, dailyColIdx) > -9999)
          .sort((a, b) => cmpDayColumn(a, b, dailyColIdx, true))
          .slice(0, freeTopN)
          .map((i) => i.etf_code);
      }

      const favSet = new Set(store.state.isLoggedIn ? (favCodes.value || []).map(String) : []);

      const totalCount = items.length;
      const t0Count = items.filter((i) => i.trade_rule === "t+0").length;
      const sponsoredCount = items.filter((i) => i.is_sponsored || i.resolved_sponsor_name).length;
      const favCount = items.filter((i) => favSet.has(String(i.etf_code))).length;
      const activeTodayCount = items.filter((i) => isLatestActive(i)).length;

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
          return cmpLatestActiveRank(a, b);
        });
      } else {
        /**
         * 默认排序三级/四级分组规则：
         * - 没登录时：最新异动 (group 2) -> 剩下的按后台「默认监控列表」顺序排列 (group 3)
         * - 未赞助已登录：收藏 (group 1) -> 剩余最新异动 (group 2) -> 后台「默认监控列表」顺序排列 (group 3)
         * - 赞助已登录：赞助 (group 0) -> 收藏 (group 1) -> 剩余最新异动 (group 2) -> 后台「默认监控列表」顺序排列 (group 3)
         */
        const groupOf = (row) => {
          const c = String(row.etf_code);
          if (store.state.isLoggedIn) {
            if (row.is_my_sponsor) return 0; // 赞助
            if (favSet.has(c)) return 1; // 收藏
          }
          if (isLatestActive(row)) return 2; // 最新异动（或剩余最新异动）
          return 3; // 剩余标的：按后台「默认监控列表」顺序排列
        };

        items.sort((a, b) => {
          const ga = groupOf(a);
          const gb = groupOf(b);
          if (ga !== gb) return ga - gb;

          // Group 2（最新异动）：按异动波幅从大到小排，同波幅按「默认监控列表」顺序
          if (ga === 2) {
            return cmpLatestActiveRank(a, b);
          }

          // Group 0（赞助）与 Group 1（收藏）：优先有最新异动的排前面，其次按「默认监控列表」顺序
          if (ga === 0 || ga === 1) {
            const actA = isLatestActive(a);
            const actB = isLatestActive(b);
            if (actA && actB) return cmpLatestActiveRank(a, b);
            if (actA !== actB) return actA ? -1 : 1;
            return cmpDefaultWatchlistOrder(a, b);
          }

          // Group 3（剩余无异动标的）：严格按照后台「默认监控列表」顺序排列
          return cmpDefaultWatchlistOrder(a, b);
        });
      }

      if (quickFilter.value === "active") {
        items = items.filter((i) => isLatestActive(i));
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
            (i.trade_rule === "t+0" && (q.includes("t+0") || q.includes("t0")))
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
        const [prefRes, mineRes, meRes] = await Promise.all([
          dashboardPrefsApi.fetch().catch(() => ({})),
          sponsorApi.fetchMine().catch(() => ({ data: [] })),
          !store.state.nickname ? authApi.getMe().catch(() => null) : Promise.resolve(null),
        ]);
        if (meRes) {
          const d = meRes.data || meRes;
          if (d && d.nickname) {
            store.setUserState({ nickname: d.nickname });
            localStorage.setItem("etf_sponsor_fallback_nick", d.nickname);
          }
        } else if (store.state.nickname) {
          localStorage.setItem("etf_sponsor_fallback_nick", store.state.nickname);
        }

        const data = prefRes?.data || prefRes || {};
        favCodes.value = (data.favorites || []).map(normCode).filter((c) => c.length === 6);
        userOrder.value = (data.order || []).map(normCode);
        const now = Date.now();
        const myActive = (mineRes?.data || []).filter(
          (r) => r.status === "active" && Number(r.expire_at) > now
        );
        mySponsoredCodes.value = myActive.map((r) => normCode(r.etf_code)).filter(Boolean);

        // 若当前用户已设置昵称，但历史赞助记录里仍为空或占位符，自动触发一次昵称同步回写后端
        const currentNick = String(store.state.nickname || "").trim();
        if (
          currentNick &&
          !isPlaceholderSponsorName(currentNick) &&
          myActive.some((r) => isPlaceholderSponsorName(r.sponsor_name))
        ) {
          authApi.updateNickname(currentNick).catch(() => {});
        }
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

        // 汇总有效赞助池的详细字段（含 nickname、username 等），解决单接口信息缺失导致的“匿名会员”问题
        const spMap = {};
        const activeArr = Array.isArray(activeSpRes?.data ?? activeSpRes)
          ? (activeSpRes?.data ?? activeSpRes)
          : [];
        for (const r of activeArr) {
          const c = normCode(r.etf_code);
          if (!c) continue;
          if (!spMap[c]) {
            spMap[c] = { ...r };
          } else if (
            isPlaceholderSponsorName(spMap[c].sponsor_name) &&
            !isPlaceholderSponsorName(r.nickname || r.sponsor_name)
          ) {
            spMap[c].sponsor_name = r.nickname || r.sponsor_name;
            spMap[c].nickname = r.nickname || spMap[c].nickname;
          }
          const validNick = String(r.nickname || r.sponsor_name || "").trim();
          if (validNick && !isPlaceholderSponsorName(validNick)) {
            localStorage.setItem("etf_sponsor_fallback_nick", validNick);
          }
        }
        activeSponsorsMap.value = spMap;

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

    watch(
      () => store.state.nickname,
      (v) => {
        if (v && !isPlaceholderSponsorName(v)) {
          localStorage.setItem("etf_sponsor_fallback_nick", v.trim());
        }
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
      likeSponsorOnBoard,
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
      <!-- 首页优惠活动文字提醒广告（展示在“搜索代码 / 名称...”输入框正上方） -->
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

      <!-- 搜索框 + 快捷筛选栏 -->
      <div class="flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center justify-between">
        <div class="flex flex-col sm:flex-row gap-2 flex-1">
          <div class="bg-white rounded-xl shadow-sm border border-slate-100 flex items-center flex-1">
            <i class="fa-solid fa-magnifying-glass text-slate-400 pl-3.5 text-xs sm:text-sm"></i>
            <input v-model="searchQuery" type="search" placeholder="搜索代码 / 名称 / 赞助昵称 / T+0..."
                   class="w-full bg-transparent border-none outline-none text-xs sm:text-sm py-2.5 px-2.5">
            <button v-if="searchQuery" @click="searchQuery=''" class="text-slate-300 hover:text-slate-500 pr-3">
              <i class="fa-solid fa-circle-xmark text-xs"></i>
            </button>
          </div>

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
                    :class="quickFilter==='t0' ? 'bg-red-500 text-white border-transparent shadow-sm' : 'bg-white text-red-600 border-red-100 hover:bg-red-50/50'">
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

                        <!-- 第二行：股票代码（T+0为红色，T+1保持不变，不加(0)） + 可点击点赞的「(昵称) 赞助」徽章 -->
                        <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span class="text-[11px] font-mono cursor-pointer hover:underline"
                                :class="item.trade_rule === 't+0' ? 'text-red-500 font-bold' : 'text-slate-500'"
                                :title="(item.trade_rule === 't+0' ? 'T+0 标的' : 'T+1 标的') + ' · 点击复制代码'"
                                @click="copyCode(item.etf_code, $event)">{{ item.etf_code }}</span>

                          <button v-if="item.resolved_sponsor_name"
                                  type="button"
                                  @click.stop="likeSponsorOnBoard(item, $event)"
                                  class="inline-flex items-center gap-1 text-[10px] bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-800 border border-amber-200/90 px-1.5 py-0.2 rounded font-bold max-w-[135px] sm:max-w-[165px] truncate transition cursor-pointer"
                                  :title="'点击为赞助会员【' + item.resolved_sponsor_name + '】点赞（已获赞 ' + (item.like_count || 0) + ' 次）'">
                            <i class="fa-solid fa-heart text-[8px] text-rose-500 shrink-0"></i>
                            <span class="truncate">{{ item.resolved_sponsor_name }} 赞助</span>
                            <span v-if="item.like_count > 0" class="text-[9px] text-rose-600 font-mono shrink-0">+{{ item.like_count }}</span>
                          </button>
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
          格式：上午/下午|日线；<span class="text-red-500 font-bold">红色代码</span>代表 T+0 标的，其余为 T+1 标的。
        </p>

        <!-- 看板底部：温暖打赏卡片 -->
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
                <span><strong>全量多周期图表开放：</strong>使用邮箱注册登录即可查看所有标的的<strong>半日线、日线、周线</strong>趋势大图。</span>
              </div>
              <div class="flex items-start gap-2.5">
                <i class="fa-solid fa-circle-check text-emerald-500 mt-0.5"></i>
                <span><strong>赞助置顶与自选排序：</strong>赞助会员本人赞助的标的默认置顶，支持星标收藏与拖拽排序。</span>
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
