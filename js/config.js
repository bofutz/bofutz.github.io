/**
 * 波幅探长 - 全局配置
 * 监控=按时间 VIP；自主查询=按次；已删除定制监控
 */
export const CONFIG = {
  API_BASE: "https://vip.hahagw.eu.org",
  MAIL_API_BASE: "https://mail.hahagw.eu.org",
  TURNSTILE_SITEKEY: "0x4AAAAAAEDLWs232Np7X0xa",

  STORAGE_KEYS: {
    TOKEN: "etf_token",
    USERNAME: "etf_username",
    REF_CODE: "etf_ref",
    VIP_DAYS: "etf_vip_days",
    VIP_LEVEL: "etf_vip_level",
    CHART_CREDITS: "etf_chart_credits",
    ADMIN_SECRET: "admin_secret",
    AD_LAST_SHOWN: "etf_ad_last_shown",
  },

  PLAN_TYPES: {
    SHARED: "shared",
    CHART: "chart",
    BOTH: "both",
  },

  PLAN_TYPE_LABELS: {
    shared: "监控 VIP",
    chart: "图表查询次数",
    both: "监控 VIP",
  },

  VIP_LEVEL_LABELS: {
    0: "普通用户",
    1: "月卡会员",
    2: "季卡会员",
    3: "半年会员",
    4: "年卡会员",
  },

  CHART_INTERVALS: {
    half_day: "半日线",
    daily: "日线",
    weekly: "周线",
  },

  USERNAME_PATTERN: /^[A-Za-z0-9]+$/,
  USERNAME_MIN: 6,
  USERNAME_MAX: 32,

  DEFAULT_PUBLIC_SETTINGS: {
    gift_register_days: "1",
    gift_inviter_days: "0",
    gift_invitee_days: "3",
    referral_code_min_len: "8",
    referral_code_max_len: "16",
    referral_rebate_percent: "10",
    referral_rebate_min_days: "90",
    free_top_n_charts: "3",
    pay_register_enabled: "1",
    promo_enabled: "1",
    alipay_qr_url: "",
    wechat_qr_url: "",
    default_pay_channel: "wechat",

    chart_query_batch_hours: "2",
    chart_query_retain_trading_days: "2",
    chart_query_intervals: '["daily"]',
    chart_query_deduct_on: "submit",
    vip_monthly_chart_gift: "0",

    vote_monthly_limit: "10",
    vote_min_level: "1",
    vote_etf_only: "1",

    tip_enabled: "0",
    tip_wechat_qr_url: "",
    tip_alipay_qr_url: "",
    tip_note: "觉得有用？请作者喝杯咖啡",

    ad_enabled: "0",
    ad_title: "",
    ad_content: "",
    ad_image_url: "",
    ad_link_url: "",
    ad_start_at: "",
    ad_end_at: "",
    ad_frequency: "daily",

    social_douyin: "",
    social_shipinhao: "",
    social_xiaohongshu: "",
    social_gongzhonghao: "",
    social_kuaishou: "",
    social_platforms: "",
  },
};
