/**
 * 波幅探长 - 全局状态 (v5.1)
 * 注册登录即可看全量看板与图表；支持用户自定义昵称与赞助标的本人置顶识别
 */
import { CONFIG } from "./config.js";

const { reactive } = Vue;

const state = reactive({
  isLoggedIn: false,
  userId: null,
  username: "",
  nickname: "",
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

  /** 获取展示用名称：优先昵称，否则取邮箱前缀 */
  getDisplayName() {
    if (state.nickname && state.nickname.trim()) {
      return state.nickname.trim();
    }
    const u = String(state.username || "").trim();
    if (!u) return "会员";
    return u.includes("@") ? u.split("@")[0] : u;
  },

  checkLoginState() {
    try {
      const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
      if (token) {
        state.isLoggedIn = true;
        const rawId = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_ID);
        state.userId = rawId ? Number(rawId) || rawId : null;
        state.username = localStorage.getItem(CONFIG.STORAGE_KEYS.USERNAME) || "";
        state.nickname = localStorage.getItem(CONFIG.STORAGE_KEYS.NICKNAME) || "";
      } else {
        this.clearUserState();
      }
    } catch (e) {
      console.error("checkLoginState", e);
    }
  },

  setUserState({ token, userId, username, nickname, securitySet }) {
    if (token) localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, token);
    if (userId !== undefined && userId !== null) {
      localStorage.setItem(CONFIG.STORAGE_KEYS.USER_ID, String(userId));
      state.userId = Number(userId) || userId;
    }
    if (username) {
      localStorage.setItem(CONFIG.STORAGE_KEYS.USERNAME, username);
      state.username = username;
    }
    if (nickname !== undefined && nickname !== null) {
      localStorage.setItem(CONFIG.STORAGE_KEYS.NICKNAME, String(nickname));
      state.nickname = String(nickname);
    }
    state.isLoggedIn = true;
    if (securitySet != null) state.securitySet = !!securitySet;
  },

  clearUserState() {
    [
      CONFIG.STORAGE_KEYS.TOKEN,
      CONFIG.STORAGE_KEYS.USER_ID,
      CONFIG.STORAGE_KEYS.USERNAME,
      CONFIG.STORAGE_KEYS.NICKNAME,
    ].forEach((k) => localStorage.removeItem(k));
    state.isLoggedIn = false;
    state.userId = null;
    state.username = "";
    state.nickname = "";
    state.securitySet = true;
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
