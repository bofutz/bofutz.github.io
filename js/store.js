/**
 * 波幅探长 - 响应式全局状态 Store
 * js/store.js
 */
import { CONFIG } from "./config.js";

const { reactive, computed } = Vue;

const state = reactive({
  // 认证状态
  isLoggedIn: false,
  isVip: false,
  username: "",
  referralCode: "",
  vipDaysLeft: 0,

  // 管理员鉴权
  adminSecret: localStorage.getItem(CONFIG.STORAGE_KEYS.ADMIN_SECRET) || "",
  isAdminAuthenticated: false,

  // 公共配置（默认兜底，loadPublicSettings 后与后台对齐）
  publicSettings: { ...CONFIG.DEFAULT_PUBLIC_SETTINGS },
  publicSettingsLoaded: false,

  // 界面交互状态
  menuOpen: false,
  userMenuOpen: false,
  authModalVisible: false,
  authMode: "login", // 'login' | 'register'

  // 全局消息提示
  toasts: [],
});

export const store = {
  state,

  isVipActive: computed(() => state.isLoggedIn && state.vipDaysLeft > 0),

  checkLoginState() {
    try {
      const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
      if (token) {
        state.isLoggedIn = true;
        state.username = localStorage.getItem(CONFIG.STORAGE_KEYS.USERNAME) || "";
        state.referralCode = localStorage.getItem(CONFIG.STORAGE_KEYS.REF_CODE) || "";
        state.vipDaysLeft = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.VIP_DAYS), 10) || 0;
        state.isVip = state.vipDaysLeft > 0;
      } else {
        this.clearUserState();
      }
    } catch (e) {
      console.error("Check login state error:", e);
    }
  },

  setUserState({ token, username, referralCode, vipDaysLeft }) {
    if (token) localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, token);
    if (username) localStorage.setItem(CONFIG.STORAGE_KEYS.USERNAME, username);
    if (referralCode != null) localStorage.setItem(CONFIG.STORAGE_KEYS.REF_CODE, referralCode);
    if (vipDaysLeft != null) localStorage.setItem(CONFIG.STORAGE_KEYS.VIP_DAYS, String(vipDaysLeft));

    state.isLoggedIn = true;
    state.username = username || state.username;
    state.referralCode = referralCode ?? state.referralCode;
    state.vipDaysLeft = vipDaysLeft ?? state.vipDaysLeft;
    state.isVip = state.vipDaysLeft > 0;
  },

  clearUserState() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USERNAME);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.REF_CODE);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.VIP_DAYS);

    state.isLoggedIn = false;
    state.isVip = false;
    state.username = "";
    state.referralCode = "";
    state.vipDaysLeft = 0;
  },

  showToast(msg, type = "success") {
    state.toasts.push({ msg, type, id: Date.now() });
    setTimeout(() => {
      state.toasts.shift();
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

  /**
   * 从后端拉取公共配置（注册赠送、优惠码开关、支付通道、社交账号等）
   * 应在前台入口启动时调用一次
   */
  async loadPublicSettings() {
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/settings/public`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`settings ${res.status}`);
      const data = await res.json();
      const payload = data?.data || data;
      if (payload && typeof payload === "object") {
        this.setPublicSettings(payload);
      }
      return state.publicSettings;
    } catch (e) {
      console.error("loadPublicSettings error:", e);
      // 失败时保留 DEFAULT，不阻断页面
      return state.publicSettings;
    }
  },
};
