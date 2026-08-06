/**
 * 波幅探长 - 前台完整逻辑脚本 (app.js)
 * 恢复全功能 Viewer.js 查看器 (放大/缩小/旋转/翻转/拖拽)
 * 个人中心 5 大卡片 (完全还原图一)、看板 (4周展开/绝对值Top3免费/日线半日线周线)
 * 购买套餐 (分类上架/优惠码显隐开关/精准支付)、监控投票、答疑与指南
 */
const { createApp, ref, reactive, computed, onMounted, watch } = Vue;

const API_BASE = "https://vip.hahagw.eu.org";

// 全局响应式状态 Store
const store = reactive({
  isLoggedIn: false,
  isVip: false,
  username: "",
  referralCode: "",
  vipDaysLeft: 0,
  publicSettings: {
    gift_register_days: "1",
    gift_inviter_days: "3",
    gift_invitee_days: "2",
    free_top_n_charts: "3",
    promo_enabled: "1",
    alipay_qr_url: "",
    wechat_qr_url: "",
    default_pay_channel: "alipay",
    custom_max_symbols: "3",
    vote_monthly_limit: "10",
  },
  menuOpen: false,
  userMenuOpen: false,
  authModalVisible: false,
  authMode: "login",
  toasts: [],
  showToast(msg, type = "success") {
    store.toasts.push({ msg, type, id: Date.now() });
    setTimeout(() => { store.toasts.shift(); }, 2800);
  },
  checkLoginState() {
    try {
      const token = localStorage.getItem("etf_token");
      if (token) {
        store.isLoggedIn = true;
        store.username = localStorage.getItem("etf_username") || "";
        store.referralCode = localStorage.getItem("etf_ref") || "";
        store.vipDaysLeft = parseInt(localStorage.getItem("etf_vip_days"), 10) || 0;
        store.isVip = store.vipDaysLeft > 0;
      }
    } catch (_) {}
  },
  logout() {
    localStorage.clear();
    store.isLoggedIn = false;
    store.isVip = false;
    store.username = "";
    store.referralCode = "";
    store.vipDaysLeft = 0;
    store.showToast("已退出登录");
    window.location.hash = "#/";
  }
});

// 通用 Fetch 封装
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem("etf_token");
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  if (res.status === 401) {
    store.logout();
    throw new Error("登录已过期，请重新登录");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || "请求处理失败");
  return data;
}

// Viewer.js 全功能高级图片查看器 (包含：放大/缩小/旋转/翻转/拖拽/复位)
function openViewerImage(imageUrl) {
  if (!imageUrl) return;
  const image = new Image();
  image.src = imageUrl;
  image.onload = () => {
    if (window.Viewer) {
      const viewer = new window.Viewer(image, {
        hidden() { viewer.destroy(); },
        toolbar: {
          zoomIn: 1,
          zoomOut: 1,
          oneToOne: 1,
          reset: 1,
          prev: 0,
          play: 0,
          next: 0,
          rotateLeft: 1,
          rotateRight: 1,
          flipHorizontal: 1,
          flipVertical: 1,
        },
        navbar: false,
        title: false,
        tooltip: true,
        movable: true,
        zoomable: true,
        rotatable: true,
        scalable: true,
        transition: true,
      });
      viewer.show();
    } else {
      window.open(imageUrl, "_blank");
    }
  };
}

// 1. Header 组件
const HeaderComp = {
  props: ["pageTitle"],
  emits: ["navigate"],
  setup(props, { emit }) {
    return {
      store,
      toggleMenu: () => { store.menuOpen = !store.menuOpen; },
      toggleUserMenu: () => { store.userMenuOpen = !store.userMenuOpen; },
      openAuth: (mode) => { store.authMode = mode; store.authModalVisible = true; },
      navigate: (path) => { emit("navigate", path); store.userMenuOpen = false; },
      logout: store.logout,
    };
  },
  template: `
    <header class="h-14 sm:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 z-10 shrink-0 select-none">
      <div class="flex items-center gap-2 sm:gap-3">
        <button @click.stop="toggleMenu" class="text-slate-500 hover:text-slate-700 p-2"><i class="fa-solid fa-bars text-xl"></i></button>
        <a @click.prevent="navigate('#/')" href="#/" class="flex items-center gap-2 cursor-pointer">
          <img src="logo.png" class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover shadow-sm border border-slate-100" onerror="this.style.display='none'">
          <span class="text-base sm:text-lg font-bold theme-text tracking-wide hidden sm:block">波幅探长</span>
        </a>
        <span class="text-sm font-semibold text-slate-500 border-l border-slate-200 pl-3 hidden sm:block">{{ pageTitle }}</span>
      </div>

      <div class="flex items-center gap-2 sm:gap-5">
        <div v-if="!store.isLoggedIn" class="flex gap-2">
          <button @click="openAuth('login')" class="text-sm font-medium text-slate-600 hover:theme-text px-1">登录</button>
          <button @click="openAuth('register')" class="text-sm font-medium theme-bg text-white px-3 py-1.5 rounded-lg hover:opacity-90">注册</button>
        </div>
        <div v-else class="relative">
          <div @click.stop="toggleUserMenu" class="flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded select-none">
            <i class="fa-solid fa-circle-user text-slate-400 text-2xl"></i>
            <span class="text-sm font-medium text-slate-600 hidden sm:inline">{{ store.username }}</span>
            <i class="fa-solid fa-chevron-down text-[10px] text-slate-400" :class="{'rotate-180': store.userMenuOpen}"></i>
          </div>
          <div v-if="store.userMenuOpen" @click.stop class="absolute right-0 mt-2 w-36 bg-white rounded-xl shadow-lg border border-slate-100 z-50 overflow-hidden">
            <div @click="navigate('#/profile')" class="px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer flex items-center border-b"><i class="fa-regular fa-user mr-2 text-slate-400"></i>个人中心</div>
            <div @click="logout" class="px-4 py-3 text-sm text-red-500 hover:bg-red-50 cursor-pointer flex items-center"><i class="fa-solid fa-right-from-bracket mr-2"></i>退出登录</div>
          </div>
        </div>
      </div>
    </header>
  `,
};

// 2. Sidebar 组件
const SidebarComp = {
  props: ["currentRoute"],
  emits: ["navigate"],
  setup(props, { emit }) {
    const navigate = (path, requireAuth = false) => {
      if (requireAuth && !store.isLoggedIn) {
        store.authMode = "login";
        store.authModalVisible = true;
        store.menuOpen = false;
        return;
      }
      emit("navigate", path);
      store.menuOpen = false;
    };
    return { store, navigate };
  },
  template: `
    <div>
      <div v-if="store.menuOpen" @click="store.menuOpen = false" class="fixed inset-0 bg-black/40 z-40"></div>
      <aside class="fixed inset-y-0 left-0 w-64 bg-white z-50 transform transition-transform duration-300 flex flex-col shadow-2xl select-none"
             :class="store.menuOpen ? 'translate-x-0' : '-translate-x-full'">
        <div class="h-14 sm:h-16 theme-bg text-white flex items-center justify-between px-5 text-lg font-bold">
          <a href="#/" @click="navigate('#/')" class="flex items-center gap-2 text-white"><span>波幅探长</span></a>
          <button @click="store.menuOpen = false" class="text-white/70 hover:text-white"><i class="fa-solid fa-xmark text-xl"></i></button>
        </div>
        <div class="flex-1 overflow-y-auto py-2 custom-scrollbar">
          <div @click="navigate('#/')" class="nav-item block px-6 py-3.5 border-b" :class="{active: currentRoute === '#/'}"><i class="fa-solid fa-chart-simple w-6"></i> 数据看板</div>
          <div @click="navigate('#/profile', true)" class="nav-item block px-6 py-3.5 border-b" :class="{active: currentRoute === '#/profile'}"><i class="fa-solid fa-user w-6"></i> 个人中心</div>
          <div @click="navigate('#/plan')" class="nav-item block px-6 py-3.5 border-b" :class="{active: currentRoute === '#/plan'}"><i class="fa-solid fa-bag-shopping w-6"></i> 购买套餐</div>
          <div @click="navigate('#/vote')" class="nav-item block px-6 py-3.5 border-b" :class="{active: currentRoute === '#/vote'}"><i class="fa-solid fa-check-to-slot w-6"></i> 监控投票</div>
          <div @click="navigate('#/tickets', true)" class="nav-item block px-6 py-3.5 border-b" :class="{active: currentRoute === '#/tickets'}"><i class="fa-solid fa-headset w-6"></i> 答疑留言</div>
          <div @click="navigate('#/docs')" class="nav-item block px-6 py-3.5" :class="{active: currentRoute === '#/docs'}"><i class="fa-solid fa-book w-6"></i> 使用说明</div>
        </div>
      </aside>
    </div>
  `,
};

// 3. Footer 组件
const FooterComp = {
  setup() {
    const getQrUrl = (url) => url ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url.trim())}` : "";
    return { settings: computed(() => store.publicSettings), getQrUrl };
  },
  template: `
    <footer class="mt-10 pt-5 pb-5 border-t border-slate-200/80 text-center text-xs text-slate-500 shrink-0 select-none">
      <div class="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>© 2026 波幅探长 · 专业的波幅监控与数据分析平台</div>
        <div class="flex items-center gap-4 text-slate-400">
          <a v-if="settings.social_douyin" :href="settings.social_douyin" target="_blank" class="social-item hover:text-slate-700" title="抖音">
            <i class="fa-brands fa-tiktok text-lg"></i>
            <div class="social-qr-pop"><img :src="getQrUrl(settings.social_douyin)"><p class="text-[10px] text-slate-500 mt-1">抖音</p></div>
          </a>
          <a v-if="settings.social_shipinhao" :href="settings.social_shipinhao" target="_blank" class="social-item hover:text-[#07C160]" title="视频号">
            <i class="fa-brands fa-weixin text-lg"></i>
            <div class="social-qr-pop"><img :src="getQrUrl(settings.social_shipinhao)"><p class="text-[10px] text-slate-500 mt-1">视频号</p></div>
          </a>
          <a v-if="settings.social_xiaohongshu" :href="settings.social_xiaohongshu" target="_blank" class="social-item hover:text-[#FE2C55]" title="小红书">
            <i class="fa-solid fa-book text-lg"></i>
            <div class="social-qr-pop"><img :src="getQrUrl(settings.social_xiaohongshu)"><p class="text-[10px] text-slate-500 mt-1">小红书</p></div>
          </a>
          <a v-if="settings.social_gongzhonghao" :href="settings.social_gongzhonghao" target="_blank" class="social-item hover:text-[#07C160]" title="公众号">
            <i class="fa-solid fa-comment-dots text-lg"></i>
            <div class="social-qr-pop"><img :src="getQrUrl(settings.social_gongzhonghao)"><p class="text-[10px] text-slate-500 mt-1">公众号</p></div>
          </a>
          <a v-if="settings.social_kuaishou" :href="settings.social_kuaishou" target="_blank" class="social-item hover:text-[#FF4906]" title="快手">
            <i class="fa-solid fa-video text-lg"></i>
            <div class="social-qr-pop"><img :src="getQrUrl(settings.social_kuaishou)"><p class="text-[10px] text-slate-500 mt-1">快手</p></div>
          </a>
        </div>
      </div>
    </footer>
  `,
};

// 4. Toast 组件
const ToastComp = {
  setup() { return { toasts: store.toasts }; },
  template: `
    <div class="fixed top-4 right-4 z-[200] space-y-2 pointer-events-none select-none">
      <div v-for="t in toasts" :key="t.id" class="px-4 py-2.5 rounded-lg shadow-lg text-sm text-white font-medium flex items-center gap-2 pointer-events-auto" :class="t.type==='error'?'bg-red-500':'bg-emerald-500'">
        <span>{{ t.msg }}</span>
      </div>
    </div>
  `,
};

// 5. AuthModal 组件
const AuthModalComp = {
  setup() {
    const form = reactive({ username: "", password: "", refCode: "" });
    const closeModal = () => { store.authModalVisible = false; };
    const submit = async () => {
      if (!form.username || !form.password) { store.showToast("账号和密码不能为空", "error"); return; }
      try {
        if (store.authMode === "register") {
          const res = await fetch(`${API_BASE}/api/register`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: form.username, password: form.password, ref_code: form.refCode }),
          }).then(r => r.json());
          if (res.error) throw new Error(res.error);
          store.showToast("注册成功，请登录");
          store.authMode = "login";
        } else {
          const data = await apiFetch("/api/login", {
            method: "POST", body: JSON.stringify({ username: form.username, password: form.password }),
          });
          localStorage.setItem("etf_token", data.token);
          localStorage.setItem("etf_username", form.username.trim());
          localStorage.setItem("etf_ref", data.referral_code || "");
          localStorage.setItem("etf_vip_days", data.shared_vip_days ?? data.vip_days_left ?? 0);
          store.checkLoginState();
          store.showToast("登录成功");
          closeModal();
        }
      } catch (err) { store.showToast(err.message, "error"); }
    };
    return { store, form, closeModal, submit };
  },
  template: `
    <div v-if="store.authModalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="closeModal">
      <div class="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
        <div class="flex border-b pb-2">
          <button @click="store.authMode='login'" class="flex-1 py-2 font-bold" :class="store.authMode==='login'?'theme-text border-b-2 theme-border':'text-slate-400'">账号登录</button>
          <button @click="store.authMode='register'" class="flex-1 py-2 font-bold" :class="store.authMode==='register'?'theme-text border-b-2 theme-border':'text-slate-400'">免费注册</button>
        </div>
        <input v-model="form.username" placeholder="电子邮箱账号" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
        <input v-model="form.password" type="password" placeholder="密码 (至少6位)" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
        <input v-if="store.authMode==='register'" v-model="form.refCode" placeholder="推荐码 (选填)" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
        <button @click="submit" class="w-full theme-bg text-white font-bold py-2.5 rounded-lg text-sm">{{ store.authMode==='login'?'立即登录':'确认注册' }}</button>
      </div>
    </div>
  `,
};

// 6. Dashboard 组件 (展开 4 周 / 绝对值 Top 3 免费 / 日线半日线周线全功能 Viewer.js)
const DashboardComp = {
  setup() {
    const loading = ref(false);
    const allData = ref([]);
    const selectedMonday = ref("");
    const searchQuery = ref("");
    const expandedRowKey = ref(null);
    const dailyModalVisible = ref(false);
    const dailyTarget = reactive({ code: "", name: "" });

    const isValidDate = (d) => d && typeof d === "string" && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(d.trim());
    const parseYMD = (s) => isValidDate(s) ? s.trim().split(/[-/]/).map(v => parseInt(v, 10)) : [0, 0, 0];

    const getWeekDays = (dateStr) => {
      const [y, m, d] = parseYMD(dateStr);
      if (!y) return [];
      const dateObj = new Date(y, m - 1, d);
      const offset = dateObj.getDay() === 0 ? -6 : 1 - dateObj.getDay();
      const monday = new Date(y, m - 1, d + offset);
      const days = [];
      for (let i = 0; i < 5; i++) {
        const temp = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
        days.push(`${temp.getFullYear()}-${String(temp.getMonth() + 1).padStart(2, "0")}-${String(temp.getDate()).padStart(2, "0")}`);
      }
      return days;
    };

    const getStatusVal = (str) => {
      if (!str || str === "-" || str === "--") return -9999;
      const m = String(str).match(/[-+]?[0-9]*\.?[0-9]+/);
      return m ? parseFloat(m[0]) : -9999;
    };

    // 展开过去 4 周历史数据 (最多 4 行)
    const getPastWeeks = (etfCode) => {
      if (!selectedMonday.value) return [];
      const pastData = allData.value.filter(i => i.etf_code === etfCode && (i.day_status || i.week_status));
      const weekMap = {};
      pastData.forEach(item => {
        if (!item.date || !isValidDate(item.date)) return;
        const wDays = getWeekDays(item.date);
        if (!wDays.length) return;
        const monday = wDays[0];
        if (monday === selectedMonday.value) return;
        if (!weekMap[monday]) weekMap[monday] = { monday, days: [null, null, null, null, null], week_status: null };
        const idx = wDays.indexOf(item.date);
        if (idx !== -1) weekMap[monday].days[idx] = item;
        if (item.week_status && item.week_status !== "-") weekMap[monday].week_status = item.week_status;
      });
      return Object.values(weekMap).sort((a, b) => b.monday.localeCompare(a.monday)).slice(0, 4);
    };

    // 绝对值降序与免费 Top 3
    const processedData = computed(() => {
      if (!selectedMonday.value) return { list: [], freeCodes: [] };
      const weekDays = getWeekDays(selectedMonday.value);
      const etfMap = {};
      allData.value.forEach(item => {
        if (!item.date) return;
        const idx = weekDays.indexOf(item.date);
        if (idx !== -1) {
          if (!etfMap[item.etf_code]) {
            etfMap[item.etf_code] = { etf_code: item.etf_code, etf_name: item.etf_name, days: [null, null, null, null, null], week_status: null };
          }
          etfMap[item.etf_code].days[idx] = item;
          if (item.week_status && item.week_status !== "-") etfMap[item.etf_code].week_status = item.week_status;
        }
      });

      let items = Object.values(etfMap);
      items.sort((a, b) => {
        let latestIdx = 4;
        while (latestIdx >= 0) {
          const hasData = items.some(i => i.days[latestIdx]?.day_status && i.days[latestIdx].day_status !== "-");
          if (hasData) break;
          latestIdx--;
        }
        if (latestIdx >= 0) {
          const valA = a.days[latestIdx]?.day_status ? Math.abs(getStatusVal(a.days[latestIdx].day_status)) : -9999;
          const valB = b.days[latestIdx]?.day_status ? Math.abs(getStatusVal(b.days[latestIdx].day_status)) : -9999;
          return valB - valA;
        }
        return 0;
      });

      const freeCodes = items.slice(0, 3).map(i => i.etf_code);
      if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase().trim();
        items = items.filter(i => (i.etf_name && i.etf_name.toLowerCase().includes(q)) || (i.etf_code && i.etf_code.toLowerCase().includes(q)));
      }
      return { list: items, freeCodes };
    });

    const checkViewPermission = (code) => {
      if (store.isVip || processedData.value.freeCodes.includes(code)) return true;
      if (confirm("非免费标的看图需 VIP 权限，是否去开通？")) window.location.hash = "#/plan";
      return false;
    };

    const openDailyModal = (item) => {
      if (!checkViewPermission(item.etf_code)) return;
      dailyTarget.code = item.etf_code;
      dailyTarget.name = item.etf_name || item.etf_code;
      dailyModalVisible.value = true;
    };

    const viewChart = (code, type) => {
      dailyModalVisible.value = false;
      const url = `https://pub-973330e118204686a625fe51431d4336.r2.dev/charts/${code}_${type}.png`;
      openViewerImage(url);
    };

    const openWeeklyChart = (item) => {
      if (!checkViewPermission(item.etf_code)) return;
      const url = `https://pub-973330e118204686a625fe51431d4336.r2.dev/charts/${item.etf_code}_weekly.png`;
      openViewerImage(url);
    };

    onMounted(async () => {
      loading.value = true;
      try {
        const rawUrl = atob("aHR0cHM6Ly9ldGYuaGFoYWd3LmV1Lm9yZy8=");
        const res = await fetch(rawUrl);
        if (res.ok) {
          allData.value = await res.json();
          selectedMonday.value = "2026-08-03";
        }
      } catch (_) {}
      finally { loading.value = false; }
    });

    return {
      loading, searchQuery, processedData, expandedRowKey, dailyModalVisible, dailyTarget,
      openDailyModal, openWeeklyChart, viewChart, getPastWeeks,
      toggleRow: (i) => { expandedRowKey.value = expandedRowKey.value === i.etf_code ? null : i.etf_code; },
      getColorClass: (s) => (!s || s === "-") ? "text-slate-300" : (s.includes("+") ? "text-red-500" : "text-emerald-500"),
    };
  },
  template: `
    <div class="max-w-7xl mx-auto space-y-4 select-none">
      <div class="flex justify-between items-center bg-white p-3.5 rounded-xl border shadow-sm">
        <span class="text-sm font-bold text-slate-700">数据看板 (最新绝对值前 3 名标的免费看图)</span>
        <input v-model="searchQuery" placeholder="搜索 代码/名称..." class="border px-3 py-1.5 rounded-lg text-sm outline-none focus:theme-border">
      </div>

      <div class="bg-white rounded-xl border overflow-hidden shadow-sm">
        <table class="w-full text-center text-sm whitespace-nowrap">
          <thead class="bg-slate-50 border-b text-xs font-bold">
            <tr>
              <th class="py-3 px-4 text-left">标的名称 (绝对值倒序)</th>
              <th v-for="idx in 5" :key="idx">周{{ ['一','二','三','四','五'][idx-1] }}</th>
              <th>周线</th>
            </tr>
          </thead>
          <tbody class="divide-y text-sm">
            <template v-for="item in processedData.list" :key="item.etf_code">
              <tr class="hover:bg-slate-50 cursor-pointer" @click="toggleRow(item)">
                <td class="p-3 text-left font-bold text-slate-800">
                  {{ item.etf_name }}
                  <span v-if="processedData.freeCodes.includes(item.etf_code)" class="text-[9px] bg-orange-100 text-orange-600 px-1 py-0.2 rounded ml-1 font-bold">Top3 免费</span>
                  <div class="text-[11px] text-slate-400 font-mono">{{ item.etf_code }}</div>
                </td>
                
                <td v-for="idx in 5" :key="idx" class="p-3 font-medium" :class="getColorClass(item.days[idx-1]?.day_status)">
                  <span>{{ item.days[idx-1]?.day_status || '-' }}</span>
                  <i v-if="item.days[idx-1]" class="fa-regular fa-image text-slate-300 hover:text-blue-500 ml-1 cursor-pointer"
                     title="查看日线/半日线图表" @click.stop="openDailyModal(item)"></i>
                </td>

                <td class="p-3 font-medium" :class="getColorClass(item.week_status)">
                  <span>{{ item.week_status || '-' }}</span>
                  <i class="fa-regular fa-image text-slate-300 hover:text-blue-500 ml-1 cursor-pointer"
                     title="查看周线图表" @click.stop="openWeeklyChart(item)"></i>
                </td>
              </tr>

              <template v-if="expandedRowKey === item.etf_code">
                <tr v-for="week in getPastWeeks(item.etf_code)" :key="week.monday" class="bg-slate-50 text-xs">
                  <td class="p-2.5 text-left font-mono text-slate-400 pl-6"><i class="fa-regular fa-clock mr-1"></i>{{ week.monday }}</td>
                  <td v-for="idx in 5" :key="idx" class="p-2.5 font-medium" :class="getColorClass(week.days[idx-1]?.day_status)">{{ week.days[idx-1]?.day_status || '-' }}</td>
                  <td class="p-2.5 font-medium" :class="getColorClass(week.week_status)">{{ week.week_status || '-' }}</td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </div>

      <div v-if="dailyModalVisible" class="fixed inset-0 modal-overlay z-[100] flex items-center justify-center p-4" @click.self="dailyModalVisible = false">
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl text-center">
          <h3 class="font-bold text-slate-800 text-base">{{ dailyTarget.name }} ({{ dailyTarget.code }})</h3>
          <p class="text-xs text-slate-400">请选择要查看的图表类型：</p>
          <div class="space-y-2">
            <button @click="viewChart(dailyTarget.code, 'daily')" class="w-full theme-bg text-white font-bold py-2.5 rounded-xl text-sm shadow hover:opacity-90">
              <i class="fa-solid fa-chart-line mr-2"></i>查看【日线图表】(支持旋转放大)
            </button>
            <button @click="viewChart(dailyTarget.code, 'half_day')" class="w-full bg-slate-100 text-slate-700 font-bold py-2.5 rounded-xl text-sm hover:bg-slate-200">
              <i class="fa-solid fa-chart-column mr-2"></i>查看【半日线图表】(支持旋转放大)
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
};

// 7. Profile 组件 (完全还原图一 5 大卡片)
const ProfileComp = {
  setup() {
    const orders = ref([]);
    const invitees = ref([]);
    const customList = ref([]);
    const pwdForm = reactive({ oldPassword: "", newPassword: "", confirmPassword: "" });

    const loadData = async () => {
      if (!store.isLoggedIn) return;
      try {
        const [oRes, iRes, cRes] = await Promise.all([
          apiFetch("/api/user/orders").catch(() => ({ data: [] })),
          apiFetch("/api/user/invitees").catch(() => ({ data: [] })),
          apiFetch("/api/user/watchlist/custom").catch(() => ({ data: [] })),
        ]);
        orders.value = oRes.data || [];
        invitees.value = iRes.data || [];
        customList.value = cRes.data || [];
      } catch (_) {}
    };

    const changePassword = async () => {
      if (!pwdForm.oldPassword || pwdForm.newPassword.length < 6 || pwdForm.newPassword !== pwdForm.confirmPassword) {
        store.showToast("请输入正确填写的密码", "error");
        return;
      }
      try {
        await apiFetch("/api/password", { method: "POST", body: JSON.stringify({ old_password: pwdForm.oldPassword, new_password: pwdForm.newPassword }) });
        store.showToast("密码修改成功，请重新登录");
        store.logout();
      } catch (err) { store.showToast(err.message, "error"); }
    };

    onMounted(loadData);

    return { store, settings: computed(() => store.publicSettings), orders, invitees, customList, pwdForm, changePassword };
  },
  template: `
    <div class="max-w-4xl mx-auto space-y-5 select-none">
      <!-- 1. 通用监控 VIP 权限 (卡片一) -->
      <div class="bg-white p-5 sm:p-6 rounded-xl shadow-sm border flex items-center justify-between">
        <div>
          <div class="text-xs text-slate-400 mb-1">通用监控 VIP 权限</div>
          <div class="flex items-center gap-2">
            <span class="text-xl sm:text-2xl font-bold" :class="store.isVip ? 'theme-text' : 'text-slate-400'">
              {{ store.isVip ? '已开通' : '未开通' }}
            </span>
            <span v-if="store.isVip" class="text-xs bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded-full border border-emerald-100 font-bold">
              剩余 {{ store.vipDaysLeft }} 天
            </span>
          </div>
        </div>
        <a href="#/plan" class="theme-bg text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:opacity-90 shadow-sm">
          {{ store.isVip ? '续费 VIP' : '开通 VIP' }}
        </a>
      </div>

      <!-- 2. 我的定制监控 (卡片二，图一还原) -->
      <div class="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div class="px-5 sm:px-6 py-4 border-b flex justify-between items-center">
          <div>
            <div class="font-bold text-slate-800 text-base">我的定制监控</div>
            <p class="text-[11px] text-slate-400 mt-0.5">套餐总价含最多 {{ settings.custom_max_symbols || 3 }} 只 · 与通用独立 · 不解锁通用图表</p>
          </div>
          <a href="#/plan" class="theme-bg text-white px-3.5 py-1.5 rounded-lg text-xs font-bold hover:opacity-90">+ 添加标的</a>
        </div>
        <div v-if="!customList.length" class="p-8 text-center text-slate-400 text-xs font-medium">暂无定制标的</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm text-left whitespace-nowrap">
            <thead class="bg-slate-50 text-xs text-slate-500 border-b">
              <tr><th class="p-3">代码 / 名称</th><th class="p-3 text-center">状态</th><th class="p-3 text-center">到期</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="c in customList" :key="c.id">
                <td class="p-3 font-bold text-slate-800">{{ c.etf_code }} <span class="text-xs font-normal text-slate-400 ml-1">{{ c.etf_name }}</span></td>
                <td class="p-3 text-center font-bold text-xs text-emerald-600">{{ c.status === 'active' ? '监控中' : c.status }}</td>
                <td class="p-3 text-center text-xs font-mono text-slate-400">{{ c.expire_at ? new Date(c.expire_at).toLocaleDateString() : '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 3. 我的订单 (卡片三，图一还原) -->
      <div class="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div class="px-5 sm:px-6 py-4 border-b font-bold text-slate-800 text-base">我的订单</div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm whitespace-nowrap">
            <thead class="bg-slate-50 text-xs text-slate-500 border-b font-bold">
              <tr><th class="py-3 px-4">套餐</th><th class="py-3 px-4">金额</th><th class="py-3 px-4">类型</th><th class="py-3 px-4">获得 VIP</th><th class="py-3 px-4">状态</th><th class="py-3 px-4">时间</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="o in orders" :key="o.id">
                <td class="py-3.5 px-4 font-bold">{{ o.plan_id }}</td>
                <td class="py-3.5 px-4 font-mono font-bold">¥ {{ o.amount }}</td>
                <td class="py-3.5 px-4 text-xs font-bold text-slate-500">{{ o.order_type === 'custom_watchlist' ? '定制' : '通用' }}</td>
                <td class="py-3.5 px-4 text-emerald-600 font-bold text-xs">{{ o.status === 'approved' ? (o.vip_days_granted ? ('+' + o.vip_days_granted + '天') : '定制激活') : '-' }}</td>
                <td class="py-3.5 px-4 font-bold text-xs">{{ o.status === 'approved' ? '已通过' : '审核中' }}</td>
                <td class="py-3.5 px-4 text-xs font-mono text-slate-400">{{ new Date(o.created_at).toLocaleDateString() }}</td>
              </tr>
              <tr v-if="!orders.length"><td colspan="6" class="py-8 text-center text-slate-400 text-xs font-medium">暂无订单</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 4. 专属邀请码及奖励 (卡片四，图一还原) -->
      <div class="bg-white p-5 sm:p-6 rounded-xl shadow-sm border space-y-4">
        <div class="font-bold text-slate-800 text-base">专属邀请码及奖励</div>
        <div class="bg-slate-50 p-4 rounded-xl flex justify-between items-center border border-slate-100">
          <div><div class="text-xs text-slate-400 mb-1">您的专属邀请码</div><span class="font-mono text-2xl font-extrabold theme-text tracking-widest">{{ store.referralCode || '-' }}</span></div>
          <div class="text-right text-xs theme-text font-medium leading-relaxed">
            <div>邀请与被邀请双方各送 VIP</div>
            <div class="text-sm font-bold mt-0.5">邀请人 {{ settings.gift_inviter_days || 3 }} 天 · 被邀请人 {{ settings.gift_invitee_days || 2 }} 天</div>
          </div>
        </div>

        <div class="text-sm font-bold text-slate-600 pt-1">我邀请的用户 ({{ invitees.length }})</div>
        <div v-if="!invitees.length" class="text-xs text-slate-400 py-4 text-center font-medium">暂无被邀请人</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm text-left">
            <thead class="text-xs text-slate-400 border-b"><tr><th class="p-2">账号</th><th class="p-2">当前 VIP 天数</th><th class="p-2">注册时间</th></tr></thead>
            <tbody class="divide-y"><tr v-for="inv in invitees" :key="inv.id"><td class="p-2 font-bold">{{ inv.username }}</td><td class="p-2 font-bold text-emerald-600">{{ inv.vip_days_left }} 天</td><td class="p-2 text-xs text-slate-400">{{ new Date(inv.created_at).toLocaleDateString() }}</td></tr></tbody>
          </table>
        </div>
      </div>

      <!-- 5. 修改账号密码 (卡片五) -->
      <div class="bg-white p-5 sm:p-6 rounded-xl shadow-sm border">
        <h3 class="font-bold text-slate-800 text-base mb-4">修改账号密码</h3>
        <div class="space-y-3 max-w-md">
          <input v-model="pwdForm.oldPassword" type="password" placeholder="原密码" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
          <input v-model="pwdForm.newPassword" type="password" placeholder="新密码 (至少6位)" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
          <input v-model="pwdForm.confirmPassword" type="password" placeholder="确认新密码" class="w-full border px-3 py-2 rounded-lg text-sm focus:theme-border outline-none">
          <button @click="changePassword" class="theme-bg text-white px-5 py-2.5 rounded-lg text-xs font-bold shadow-sm hover:opacity-90">确认修改</button>
        </div>
      </div>
    </div>
  `,
};

// 8. Plan 组件 (包含 promo_enabled 二维码下方优惠码及扫码支付)
const PlanComp = {
  setup() {
    const plans = ref([]);
    const planTab = ref("shared");
    const topUpForm = reactive({ planId: "", amount: 18.8, floatingAmount: "18.82", txId: "", orderType: "vip" });
    const promoInput = ref("");
    const payChannel = ref("alipay");
    const showManualInput = ref(false);
    const payRegister = reactive({ username: "", password: "", refCode: "" });

    const displayPlans = computed(() => {
      if (planTab.value === "custom") return plans.value.filter(p => p.plan_type === "custom" || p.plan_type === "both");
      return plans.value.filter(p => p.plan_type === "shared" || p.plan_type === "both" || !p.plan_type);
    });

    const currentPayQrSrc = computed(() => {
      const url = payChannel.value === "wechat" ? store.publicSettings.wechat_qr_url : store.publicSettings.alipay_qr_url;
      if (!url) return "";
      if (/\.(png|jpe?g|webp|svg)/i.test(url)) return url;
      return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url.trim())}`;
    });

    onMounted(async () => {
      const res = await apiFetch("/api/plans").catch(() => ({ data: [] }));
      plans.value = res.data || [];
      if (displayPlans.value.length) selectPlan(displayPlans.value[0]);
    });

    const selectPlan = (p) => {
      topUpForm.planId = p.id;
      topUpForm.amount = p.price;
      topUpForm.floatingAmount = (Number(p.price) + 0.02).toFixed(2);
      topUpForm.orderType = planTab.value === "custom" ? "custom_watchlist" : "vip";
    };

    const submitOrder = async () => {
      if (!/^\d{6}$/.test(topUpForm.txId)) { store.showToast("请填写 6 位数字单号凭证", "error"); return; }
      try {
        await apiFetch("/api/orders", {
          method: "POST",
          body: JSON.stringify({ plan_id: topUpForm.planId, amount: topUpForm.floatingAmount, tx_id_last6: topUpForm.txId, order_type: topUpForm.orderType, register_username: payRegister.username, register_password: payRegister.password }),
        });
        store.showToast("提交成功，等待审核！");
        topUpForm.txId = "";
      } catch (err) { store.showToast(err.message, "error"); }
    };

    return { store, settings: computed(() => store.publicSettings), planTab, displayPlans, topUpForm, promoInput, payChannel, currentPayQrSrc, showManualInput, payRegister, selectPlan, submitOrder };
  },
  template: `
    <div class="max-w-5xl mx-auto space-y-6 select-none">
      <div class="flex gap-2 text-sm">
        <button @click="planTab='shared'" class="px-5 py-2.5 rounded-lg border font-bold shadow-sm" :class="planTab==='shared'?'theme-bg text-white':'bg-white text-slate-600'">通用监控</button>
        <button @click="planTab='custom'" class="px-5 py-2.5 rounded-lg border font-bold shadow-sm" :class="planTab==='custom'?'theme-bg text-white':'bg-white text-slate-600'">定制监控</button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div v-for="p in displayPlans" :key="p.id" @click="selectPlan(p)" class="bg-white p-5 rounded-xl border-2 cursor-pointer transition-all shadow-sm" :class="topUpForm.planId===p.id?'theme-border ring-2 ring-[#4da6a0]/20':'border-slate-100'">
          <div class="font-bold text-slate-800">{{ p.name }}</div>
          <div class="text-3xl font-light text-slate-800 my-2">¥ {{ p.price }}</div>
          <button class="w-full py-2 rounded text-xs font-bold" :class="topUpForm.planId===p.id?'theme-bg text-white':'bg-slate-100'">{{ topUpForm.planId===p.id?'已选中':'选择套餐' }}</button>
        </div>
      </div>

      <div class="bg-white p-6 rounded-2xl border max-w-2xl mx-auto space-y-5 shadow-sm">
        <!-- 未登录支付即注册 -->
        <div v-if="!store.isLoggedIn" class="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-2">
          <div class="text-xs font-bold text-amber-800">未登录：支付成功后将自动注册账号</div>
          <input v-model="payRegister.username" placeholder="账号 (不强制邮箱)" class="w-full border px-3 py-2 rounded text-sm outline-none">
          <input v-model="payRegister.password" type="password" placeholder="密码 (至少6位)" class="w-full border px-3 py-2 rounded text-sm outline-none">
        </div>

        <!-- 金额与通道 -->
        <div class="text-center space-y-3">
          <div class="text-xs text-slate-400">精准应付金额</div>
          <div class="text-3xl font-extrabold text-red-500 font-mono">¥ {{ topUpForm.floatingAmount }}</div>
          
          <div class="flex justify-center gap-2 text-xs">
            <button @click="payChannel='alipay'" class="px-4 py-1.5 rounded-full border font-bold" :class="payChannel==='alipay'?'theme-bg text-white':'bg-white'">支付宝</button>
            <button @click="payChannel='wechat'" class="px-4 py-1.5 rounded-full border font-bold" :class="payChannel==='wechat'?'theme-bg text-white':'bg-white'">微信支付</button>
          </div>

          <div class="w-48 h-48 mx-auto bg-slate-50 border border-dashed rounded-xl p-2 flex items-center justify-center">
            <img v-if="currentPayQrSrc" :src="currentPayQrSrc" class="max-w-full max-h-full rounded">
            <span v-else class="text-xs text-slate-400">请在后台设置收款码 URL</span>
          </div>
        </div>

        <!-- 优惠码输入卡片 (放在二维码下方，受 promo_enabled 开关控制) -->
        <div v-if="settings.promo_enabled === '1' || settings.promo_enabled === 1 || settings.promo_enabled === true" class="bg-slate-50 p-4 rounded-xl border">
          <label class="text-xs font-bold text-slate-600 block mb-2">优惠码 (选填)</label>
          <div class="flex gap-2">
            <input v-model="promoInput" placeholder="输入优惠码" class="flex-1 border px-3 py-2 rounded text-sm uppercase outline-none focus:theme-border">
            <button class="px-4 py-2 theme-bg text-white rounded text-xs font-bold">使用</button>
          </div>
        </div>

        <div class="max-w-xs mx-auto text-center space-y-2 pt-2">
          <button @click="showManualInput = !showManualInput" class="text-xs text-slate-400 hover:text-slate-600">手动提交支付单号后 6 位</button>
          <div v-if="showManualInput" class="space-y-2">
            <input v-model="topUpForm.txId" maxlength="6" placeholder="后 6 位数字" class="w-full border px-4 py-2 rounded text-center font-mono text-sm outline-none">
            <button @click="submitOrder" class="w-full py-2.5 theme-bg text-white rounded text-xs font-bold">确认提交审核</button>
          </div>
        </div>
      </div>
    </div>
  `,
};

// 9. Vote 组件
const VoteComp = {
  setup() {
    const rankings = ref([]);
    onMounted(async () => {
      const res = await apiFetch("/api/vote/rankings").catch(() => ({ data: [] }));
      rankings.value = res.data || [];
    });
    return { rankings };
  },
  template: `
    <div class="max-w-6xl mx-auto space-y-4 select-none">
      <div class="theme-bg p-6 rounded-2xl text-white shadow-sm">
        <h2 class="text-2xl font-bold">全网会员监控投票榜 TOP 100</h2>
        <p class="text-xs text-white/90 mt-1">每月付费会员可填写最想监控的 10 只标的，月底前 50 自动纳为下月通用监控。</p>
      </div>
      <div class="bg-white rounded-xl border overflow-hidden shadow-sm">
        <table class="w-full text-sm text-center">
          <thead class="bg-slate-50 text-xs font-bold"><tr><th class="p-3">排名</th><th class="p-3 text-left">标的代码</th><th class="p-3 text-left">标的名称</th><th class="p-3">得票数</th></tr></thead>
          <tbody>
            <tr v-for="(item, idx) in rankings" :key="item.etf_code" class="hover:bg-slate-50">
              <td class="p-3 font-mono font-bold">#{{ idx + 1 }}</td>
              <td class="p-3 text-left font-mono font-bold">{{ item.etf_code }}</td>
              <td class="p-3 text-left font-medium">{{ item.etf_name }}</td>
              <td class="p-3 font-bold text-orange-500">{{ item.vote_count }} 票</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
};

// 10. Tickets 组件
const TicketsComp = {
  setup() {
    const tickets = ref([]);
    onMounted(async () => {
      if (!store.isLoggedIn) return;
      const res = await apiFetch("/api/tickets").catch(() => ({ data: [] }));
      tickets.value = res.data || [];
    });
    return { tickets };
  },
  template: `
    <div class="max-w-3xl mx-auto space-y-4 select-none">
      <h2 class="text-xl font-bold">答疑留言</h2>
      <div class="bg-white rounded-xl border p-4 shadow-sm">
        <div v-for="t in tickets" :key="t.id" class="border-b py-2.5 last:border-0">
          <div class="font-bold text-sm">{{ t.subject }}</div>
          <div class="text-xs text-slate-500 mt-1">{{ t.message }}</div>
          <div v-if="t.admin_reply" class="bg-emerald-50 text-xs p-2.5 rounded mt-2 theme-text font-medium">官方回复: {{ t.admin_reply }}</div>
        </div>
      </div>
    </div>
  `,
};

// 11. Docs 组件
const DocsComp = {
  template: `
    <div class="max-w-4xl mx-auto bg-white p-8 rounded-2xl border space-y-4 select-none shadow-sm">
      <h2 class="text-2xl font-bold text-center text-slate-800">波幅探长 · 使用指南</h2>
      <div class="text-sm text-slate-600 space-y-3 leading-relaxed">
        <p><strong>1. 通用监控 vs 定制监控：</strong>通用解锁全看板图表；定制监控专属配置。</p>
        <p><strong>2. 监控投票：</strong>付费会员每月可投票 10 只标的，月底统计 Top 50 自动纳为下月通用监控。</p>
        <p><strong>3. 游客开通：</strong>开通时设置账号密码即可同步自动建号。</p>
      </div>
    </div>
  `,
};

// 启动前台应用
createApp({
  components: {
    "v-header": HeaderComp,
    "v-sidebar": SidebarComp,
    "v-footer": FooterComp,
    "v-auth-modal": AuthModalComp,
    "v-toast": ToastComp,
    Dashboard: DashboardComp,
    Profile: ProfileComp,
    Plan: PlanComp,
    Vote: VoteComp,
    Tickets: TicketsComp,
    Docs: DocsComp,
  },
  setup() {
    const currentRoute = ref(window.location.hash || "#/");
    const navigate = (path) => { currentRoute.value = path; window.location.hash = path; };

    const currentComponent = computed(() => {
      switch (currentRoute.value) {
        case "#/profile": return "Profile";
        case "#/plan": return "Plan";
        case "#/vote": return "Vote";
        case "#/tickets": return "Tickets";
        case "#/docs": return "Docs";
        default: return "Dashboard";
      }
    });

    const pageTitle = computed(() => {
      const map = { "#/": "数据看板", "#/profile": "个人中心", "#/plan": "购买套餐", "#/vote": "全网监控投票", "#/tickets": "答疑留言", "#/docs": "使用说明" };
      return map[currentRoute.value] || "数据看板";
    });

    onMounted(() => {
      store.checkLoginState();
      fetch(`${API_BASE}/api/settings/public`).then(r => r.json()).then(d => { if (d.data) store.publicSettings = { ...store.publicSettings, ...d.data }; });
      window.addEventListener("hashchange", () => { currentRoute.value = window.location.hash || "#/"; });
    });

    return { currentRoute, currentComponent, pageTitle, navigate };
  },
}).mount("#app");
