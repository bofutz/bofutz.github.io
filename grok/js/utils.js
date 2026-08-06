/**
 * 纯工具函数 - 无副作用
 */

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

export const isImageUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  const u = url.trim().toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(u)) return true;
  if (u.includes("qr") && (u.includes("image") || u.includes("img") || u.includes("pic"))) return true;
  return false;
};

export const linkToQrSrc = (url) => {
  if (!url) return "";
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(url.trim())}`;
};

export const pureCode = (code) => {
  const m = String(code || "").match(/\d{6}/);
  return m ? m[0] : String(code || "").trim();
};

export const formatDateExact = (ts) => {
  if (!ts) return "-";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "-";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const formatDateShort = (ts) => {
  if (!ts) return "-";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "-";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** 后台用：YYYY/MM/DD HH:mm */
export const formatDate = (ts) => {
  if (!ts) return "-";
  const d = new Date(typeof ts === "number" ? ts : ts);
  if (isNaN(d.getTime())) return "-";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const toLocalInput = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const getWeekDays = (dateStr) => {
  const y = parseYear(dateStr), m = parseMonth(dateStr), d = parseDay(dateStr);
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

export const getWeekNumberInMonth = (dateStr) => {
  const y = parseYear(dateStr), m = parseMonth(dateStr), d = parseDay(dateStr);
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

export const getStatusVal = (str) => {
  if (!str || typeof str !== "string" || str === "-" || str === "--") return -9999;
  const match = str.match(/[-+]?[0-9]*\.?[0-9]+/);
  return match ? parseFloat(match[0]) : -9999;
};

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

/** 当前自然月 key：YYYY-MM */
export function currentMonthKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** 通过新浪/腾讯接口查询标的名称 */
export async function lookupEtfName(code) {
  const c = pureCode(code);
  if (!/^\d{6}$/.test(c)) return "";

  // 优先腾讯
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`https://qt.gtimg.cn/q=s_${c}`, {
      signal: ctrl.signal,
      mode: "cors",
    });
    clearTimeout(t);
    const text = await res.text();
    const m = text.match(/="[^~]*~([^~]+)~/);
    if (m && m[1] && m[1] !== "未知") return m[1].trim();
  } catch (_) {}

  // 回退新浪
  try {
    const prefix = c.startsWith("5") || c.startsWith("1") ? "sh" : "sz";
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`https://hq.sinajs.cn/list=${prefix}${c}`, {
      signal: ctrl.signal,
      mode: "cors",
      headers: { Referer: "https://finance.sina.com.cn" },
    });
    clearTimeout(t);
    const text = await res.text();
    const m = text.match(/="([^,]+),/);
    if (m && m[1]) return m[1].trim();
  } catch (_) {}

  return "";
}
