/**
 * 波幅探长 - 主业务逻辑脚本 (app.js)
 * 已修复：
 * 1. 日期解析函数严重错误
 * 2. weekDays 数组被当字符串使用的多处逻辑错误
 * 3. 文件末尾残留的 EOF / 垃圾字符导致语法错误
 * 4. 社交弹窗相关变量已正确暴露
 * 5. 日线图标跟随最新有数据列、周线始终有图标
 * 6. 未登录前三免费看图（双重保险：index < 3 或 freeEtfCodes）
 * 7. 数据不再前置日期，改为悬停提示（PC）/ 小字显示（手机）
 */
const { createApp, ref, computed, reactive, onMounted, onUnmounted, watch, nextTick } = Vue;

const API_BASE = "https://vip.hahagw.eu.org";
const MAIL_API_BASE = "https://mail.hahagw2016.workers.dev";
const TURNSTILE_SITEKEY = "0x4AAAAAAEDLWs232Np7X0xa";

// 日期解析工具函数（严格过滤异常数据）
const isValidDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return false;
    const match = dateStr.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (!match) return false;
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const d = parseInt(match[3], 10);
    return y >= 2020 && y <= 2030 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
};

const parseYear = (dateStr) => {
    if (!isValidDate(dateStr)) return 0;
    const parts = dateStr.trim().split(/[-/]/);
    return parseInt(parts[0], 10) || 0;
};

const parseMonth = (dateStr) => {
    if (!isValidDate(dateStr)) return 0;
    const parts = dateStr.trim().split(/[-/]/);
    return parseInt(parts[1], 10) || 0;
};

const parseDay = (dateStr) => {
    if (!isValidDate(dateStr)) return 0;
    const parts = dateStr.trim().split(/[-/]/);
    return parseInt(parts[2], 10) || 0;
};

createApp({
    setup() {
        const currentRoute = ref(window.location.hash || '#/');
        const menuOpen = ref(false);
        const userMenuOpen = ref(false);
        const freeEtfCodes = ref([]);

        const navigate = (path) => {
            currentRoute.value = path;
            window.location.hash = path;
            menuOpen.value = false;
        };

        const closeDropdowns = () => {
            userMenuOpen.value = false;
            showDropdown.value = false;
        };

        const pageTitle = computed(() => {
            const map = {
                '#/': '数据看板',
                '#/plan': '购买套餐',
                '#/profile': '个人中心',
                '#/docs': '使用说明'
            };
            return map[currentRoute.value] || '数据看板';
        });

        const apiFetch = async (endpoint, options = {}) => {
            const token = localStorage.getItem('etf_token');
            if (token) {
                options.headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
            }
            options.headers = { ...options.headers, 'Content-Type': 'application/json' };

            const res = await fetch(`${API_BASE}${endpoint}`, options);
            if (res.status === 401) {
                logout(false);
                throw new Error('登录已过期，请重新登录');
            }
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || '请求失败');
            return data;
        };

        const isLoggedIn = ref(false);
        const isVip = ref(false);
        const username = ref('');
        const vipDaysLeft = ref(0);
        const referralCode = ref('');

        const checkLoginState = () => {
            try {
                if (localStorage.getItem('etf_token')) {
                    isLoggedIn.value = true;
                    username.value = localStorage.getItem('etf_username') || '';
                    referralCode.value = localStorage.getItem('etf_ref') || '';
                    vipDaysLeft.value = parseInt(localStorage.getItem('etf_vip_days')) || 0;
                    isVip.value = vipDaysLeft.value > 0;
                }
            } catch (e) {}
        };

        const authModalVisible = ref(false);
        const authMode = ref('login');
        const authLoading = ref(false);
        const authForm = reactive({
            username: '',
            password: '',
            refCode: '',
            emailCode: '',
            turnstileToken: ''
        });

        const sendCodeLoading = ref(false);
        const countdown = ref(0);

        const renderTurnstile = () => {
            if (authMode.value !== 'register') return;
            nextTick(() => {
                setTimeout(() => {
                    const container = document.getElementById('turnstile-container');
                    if (container && window.turnstile) {
                        container.innerHTML = '';
                        try {
                            window.turnstile.render('#turnstile-container', {
                                sitekey: TURNSTILE_SITEKEY,
                                callback: (token) => { authForm.turnstileToken = token; },
                                'expired-callback': () => { authForm.turnstileToken = ''; }
                            });
                        } catch (e) {}
                    }
                }, 150);
            });
        };

        const switchAuthMode = (mode) => {
            authMode.value = mode;
            authForm.password = '';
            authForm.emailCode = '';
            authForm.turnstileToken = '';
            if (mode === 'register') renderTurnstile();
        };

        const openAuth = (mode) => {
            authModalVisible.value = true;
            switchAuthMode(mode);
        };

        const closeAuth = () => {
            authModalVisible.value = false;
        };

        const sendEmailCode = async () => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!authForm.username || !emailRegex.test(authForm.username)) {
                alert('请输入格式正确的电子邮箱地址！');
                return;
            }
            if (!authForm.turnstileToken) {
                alert('请先勾选/完成人机安全验证！');
                return;
            }

            sendCodeLoading.value = true;
            try {
                const res = await fetch(`${MAIL_API_BASE}/api/send-code`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: authForm.username,
                        turnstileToken: authForm.turnstileToken
                    })
                });
                const data = await res.json();
                if (data.success) {
                    alert(data.msg || '验证码发送成功，请登录邮箱查看！');
                    countdown.value = 60;
                    const timer = setInterval(() => {
                        countdown.value--;
                        if (countdown.value <= 0) {
                            clearInterval(timer);
                            if (window.turnstile) window.turnstile.reset('#turnstile-container');
                        }
                    }, 1000);
                } else {
                    alert(data.msg || '发送失败，请重试');
                    if (window.turnstile) window.turnstile.reset('#turnstile-container');
                }
            } catch (e) {
                alert('网络连接错误，发送失败！');
                if (window.turnstile) window.turnstile.reset('#turnstile-container');
            } finally {
                sendCodeLoading.value = false;
            }
        };

        const submitAuth = async () => {
            if (!authForm.username || !authForm.password) {
                alert('账号和密码不能为空');
                return;
            }

            if (authMode.value === 'register') {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(authForm.username)) {
                    alert('请填写合法的电子邮箱地址');
                    return;
                }
                if (!authForm.emailCode) {
                    alert('请输入收到的6位邮箱验证码');
                    return;
                }
            }

            authLoading.value = true;
            try {
                if (authMode.value === 'register') {
                    await apiFetch('/api/register', {
                        method: 'POST',
                        body: JSON.stringify({
                            username: authForm.username,
                            password: authForm.password,
                            ref_code: authForm.refCode,
                            code: authForm.emailCode
                        })
                    });
                    alert('注册成功，请登录体验！');
                    switchAuthMode('login');
                } else {
                    const data = await apiFetch('/api/login', {
                        method: 'POST',
                        body: JSON.stringify({
                            username: authForm.username,
                            password: authForm.password
                        })
                    });
                    localStorage.setItem('etf_token', data.token);
                    localStorage.setItem('etf_username', authForm.username);
                    localStorage.setItem('etf_ref', data.referral_code || '');
                    localStorage.setItem('etf_vip_days', data.vip_days_left || 0);
                    checkLoginState();
                    closeAuth();
                    fetchData();
                    if (currentRoute.value === '#/profile') fetchOrders();
                }
            } catch (err) {
                alert(err.message);
            } finally {
                authLoading.value = false;
            }
        };

        const logout = (showAlert = true) => {
            try { localStorage.clear(); } catch (e) {}
            isLoggedIn.value = false;
            isVip.value = false;
            username.value = '';
            referralCode.value = '';
            vipDaysLeft.value = 0;
            if (showAlert) alert('已退出登录');
            navigate('#/');
        };

        const formatDateExact = (ts) => {
            if (!ts) return '-';
            const d = new Date(ts);
            return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        };

        const loading = ref(false);
        const allData = ref([]);
        const chartsMap = ref({});
        const showDropdown = ref(false);
        const selectedMonday = ref('');
        const searchQuery = ref('');
        const expandedRowKey = ref(null);

        const sortColumn = ref(null);
        const sortOrder = ref('desc');
        const handleSort = (column) => {
            if (sortColumn.value === column) {
                if (sortOrder.value === 'desc') sortOrder.value = 'asc';
                else {
                    sortColumn.value = null;
                    sortOrder.value = 'desc';
                }
            } else {
                sortColumn.value = column;
                sortOrder.value = 'desc';
            }
        };

        const getStatusVal = (str) => {
            if (!str || typeof str !== 'string' || str === '-' || str === '--') return -9999;
            const match = str.match(/[-+]?[0-9]*\.?[0-9]+/);
            return match ? parseFloat(match[0]) : -9999;
        };

        const getWeekDays = (dateStr) => {
            const y = parseYear(dateStr);
            const m = parseMonth(dateStr);
            const d = parseDay(dateStr);
            if (!y || !m || !d) return [];
            const dateObj = new Date(y, m - 1, d);
            let dayOfWeek = dateObj.getDay();
            const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            const monday = new Date(y, m - 1, d + offset);
            const days = [];
            for (let i = 0; i < 5; i++) {
                const temp = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
                days.push(
                    `${temp.getFullYear()}-${String(temp.getMonth() + 1).padStart(2, '0')}-${String(temp.getDate()).padStart(2, '0')}`
                );
            }
            return days;
        };

        const getWeekNumberInMonth = (dateStr) => {
            const y = parseYear(dateStr);
            const m = parseMonth(dateStr);
            const d = parseDay(dateStr);
            if (!d) return '';
            const firstDay = new Date(y, m - 1, 1);
            let firstDayOfWeek = firstDay.getDay();
            if (firstDayOfWeek === 0) firstDayOfWeek = 7;
            const weekNum = Math.ceil((d + (firstDayOfWeek - 1)) / 7);
            return `第${['一', '二', '三', '四', '五', '六'][weekNum - 1] || weekNum}周`;
        };

        // ========== 悬停提示相关 ==========
        // 日线悬停：07-29
        const getDayTooltip = (dateStr) => {
            if (!dateStr || !isValidDate(dateStr)) return '';
            const m = String(parseMonth(dateStr)).padStart(2, '0');
            const d = String(parseDay(dateStr)).padStart(2, '0');
            return `${m}-${d}`;
        };

        // 周线悬停：07-5w
        const getWeekTooltip = (mondayStr) => {
            if (!mondayStr || !isValidDate(mondayStr)) return '';
            const m = String(parseMonth(mondayStr)).padStart(2, '0');
            const weekNumStr = getWeekNumberInMonth(mondayStr);
            const numMatch = weekNumStr.match(/[一二三四五六]/);
            const map = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
            const n = numMatch ? (map[numMatch[0]] || 1) : 1;
            return `${m}-${n}w`;
        };

        // 当前周「第x周」标签
        const getCurrentWeekLabel = () => {
            if (!selectedMonday.value) return '';
            return getWeekNumberInMonth(selectedMonday.value);
        };

        // 手机端小字日期（日线）
        const getMobileDayDate = (dateStr) => {
            return getDayTooltip(dateStr);
        };

        // 手机端小字日期（周线）
        const getMobileWeekDate = (mondayStr) => {
            return getWeekTooltip(mondayStr);
        };

        const uniqueDatesSet = computed(() => {
            const validDates = allData.value
                .filter(i => (i.day_status || i.week_status) && isValidDate(i.date))
                .map(i => i.date);
            return new Set(validDates);
        });

        const availablePeriods = computed(() => {
            const periods = {};
            [...uniqueDatesSet.value].forEach(dateStr => {
                const wDays = getWeekDays(dateStr);
                if (wDays.length === 0) return;
                const monday = wDays[0];
                const y = parseYear(monday);
                const m = parseMonth(monday);
                const monthKey = `${y}-${String(m).padStart(2, '0')}`;
                if (!periods[monthKey]) {
                    periods[monthKey] = {
                        monthKey,
                        monthLabel: `${y}年${m}月`,
                        weeksMap: {}
                    };
                }
                if (!periods[monthKey].weeksMap[monday]) {
                    periods[monthKey].weeksMap[monday] = {
                        monday,
                        weekLabel: getWeekNumberInMonth(monday)
                    };
                }
            });
            const result = Object.values(periods).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
            result.forEach(m => {
                m.weeks = Object.values(m.weeksMap).sort((a, b) => b.monday.localeCompare(a.monday));
            });
            return result;
        });

        const currentPeriodLabel = computed(() => {
            for (const m of availablePeriods.value) {
                for (const w of m.weeks) {
                    if (w.monday === selectedMonday.value) {
                        const monthVal = parseMonth(w.monday);
                        return `${monthVal}月 · ${w.weekLabel}`;
                    }
                }
            }
            return '';
        });

        const currentWeekHeaders = computed(() => {
            if (!selectedMonday.value) return [];
            const days = getWeekDays(selectedMonday.value);
            if (days.length === 0) return [];
            return days.map(d => parseDay(d));
        });

        const weekStatusHeader = computed(() => {
            if (!selectedMonday.value) return '';
            const weekDays = getWeekDays(selectedMonday.value);
            if (weekDays.length < 5) return '';

            const fridayDate = weekDays[4];
            const y = parseYear(fridayDate);
            const m = parseMonth(fridayDate);
            const d = parseDay(fridayDate);
            if (!y) return '';

            const friday16 = new Date(y, m - 1, d, 16, 0, 0);
            const isPastFriday16 = Date.now() >= friday16.getTime();

            if (isPastFriday16) {
                return `${parseDay(weekDays[0])}~${parseDay(weekDays[4])}日`;
            } else {
                const my = parseYear(weekDays[0]);
                const mm = parseMonth(weekDays[0]);
                const md = parseDay(weekDays[0]);
                const currentMonday = new Date(my, mm - 1, md);
                const prevMonday = new Date(currentMonday.getTime() - 7 * 24 * 60 * 60 * 1000);
                const prevFriday = new Date(currentMonday.getTime() - 3 * 24 * 60 * 60 * 1000);
                return `${prevMonday.getDate()}~${prevFriday.getDate()}日`;
            }
        });

        const selectWeek = (mondayStr) => {
            selectedMonday.value = mondayStr;
            showDropdown.value = false;
        };

        // 当前周「日线图表 icon」应该显示的列索引（所有行统一同一列）
        // 规则：
        // 1. 优先取当前周里最新有数据的那一天（有数据就按数据）
        // 2. 如果整周都没有数据，则按北京时间17点规则：
        //    - 周一~周五：17点后显示当天列，17点前显示前一交易日
        //    - 周六/周日：固定显示周五列
        const latestDailyColIndex = computed(() => {
            if (!selectedMonday.value) return -1;
            const weekDays = getWeekDays(selectedMonday.value);
            if (weekDays.length < 5) return -1;

            // 1. 先找当前周最新有数据的列（从周五往前扫）——有数据就按数据
            for (let i = 4; i >= 0; i--) {
                const hasAny = allData.value.some(
                    item => item.date === weekDays[i] && item.day_status && item.day_status !== '-' && item.day_status !== '--'
                );
                if (hasAny) return i;
            }

            // 2. 整周都没数据 → 按北京时间17点规则
            const now = new Date();
            // 转成北京时间（UTC+8）
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const beijing = new Date(utc + (8 * 60 * 60000));
    
            let day = beijing.getDay(); // 0=周日, 1=周一 ... 6=周六
            const hour = beijing.getHours();

            // 周末固定周五
            if (day === 0 || day === 6) {
                return 4; // 周五
            }

            // 周一~周五：day 1→index0, 2→1, ..., 5→4
            let col = day - 1;

            // 17点前，显示前一交易日
            if (hour < 17) {
                col = col - 1;
                // 周一17点前：仍显示周一列（上周五属于上一周）
                if (col < 0) col = 0;
            }

            return col;
        });

        // 手机端：保留 +/- 符号，只去掉 %
        const formatMobileStatus = (status) => {
            if (!status || status === '-' || status === '--') return '-';
            const match = String(status).match(/([-+]?[0-9]*\.?[0-9]+)/);
            if (!match) return '-';
            return match[1];
        };

        // 手机端颜色
        const getMobileStatusClass = (status) => {
            if (!status || status === '-' || status === '--') return 'mobile-status-neutral';
            if (String(status).includes('+')) return 'mobile-status-up';
            return 'mobile-status-down';
        };

        // 手机端历史周标签：7M5W
        const formatMobileWeekLabel = (mondayStr) => {
            if (!mondayStr || !isValidDate(mondayStr)) return '';
            const m = parseMonth(mondayStr);
            const weekNumStr = getWeekNumberInMonth(mondayStr);
            const numMatch = weekNumStr.match(/[一二三四五六]/);
            const map = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
            const n = numMatch ? (map[numMatch[0]] || 1) : 1;
            return `${m}M${n}W`;
        };

        // 默认按最新周线绝对值（降序）排序
        const sortedData = computed(() => {
            if (!selectedMonday.value) return [];
            const weekDays = getWeekDays(selectedMonday.value);
            if (weekDays.length < 5) return [];

            const fridayDate = weekDays[4];
            const y = parseYear(fridayDate);
            const m = parseMonth(fridayDate);
            const d = parseDay(fridayDate);
            if (!y) return [];

            const friday16 = new Date(y, m - 1, d, 16, 0, 0);
            const now = new Date();
            const isPastFriday16 = now.getTime() >= friday16.getTime();

            const etfMap = {};

            allData.value.forEach(item => {
                if (!item.date) return;
                const idx = weekDays.indexOf(item.date);
                if (idx !== -1) {
                    if (!etfMap[item.etf_code]) {
                        etfMap[item.etf_code] = {
                            etf_code: item.etf_code,
                            etf_name: item.etf_name,
                            days: [null, null, null, null, null],
                            week_status: null
                        };
                    }
                    etfMap[item.etf_code].days[idx] = item;

                    if (isPastFriday16 && item.week_status && item.week_status !== '-' && item.week_status !== '--') {
                        etfMap[item.etf_code].week_status = item.week_status;
                    }
                }
            });

            if (!isPastFriday16) {
                const my = parseYear(weekDays[0]);
                const mm = parseMonth(weekDays[0]);
                const md = parseDay(weekDays[0]);
                const curMon = new Date(my, mm - 1, md);
                const prevMon = new Date(curMon.getTime() - 7 * 24 * 60 * 60 * 1000);
                const prevMondayStr = `${prevMon.getFullYear()}-${String(prevMon.getMonth() + 1).padStart(2, '0')}-${String(prevMon.getDate()).padStart(2, '0')}`;

                const prevWeekDates = getWeekDays(prevMondayStr);
                const lastWeekStatusMap = {};

                allData.value.forEach(item => {
                    if (!item.date) return;
                    if (
                        prevWeekDates.includes(item.date) &&
                        item.week_status &&
                        item.week_status !== '-' &&
                        item.week_status !== '--'
                    ) {
                        lastWeekStatusMap[item.etf_code] = item.week_status;
                    }
                });

                for (const code in lastWeekStatusMap) {
                    if (!etfMap[code]) {
                        const etfItem = allData.value.find(i => i.etf_code === code);
                        etfMap[code] = {
                            etf_code: code,
                            etf_name: etfItem ? etfItem.etf_name : code,
                            days: [null, null, null, null, null],
                            week_status: null
                        };
                    }
                    etfMap[code].week_status = lastWeekStatusMap[code];
                }
            }

            let validItems = Object.values(etfMap).filter(item => {
                const hasDay = item.days.some(
                    d => d && d.day_status && d.day_status !== '-' && d.day_status !== '--'
                );
                const hasWeek = item.week_status && item.week_status !== '-' && item.week_status !== '--';
                return hasDay || hasWeek || (chartsMap.value && chartsMap.value.hasOwnProperty(item.etf_code));
            });

            if (chartsMap.value && typeof chartsMap.value === 'object') {
                Object.keys(chartsMap.value).forEach(code => {
                    if (!etfMap[code]) {
                        const etfItem = allData.value.find(i => i.etf_code === code);
                        validItems.push({
                            etf_code: code,
                            etf_name: etfItem ? etfItem.etf_name : code,
                            days: [null, null, null, null, null],
                            week_status: null
                        });
                    }
                });
            }

            if (searchQuery.value) {
                const q = searchQuery.value.toLowerCase().trim();
                validItems = validItems.filter(
                    item =>
                        (item.etf_name && item.etf_name.toLowerCase().includes(q)) ||
                        (item.etf_code && item.etf_code.toLowerCase().includes(q))
                );
            }

            validItems.sort((a, b) => {
                if (sortColumn.value) {
                    if (sortColumn.value === 'etf_name') {
                        const cmp = (a.etf_name || '').localeCompare(b.etf_name || '', 'zh-CN');
                        return sortOrder.value === 'asc' ? cmp : -cmp;
                    } else if (sortColumn.value.startsWith('d')) {
                        const idx = parseInt(sortColumn.value.substring(1), 10);
                        const valA = a.days[idx] ? getStatusVal(a.days[idx].day_status) : -9999;
                        const valB = b.days[idx] ? getStatusVal(b.days[idx].day_status) : -9999;
                        if (valA === -9999 && valB !== -9999) return 1;
                        if (valB === -9999 && valA !== -9999) return -1;
                        return sortOrder.value === 'desc' ? valB - valA : valA - valB;
                    } else if (sortColumn.value === 'week_status') {
                        const valA = getStatusVal(a.week_status);
                        const valB = getStatusVal(b.week_status);
                        if (valA === -9999 && valB !== -9999) return 1;
                        if (valB === -9999 && valA !== -9999) return -1;
                        return sortOrder.value === 'desc' ? valB - valA : valA - valB;
                    }
                } else {
                    const valWkA =
                        a.week_status && a.week_status !== '-' && a.week_status !== '--'
                            ? Math.abs(getStatusVal(a.week_status))
                            : -9999;
                    const valWkB =
                        b.week_status && b.week_status !== '-' && b.week_status !== '--'
                            ? Math.abs(getStatusVal(b.week_status))
                            : -9999;

                    if (valWkA !== -9999 || valWkB !== -9999) {
                        if (valWkA !== -9999 && valWkB !== -9999) return valWkB - valWkA;
                        if (valWkA !== -9999) return -1;
                        if (valWkB !== -9999) return 1;
                    }

                    let latestIdx = 4;
                    while (latestIdx >= 0) {
                        const hasData = validItems.some(
                            i =>
                                i.days[latestIdx] &&
                                i.days[latestIdx].day_status &&
                                i.days[latestIdx].day_status !== '-'
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
                }
            });

            return validItems;
        });

        const toggleRow = (item) => {
            expandedRowKey.value = expandedRowKey.value === item.etf_code ? null : item.etf_code;
        };

        const getPastWeeks = (etf_code) => {
            if (!selectedMonday.value) return [];
            const pastData = allData.value.filter(
                item => item.etf_code === etf_code && (item.day_status || item.week_status)
            );
            const weekMap = {};
            pastData.forEach(item => {
                if (!item.date || !isValidDate(item.date)) return;
                const wDays = getWeekDays(item.date);
                if (wDays.length === 0) return;
                const monday = wDays[0];
                if (monday === selectedMonday.value) return;

                if (!weekMap[monday]) {
                    const m = parseMonth(monday);
                    const weekNum = getWeekNumberInMonth(monday);
                    weekMap[monday] = {
                        monday: monday,
                        weekLabel: `${m}月${weekNum}`,
                        fridayDate: wDays[4],
                        days: [null, null, null, null, null],
                        week_status: null
                    };
                }
                const idx = wDays.indexOf(item.date);
                if (idx !== -1) weekMap[monday].days[idx] = item;
                if (item.week_status && item.week_status !== '-' && item.week_status !== '--') {
                    weekMap[monday].week_status = item.week_status;
                }
            });
            const weekList = Object.values(weekMap);
            return weekList.sort((a, b) => b.monday.localeCompare(a.monday));
        };

        const fetchPlans = async () => {
            try {
                const data = await fetch(`${API_BASE}/api/plans`);
                const res = await data.json();
                if (res.success && res.data && res.data.length > 0) {
                    vipPlans.value = res.data;
                }
            } catch (e) {}
        };

        const fetchChartsMap = async () => {
            try {
                const token = localStorage.getItem('etf_token');
                const headers = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;
                const res = await fetch(`${API_BASE}/api/etfs`, { headers });
                if (res.ok) {
                    const data = await res.json();
                    chartsMap.value = data.charts || {};
                    if (isLoggedIn.value) isVip.value = !!data.is_vip;
                }
            } catch (e) {}
        };

        const fetchData = async () => {
            loading.value = true;
            try {
                const [res1] = await Promise.all([
                    fetch(atob('aHR0cHM6Ly9ldGYuaGFoYWd3LmV1Lm9yZy8=')).catch(() => null),
                    fetchChartsMap()
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

        let currentViewer = null;

        // ========== 关键修复：未登录前三免费看图（双重保险） ==========
        const openChart = (etfCode, type, index, isHistorical = false) => {
            if (isLoggedIn.value && isVip.value) {
                showViewer(etfCode, type);
                return;
            }
            const isTopThree = (typeof index === 'number' && index >= 0 && index < 3);
            const isInFreeList = freeEtfCodes.value.includes(etfCode);
            if (isTopThree || isInFreeList) {
                showViewer(etfCode, type);
                return;
            }
            if (confirm('此为VIP付费专属监控图表，请登录/注册。 \n\n🎉 当前最新排名前三免费对全网开放，新注册送 1 天体验权限！')) {
                if (!isLoggedIn.value) openAuth('login');
                else navigate('#/plan');
            }
        };

        const showViewer = (etfCode, type) => {
            const specificKey = `${etfCode}_${type}`;
            let imgUrl = null;

            if (chartsMap.value && chartsMap.value[specificKey]) {
                imgUrl = chartsMap.value[specificKey];
            } else if (
                chartsMap.value &&
                typeof chartsMap.value[etfCode] === 'object' &&
                chartsMap.value[etfCode][type]
            ) {
                imgUrl = chartsMap.value[etfCode][type];
            } else if (type === 'weekly') {
                if (chartsMap.value && typeof chartsMap.value[etfCode] === 'string') {
                    const rawUrl = chartsMap.value[etfCode];
                    if (rawUrl.includes('_daily')) {
                        imgUrl = rawUrl.replace('_daily', '_weekly');
                    } else if (!rawUrl.includes('_weekly')) {
                        imgUrl = rawUrl.replace(/\.png$/i, '_weekly.png');
                    } else {
                        imgUrl = rawUrl;
                    }
                } else {
                    imgUrl = `https://pub-973330e118204686a625fe51431d4336.r2.dev/charts/${etfCode}_weekly.png`;
                }
            } else {
                if (chartsMap.value && typeof chartsMap.value[etfCode] === 'string') {
                    imgUrl = chartsMap.value[etfCode];
                } else {
                    imgUrl = `https://pub-973330e118204686a625fe51431d4336.r2.dev/charts/${etfCode}_daily.png`;
                }
            }

            const image = new Image();
            image.src = imgUrl.split('?')[0];
            if (currentViewer) {
                currentViewer.destroy();
            }
            currentViewer = new Viewer(image, {
                hidden: () => {
                    currentViewer.destroy();
                    currentViewer = null;
                },
                navbar: false,
                title: false,
                button: true,
                backdrop: true
            });
            currentViewer.show();
        };

        const getColorClass = (status) => {
            if (!status || status === '-' || status === '--') return 'text-slate-300';
            return status.includes('+') ? 'text-red-500' : 'text-emerald-500';
        };

        const selectedOrder = ref(null);
        const orderList = ref([]);
        const vipPlans = ref([
            { id: 'trial', name: '首充体验', price: 1.88, days: 2, tag: '新人破冰' },
            { id: 'week', name: '体验周卡', price: 8.80, days: 7, tag: '特惠' },
            { id: 'month', name: '包月畅享', price: 18.80, days: 30, tag: '最推荐' },
            { id: 'season', name: '季度实惠', price: 48.80, days: 90 }
        ]);

        const fetchOrders = async () => {
            if (!isLoggedIn.value) return;
            try {
                const res = await apiFetch('/api/user/orders');
                orderList.value = res.data || [];
            } catch (e) {}
        };

        const viewOrder = (order) => {
            selectedOrder.value = order;
        };

        const getPlanName = (planId) => {
            const p = vipPlans.value.find(x => x.id === planId);
            return p ? p.name : planId;
        };

        const formatStatus = (s) => {
            return s === 'approved' ? '已完成' : s === 'pending' ? '审核中' : '已取消';
        };

        const showManualInput = ref(false);
        const topUpForm = reactive({
            planId: 'month',
            amount: 18.80,
            floatingAmount: '18.82',
            txId: ''
        });
        const orderLoading = ref(false);
        const orderMessage = ref('');

        const generateFloatingAmount = (basePrice) => {
            const randCents = (Math.floor(Math.random() * 5) + 1) / 100;
            return (basePrice + randCents).toFixed(2);
        };

        const selectTopUpPlan = (plan) => {
            topUpForm.planId = plan.id;
            topUpForm.amount = plan.price;
            topUpForm.floatingAmount = generateFloatingAmount(plan.price);
        };

        const checkPaymentStatus = async () => {
            orderMessage.value = '🔍 正在轮询V免签后台收款通知...';
            if (isLoggedIn.value) {
                await fetchOrders();
                if (
                    orderList.value.some(
                        o =>
                            o.status === 'approved' &&
                            new Date() - new Date(o.created_at) < 300000
                    )
                ) {
                    orderMessage.value = '🎉 自动核验成功！VIP 权限已秒级激活！';
                    fetchData();
                    return;
                }
            }
            setTimeout(() => {
                orderMessage.value =
                    '💡 若已付完款，系统监听一般在3秒内完成，您可稍后查看个人中心或更新页面';
            }, 1200);
        };

        const submitOrder = async () => {
            if (!isLoggedIn.value) {
                openAuth('login');
                return;
            }

            if (!/^\d{6}$/.test(topUpForm.txId)) {
                alert('请填写准确的6位数字凭证');
                return;
            }

            if (orderList.value.some(o => o.status === 'pending')) {
                alert('您有一笔尚未审核的订单，请勿重复提交！');
                return;
            }

            orderLoading.value = true;
            orderMessage.value = '';
            try {
                await apiFetch('/api/orders', {
                    method: 'POST',
                    body: JSON.stringify({
                        plan_id: topUpForm.planId,
                        amount: topUpForm.amount,
                        tx_id_last6: topUpForm.txId
                    })
                });
                orderMessage.value = '✅ 提交成功！系统正在核对订单...';
                topUpForm.txId = '';
                setTimeout(() => {
                    fetchOrders();
                }, 1500);
            } catch (err) {
                orderMessage.value = `❌ ${err.message}`;
            } finally {
                orderLoading.value = false;
            }
        };

        const pwdForm = reactive({ old: '', new: '', confirm: '' });
        const pwdLoading = ref(false);
        const submitPasswordChange = async () => {
            if (!pwdForm.old || !pwdForm.new || pwdForm.new !== pwdForm.confirm) {
                alert('请正确填写密码且两次输入需一致！');
                return;
            }
            pwdLoading.value = true;
            try {
                await apiFetch('/api/password', {
                    method: 'POST',
                    body: JSON.stringify({
                        old_password: pwdForm.old,
                        new_password: pwdForm.new
                    })
                });
                alert('密码修改成功！请重新登录。');
                logout(false);
            } catch (err) {
                alert(err.message);
            } finally {
                pwdLoading.value = false;
                pwdForm.old = '';
                pwdForm.new = '';
                pwdForm.confirm = '';
            }
        };

        const chatModule = typeof useChatModule === 'function' ? useChatModule(Vue) : {};

        const socialModalVisible = ref(false);
        const currentSocialPlatform = ref('');
        const openSocialModal = (platform) => {
            currentSocialPlatform.value = platform;
            socialModalVisible.value = true;
        };

        watch(currentRoute, (newRoute) => {
            selectedOrder.value = null;
            searchQuery.value = '';
            if (newRoute === '#/profile') fetchOrders();
        });

        // 强制同步免费前三
        watch(sortedData, (newVal) => {
            if (newVal && newVal.length > 0) {
                freeEtfCodes.value = newVal.slice(0, 3).map(item => item.etf_code);
            } else {
                freeEtfCodes.value = [];
            }
        }, { immediate: true });

        onMounted(() => {
            checkLoginState();
            fetchPlans();
            fetchData();
            if (isLoggedIn.value) fetchOrders();
            window.addEventListener('click', closeDropdowns);
        });

        onUnmounted(() => {
            window.removeEventListener('click', closeDropdowns);
        });

        return {
            currentRoute,
            menuOpen,
            userMenuOpen,
            pageTitle,
            navigate,
            closeDropdowns,
            isLoggedIn,
            isVip,
            username,
            vipDaysLeft,
            referralCode,
            logout,
            authModalVisible,
            authMode,
            authForm,
            authLoading,
            openAuth,
            closeAuth,
            submitAuth,
            switchAuthMode,
            sendEmailCode,
            sendCodeLoading,
            countdown,
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
            currentWeekHeaders,
            weekStatusHeader,
            expandedRowKey,
            toggleRow,
            getPastWeeks,
            parseDay,
            parseMonth,
            parseYear,
            vipPlans,
            topUpForm,
            selectTopUpPlan,
            orderLoading,
            orderMessage,
            submitOrder,
            checkPaymentStatus,
            showManualInput,
            openChart,
            getColorClass,
            selectedOrder,
            orderList,
            viewOrder,
            getPlanName,
            formatStatus,
            formatDateExact,
            pwdForm,
            pwdLoading,
            submitPasswordChange,
            freeEtfCodes,
            // 新增
            isLatestDailyColumn,
            getCurrentWeekLabel,
            formatMobileStatus,
            getMobileStatusClass,
            formatMobileWeekLabel,
            getDayTooltip,
            getWeekDays,
            getWeekTooltip,
            getMobileDayDate,
            getMobileWeekDate,
            ...chatModule,
            socialModalVisible,
            currentSocialPlatform,
            openSocialModal
        };
    }
}).mount('#app');
