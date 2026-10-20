/**
 * 波幅探长 - 全局状态（精简版）
 * 登录即可看全量看板/图表；无 VIP 天数门槛
 */
import { CONFIG } from "./config.js";

const { reactive } = Vue;

const state = reactive({
  isLoggedIn: false,
  username: "",
  referralCode: "",
  chartCredits: 0,
  securitySet: true,

  adminSecret: localStorage.getItem(CONFIG.STORAGE_KEYS.ADMIN_SECRET) || "",
  isAdminAuthenticated: false,

  publicSettings: { ...CONFIG.DEFAULT_PUBLIC_SETTINGS },
  publicSettingsLoaded: false,

  menuOpen: false,
  userMenuOpen: false,
  authModalVisible: false,
  authMode: "login",

  toasts: [],
});

export const store = {
  state,

  checkLoginState() {
    try {
      const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
      if (token) {
        state.isLoggedIn = true;
        state.username = localStorage.getItem(CONFIG.STORAGE_KEYS.USERNAME) || "";
        state.referralCode = localStorage.getItem(CONFIG.STORAGE_KEYS.REF_CODE) || "";
        state.chartCredits =
          parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.CHART_CREDITS), 10) || 0;
      } else {
        this.clearUserState();
      }
    } catch (e) {
      console.error("checkLoginState", e);
    }
  },

  setUserState({ token, username, referralCode, chartCredits }) {
    if (token) localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, token);
    if (username) localStorage.setItem(CONFIG.STORAGE_KEYS.USERNAME, username);
    if (referralCode != null)
      localStorage.setItem(CONFIG.STORAGE_KEYS.REF_CODE, referralCode);
    if (chartCredits != null) {
      const c = Math.max(0, parseInt(chartCredits, 10) || 0);
      localStorage.setItem(CONFIG.STORAGE_KEYS.CHART_CREDITS, String(c));
      state.chartCredits = c;
    }
    state.isLoggedIn = true;
    state.username = username || state.username;
    state.referralCode = referralCode ?? state.referralCode;
  },

  clearUserState() {
    [
      CONFIG.STORAGE_KEYS.TOKEN,
      CONFIG.STORAGE_KEYS.USERNAME,
      CONFIG.STORAGE_KEYS.REF_CODE,
      CONFIG.STORAGE_KEYS.CHART_CREDITS,
    ].forEach((k) => localStorage.removeItem(k));
    state.isLoggedIn = false;
    state.username = "";
    state.referralCode = "";
    state.chartCredits = 0;
    state.securitySet = true;
  },

  setSecuritySet(val) {
    state.securitySet = !!val;
  },

  setChartCredits(n) {
    const c = Math.max(0, parseInt(n, 10) || 0);
    state.chartCredits = c;
    try {
      localStorage.setItem(CONFIG.STORAGE_KEYS.CHART_CREDITS, String(c));
    } catch (_) {}
  },

  showToast(msg, type = "success") {
    const id = Date.now() + Math.random();
    state.toasts.push({ msg, type, id });
    setTimeout(() => {
      const i = state.toasts.findIndex((t) => t.id === id);
      if (i >= 0) state.toasts.splice(i, 1);
    }, 2800);
  },

  setPublicSettings(settings) {
    if (settings && typeof settings === "object") {
      state.publicSettings = {
        ...CONFIG.DEFAULT_PUBLIC_SETTINGS,
        ...state.publicSettings,
        ...settings,
      };
      state.publicSettingsLoaded = true;
    }
  },

  async loadPublicSettings() {
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/settings/public`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`settings ${res.status}`);
      const data = await res.json();
      const payload = data?.data || data;
      if (payload && typeof payload === "object") this.setPublicSettings(payload);
      return state.publicSettings;
    } catch (e) {
      console.error("loadPublicSettings", e);
      return state.publicSettings;
    }
  },

  /** 解析赞助周期价 */
  getSymbolPrices() {
    const raw = state.publicSettings.symbol_prices;
    try {
      const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(arr) && arr.length) {
        return arr.map((p) => ({
          days: Number(p.days) || 30,
          price: Number(p.price) || 0,
          label: p.label || `${p.days}天`,
        }));
      }
    } catch (_) {}
    return CONFIG.DEFAULT_SYMBOL_PRICES.map((p) => ({ ...p }));
  },

  getSocialPlatforms() {
    const s = state.publicSettings || {};
    const raw = s.social_platforms;
    if (raw) {
      try {
        const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (Array.isArray(arr) && arr.length) {
          return arr
            .map((p) => ({
              key: p.key || p.label || "",
              label: p.label || p.key || "",
              icon: p.icon || "fa-solid fa-link",
              handle: String(p.handle || "").trim(),
            }))
            .filter((p) => p.handle);
        }
      } catch (_) {}
    }
    return [];
  },
};
