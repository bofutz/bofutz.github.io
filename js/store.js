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
  vipLevel: 0, // 0=无 1=月 2=季 3=半年 4=年
  chartCredits: 0, // 自主查询剩余次数

  // 安全问题是否已设置（个人中心红条；登录后拉取）
  securitySet: true,

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
  authMode: "login", // 'login' | 'register' | 'forgot'

  // 全局消息提示
  toasts: [],
});

function parseLevel(v) {
  const n = parseInt(v, 10);
  if (isNaN(n) || n < 0) return 0;
  return Math.min(4, n);
}

export const store = {
  state,

  isVipActive: computed(() => state.isLoggedIn && state.vipDaysLeft > 0),

  /** 是否达到票选最低等级 */
  canVoteByLevel: computed(() => {
    const min = parseInt(state.publicSettings.vote_min_level || "1", 10) || 1;
    return state.isLoggedIn && state.vipLevel >= min;
  }),

  vipLevelLabel: computed(() => {
    const map = CONFIG.VIP_LEVEL_LABELS || {};
    return map[state.vipLevel] || map[0] || "普通用户";
  }),

  checkLoginState() {
    try {
      const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
      if (token) {
        state.isLoggedIn = true;
        state.username = localStorage.getItem(CONFIG.STORAGE_KEYS.USERNAME) || "";
        state.referralCode = localStorage.getItem(CONFIG.STORAGE_KEYS.REF_CODE) || "";
        state.vipDaysLeft =
          parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.VIP_DAYS), 10) || 0;
        state.vipLevel = parseLevel(
          localStorage.getItem(CONFIG.STORAGE_KEYS.VIP_LEVEL)
        );
        state.chartCredits =
          parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.CHART_CREDITS), 10) || 0;
        state.isVip = state.vipDaysLeft > 0;
      } else {
        this.clearUserState();
      }
    } catch (e) {
      console.error("Check login state error:", e);
    }
  },

  setUserState({ token, username, referralCode, vipDaysLeft, vipLevel, chartCredits }) {
    if (token) localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, token);
    if (username) localStorage.setItem(CONFIG.STORAGE_KEYS.USERNAME, username);
    if (referralCode != null)
      localStorage.setItem(CONFIG.STORAGE_KEYS.REF_CODE, referralCode);
    if (vipDaysLeft != null)
      localStorage.setItem(CONFIG.STORAGE_KEYS.VIP_DAYS, String(vipDaysLeft));
    if (vipLevel != null) {
      const lv = parseLevel(vipLevel);
      localStorage.setItem(CONFIG.STORAGE_KEYS.VIP_LEVEL, String(lv));
      state.vipLevel = lv;
    }
    if (chartCredits != null) {
      const c = Math.max(0, parseInt(chartCredits, 10) || 0);
      localStorage.setItem(CONFIG.STORAGE_KEYS.CHART_CREDITS, String(c));
      state.chartCredits = c;
    }

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
    localStorage.removeItem(CONFIG.STORAGE_KEYS.VIP_LEVEL);

    state.isLoggedIn = false;
    state.isVip = false;
    state.username = "";
    state.referralCode = "";
    state.vipDaysLeft = 0;
    state.vipLevel = 0;
    state.chartCredits = 0;
    localStorage.removeItem(CONFIG.STORAGE_KEYS.CHART_CREDITS);
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
    state.toasts.push({ msg, type, id: Date.now() + Math.random() });
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
   * 从后端拉取公共配置（注册赠送、优惠码、票选门槛、打赏、广告、社交等）
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
      return state.publicSettings;
    }
  },

  /** 解析社交平台列表：优先 social_platforms JSON，否则回退旧字段 */
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
    // 兼容旧版五个字段
    const legacy = [
      { key: "social_douyin", label: "抖音", icon: "fa-brands fa-tiktok" },
      { key: "social_shipinhao", label: "视频号", icon: "fa-brands fa-weixin" },
      {
        key: "social_xiaohongshu",
        label: "小红书",
        icon: "fa-solid fa-book",
      },
      {
        key: "social_gongzhonghao",
        label: "公众号",
        icon: "fa-solid fa-comment-dots",
      },
      { key: "social_kuaishou", label: "快手", icon: "fa-solid fa-video" },
    ];
    return legacy
      .map((p) => {
        const handle = String(s[p.key] || "").trim();
        if (!handle) return null;
        return {
          key: p.key,
          label: p.label,
          icon: p.icon,
          handle: handle.startsWith("@") ? handle : `@${handle}`,
        };
      })
      .filter(Boolean);
  },
};
