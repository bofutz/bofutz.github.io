/**
 * js/config.js
 * 波幅探长 · 公共配置与工具
 * 前台 / 后台共用
 */

export const API_BASE = "https://vip.hahagw.eu.org";
export const MAIL_API_BASE = "https://mail.hahagw.eu.org";
export const TURNSTILE_SITEKEY = "0x4AAAAAAEDLWs232Np7X0xa";
export const DATA_JSON_URL = atob("aHR0cHM6Ly9ldGYuaGFoYWd3LmV1Lm9yZy8="); // etf.hahagw.eu.org/
export const CHART_CDN = "https://pub-973330e118204686a625fe51431d4336.r2.dev/charts/";

/** 日期是否合法 YYYY-MM-DD 或 YYYY/MM/DD */
export const isValidDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return false;
  const match = dateStr.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!match) return false;
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);
  return y >= 2020 && y <= 2030 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
};

export const parseYear = (s) => (isValidDate(s) ? parseInt(s.trim().split(/[-/]/)[0], 10) : 0);
export const parseMonth = (s) => (isValidDate(s) ? parseInt(s.trim().split(/[-/]/)[1], 10) : 0);
export const parseDay = (s) => (isValidDate(s) ? parseInt(s.trim().split(/[-/]/)[2], 10) : 0);

export const isEmail = (s) =>
  typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/** 判断是否为图片直链 */
export const isImageUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  const u = url.trim().toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(u)) return true;
  if (u.includes("qr") && (u.includes("image") || u.includes("img") || u.includes("pic"))) return true;
  return false;
};

/** 支付链接 → 二维码图片地址 */
export const linkToQrSrc = (url) => {
  if (!url) return "";
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(url.trim())}`;
};

/** 提取 6 位数字代码 */
export const pureCode = (code) => {
  const m = String(code || "").match(/\d{6}/);
  return m ? m[0] : String(code || "").trim();
};

/** 时间戳 → 精确到分钟 */
export const formatDateExact = (ts) => {
  if (!ts) return "-";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "-";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** 时间戳 → MM-DD */
export const formatDateShort = (ts) => {
  if (!ts) return "-";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "-";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** datetime-local 输入值 */
export const toLocalInput = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** 计算某日所在周的周一～周五日期数组 */
export const getWeekDays = (dateStr) => {
  const y = parseYear(dateStr);
  const m = parseMonth(dateStr);
  const d = parseDay(dateStr);
  if (!y || !m || !d) return [];
  const dateObj = new Date(y, m - 1, d);
  let dayOfWeek = dateObj.getDay();
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(y, m - 1, d + offset);
  const days = [];
  for (let i = 0; i < 5; i++) {
    const temp = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    days.push(
      `${temp.getFullYear()}-${String(temp.getMonth() + 1).padStart(2, "0")}-${String(temp.getDate()).padStart(2, "0")}`
    );
  }
  return days;
};

/** 第几周中文 */
export const getWeekNumberInMonth = (dateStr) => {
  const y = parseYear(dateStr);
  const m = parseMonth(dateStr);
  const d = parseDay(dateStr);
  if (!d) return "";
  const firstDay = new Date(y, m - 1, 1);
  let firstDayOfWeek = firstDay.getDay();
  if (firstDayOfWeek === 0) firstDayOfWeek = 7;
  const weekNum = Math.ceil((d + (firstDayOfWeek - 1)) / 7);
  return `第${["一", "二", "三", "四", "五", "六"][weekNum - 1] || weekNum}周`;
};

export const getDayTooltip = (dateStr) => {
  if (!dateStr || !isValidDate(dateStr)) return "";
  return `${String(parseMonth(dateStr)).padStart(2, "0")}-${String(parseDay(dateStr)).padStart(2, "0")}`;
};

export const getWeekTooltip = (mondayStr) => {
  if (!mondayStr || !isValidDate(mondayStr)) return "";
  const m = String(parseMonth(mondayStr)).padStart(2, "0");
  const weekNumStr = getWeekNumberInMonth(mondayStr);
  const numMatch = weekNumStr.match(/[一二三四五六]/);
  const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
  const n = numMatch ? map[numMatch[0]] || 1 : 1;
  return `${m}-${n}w`;
};

/** 从状态字符串提取数值用于排序 */
export const getStatusVal = (str) => {
  if (!str || typeof str !== "string" || str === "-" || str === "--") return -9999;
  const match = str.match(/[-+]?[0-9]*\.?[0-9]+/);
  return match ? parseFloat(match[0]) : -9999;
};

/** 颜色类 */
export const getColorClass = (status) => {
  if (!status || status === "-" || status === "--") return "text-slate-300";
  return status.includes("+") ? "text-red-500" : "text-emerald-500";
};

export const formatMobileStatus = (status) => {
  if (!status || status === "-" || status === "--") return "-";
  const match = String(status).match(/([-+]?[0-9]*\.?[0-9]+)/);
  return match ? match[1] : "-";
};

export const getMobileStatusClass = (status) => {
  if (!status || status === "-" || status === "--") return "mobile-status-neutral";
  return String(status).includes("+") ? "mobile-status-up" : "mobile-status-down";
};

/** 生成浮动金额（防撞单） */
export const generateFloatingAmount = (basePrice) => {
  const randCents = (Math.floor(Math.random() * 5) + 1) / 100;
  return (Number(basePrice) + randCents).toFixed(2);
};
