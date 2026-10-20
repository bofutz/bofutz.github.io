/**
 * 波幅探长 - 全局状态（精简版）
 * 登录即可看全量看板/图表；无 VIP 天数门槛看图
 * 已移除 chartCredits / 自主查询相关状态
 */
import { CONFIG } from "./config.js";

const { reactive } = Vue;

const state = reactive({
  isLoggedIn: false,
  username: "",
  referralCode: "",
  securitySet: true,
  vipLevel: 0,
  vipDaysLeft: 0,
  isVip: false,

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
      } else {
        this.clearUserState();
      }
    } catch (e) {
      console.error("checkLoginState", e);
    }
  },

  setUserState({ token, username, referralCode, vipLevel, vipDaysLeft, securitySet }) {
    if (token) localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, token);
    if (username) localStorage.setItem(CONFIG.STORAGE_KEYS.USERNAME, username);
    if (referralCode != null)
      localStorage.setItem(CONFIG.STORAGE_KEYS.REF_CODE, referralCode);
    state.isLoggedIn = true;
    state.username = username || state.username;
    state.referralCode = referralCode ?? state.referralCode;
    if (vipLevel != null) state.vipLevel = Number(vipLevel) || 0;
    if (vipDaysLeft != null) {
      state.vipDaysLeft = Math.max(0, Number(vipDaysLeft) || 0);
      state.isVip = state.vipDaysLeft > 0;
    }
    if (securitySet != null) state.securitySet = !!securitySet;
  },

  clearUserState() {
    [
      CONFIG.STORAGE_KEYS.TOKEN,
      CONFIG.STORAGE_KEYS.USERNAME,
      CONFIG.STORAGE_KEYS.REF_CODE,
    ].forEach((k) => localStorage.removeItem(k));
    state.isLoggedIn = false;
    state.username = "";
    state.referralCode = "";
    state.securitySet = true;
    state.vipLevel = 0;
    state.vipDaysLeft = 0;
    state.isVip = false;
  },

  setSecuritySet(val) {
    state.securitySet = !!val;
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
