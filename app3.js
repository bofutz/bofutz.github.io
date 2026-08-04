/**
 * 波幅探长 app.js v2
 * 通用/定制独立 · 公开设置 · 答疑 · 支付宝/微信码 · 按只计费 · 邀请记录
 */
const { createApp, ref, computed, reactive, onMounted, onUnmounted, watch, nextTick } = Vue;

const API_BASE = "https://vip.hahagw.eu.org";
const MAIL_API_BASE = "https://mail.hahagw.eu.org";
const TURNSTILE_SITEKEY = "0x4AAAAAAEDLWs232Np7X0xa";

const isValidDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return false;
  const match = dateStr.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!match) return false;
  const y = parseInt(match[1], 10), m = parseInt(match[2], 10), d = parseInt(match[3], 10);
  return y >= 2020 && y <= 2030 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
};
const parseYear = (s) => (isValidDate(s) ? parseInt(s.trim().split(/[-/]/)[0], 10) : 0);
const parseMonth = (s) => (isValidDate(s) ? parseInt(s.trim().split(/[-/]/)[1], 10) : 0);
const parseDay = (s) => (isValidDate(s) ? parseInt(s.trim().split(/[-/]/)[2], 10) : 0);
const isEmail = (s) => typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

createApp({
  setup() {
    const currentRoute = ref(window.location.hash || "#/");
    const menuOpen = ref(false);
    const userMenuOpen = ref(false);
    const freeEtfCodes = ref([]);
    const publicSettings = ref({
      gift_register_days: "1",
      gift_inviter_days: "3",
      gift_invitee_days: "2",
      free_top_n_charts: "3",
      pay_register_enabled: "1",
      alipay_qr_url: "",
      wechat_qr_url: "",
      default_pay_channel: "alipay",
    });

    const PROTECTED_ROUTES = ["#/profile", "#/tickets"];

    const navigate = (path) => {
      if (PROTECTED_ROUTES.includes(path) && !isLoggedIn.value) {
        openAuth("login");
        return;
      }
      currentRoute.value = path;
      window.location.hash = path;
      menuOpen.value = false;
    };

    const requireLoginThen = (path) => {
      if (!isLoggedIn.value) {
        openAuth("login");
        menuOpen.value = false;
        return;
      }
      navigate(path);
    };

    const closeDropdowns = () => {
      userMenuOpen.value = false;
      showDropdown.value = false;
    };

    const pageTitle = computed(() => {
      const map = {
        "#/": "数据看板",
        "#/plan": "购买套餐",
        "#/profile": "个人中心",
        "#/tickets": "答疑留言",
        "#/docs": "使用说明",
      };
      return map[currentRoute.value] || "数据看板";
    });

    const apiFetch = async (endpoint, options = {}) => {
      const token = localStorage.getItem("etf_token");
      if (token) options.headers = { ...options.headers, Authorization: `Bearer ${token}` };
      options.headers = { ...options.headers, "Content-Type": "application/json" };
      const res = await fetch(`${API_BASE}${endpoint}`, options);
      if (res.status === 401) {
        logout(false);
        throw new Error("登录已过期，请重新登录");
      }
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "请求失败");
      return data;
    };

    const isLoggedIn = ref(false);
    const isVip = ref(false);
    const username = ref("");
    const vipDaysLeft = ref(0);
    const referralCode = ref("");

    const checkLoginState = () => {
      try {
        if (localStorage.getItem("etf_token")) {
          isLoggedIn.value = true;
          username.value = localStorage.getItem("etf_username") || "";
          referralCode.value = localStorage.getItem("etf_ref") || "";
          vipDaysLeft.value = parseInt(localStorage.getItem("etf_vip_days")) || 0;
          isVip.value = vipDaysLeft.value > 0;
        }
      } catch (_) {}
    };

    const fetchPublicSettings = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/settings/public`);
        const data = await res.json();
        if (data.success && data.data) {
          publicSettings.value = { ...publicSettings.value, ...data.data };
          if (data.data.default_pay_channel) payChannel.value = data.data.default_pay_channel;
        }
      } catch (_) {}
    };

    // ---------- 认证 ----------
    const authModalVisible = ref(false);
    const authMode = ref("login");
    const authLoading = ref(false);
    const authForm = reactive({ username: "", password: "", refCode: "", emailCode: "", turnstileToken: "" });
    const sendCodeLoading = ref(false);
    const countdown = ref(0);

    const renderTurnstile = () => {
      if (authMode.value !== "register") return;
      nextTick(() => {
        setTimeout(() => {
          const container = document.getElementById("turnstile-container");
          if (container && window.turnstile) {
            container.innerHTML = "";
            try {
              window.turnstile.render("#turnstile-container", {
                sitekey: TURNSTILE_SITEKEY,
                callback: (token) => { authForm.turnstileToken = token; },
                "expired-callback": () => { authForm.turnstileToken = ""; },
              });
            } catch (_) {}
          }
        }, 150);
      });
    };

    const switchAuthMode = (mode) => {
      authMode.value = mode;
      authForm.password = "";
      authForm.emailCode = "";
      authForm.turnstileToken = "";
      if (mode === "register") renderTurnstile();
    };
    const openAuth = (mode) => { authModalVisible.value = true; switchAuthMode(mode); };
    const closeAuth = () => { authModalVisible.value = false; };

    const sendEmailCode = async () => {
      if (!isEmail(authForm.username)) { alert("请输入正确邮箱"); return; }
      if (!authForm.turnstileToken) { alert("请先完成人机验证"); return; }
      sendCodeLoading.value = true;
      try {
        const res = await fetch(`${MAIL_API_BASE}/api/send-code`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: authForm.username, turnstileToken: authForm.turnstileToken }),
        });
        const data = await res.json();
        if (data.success) {
          alert(data.msg || "验证码已发送");
          countdown.value = 60;
          const timer = setInterval(() => {
            countdown.value--;
            if (countdown.value <= 0) {
              clearInterval(timer);
              if (window.turnstile) window.turnstile.reset("#turnstile-container");
            }
          }, 1000);
        } else {
          alert(data.msg || "发送失败");
          if (window.turnstile) window.turnstile.reset("#turnstile-container");
        }
      } catch (_) {
        alert("网络错误");
        if (window.turnstile) window.turnstile.reset("#turnstile-container");
      } finally {
        sendCodeLoading.value = false;
      }
    };

    const submitAuth = async () => {
      if (!authForm.username || !authForm.password) { alert("账号和密码不能为空"); return; }
      if (authMode.value === "register") {
        if (!isEmail(authForm.username)) { alert("请填写合法邮箱"); return; }
        if (!authForm.emailCode) { alert("请输入邮箱验证码"); return; }
      }
      authLoading.value = true;
      try {
        if (authMode.value === "register") {
          const reg = await apiFetch("/api/register", {
            method: "POST",
            body: JSON.stringify({
              username: authForm.username.trim(),
              password: authForm.password,
              ref_code: authForm.refCode,
              code: authForm.emailCode,
            }),
          });
          alert(reg.message || "注册成功，请登录" + (reg.vip_days_gift ? `（已获 ${reg.vip_days_gift} 天体验）` : ""));
          switchAuthMode("login");
        } else {
          const data = await apiFetch("/api/login", {
            method: "POST",
            body: JSON.stringify({ username: authForm.username.trim(), password: authForm.password }),
          });
          localStorage.setItem("etf_token", data.token);
          localStorage.setItem("etf_username", authForm.username.trim());
          localStorage.setItem("etf_ref", data.referral_code || "");
          localStorage.setItem("etf_vip_days", data.shared_vip_days ?? data.vip_days_left ?? 0);
          checkLoginState();
          closeAuth();
          fetchData();
          fetchCustomWatchlist();
          if (currentRoute.value === "#/profile") {
            fetchOrders();
            fetchInvitees();
          }
          if (currentRoute.value === "#/tickets") fetchTickets();
        }
      } catch (err) {
        alert(err.message);
      } finally {
        authLoading.value = false;
      }
    };

    const logout = (showAlert = true) => {
      try { localStorage.clear(); } catch (_) {}
      isLoggedIn.value = false;
      isVip.value = false;
      username.value = "";
      referralCode.value = "";
      vipDaysLeft.value = 0;
      customWatchlist.value = [];
      inviteeList.value = [];
      ticketList.value = [];
      if (showAlert) alert("已退出登录");
      navigate("#/");
    };

    const formatDateExact = (ts) => {
      if (!ts) return "-";
      const d = new Date(ts);
      if (isNaN(d.getTime())) return "-";
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    };
    const formatDateShort = (ts) => {
      if (!ts) return "-";
      const d = new Date(ts);
      if (isNaN(d.getTime())) return "-";
      const p = (n) => String(n).padStart(2, "0");
      return `${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    };

    // ---------- 看板 ----------
    const loading = ref(false);
    const allData = ref([]);
    const chartsMap = ref({});
    const showDropdown = ref(false);
    const selectedMonday = ref("");
    const searchQuery = ref("");
    const expandedRowKey = ref(null);
    const sortColumn = ref(null);
    const sortOrder = ref("desc");
    const sharedWatchlist = ref([]);

    const handleSort = (column) => {
      if (sortColumn.value === column) {
        if (sortOrder.value === "desc") sortOrder.value = "asc";
        else { sortColumn.value = null; sortOrder.value = "desc"; }
      } else {
        sortColumn.value = column;
        sortOrder.value = "desc";
      }
    };

    const getStatusVal = (str) => {
      if (!str || typeof str !== "string" || str === "-" || str === "--") return -9999;
      const match = str.match(/[-+]?[0-9]*\.?[0-9]+/);
      return match ? parseFloat(match[0]) : -9999;
    };

    const getWeekDays = (dateStr) => {
      const y = parseYear(dateStr), m = parseMonth(dateStr), d = parseDay(dateStr);
      if (!y || !m || !d) return [];
      const dateObj = new Date(y, m - 1, d);
      let dayOfWeek = dateObj.getDay();
      const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(y, m - 1, d + offset);
      const days = [];
      for (let i = 0; i < 5; i++) {
        const temp = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
        days.push(`${temp.getFullYear()}-${String(temp.getMonth() + 1).padStart(2, "0")}-${String(temp.getDate()).padStart(2, "0")}`);
      }
      return days;
    };

    const getWeekNumberInMonth = (dateStr) => {
      const y = parseYear(dateStr), m = parseMonth(dateStr), d = parseDay(dateStr);
      if (!d) return "";
      const firstDay = new Date(y, m - 1, 1);
      let firstDayOfWeek = firstDay.getDay();
      if (firstDayOfWeek === 0) firstDayOfWeek = 7;
      const weekNum = Math.ceil((d + (firstDayOfWeek - 1)) / 7);
      return `第${["一", "二", "三", "四", "五", "六"][weekNum - 1] || weekNum}周`;
    };

    const getDayTooltip = (dateStr) => {
      if (!dateStr || !isValidDate(dateStr)) return "";
      return `${String(parseMonth(dateStr)).padStart(2, "0")}-${String(parseDay(dateStr)).padStart(2, "0")}`;
    };
    const getWeekTooltip = (mondayStr) => {
      if (!mondayStr || !isValidDate(mondayStr)) return "";
      const m = String(parseMonth(mondayStr)).padStart(2, "0");
      const weekNumStr = getWeekNumberInMonth(mondayStr);
      const numMatch = weekNumStr.match(/[一二三四五六]/);
      const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
      const n = numMatch ? map[numMatch[0]] || 1 : 1;
      return `${m}-${n}w`;
    };
    const getMobileDayDate = (d) => getDayTooltip(d);
    const getMobileWeekDate = (m) => getWeekTooltip(m);

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
        if (!periods[monthKey]) periods[monthKey] = { monthKey, monthLabel: `${y}年${m}月`, weeksMap: {} };
        if (!periods[monthKey].weeksMap[monday]) {
          periods[monthKey].weeksMap[monday] = { monday, weekLabel: getWeekNumberInMonth(monday) };
        }
      });
      const result = Object.values(periods).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
      result.forEach((m) => { m.weeks = Object.values(m.weeksMap).sort((a, b) => b.monday.localeCompare(a.monday)); });
      return result;
    });

    const currentPeriodLabel = computed(() => {
      for (const m of availablePeriods.value) {
        for (const w of m.weeks) {
          if (w.monday === selectedMonday.value) return `${parseMonth(w.monday)}月 · ${w.weekLabel}`;
        }
      }
      return "";
    });

    const selectWeek = (mondayStr) => { selectedMonday.value = mondayStr; showDropdown.value = false; };

    const latestDailyColIndex = computed(() => {
      if (!selectedMonday.value) return -1;
      const weekDays = getWeekDays(selectedMonday.value);
      if (weekDays.length < 5) return -1;
      for (let i = 4; i >= 0; i--) {
        if (allData.value.some((item) => item.date === weekDays[i] && item.day_status && item.day_status !== "-" && item.day_status !== "--")) return i;
      }
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const beijing = new Date(utc + 8 * 60 * 60000);
      const day = beijing.getDay(), hour = beijing.getHours();
      if (day === 0 || day === 6) return 4;
      let col = day - 1;
      if (hour < 17) { col = col - 1; if (col < 0) col = 0; }
      return col;
    });
    const isLatestDailyColumn = (idx) => idx === latestDailyColIndex.value;

    const formatMobileStatus = (status) => {
      if (!status || status === "-" || status === "--") return "-";
      const match = String(status).match(/([-+]?[0-9]*\.?[0-9]+)/);
      return match ? match[1] : "-";
    };
    const getMobileStatusClass = (status) => {
      if (!status || status === "-" || status === "--") return "mobile-status-neutral";
      return String(status).includes("+") ? "mobile-status-up" : "mobile-status-down";
    };

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
            etfMap[item.etf_code] = { etf_code: item.etf_code, etf_name: item.etf_name, days: [null, null, null, null, null], week_status: null };
          }
          etfMap[item.etf_code].days[idx] = item;
          if (isPastFriday16 && item.week_status && item.week_status !== "-" && item.week_status !== "--") {
            etfMap[item.etf_code].week_status = item.week_status;
          }
        }
      });

      if (!isPastFriday16) {
        const my = parseYear(weekDays[0]), mm = parseMonth(weekDays[0]), md = parseDay(weekDays[0]);
        const curMon = new Date(my, mm - 1, md);
        const prevMon = new Date(curMon.getTime() - 7 * 86400000);
        const prevMondayStr = `${prevMon.getFullYear()}-${String(prevMon.getMonth() + 1).padStart(2, "0")}-${String(prevMon.getDate()).padStart(2, "0")}`;
        const prevWeekDates = getWeekDays(prevMondayStr);
        const lastWeekStatusMap = {};
        allData.value.forEach((item) => {
          if (!item.date) return;
          if (prevWeekDates.includes(item.date) && item.week_status && item.week_status !== "-" && item.week_status !== "--") {
            lastWeekStatusMap[item.etf_code] = item.week_status;
          }
        });
        for (const code in lastWeekStatusMap) {
          if (!etfMap[code]) {
            const etfItem = allData.value.find((i) => i.etf_code === code);
            etfMap[code] = { etf_code: code, etf_name: etfItem ? etfItem.etf_name : code, days: [null, null, null, null, null], week_status: null };
          }
          etfMap[code].week_status = lastWeekStatusMap[code];
        }
      }

      let validItems = Object.values(etfMap).filter((item) => {
        const hasDay = item.days.some((d) => d && d.day_status && d.day_status !== "-" && d.day_status !== "--");
        const hasWeek = item.week_status && item.week_status !== "-" && item.week_status !== "--";
        return hasDay || hasWeek || (chartsMap.value && chartsMap.value.hasOwnProperty(item.etf_code));
      });

      if (sharedWatchlist.value.length > 0) {
        const codeSet = new Set(sharedWatchlist.value.map((w) => w.etf_code));
        const filtered = validItems.filter((i) => codeSet.has(i.etf_code));
        if (filtered.length > 0) validItems = filtered;
      }

      if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase().trim();
        validItems = validItems.filter(
          (item) => (item.etf_name && item.etf_name.toLowerCase().includes(q)) || (item.etf_code && item.etf_code.toLowerCase().includes(q))
        );
      }

      validItems.sort((a, b) => {
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
          const valWkA = a.week_status && a.week_status !== "-" ? Math.abs(getStatusVal(a.week_status)) : -9999;
          const valWkB = b.week_status && b.week_status !== "-" ? Math.abs(getStatusVal(b.week_status)) : -9999;
          if (valWkA !== -9999 || valWkB !== -9999) {
            if (valWkA !== -9999 && valWkB !== -9999) return valWkB - valWkA;
            if (valWkA !== -9999) return -1;
            if (valWkB !== -9999) return 1;
          }
          let latestIdx = 4;
          while (latestIdx >= 0) {
            const hasData = validItems.some((i) => i.days[latestIdx] && i.days[latestIdx].day_status && i.days[latestIdx].day_status !== "-");
            if (hasData) break;
            latestIdx--;
          }
          if (latestIdx >= 0) {
            const valA = a.days[latestIdx] && a.days[latestIdx].day_status ? Math.abs(getStatusVal(a.days[latestIdx].day_status)) : -9999;
            const valB = b.days[latestIdx] && b.days[latestIdx].day_status ? Math.abs(getStatusVal(b.days[latestIdx].day_status)) : -9999;
            return valB - valA;
          }
        }
        return 0;
      });
      return validItems;
    });

    const toggleRow = (item) => {
      expandedRowKey.value = expandedRowKey.value === item.etf_code ? null : item.etf_code;
    };

    const getPastWeeks = (etf_code) => {
      if (!selectedMonday.value) return [];
      const pastData = allData.value.filter((item) => item.etf_code === etf_code && (item.day_status || item.week_status));
      const weekMap = {};
      pastData.forEach((item) => {
        if (!item.date || !isValidDate(item.date)) return;
        const wDays = getWeekDays(item.date);
        if (!wDays.length) return;
        const monday = wDays[0];
        if (monday === selectedMonday.value) return;
        if (!weekMap[monday]) weekMap[monday] = { monday, days: [null, null, null, null, null], week_status: null };
        const idx = wDays.indexOf(item.date);
        if (idx !== -1) weekMap[monday].days[idx] = item;
        if (item.week_status && item.week_status !== "-" && item.week_status !== "--") weekMap[monday].week_status = item.week_status;
      });
      return Object.values(weekMap).sort((a, b) => b.monday.localeCompare(a.monday));
    };

    const fetchSharedWatchlist = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/watchlist/shared`);
        const data = await res.json();
        if (data.success) sharedWatchlist.value = data.data || [];
      } catch (_) {}
    };

    // ---------- 定制（个人中心） ----------
    const customWatchlist = ref([]);
    const customLoading = ref(false);
    const customEditorVisible = ref(false);
    const customDraftItems = ref([{ etf_code: "", etf_name: "" }]);

    const customSymbolCount = computed(() =>
      customDraftItems.value.filter((r) => String(r.etf_code || "").trim()).length || 1
    );

    const fetchCustomWatchlist = async () => {
      if (!isLoggedIn.value) { customWatchlist.value = []; return; }
      customLoading.value = true;
      try {
        const data = await apiFetch("/api/watchlist/custom");
        customWatchlist.value = data.data || [];
      } catch (_) {
        customWatchlist.value = [];
      } finally {
        customLoading.value = false;
      }
    };

    const openCustomEditor = () => {
      if (!isLoggedIn.value) { openAuth("login"); return; }
      customDraftItems.value = [{ etf_code: "", etf_name: "" }];
      customEditorVisible.value = true;
    };

    const confirmCustomAndPay = () => {
      const items = customDraftItems.value
        .map((r) => ({ etf_code: String(r.etf_code || "").trim(), etf_name: String(r.etf_name || r.etf_code || "").trim() }))
        .filter((r) => r.etf_code);
      if (!items.length) { alert("请至少填写一只代码"); return; }
      sessionStorage.setItem("pending_custom_items", JSON.stringify(items));
      customEditorVisible.value = false;
      planTab.value = "custom";
      topUpForm.orderType = "custom_watchlist";
      navigate("#/plan");
      // 选中第一个定制套餐并重算
      nextTick(() => {
        const customPlans = vipPlans.value.filter((p) => (p.plan_type || "") === "custom");
        if (customPlans.length) selectTopUpPlan(customPlans[0]);
        else if (vipPlans.value.length) selectTopUpPlan(vipPlans.value[0]);
        recalcCustomPrice();
      });
    };

    const removeCustomItem = async (item) => {
      if (!confirm(`移除 ${item.etf_code}？`)) return;
      try {
        await apiFetch("/api/watchlist/custom", { method: "DELETE", body: JSON.stringify({ id: item.id }) });
        fetchCustomWatchlist();
      } catch (e) {
        alert(e.message);
      }
    };

    // ---------- 图表（仅通用 VIP 或前 N） ----------
    let currentViewer = null;
    const freeTopN = computed(() => parseInt(publicSettings.value.free_top_n_charts, 10) || 3);

    const openChart = (etfCode, type, index) => {
      if (isLoggedIn.value && isVip.value) { showViewer(etfCode, type); return; }
      // 仅允许「最新周锁定 TOP N」中的代码，与当前行 index / 排序无关
      const isInFreeList = freeEtfCodes.value.includes(etfCode);
      if (isInFreeList) { showViewer(etfCode, type); return; }
      if (confirm("此为「通用监控」VIP专属图表。\n是否去开通通用VIP？")) {
        if (!isLoggedIn.value) openAuth("login");
        else { planTab.value = "shared"; navigate("#/plan"); }
      }
    };

    const showViewer = (etfCode, type) => {
      const specificKey = `${etfCode}_${type}`;
      let imgUrl = null;
      if (chartsMap.value?.[specificKey]) imgUrl = chartsMap.value[specificKey];
      else if (chartsMap.value?.[etfCode]?.[type]) imgUrl = chartsMap.value[etfCode][type];
      else if (type === "weekly") {
        if (typeof chartsMap.value?.[etfCode] === "string") {
          const raw = chartsMap.value[etfCode];
          imgUrl = raw.includes("_daily") ? raw.replace("_daily", "_weekly") : raw.replace(/\.png$/i, "_weekly.png");
        } else imgUrl = `https://pub-973330e118204686a625fe51431d4336.r2.dev/charts/${etfCode}_weekly.png`;
      } else {
        imgUrl = typeof chartsMap.value?.[etfCode] === "string"
          ? chartsMap.value[etfCode]
          : `https://pub-973330e118204686a625fe51431d4336.r2.dev/charts/${etfCode}_daily.png`;
      }
      const image = new Image();
      image.src = imgUrl.split("?")[0];
      if (currentViewer) currentViewer.destroy();
      currentViewer = new Viewer(image, {
        hidden: () => { currentViewer.destroy(); currentViewer = null; },
        navbar: false, title: false, button: true, backdrop: true,
      });
      currentViewer.show();
    };

    const getColorClass = (status) => {
      if (!status || status === "-" || status === "--") return "text-slate-300";
      return status.includes("+") ? "text-red-500" : "text-emerald-500";
    };

    // ---------- 套餐 / 支付 ----------
    const orderList = ref([]);
    const vipPlans = ref([]);
    const planTab = ref("shared");
    const showManualInput = ref(false);
    const payChannel = ref("alipay");
    const topUpForm = reactive({
      planId: "month",
      amount: 18.8,
      originalAmount: 18.8,
      floatingAmount: "18.82",
      txId: "",
      orderType: "vip",
      unitPrice: 18.8,
    });
    const orderLoading = ref(false);
    const orderMessage = ref("");
    const promoInput = ref("");
    const promoChecking = ref(false);
    const promoValid = ref(false);
    const promoMessage = ref("");
    const payRegister = reactive({ username: "", password: "", refCode: "" });

    const displayPlans = computed(() => {
      if (planTab.value === "custom") {
        return vipPlans.value.filter((p) => (p.plan_type || "") === "custom");
      }
      return vipPlans.value.filter((p) => (p.plan_type || "shared") === "shared" || !p.plan_type);
    });

    const displayPayAmount = computed(() => topUpForm.floatingAmount);

    const currentPayQr = computed(() => {
      if (payChannel.value === "wechat") return publicSettings.value.wechat_qr_url || "";
      return publicSettings.value.alipay_qr_url || "";
    });

    const generateFloatingAmount = (basePrice) => {
      const randCents = (Math.floor(Math.random() * 5) + 1) / 100;
      return (Number(basePrice) + randCents).toFixed(2);
    };

    const recalcCustomPrice = () => {
      const qty = planTab.value === "custom" ? customSymbolCount.value : 1;
      const unit = Number(topUpForm.unitPrice) || 0;
      const base = unit * qty;
      topUpForm.amount = base;
      topUpForm.originalAmount = base;
      if (!promoValid.value) {
        topUpForm.floatingAmount = generateFloatingAmount(base);
      }
    };

    const selectTopUpPlan = (plan) => {
      topUpForm.planId = plan.id;
      topUpForm.unitPrice = Number(plan.price);
      topUpForm.orderType = (plan.plan_type === "custom" || planTab.value === "custom") ? "custom_watchlist" : "vip";
      promoValid.value = false;
      promoMessage.value = "";
      promoInput.value = "";
      const qty = topUpForm.orderType === "custom_watchlist" ? customSymbolCount.value : 1;
      const base = Number(plan.price) * qty;
      topUpForm.amount = base;
      topUpForm.originalAmount = base;
      topUpForm.floatingAmount = generateFloatingAmount(base);
    };

    watch(planTab, (tab) => {
      const list = tab === "custom"
        ? vipPlans.value.filter((p) => p.plan_type === "custom")
        : vipPlans.value.filter((p) => (p.plan_type || "shared") === "shared" || !p.plan_type);
      if (list.length) selectTopUpPlan(list[0]);
    });

    watch(customDraftItems, () => {
      if (planTab.value === "custom" && topUpForm.planId) {
        if (promoValid.value) applyPromo();
        else recalcCustomPrice();
      }
    }, { deep: true });

    const applyPromo = async () => {
      if (!promoInput.value.trim()) { promoMessage.value = "请输入优惠码"; promoValid.value = false; return; }
      if (!topUpForm.planId) { alert("请先选择套餐"); return; }
      promoChecking.value = true;
      try {
        const qty = planTab.value === "custom" ? customSymbolCount.value : 1;
        const res = await fetch(`${API_BASE}/api/promo/check`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(localStorage.getItem("etf_token") ? { Authorization: `Bearer ${localStorage.getItem("etf_token")}` } : {}),
          },
          body: JSON.stringify({ plan_id: topUpForm.planId, promo_code: promoInput.value.trim(), quantity: qty }),
        });
        const data = await res.json();
        if (data.success) {
          promoValid.value = true;
          promoMessage.value = `已优惠 ¥${data.discount}，实付基准 ¥${data.amount}`;
          topUpForm.originalAmount = data.original_amount;
          topUpForm.amount = data.amount;
          topUpForm.floatingAmount = generateFloatingAmount(data.amount);
        } else {
          promoValid.value = false;
          promoMessage.value = data.error || "优惠码无效";
        }
      } catch (_) {
        promoValid.value = false;
        promoMessage.value = "校验失败，请重试";
      } finally {
        promoChecking.value = false;
      }
    };

    const fetchPlans = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/plans`);
        const data = await res.json();
        if (data.success && data.data?.length) {
          vipPlans.value = data.data;
          const list = displayPlans.value;
          if (list.length && !list.find((p) => p.id === topUpForm.planId)) selectTopUpPlan(list[0]);
          else if (list.length) selectTopUpPlan(list.find((p) => p.id === topUpForm.planId) || list[0]);
        }
      } catch (_) {}
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
          if (isLoggedIn.value) {
            isVip.value = !!data.is_vip;
            if (data.shared_vip_days != null) {
              vipDaysLeft.value = data.shared_vip_days;
              localStorage.setItem("etf_vip_days", data.shared_vip_days);
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
        ]);
        if (res1 && res1.ok) {
          const data = await res1.json();
          if (Array.isArray(data)) {
            allData.value = data;
            if (availablePeriods.value.length > 0 && availablePeriods.value[0].weeks.length > 0) {
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

    const fetchOrders = async () => {
      if (!isLoggedIn.value) return;
      try {
        const res = await apiFetch("/api/user/orders");
        orderList.value = res.data || [];
      } catch (_) {}
    };

    const inviteeList = ref([]);
    const inviteeLoading = ref(false);
    const fetchInvitees = async () => {
      if (!isLoggedIn.value) return;
      inviteeLoading.value = true;
      try {
        const res = await apiFetch("/api/user/invitees");
        inviteeList.value = res.data || [];
      } catch (_) {
        inviteeList.value = [];
      } finally {
        inviteeLoading.value = false;
      }
    };

    // ---------- 答疑 ----------
    const ticketList = ref([]);
    const showTicketForm = ref(false);
    const ticketLoading = ref(false);
    const ticketForm = reactive({ subject: "", level: "medium", message: "" });

    const fetchTickets = async () => {
      if (!isLoggedIn.value) return;
      try {
        const res = await apiFetch("/api/tickets");
        ticketList.value = res.data || [];
      } catch (_) {
        ticketList.value = [];
      }
    };

    const submitTicket = async () => {
      if (!ticketForm.subject.trim() || !ticketForm.message.trim()) {
        alert("请填写主题和内容");
        return;
      }
      ticketLoading.value = true;
      try {
        await apiFetch("/api/tickets", {
          method: "POST",
          body: JSON.stringify({
            subject: ticketForm.subject.trim(),
            level: ticketForm.level,
            message: ticketForm.message.trim(),
          }),
        });
        alert("提交成功");
        ticketForm.subject = "";
        ticketForm.message = "";
        showTicketForm.value = false;
        fetchTickets();
      } catch (e) {
        alert(e.message);
      } finally {
        ticketLoading.value = false;
      }
    };

    const submitOrder = async () => {
      if (!/^\d{6}$/.test(topUpForm.txId)) { alert("请填写6位数字凭证"); return; }

      if (!isLoggedIn.value) {
        if (!payRegister.username || !payRegister.password) {
          alert("未登录请填写注册邮箱和密码，或先登录");
          return;
        }
        if (!isEmail(payRegister.username)) { alert("注册账号必须是合法邮箱"); return; }
        if (String(payRegister.password).length < 6) { alert("密码至少6位"); return; }
      }

      if (isLoggedIn.value && orderList.value.some((o) => o.status === "pending")) {
        alert("您有待审核订单，请勿重复提交");
        return;
      }

      let customItems = null;
      if (planTab.value === "custom" || topUpForm.orderType === "custom_watchlist") {
        customItems = customDraftItems.value
          .map((r) => ({ etf_code: String(r.etf_code || "").trim(), etf_name: String(r.etf_name || "").trim() }))
          .filter((r) => r.etf_code);
        const pending = sessionStorage.getItem("pending_custom_items");
        if ((!customItems || !customItems.length) && pending) {
          try { customItems = JSON.parse(pending); } catch (_) {}
        }
        if (!customItems || !customItems.length) {
          alert("请填写至少一只定制标的代码");
          return;
        }
      }

      orderLoading.value = true;
      orderMessage.value = "";
      try {
        const body = {
          plan_id: topUpForm.planId,
          amount: Number(topUpForm.floatingAmount) || topUpForm.amount,
          tx_id_last6: topUpForm.txId,
          promo_code: promoValid.value ? promoInput.value.trim() : undefined,
          order_type: (planTab.value === "custom" || topUpForm.orderType === "custom_watchlist") ? "custom_watchlist" : "vip",
        };
        if (customItems) body.custom_items = customItems;
        if (!isLoggedIn.value) {
          body.register_username = payRegister.username.trim();
          body.register_password = payRegister.password;
          if (payRegister.refCode) body.ref_code = payRegister.refCode;
        }

        const headers = { "Content-Type": "application/json" };
        const token = localStorage.getItem("etf_token");
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(`${API_BASE}/api/orders`, { method: "POST", headers, body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || "提交失败");

        orderMessage.value = "提交成功！等待审核开通";
        topUpForm.txId = "";
        sessionStorage.removeItem("pending_custom_items");
        if (isLoggedIn.value) {
          setTimeout(() => { fetchOrders(); fetchCustomWatchlist(); }, 1500);
        }
      } catch (err) {
        orderMessage.value = err.message;
      } finally {
        orderLoading.value = false;
      }
    };

    const getPlanName = (planId) => {
      const p = vipPlans.value.find((x) => x.id === planId);
      return p ? p.name : planId;
    };
    const formatStatus = (s) => (s === "approved" ? "已完成" : s === "pending" ? "审核中" : "已取消");

    const pwdForm = reactive({ old: "", new: "", confirm: "" });
    const pwdLoading = ref(false);
    const submitPasswordChange = async () => {
      if (!pwdForm.old || !pwdForm.new || pwdForm.new !== pwdForm.confirm) {
        alert("请正确填写且两次新密码一致");
        return;
      }
      pwdLoading.value = true;
      try {
        await apiFetch("/api/password", {
          method: "POST",
          body: JSON.stringify({ old_password: pwdForm.old, new_password: pwdForm.new }),
        });
        alert("密码修改成功，请重新登录");
        logout(false);
      } catch (err) {
        alert(err.message);
      } finally {
        pwdLoading.value = false;
        pwdForm.old = ""; pwdForm.new = ""; pwdForm.confirm = "";
      }
    };

    const chatModule = typeof useChatModule === "function" ? useChatModule(Vue) : {};
    const chatOpen = ref(false);
    const chatInput = ref("");
    const chatMessages = ref([]);
    const unreadCount = ref(0);

    const openChat = () => {
      if (!isLoggedIn.value) { openAuth("login"); return; }
      chatOpen.value = true;
      if (chatModule.openChat) chatModule.openChat();
    };
    const sendChatMessage = () => {
      if (chatModule.sendChatMessage) chatModule.sendChatMessage();
      else if (chatInput.value.trim()) {
        chatMessages.value.push({
          sender: "user",
          content: chatInput.value,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          type: "text",
        });
        chatInput.value = "";
      }
    };

    watch(currentRoute, (newRoute) => {
      searchQuery.value = "";
      if (newRoute === "#/profile" && isLoggedIn.value) {
        fetchOrders();
        fetchInvitees();
        fetchCustomWatchlist();
      }
      if (newRoute === "#/tickets" && isLoggedIn.value) fetchTickets();
      if (newRoute === "#/plan") {
        const pending = sessionStorage.getItem("pending_custom_items");
        if (pending) {
          try {
            const items = JSON.parse(pending);
            if (items?.length) {
              customDraftItems.value = items;
              planTab.value = "custom";
            }
          } catch (_) {}
        }
      }
    });

    /**
     * 免费 TopN：与「最新一周 + 默认排序」完全一致，并锁定代码。
     * - 取 availablePeriods 最新一周（与默认选中周相同）
     * - 若该周已过周五 16:00：按 |周线| 从大到小
     * - 否则：按该周内「最新有数据的一天」的 |日线| 从大到小
     * - 不随用户切换历史周、点列排序、搜索而改变
     */
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

      // 组装与看板相同结构的最新一周数据
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

      // 未过周五：周线用上一周（与看板一致）
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

      // 与看板默认排序相同：优先 |周线|，否则最新日线列 |日线|
      items.sort((a, b) => {
        const valWkA =
          a.week_status && a.week_status !== "-" ? Math.abs(getStatusVal(a.week_status)) : -9999;
        const valWkB =
          b.week_status && b.week_status !== "-" ? Math.abs(getStatusVal(b.week_status)) : -9999;
        if (valWkA !== -9999 || valWkB !== -9999) {
          if (valWkA !== -9999 && valWkB !== -9999) return valWkB - valWkA;
          if (valWkA !== -9999) return -1;
          if (valWkB !== -9999) return 1;
        }
        let latestIdx = 4;
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
        if (latestIdx >= 0) {
          const valA =
            a.days[latestIdx] && a.days[latestIdx].day_status
              ? Math.abs(getStatusVal(a.days[latestIdx].day_status))
              : -9999;
          const valB =
            b.days[latestIdx] && b.days[latestIdx].day_status
              ? Math.abs(getStatusVal(b.days[latestIdx].day_status))
              : -9999;
          return valB - valA;
        }
        return 0;
      });

      freeEtfCodes.value = items.slice(0, n).map((i) => i.etf_code);
    };

    watch(
      [allData, sharedWatchlist, availablePeriods, () => publicSettings.value.free_top_n_charts],
      () => {
        computeLockedFreeTop();
      },
      { deep: true }
    );

    onMounted(() => {
      checkLoginState();
      fetchPublicSettings();
      fetchPlans();
      fetchData();
      if (isLoggedIn.value) {
        fetchOrders();
        fetchCustomWatchlist();
      }
      window.addEventListener("click", closeDropdowns);
      window.addEventListener("hashchange", () => {
        currentRoute.value = window.location.hash || "#/";
      });
    });
    onUnmounted(() => window.removeEventListener("click", closeDropdowns));

    return {
      currentRoute, menuOpen, userMenuOpen, pageTitle, navigate, requireLoginThen, closeDropdowns,
      isLoggedIn, isVip, username, vipDaysLeft, referralCode, logout, publicSettings,
      authModalVisible, authMode, authForm, authLoading, openAuth, closeAuth, submitAuth, switchAuthMode,
      sendEmailCode, sendCodeLoading, countdown,
      loading, sortedData, showDropdown, searchQuery, availablePeriods, currentPeriodLabel, selectWeek, selectedMonday,
      sortColumn, sortOrder, handleSort, expandedRowKey, toggleRow, getPastWeeks,
      openChart, getColorClass, isLatestDailyColumn, formatMobileStatus, getMobileStatusClass,
      getDayTooltip, getWeekTooltip, getMobileDayDate, getMobileWeekDate, freeEtfCodes,
      sharedWatchlist, customWatchlist, customLoading, customEditorVisible, customDraftItems, customSymbolCount,
      openCustomEditor, confirmCustomAndPay, removeCustomItem, formatDateShort,
      vipPlans, planTab, displayPlans, topUpForm, selectTopUpPlan, orderLoading, orderMessage, submitOrder, showManualInput,
      promoInput, promoChecking, promoValid, promoMessage, applyPromo, displayPayAmount, payRegister,
      payChannel, currentPayQr, recalcCustomPrice,
      orderList, getPlanName, formatStatus, formatDateExact, fetchOrders,
      inviteeList, inviteeLoading, fetchInvitees,
      ticketList, showTicketForm, ticketForm, ticketLoading, submitTicket, fetchTickets,
      pwdForm, pwdLoading, submitPasswordChange,
      chatOpen, chatInput, chatMessages, unreadCount, openChat, sendChatMessage,
      ...chatModule,
    };
  },
}).mount("#app");
