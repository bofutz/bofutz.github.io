/**
 * 波幅探长 - 全局配置 (v5.0)
 * 注册即可免费查看全量看板与图表；无邀请码/VIP等级/赠送天数
 * 核心模式：会员赞助监控标的进入公共池（展示赞助者昵称） + 自由打赏支持
 */
export const CONFIG = {
  API_BASE: "https://vip.hahagw.eu.org",
  MAIL_API_BASE: "https://mail.hahagw.eu.org",
  TURNSTILE_SITEKEY: "0x4AAAAAAEDLWs232Np7X0xa",
  R2_CHART_BASE: "https://pub-973330e118204686a625fe51431d4336.r2.dev/charts",

  STORAGE_KEYS: {
    TOKEN: "etf_token",
    USERNAME: "etf_username",
    NICKNAME: "etf_nickname",
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

  DEFAULT_PUBLIC_SETTINGS: {
    /** 未登录可免费看图的 TOP N；注册登录后全量免费 */
    free_top_n_charts: "3",
    promo_enabled: "1",
    alipay_qr_url: "",
    wechat_qr_url: "",
    default_pay_channel: "wechat",

    /** 赞助标的周期价 JSON */
    symbol_prices:
      '[{"days":30,"price":30,"label":"1个月"},{"days":90,"price":88,"label":"季度"},{"days":180,"price":168,"label":"半年"},{"days":365,"price":328,"label":"全年"}]',

    /** 看板底部打赏默认开启 */
    tip_enabled: "1",
    tip_note: "本站注册即免费开放全量数据与图表 · 您的打赏支持将直接用于服务器与算力维护",

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
