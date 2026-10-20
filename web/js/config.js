/**
 * 波幅探长 - 全局配置
 * 注册即可看全量看板/图表；盈利点：会员赞助监控标的 + 自主查询次数
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
    CHART_CREDITS: "etf_chart_credits",
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

  CHART_INTERVALS: {
    half_day_closed: "最新收盘·半日线",
    half_day_next: "下一收盘·半日线",
    daily_closed: "最新收盘·日线",
    daily_next: "下一收盘·日线",
    weekly_closed: "最新收盘·周线",
    weekly_next: "下一收盘·周线",
    half_day: "最新收盘·半日线",
    daily: "最新收盘·日线",
    weekly: "最新收盘·周线",
  },

  USERNAME_PATTERN: /^[A-Za-z0-9]+$/,
  USERNAME_MIN: 6,
  USERNAME_MAX: 32,

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

    chart_query_batch_hours: "2",
    chart_query_retain_trading_days: "2",
    chart_query_intervals:
      '["half_day_closed","half_day_next","daily_closed","daily_next","weekly_closed","weekly_next"]',
    chart_query_deduct_on: "submit",
    chart_run_slots:
      '[{"time":"07:00","mode":"query","kinds":["half_day","daily"],"enabled":true},{"time":"15:35","mode":"all","kinds":["half_day","daily"],"enabled":true},{"time":"19:00","mode":"query","kinds":["half_day","daily"],"enabled":true},{"time":"22:00","mode":"query","kinds":["half_day","daily"],"enabled":true},{"time":"09:00","mode":"query","kinds":["weekly"],"weekday":6,"enabled":true}]',

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
