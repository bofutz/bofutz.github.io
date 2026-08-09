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
    VIP_LEVEL: "etf_vip_level",
    ADMIN_SECRET: "admin_secret",
    AD_LAST_SHOWN: "etf_ad_last_shown",
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

  // 会员等级文案（按开通套餐天数映射，见后端）
  VIP_LEVEL_LABELS: {
    0: "普通用户",
    1: "月卡会员",
    2: "季卡会员",
    3: "半年会员",
    4: "年卡会员",
  },

  // 默认公共配置兜底（须与后台字段一致；接口返回后会覆盖）
  DEFAULT_PUBLIC_SETTINGS: {
    gift_register_days: "1",
    gift_inviter_days: "3",
    gift_invitee_days: "2",
    free_top_n_charts: "3",
    pay_register_enabled: "0",
    promo_enabled: "0",
    alipay_qr_url: "",
    wechat_qr_url: "",
    default_pay_channel: "wechat",

    // 定制：每组只数（一组 = 一份定制套餐价）；可添加多组
    custom_max_symbols: "3",

    // 票选
    vote_monthly_limit: "10",
    vote_min_level: "1", // 参与票选最低会员等级 1~4
    vote_etf_only: "1", // 1=仅名称含 ETF 的标的

    // 打赏
    tip_enabled: "0",
    tip_wechat_qr_url: "",
    tip_alipay_qr_url: "",
    tip_note: "觉得有用？请作者喝杯咖啡",

    // 弹窗广告
    ad_enabled: "0",
    ad_title: "",
    ad_content: "",
    ad_image_url: "",
    ad_link_url: "",
    ad_start_at: "", // 时间戳或空=不限
    ad_end_at: "",
    ad_frequency: "daily", // once | daily | always

    // 社交（兼容旧字段；Footer 优先用 social_platforms JSON）
    social_douyin: "",
    social_shipinhao: "",
    social_xiaohongshu: "",
    social_gongzhonghao: "",
    social_kuaishou: "",
    // JSON 字符串：[{ key, label, icon, handle }]，后台可增删平台
    social_platforms: "",
  },
};
