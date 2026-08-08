/**
 * 波幅探长 - 全局配置文件
 * js/config.js
 */
export const CONFIG = {
  // API 基础路径配置
  API_BASE: "https://vip.hahagw.eu.org",
  MAIL_API_BASE: "https://mail.hahagw.eu.org",

  // Cloudflare Turnstile 人机验证 SiteKey
  TURNSTILE_SITEKEY: "0x4AAAAAAEDLWs232Np7X0xa",

  // 本地存储 Key 映射
  STORAGE_KEYS: {
    TOKEN: "etf_token",
    USERNAME: "etf_username",
    REF_CODE: "etf_ref",
    VIP_DAYS: "etf_vip_days",
    ADMIN_SECRET: "admin_secret",
  },

  // 套餐类型定义
  PLAN_TYPES: {
    SHARED: "shared",
    CUSTOM: "custom",
    BOTH: "both",
  },

  // 套餐类型文本映射
  PLAN_TYPE_LABELS: {
    shared: "通用监控",
    custom: "定制监控",
    both: "通用+定制",
  },

  // 默认公共配置兜底（须与后台字段一致；接口返回后会覆盖）
  DEFAULT_PUBLIC_SETTINGS: {
    gift_register_days: "1",
    gift_inviter_days: "3",
    gift_invitee_days: "2",
    free_top_n_charts: "3",
    pay_register_enabled: "0", // 与后台「关闭游客支付即注册」对齐的安全默认
    promo_enabled: "0", // 与后台「关闭优惠码」对齐的安全默认
    alipay_qr_url: "",
    wechat_qr_url: "",
    default_pay_channel: "wechat", // 微信优先
    custom_max_symbols: "3",
    vote_monthly_limit: "10",
    social_douyin: "",
    social_shipinhao: "",
    social_xiaohongshu: "",
    social_gongzhonghao: "",
    social_kuaishou: "",
  },
};
