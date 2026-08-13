/**
 * 波幅探长 - Fetch HTTP 请求基础封装
 * js/api/http.js
 */
import { CONFIG } from "../config.js";
import { store } from "../store.js";

/**
 * 通用 Fetch 请求
 * @param {string} endpoint - API 路径
 * @param {object} options - Fetch 配置项
 * @returns {Promise<any>}
 */
export async function request(endpoint, options = {}) {
  const url = endpoint.startsWith("http") ? endpoint : `${CONFIG.API_BASE}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // 注入用户 Token
  const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // 注入管理员密钥
  const adminSecret = localStorage.getItem(CONFIG.STORAGE_KEYS.ADMIN_SECRET);
  if (adminSecret && !headers["Admin-Secret"]) {
    headers["Admin-Secret"] = adminSecret;
  }

  try {
    const response = await fetch(url, { ...options, headers });

    // 401 Token 过期处理
    if (response.status === 401 && !endpoint.includes("/api/login")) {
      if (endpoint.startsWith("/api/admin/")) {
        store.state.isAdminAuthenticated = false;
        localStorage.removeItem(CONFIG.STORAGE_KEYS.ADMIN_SECRET);
        throw new Error("管理员鉴权失败或已过期");
      } else {
        store.clearUserState();
        throw new Error("登录状态已过期，请重新登录");
      }
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.error) {
      throw new Error(data.error || `请求处理失败 (${response.status})`);
    }

    return data;
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err.message);
    throw err;
  }
}
