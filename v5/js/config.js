/**
 * 波幅探长 - 全局配置 (v5.1)
 * 注册即可免费查看全量看板与图表；会员赞助监控标的进入公共池（展示赞助者昵称）+ 自由打赏支持
 */
export const CONFIG = {
  API_BASE: "https://vip.hahagw.eu.org",
  MAIL_API_BASE: "https://mail.hahagw.eu.org",
  TURNSTILE_SITEKEY: "0x4AAAAAAEDLWs232Np7X0xa",
  R2_CHART_BASE: "https://pub-973330e118204686a625fe51431d4336.r2.dev/charts",

  STORAGE_KEYS: {
    TOKEN: "etf_token",
    USER_ID: "etf_user_id",
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
    free_top_n_charts: "3",
    promo_enabled: "1",
    alipay_qr_url: "",
    wechat_qr_url: "",
    default_pay_channel: "wechat",
    symbol_prices:
      '[{"days":30,"price":30,"label":"1个月"},{"days":90,"price":88,"label":"季度"},{"days":180,"price":168,"label":"半年"},{"days":365,"price":328,"label":"全年"}]',
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

/** 已知支持 T+0 回转交易的深市/沪市特殊 ETF 代码集合（黄金、跨境、债券、货币等） */
const KNOWN_T0_CODES = new Set([
  // 黄金/商品 ETF
  "518880", "518800", "518680", "518660", "518600",
  "159934", "159937", "159812", "159831", "159834", "159980", "159981", "159985",
  // 深市港股/美股/跨境 T+0 ETF
  "159920", "159954", "159963", "159866", "159892", "159792", "159740", "159742",
  "159747", "159751", "159711", "159712", "159726", "159605", "159607", "159612",
  "159615", "159628", "159632", "159636", "159655", "159659", "159660", "159688",
  "159691", "159696", "159699", "159501", "159502", "159506", "159509", "159513",
  "159518", "159529", "159536", "159545", "159557", "159567", "159570", "159577",
  // 深市债券/货币 ETF
  "159972", "159649", "159650", "159651", "159816", "159001", "159003", "159005",
  // 沪市货币/债券 ETF
  "511990", "511880", "511810", "511850", "511660", "511700", "511010", "511020",
  "511030", "511060", "511090", "511100", "511130", "511220", "511260", "511270",
  "511360", "511380", "511520",
]);

/**
 * 识别股票/ETF交易制度：返回 "t+0" 或 "t+1"
 * 支持后台手动指定 (customMode = "t+0" | "t+1")，否则按证券规则与名称智能判断
 */
export function resolveTradeRule(code, name, customMode = "") {
  const mode = String(customMode || "").trim().toLowerCase();
  if (mode === "t+0" || mode === "t0") return "t+0";
  if (mode === "t+1" || mode === "t1") return "t+1";

  const c = String(code || "").replace(/\D/g, "").slice(-6);
  const n = String(name || "").trim();

  if (KNOWN_T0_CODES.has(c)) return "t+0";
  // 沪市跨境 ETF (513xxx)、债券/货币 ETF (511xxx)、黄金 ETF (518xxx)、深市保证金货币 (1590xx)、可转债 (11xxxx/12xxxx)
  if (/^(511|513|518|1590)\d{3}$/.test(c)) return "t+0";
  if (/^(110|111|113|118|123|127|128)\d{3}$/.test(c)) return "t+0";

  // 名称语义兜底识别（跨境/港股/美股/黄金/债券/货币/转债）
  if (
    /(港股|恒生|恒指|国企ETF|H股|港股通|红利港股|中概|纳指|纳斯达克|标普|道琼斯|美股|美国|日经|日本|德国|法国|欧洲|沙特|东南亚|亚太|新兴亚洲|黄金|上海金|金ETF|国债|政金债|地方债|科创债|信用债|城投债|公司债|可转债|转债|短融|货币|添益|快线|日利|保证金|豆粕|有色ETF基金|能源化工)/i.test(
      n
    )
  ) {
    return "t+0";
  }

  return "t+1";
}
