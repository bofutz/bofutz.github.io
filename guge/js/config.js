/**
 * 波幅探长 全局配置文件与工具函数库
 * js/config.js
 */

// 1. 全局 Backend & API 基础地址配置
const API_BASE = "https://vip.hahagw.eu.org";
const MAIL_API_BASE = "https://mail.hahagw.eu.org";
const TURNSTILE_SITEKEY = "0x4AAAAAAEDLWs232Np7X0xa";

// 2. 日期校验与解析工具函数（已修复 match 索引）
const isValidDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return false;
  const match = dateStr.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!match) return false;
  const y = parseInt(match, 10), m = parseInt(match, 10), d = parseInt(match, 10);
  return y >= 2020 && y <= 2030 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
};

const parseYear = (s) => (isValidDate(s) ? parseInt(s.trim().split(/[-/]/)[0], 10) : 0);
const parseMonth = (s) => (isValidDate(s) ? parseInt(s.trim().split(/[-/]/), 10) : 0);
const parseDay = (s) => (isValidDate(s) ? parseInt(s.trim().split(/[-/]/), 10) : 0);
const isEmail = (s) => typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

// 3. 链接与二维码转化工具
const isImageUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  const u = url.trim().toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(u)) return true;
  if (u.includes("qr") && (u.includes("image") || u.includes("img") || u.includes("pic"))) return true;
  return false;
};

const linkToQrSrc = (url) => {
  if (!url) return "";
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(url.trim())}`;
};

// 4. 提取纯 6 位数字代码
const pureCode = (code) => {
  const m = String(code || "").match(/\d{6}/);
  return m ? m[0] : String(code || "").trim();
};

// 5. 日期格式化方法
const formatDateExact = (ts) => {
  if (!ts) return "-";
  const d = new Date(typeof ts === 'number' ? ts : ts);
  if (isNaN(d.getTime())) return "-";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const formatDateShort = (ts) => {
  if (!ts) return "-";
  const d = new Date(typeof ts === 'number' ? ts : ts);
  if (isNaN(d.getTime())) return "-";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// 6. 周期与周数计算
const getWeekDays = (dateStr) => {
  const y = parseYear(dateStr), m = parseMonth(dateStr), d = parseDay(dateStr);
  if (!y || !m || !d) return [];
  const dateObj = new Date(y, m - 1, d);
  let dayOfWeek = dateObj.getDay();
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(y, m - 1, d + offset);
  const days = [];
  for (let i = 0; i < 5; i++) {
    const temp = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    days.push(`${temp.getFullYear()}-${String(temp.getMonth() + 1).padStart(2, "0")}-${String(temp.getDate()).padStart(2, "0")}`);
  }
  return days;
};

const getWeekNumberInMonth = (dateStr) => {
  const y = parseYear(dateStr), m = parseMonth(dateStr), d = parseDay(dateStr);
  if (!d) return "";
  const firstDay = new Date(y, m - 1, 1);
  let firstDayOfWeek = firstDay.getDay();
  if (firstDayOfWeek === 0) firstDayOfWeek = 7;
  const weekNum = Math.ceil((d + (firstDayOfWeek - 1)) / 7);
  return `第${["一", "二", "三", "四", "五", "六"][weekNum - 1] || weekNum}周`;
};
