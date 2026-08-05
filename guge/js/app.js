/**
 * 波幅探长 app.js (完整修复 + 优化版)
 * 修复：公共数据独立加载、补全工具函数、Promise 容错、空状态提示
 */
const { createApp, ref, computed, reactive, onMounted, onUnmounted, watch, nextTick } = Vue;

// ========== 工具函数（原版缺失，现全部补全） ==========
function isValidDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr + "T00:00:00");
  return !isNaN(d.getTime());
}

function parseYear(dateStr) {
  return parseInt((dateStr || "").split("-")[0], 10) || 0;
}
function parseMonth(dateStr) {
  return parseInt((dateStr || "").split("-")[1], 10) || 0;
}
function parseDay(dateStr) {
  return parseInt((dateStr || "").split("-")[2], 10) || 0;
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 给定任意日期，返回该周的 Mon~Fri 字符串数组（交易日逻辑） */
function getWeekDays(dateStr) {
  if (!isValidDate(dateStr)) return [];
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0=Sun ... 6=Sat
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const days = [];
  for (let i = 0; i < 5; i++) {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    days.push(formatDate(dd));
  }
  return days;
}

function getWeekNumberInMonth(mondayStr) {
  if (!isValidDate(mondayStr)) return "";
  const d = new Date(mondayStr + "T00:00:00");
  const month = d.getMonth();
  let week = 1;
  const first = new Date(d.getFullYear(), month, 1);
  // 简单按「本月第几周」计算（以周一为基准）
  const firstMondayOffset = first.getDay() === 0 ? 1 : (1 - first.getDay() + 7) % 7;
  const firstMonday = new Date(first);
  firstMonday.setDate(1 + firstMondayOffset);
  if (d < firstMonday) return "第一周";
  const diff = Math.floor((d - firstMonday) / (7 * 86400000));
  const map = ["一", "二", "三", "四", "五", "六"];
  return `第${map[Math.min(diff, 5)] || "一"}周`;
}

function pureCode(code) {
  if (!code) return "";
  return String(code).replace(/\.(SH|SZ|ss|sz)$/i, "").trim();
}

function isEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str || "");
}

function formatDateShort(dateStr) {
  if (!isValidDate(dateStr)) return dateStr || "-";
  return `${parseMonth(dateStr)}/${parseDay(dateStr)}`;
}

function formatDateExact(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("zh-CN", { hour12: false });
  } catch {
    return dateStr;
  }
}

// ========== 常量（请根据实际后端修改） ==========
const API_BASE = window.API_BASE || ""; // 后端 API 根地址，可在 HTML 中预先定义
const MAIL_API_BASE = window.MAIL_API_BASE || API_BASE;
const TURNSTILE_SITEKEY = window.TURNSTILE_SITEKEY || "";
const PUBLIC_DATA_URL = atob("aHR0cHM6Ly9ldGYuaGFoYWd3LmV1Lm9yZy8="); // https://etf.hahagw.eu.org/

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
      custom_max_symbols: "3",
      vote_max_per_user: "10",
      vote_display_top_n: "100",
      vote_min_plan_days: "30",
      social_douyin: "",
      social_shipinhao: "",
      social_xiaohongshu: "",
      social_gongzhonghao: "",
      social_kuaishou: "",
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
        "#/vote": "监控投票",
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
        if (!API_BASE) return;
        const res = await fetch(`${API_BASE}/api/settings/public`);
        const data = await res.json();
        if (data.success && data.data) {
          publicSettings.value = { ...publicSettings.value, ...data.data };
          if (data.data.default_pay_channel) payChannel.value = data.data.default_pay_channel;
        }
      } catch (_) {}
    };

    // 认证
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
          alert(reg.message || "注册成功，请登录");
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
      if (showAlert) alert("已退出登录");
      navigate("#/");
    };

    // ========== 看板核心 ==========
    const loading = ref(false);
    const loadError = ref(""); // 新增：错误提示
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

    const isDailyChartColumn = (idx) => idx === latestDailyColIndex.value && latestDailyColIndex.value >= 0;

    const getColumnDateLabel = (idx) => {
      if (!selectedMonday.value) return "";
      const weekDays = getWeekDays(selectedMonday.value);
      if (!weekDays[idx]) return "";
      return getDayTooltip(weekDays[idx]) || weekDays[idx];
    };

    const formatMobileStatus = (status) => {
      if (!status || status === "-" || status === "--") return "-";
      const match = String(status).match(/([-+]?[0-9]*\.?[0-9]+)/);
      return match ? match[0] : "-";
    };
    const getMobileStatusClass = (status) => {
      if (!status || status === "-" || status === "--") return "mobile-status-neutral";
      return String(status).includes("+") ? "mobile-status-up" : "mobile-status-down";
    };

    // 核心看板渲染与过滤
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
        const prevMondayStr = formatDate(prevMon);
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

      if (isLoggedIn.value && isVip.value) {
        if (sharedWatchlist.value.length > 0) {
          const codeSet = new Set(sharedWatchlist.value.map((w) => w.etf_code));
          const filtered = validItems.filter((i) => codeSet.has(i.etf_code));
          if (filtered.length > 0) validItems = filtered;
        }
      } else if (isLoggedIn.value && !isVip.value) {
        const activeCustom = (customWatchlist.value || []).filter(
          (w) => w.status === "active" || w.status === "pending"
        );
        if (activeCustom.length > 0) {
          const customCodes = new Set(
            activeCustom.map((w) => pureCode(w.etf_code)).filter(Boolean)
          );
          const freeSet = new Set(freeEtfCodes.value);
          validItems = validItems.filter((i) => {
            const pure = pureCode(i.etf_code);
            return customCodes.has(pure) || customCodes.has(i.etf_code) || freeSet.has(i.etf_code);
          });
        } else if (sharedWatchlist.value.length > 0) {
          const codeSet = new Set(sharedWatchlist.value.map((w) => w.etf_code));
          const filtered = validItems.filter((i) => codeSet.has(i.etf_code));
          if (filtered.length > 0) validItems = filtered;
        }
      } else if (sharedWatchlist.value.length > 0) {
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
        if (!API_BASE) return;
        const res = await fetch(`${API_BASE}/api/watchlist/shared`);
        const data = await res.json();
        if (data.success) sharedWatchlist.value = data.data || [];
      } catch (_) {}
    };

    const fetchChartsMap = async () => {
      try {
        if (!API_BASE) return;
        const token = localStorage.getItem("etf_token");
        const headers = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${API_BASE}/api/etfs`, { headers });
        if (res.ok) {
          const data = await res.json();
          chartsMap.value = data.charts || {};
          chartAsOfFromApi.value = data.chart_as_of && isValidDate(data.chart_as_of) ? data.chart_as_of : "";
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

    // ========== 关键修复：公共数据独立加载 ==========
    const fetchData = async () => {
      loading.value = true;
      loadError.value = "";
      try {
        // 1. 优先、独立加载公共历史数据（不依赖 API_BASE）
        let publicOk = false;
        try {
          const res1 = await fetch(PUBLIC_DATA_URL);
          if (res1.ok) {
            const data = await res1.json();
            if (Array.isArray(data) && data.length > 0) {
              allData.value = data;
              publicOk = true;
              // 自动选最新有数据的周
              if (availablePeriods.value.length > 0 && availablePeriods.value[0].weeks.length > 0) {
                selectedMonday.value = availablePeriods.value[0].weeks[0].monday;
              }
            }
          }
        } catch (e) {
          console.error("公共数据加载失败", e);
          loadError.value = "历史数据源暂时不可用，请稍后重试";
        }

        // 2. 其他接口并行，互不影响
        await Promise.allSettled([
          fetchChartsMap(),
          fetchSharedWatchlist(),
        ]);

        if (!publicOk && !allData.value.length) {
          loadError.value = loadError.value || "暂无历史数据，请检查网络或稍后刷新";
        }
      } catch (e) {
        console.error(e);
        loadError.value = "数据加载异常：" + (e.message || "未知错误");
      } finally {
        loading.value = false;
      }
    };

    const computeLockedFreeTop = () => {
      const n = parseInt(publicSettings.value.free_top_n_charts, 10) || 3;
      const rows = allData.value || [];
      if (!rows.length) { freeEtfCodes.value = []; return; }
      let latestMonday = availablePeriods.value.length > 0 && availablePeriods.value[0].weeks?.length > 0 ? availablePeriods.value[0].weeks[0].monday : "";
      if (!latestMonday) { freeEtfCodes.value = []; return; }
      const weekDays = getWeekDays(latestMonday);
      if (weekDays.length < 5) { freeEtfCodes.value = []; return; }
      const sharedCodes = sharedWatchlist.value.length ? new Set(sharedWatchlist.value.map((w) => w.etf_code)) : null;
      const inScope = (code) => !sharedCodes || sharedCodes.has(code);
      const fridayDate = weekDays[4];
      const fy = parseYear(fridayDate), fm = parseMonth(fridayDate), fd = parseDay(fridayDate);
      const isPastFriday16 = fy ? Date.now() >= new Date(fy, fm - 1, fd, 16, 0, 0).getTime() : false;
      const etfMap = {};
      rows.forEach((item) => {
        if (!inScope(item.etf_code) || !item.date) return;
        const idx = weekDays.indexOf(item.date);
        if (idx === -1) return;
        if (!etfMap[item.etf_code]) { etfMap[item.etf_code] = { etf_code: item.etf_code, days: [null, null, null, null, null], week_status: null }; }
        etfMap[item.etf_code].days[idx] = item;
        if (isPastFriday16 && item.week_status && item.week_status !== "-" && item.week_status !== "--") {
          etfMap[item.etf_code].week_status = item.week_status;
        }
      });
      let items = Object.values(etfMap).filter((item) => item.days.some((d) => d && d.day_status && d.day_status !== "-") || (item.week_status && item.week_status !== "-"));
      items.sort((a, b) => {
        const valWkA = a.week_status && a.week_status !== "-" ? Math.abs(getStatusVal(a.week_status)) : -9999;
        const valWkB = b.week_status && b.week_status !== "-" ? Math.abs(getStatusVal(b.week_status)) : -9999;
        return valWkB - valWkA;
      });
      freeEtfCodes.value = items.slice(0, n).map((i) => i.etf_code);
    };

    watch([allData, sharedWatchlist, availablePeriods, () => publicSettings.value.free_top_n_charts], () => {
      computeLockedFreeTop();
    }, { deep: true });

    // 监控投票逻辑（保持原样）
    const voteList = ref([]);
    const voteSearchQuery = ref("");
    const voteModalVisible = ref(false);
    const voteSubmitting = ref(false);
    const voteDraftItems = ref([{ etf_code: "", etf_name: "" }]);
    const myVotedCodes = ref([]);

    const voteMaxPerUser = computed(() => parseInt(publicSettings.value.vote_max_per_user, 10) || 10);
    const voteDisplayTopN = computed(() => parseInt(publicSettings.value.vote_display_top_n, 10) || 100);
    const voteMinPlanDays = computed(() => parseInt(publicSettings.value.vote_min_plan_days, 10) || 30);
    const hasVoteEligibility = computed(() => isLoggedIn.value && vipDaysLeft.value >= voteMinPlanDays.value);
    const userVotedCount = computed(() => myVotedCodes.value.length);

    const fetchVotes = async () => {
      try {
        if (!API_BASE) return;
        const res = await fetch(`${API_BASE}/api/votes/top`);
        const data = await res.json();
        if (data.success) voteList.value = data.data || [];
        if (isLoggedIn.value) {
          const userRes = await apiFetch("/api/user/votes");
          if (userRes.success) myVotedCodes.value = userRes.data || [];
        }
      } catch (_) {}
    };

    const filteredVoteList = computed(() => {
      let list = voteList.value;
      if (voteSearchQuery.value) {
        const q = voteSearchQuery.value.toLowerCase().trim();
        list = list.filter((i) => i.etf_code.toLowerCase().includes(q) || (i.etf_name && i.etf_name.toLowerCase().includes(q)));
      }
      return list.slice(0, voteDisplayTopN.value);
    });

    const maxVoteCount = computed(() => voteList.value.length ? Math.max(...voteList.value.map((i) => i.vote_count || 0), 1) : 1);
    const getVotePercent = (count) => Math.min(100, Math.round(((count || 0) / maxVoteCount.value) * 100));

    const openVoteModal = () => {
      if (!isLoggedIn.value) { openAuth("login"); return; }
      if (!hasVoteEligibility.value) {
        alert(`监控投票仅限付费周期 ≥ ${voteMinPlanDays.value} 天的会员参与`);
        navigate("#/plan");
        return;
      }
      voteDraftItems.value = [{ etf_code: "", etf_name: "" }];
      voteModalVisible.value = true;
    };

    const quickVote = async (code, name) => {
      if (!isLoggedIn.value) { openAuth("login"); return; }
      if (!hasVoteEligibility.value) { alert("只有月度及以上付费会员可参与投票"); return; }
      if (userVotedCount.value >= voteMaxPerUser.value) { alert(`您本月投票额度已满`); return; }
      try {
        await apiFetch("/api/votes/submit", { method: "POST", body: JSON.stringify({ votes: [{ etf_code: code, etf_name: name }] }) });
        alert(`投票成功！`);
        fetchVotes();
      } catch (e) { alert(e.message); }
    };

    const submitVotes = async () => {
      const validVotes = voteDraftItems.value.map((r) => ({ etf_code: pureCode(r.etf_code), etf_name: (r.etf_name || r.etf_code).trim() })).filter((r) => r.etf_code);
      if (!validVotes.length) { alert("请至少填写一只标的代码"); return; }
      voteSubmitting.value = true;
      try {
        await apiFetch("/api/votes/submit", { method: "POST", body: JSON.stringify({ votes: validVotes }) });
        alert("监控投票提交成功！");
        voteModalVisible.value = false;
        fetchVotes();
      } catch (e) { alert(e.message); }
      finally { voteSubmitting.value = false; }
    };

    // 定制标的与套餐支付逻辑
    const customWatchlist = ref([]);
    const customLoading = ref(false);
    const customEditorVisible = ref(false);
    const customDraftItems = ref([{ etf_code: "", etf_name: "" }]);

    const fetchCustomWatchlist = async () => {
      if (!isLoggedIn.value) { customWatchlist.value = []; return; }
      customLoading.value = true;
      try {
        const data = await apiFetch("/api/watchlist/custom");
        customWatchlist.value = data.data || [];
      } catch (_) { customWatchlist.value = []; }
      finally { customLoading.value = false; }
    };

    const removeCustomItem = async (item) => {
      if (!confirm(`移除 ${item.etf_code}？`)) return;
      try {
        await apiFetch("/api/watchlist/custom", { method: "DELETE", body: JSON.stringify({ id: item.id }) });
        fetchCustomWatchlist();
      } catch (e) { alert(e.message); }
    };

    let currentViewer = null;
    const openChart = (etfCode, type) => {
      if (isLoggedIn.value && isVip.value) { showViewer(etfCode, type); return; }
      if (freeEtfCodes.value.includes(etfCode)) { showViewer(etfCode, type); return; }
      if (confirm("此为「通用监控」VIP专属图表。\n是否去开通通用VIP？")) {
        if (!isLoggedIn.value) openAuth("login");
        else { planTab.value = "shared"; navigate("#/plan"); }
      }
    };

    const showViewer = (etfCode, type) => {
      const specificKey = `${etfCode}_${type}`;
      let imgUrl = chartsMap.value?.[specificKey] || `https://pub-973330e118204686a625fe51431d4336.r2.dev/charts/${etfCode}_${type}.png`;
      const image = new Image();
      image.src = imgUrl.split("?")[0];
      if (currentViewer) currentViewer.destroy();
      currentViewer = new Viewer(image, { hidden: () => { currentViewer.destroy(); currentViewer = null; }, navbar: false, title: false, button: true, backdrop: true });
      currentViewer.show();
    };

    const getColorClass = (status) => {
      if (!status || status === "-" || status === "--") return "text-slate-300";
      return status.includes("+") ? "text-red-500" : "text-emerald-500";
    };

    const orderList = ref([]);
    const vipPlans = ref([]);
    const planTab = ref("shared");
    const showManualInput = ref(false);
    const payChannel = ref("alipay");
    const topUpForm = reactive({ planId: "month", amount: 18.8, txId: "", orderType: "vip" });
    const orderLoading = ref(false);
    const orderMessage = ref("");
    const promoInput = ref("");
    const promoChecking = ref(false);
    const promoValid = ref(false);
    const promoMessage = ref("");
    const payRegister = reactive({ username: "", password: "", refCode: "" });

    const displayPlans = computed(() => vipPlans.value.filter((p) => (p.plan_type || "shared") === planTab.value));
    const displayPayAmount = computed(() => topUpForm.amount);
    const currentPayQrSrc = computed(() => payChannel.value === "wechat" ? publicSettings.value.wechat_qr_url : publicSettings.value.alipay_qr_url);

    const selectTopUpPlan = (plan) => { topUpForm.planId = plan.id; topUpForm.amount = Number(plan.price); };

    const fetchPlans = async () => {
      try {
        if (!API_BASE) return;
        const res = await fetch(`${API_BASE}/api/plans`);
        const data = await res.json();
        if (data.success && data.data?.length) {
          vipPlans.value = data.data;
          selectTopUpPlan(displayPlans.value[0] || data.data[0]);
        }
      } catch (_) {}
    };

    const ticketList = ref([]);
    const showTicketForm = ref(false);
    const ticketLoading = ref(false);
    const ticketForm = reactive({ subject: "", level: "medium", message: "" });

    const submitTicket = async () => {
      if (!ticketForm.subject.trim() || !ticketForm.message.trim()) { alert("请填写完整"); return; }
      ticketLoading.value = true;
      try {
        await apiFetch("/api/tickets", { method: "POST", body: JSON.stringify(ticketForm) });
        alert("提交成功");
        ticketForm.subject = ""; ticketForm.message = "";
        showTicketForm.value = false;
      } catch (e) { alert(e.message); }
      finally { ticketLoading.value = false; }
    };

    const pwdForm = reactive({ old: "", new: "", confirm: "" });
    const pwdLoading = ref(false);
    const submitPasswordChange = async () => {
      if (!pwdForm.old || pwdForm.new !== pwdForm.confirm) { alert("密码输入不一致"); return; }
      pwdLoading.value = true;
      try {
        await apiFetch("/api/password", { method: "POST", body: JSON.stringify({ old_password: pwdForm.old, new_password: pwdForm.new }) });
        alert("修改成功，请重新登录");
        logout(false);
      } catch (e) { alert(e.message); }
      finally { pwdLoading.value = false; }
    };

    watch(currentRoute, (r) => {
      if (r === "#/vote") fetchVotes();
      if (r === "#/profile" && isLoggedIn.value) fetchCustomWatchlist();
    });

    onMounted(() => {
      checkLoginState();
      fetchPublicSettings();
      fetchData();
      fetchPlans();
      if (currentRoute.value === "#/vote") fetchVotes();
      window.addEventListener("click", closeDropdowns);
      window.addEventListener("hashchange", () => { currentRoute.value = window.location.hash || "#/"; });
    });

    onUnmounted(() => window.removeEventListener("click", closeDropdowns));

    return {
      currentRoute, menuOpen, userMenuOpen, pageTitle, navigate, requireLoginThen, closeDropdowns,
      isLoggedIn, isVip, username, vipDaysLeft, referralCode, logout, publicSettings,
      authModalVisible, authMode, authForm, authLoading, openAuth, closeAuth, submitAuth, switchAuthMode,
      sendEmailCode, sendCodeLoading, countdown,
      loading, loadError, sortedData, showDropdown, searchQuery, availablePeriods, currentPeriodLabel, selectWeek, selectedMonday,
      handleSort, expandedRowKey, toggleRow, getPastWeeks,
      openChart, getColorClass, isDailyChartColumn, getColumnDateLabel,
      formatMobileStatus, getMobileStatusClass, getDayTooltip, getWeekTooltip, getMobileDayDate, getMobileWeekDate, freeEtfCodes,
      
      voteList, filteredVoteList, voteSearchQuery, voteModalVisible, voteSubmitting, voteDraftItems,
      hasVoteEligibility, userVotedCount, voteMaxPerUser, voteDisplayTopN, myVotedCodes,
      fetchVotes, openVoteModal, quickVote, submitVotes, getVotePercent,
      
      customWatchlist, customLoading, customEditorVisible, customDraftItems, removeCustomItem, formatDateShort,
      vipPlans, planTab, displayPlans, topUpForm, selectTopUpPlan, orderLoading, orderMessage, showManualInput,
      promoInput, promoChecking, promoValid, promoMessage, displayPayAmount, payRegister, payChannel, currentPayQrSrc,
      orderList, formatDateExact, ticketList, showTicketForm, ticketForm, ticketLoading, submitTicket,
      pwdForm, pwdLoading, submitPasswordChange,
      // 暴露给模板的工具
      getWeekDays, isValidDate,
    };
  },
}).mount("#app");
