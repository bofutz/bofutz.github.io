/**
 * 波幅探长 前台逻辑处理脚本 v2.3
 * js/app.js
 */

const { createApp, ref, computed, reactive, onMounted, onUnmounted, watch, nextTick } = Vue;

createApp({
  setup() {
    // 路由与页面状态
    const currentRoute = ref(window.location.hash || "#/");
    const menuOpen = ref(false);
    const userMenuOpen = ref(false);
    const freeEtfCodes = ref([]);
    
    // 全局系统配置参数
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

    // 封装通用 API 请求
    const apiFetch = async (endpoint, options = {}) => {
      const token = localStorage.getItem("etf_token");
      options.headers = options.headers || {};
      if (token) options.headers["Authorization"] = `Bearer ${token}`;
      options.headers["Content-Type"] = "application/json";
      
      const res = await fetch(`${API_BASE}${endpoint}`, options);
      if (res.status === 401) {
        logout(false);
        throw new Error("登录已过期，请重新登录");
      }
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "请求失败");
      return data;
    };

    // 用户登录与状态管理
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

    // 用户认证 (登录/注册)
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
          fetchVotes();
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

    // 看板与行情数据处理
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

    const handleSort = (column) => {
      if (sortColumn.value === column) {
        sortOrder.value = sortOrder.value === "desc" ? "asc" : "desc";
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

    const getDayTooltip = (dateStr) => isValidDate(dateStr) ? `${String(parseMonth(dateStr)).padStart(2, "0")}-${String(parseDay(dateStr)).padStart(2, "0")}` : "";
    const getWeekTooltip = (mondayStr) => isValidDate(mondayStr) ? `${String(parseMonth(mondayStr)).padStart(2, "0")}-${getWeekNumberInMonth(mondayStr)}` : "";
    const getMobileDayDate = (d) => getDayTooltip(d);
    const getMobileWeekDate = (m) => getWeekTooltip(m);

    const uniqueDatesSet = computed(() => new Set(allData.value.filter((i) => (i.day_status || i.week_status) && isValidDate(i.date)).map((i) => i.date)));

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
      if (chartAsOfFromApi.value && isValidDate(chartAsOfFromApi.value)) return chartAsOfFromApi.value;
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
      return weekDays.length < 5 ? -1 : weekDays.indexOf(chartAsOfDate.value);
    });

    const isDailyChartColumn = (idx) => idx === latestDailyColIndex.value && latestDailyColIndex.value >= 0;

    const getColumnDateLabel = (idx) => {
      if (!selectedMonday.value) return "";
      const weekDays = getWeekDays(selectedMonday.value);
      return weekDays[idx] ? getDayTooltip(weekDays[idx]) || weekDays[idx] : "";
    };

    const formatMobileStatus = (status) => {
      if (!status || status === "-" || status === "--") return "-";
      const match = String(status).match(/([-+]?[0-9]*\.?[0-9]+)/);
      return match ? match : "-";
    };
    const getMobileStatusClass = (status) => {
      if (!status || status === "-" || status === "--") return "mobile-status-neutral";
      return String(status).includes("+") ? "mobile-status-up" : "mobile-status-down";
    };

    const sortedData = computed(() => {
      if (!selectedMonday.value) return [];
      const weekDays = getWeekDays(selectedMonday.value);
      if (weekDays.length < 5) return [];
      const etfMap = {};

      allData.value.forEach((item) => {
        if (!item.date) return;
        const idx = weekDays.indexOf(item.date);
        if (idx !== -1) {
          if (!etfMap[item.etf_code]) {
            etfMap[item.etf_code] = { etf_code: item.etf_code, etf_name: item.etf_name, days: [null, null, null, null, null], week_status: null };
          }
          etfMap[item.etf_code].days[idx] = item;
          if (item.week_status && item.week_status !== "-" && item.week_status !== "--") {
            etfMap[item.etf_code].week_status = item.week_status;
          }
        }
      });

      let validItems = Object.values(etfMap);
      if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase().trim();
        validItems = validItems.filter(
          (item) => (item.etf_name && item.etf_name.toLowerCase().includes(q)) || (item.etf_code && item.etf_code.toLowerCase().includes(q))
        );
      }
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

    // 监控投票核心逻辑模块（新增）
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
        const res = await fetch(`${API_BASE}/api/votes/top`);
        const data = await res.json();
        if (data.success) {
          voteList.value = data.data || [];
        }
        if (isLoggedIn.value) {
          const userRes = await apiFetch("/api/user/votes");
          if (userRes.success) {
            myVotedCodes.value = userRes.data || [];
          }
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

    const maxVoteCount = computed(() => {
      if (!voteList.value.length) return 1;
      return Math.max(...voteList.value.map((i) => i.vote_count || 0), 1);
    });

    const getVotePercent = (count) => Math.min(100, Math.round(((count || 0) / maxVoteCount.value) * 100));

    const openVoteModal = () => {
      if (!isLoggedIn.value) { openAuth("login"); return; }
      if (!hasVoteEligibility.value) {
        alert(`监控投票仅限付费周期 ≥ ${voteMinPlanDays.value} 天的会员参与，请先开通或续费套餐。`);
        navigate("#/plan");
        return;
      }
      voteDraftItems.value = [{ etf_code: "", etf_name: "" }];
      voteModalVisible.value = true;
    };

    const quickVote = async (code, name) => {
      if (!isLoggedIn.value) { openAuth("login"); return; }
      if (!hasVoteEligibility.value) {
        alert("只有月度及以上付费会员可参与投票");
        return;
      }
      if (userVotedCount.value >= voteMaxPerUser.value) {
        alert(`您本月投票额度已满 (${voteMaxPerUser.value} 只)`);
        return;
      }
      try {
        await apiFetch("/api/votes/submit", {
          method: "POST",
          body: JSON.stringify({ votes: [{ etf_code: code, etf_name: name }] }),
        });
        alert(`投票成功！您为 ${code} 投上了关键一票`);
        fetchVotes();
      } catch (e) {
        alert(e.message);
      }
    };

    const submitVotes = async () => {
      const validVotes = voteDraftItems.value
        .map((r) => ({ etf_code: pureCode(r.etf_code), etf_name: (r.etf_name || r.etf_code).trim() }))
        .filter((r) => r.etf_code);

      if (!validVotes.length) { alert("请至少填写一只标的代码"); return; }
      if (validVotes.length + userVotedCount.value > voteMaxPerUser.value) {
        alert(`超出限制！您最多还能投 ${voteMaxPerUser.value - userVotedCount.value} 只标的`);
        return;
      }

      voteSubmitting.value = true;
      try {
        await apiFetch("/api/votes/submit", {
          method: "POST",
          body: JSON.stringify({ votes: validVotes }),
        });
        alert("监控投票提交成功！");
        voteModalVisible.value = false;
        fetchVotes();
      } catch (e) {
        alert(e.message);
      } finally {
        voteSubmitting.value = false;
      }
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
      } catch (_) {
        customWatchlist.value = [];
      } finally {
        customLoading.value = false;
      }
    };

    const removeCustomItem = async (item) => {
      if (!confirm(`移除 ${item.etf_code}？`)) return;
      try {
        await apiFetch("/api/watchlist/custom", { method: "DELETE", body: JSON.stringify({ id: item.id }) });
        fetchCustomWatchlist();
      } catch (e) { alert(e.message); }
    };

    // 图表弹窗
    let currentViewer = null;
    const freeTopN = computed(() => parseInt(publicSettings.value.free_top_n_charts, 10) || 3);

    const openChart = (etfCode, type) => {
      if (isLoggedIn.value && isVip.value) { showViewer(etfCode, type); return; }
      const isInFreeList = freeEtfCodes.value.includes(etfCode);
      if (isInFreeList) { showViewer(etfCode, type); return; }
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

    // 套餐支付与工单、密码修改
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

    const selectTopUpPlan = (plan) => {
      topUpForm.planId = plan.id;
      topUpForm.amount = Number(plan.price);
    };

    const fetchPlans = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/plans`);
        const data = await res.json();
        if (data.success && data.data?.length) {
          vipPlans.value = data.data;
          selectTopUpPlan(displayPlans.value[0] || data.data[0]);
        }
      } catch (_) {}
    };

    const fetchData = async () => {
      loading.value = true;
      try {
        const [res1] = await Promise.all([
          fetch(atob("aHR0cHM6Ly9ldGYuaGFoYWd3LmV1Lm9yZy8=")).catch(() => null),
          fetchPublicSettings(),
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
      loading, sortedData, showDropdown, searchQuery, availablePeriods, currentPeriodLabel, selectWeek, selectedMonday,
      handleSort, expandedRowKey, toggleRow, getPastWeeks,
      openChart, getColorClass, isDailyChartColumn, getColumnDateLabel,
      formatMobileStatus, getMobileStatusClass, getDayTooltip, getWeekTooltip, getMobileDayDate, getMobileWeekDate, freeEtfCodes,
      
      // 监控投票暴露响应式变量与方法
      voteList, filteredVoteList, voteSearchQuery, voteModalVisible, voteSubmitting, voteDraftItems,
      hasVoteEligibility, userVotedCount, voteMaxPerUser, voteDisplayTopN, myVotedCodes,
      fetchVotes, openVoteModal, quickVote, submitVotes, getVotePercent,
      
      customWatchlist, customLoading, customEditorVisible, customDraftItems, removeCustomItem, formatDateShort,
      vipPlans, planTab, displayPlans, topUpForm, selectTopUpPlan, orderLoading, orderMessage, showManualInput,
      promoInput, promoChecking, promoValid, promoMessage, displayPayAmount, payRegister, payChannel, currentPayQrSrc,
      orderList, formatDateExact, ticketList, showTicketForm, ticketForm, ticketLoading, submitTicket,
      pwdForm, pwdLoading, submitPasswordChange,
    };
  },
}).mount("#app");
