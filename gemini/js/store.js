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

  // 公共配置
  publicSettings: { ...CONFIG.DEFAULT_PUBLIC_SETTINGS },

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

  // 计算属性
  isVipActive: computed(() => state.isLoggedIn && state.vipDaysLeft > 0),
  
  // 初始化登录状态
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

  // 更新用户登录态
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

  // 退出登录
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

  // 消息提示 (Toast)
  showToast(msg, type = "success") {
    state.toasts.push({ msg, type, id: Date.now() });
    setTimeout(() => {
      state.toasts.shift();
    }, 2800);
  },

  // 更新系统设置
  setPublicSettings(settings) {
    if (settings && typeof settings === "object") {
      state.publicSettings = { ...state.publicSettings, ...settings };
    }
  },
};
