/**
 * 波幅探长 - 全局配置
 * 注册即可看全量看板/图表；盈利点：会员赞助监控标的
 * 已移除：自主查询、次数套餐
 */
export const CONFIG = {
  API_BASE: "https://vip.hahagw.eu.org",
  MAIL_API_BASE: "https://mail.hahagw.eu.org",
  TURNSTILE_SITEKEY: "0x4AAAAAAEDLWs232Np7X0xa",
  R2_CHART_BASE: "https://pub-973330e118204686a625fe51431d4336.r2.dev/charts",

  STORAGE_KEYS: {
    TOKEN: "etf_token",
    USERNAME: "etf_username",
    REF_CODE: "etf_ref",
    ADMIN_SECRET: "admin_secret",
    AD_LAST_SHOWN: "etf_ad_last_shown",
  },

  /** 默认赞助周期价（后台可覆盖） */
  DEFAULT_SYMBOL_PRICES: [
    { days: 30, price: 30, label: "1个月" },
    { days: 90, price: 88, label: "季度" },
    { days: 180, price: 168, label: "半年" },
    { days: 365, price: 328, label: "全年" },
  ],

  USERNAME_PATTERN: /^[A-Za-z0-9]+$/,
  USERNAME_MIN: 6,
  USERNAME_MAX: 32,

  VIP_LEVEL_LABELS: {
    0: "普通用户",
    1: "月卡会员",
    2: "季卡会员",
    3: "半年会员",
    4: "年卡会员",
  },

  DEFAULT_PUBLIC_SETTINGS: {
    gift_register_days: "0",
    gift_invitee_days: "0",
    referral_code_min_len: "6",
    referral_code_max_len: "12",
    referral_rebate_percent: "0",
    referral_rebate_min_days: "90",
    /** 未登录可免费看图的 TOP N；登录后全量 */
    free_top_n_charts: "3",
    pay_register_enabled: "1",
    promo_enabled: "1",
    alipay_qr_url: "",
    wechat_qr_url: "",
    default_pay_channel: "wechat",

    /** 赞助标的周期价 JSON */
    symbol_prices:
      '[{"days":30,"price":30,"label":"1个月"},{"days":90,"price":88,"label":"季度"},{"days":180,"price":168,"label":"半年"},{"days":365,"price":328,"label":"全年"}]',

    tip_enabled: "0",
    tip_note: "觉得有用？请作者喝杯咖啡",

    ad_enabled: "0",
    ad_title: "",
    ad_content: "",
    ad_image_url: "",
    ad_link_url: "",
    ad_start_at: "",
    ad_end_at: "",
    ad_frequency: "daily",

    social_platforms: "",
  },
};
