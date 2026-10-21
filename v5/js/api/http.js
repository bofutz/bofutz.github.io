/**
 * Fetch 封装
 */
import { CONFIG } from "../config.js";
import { store } from "../store.js";

export async function request(endpoint, options = {}) {
  const url = endpoint.startsWith("http") ? endpoint : `${CONFIG.API_BASE}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const adminSecret = (localStorage.getItem(CONFIG.STORAGE_KEYS.ADMIN_SECRET) || "").trim();
  if (adminSecret && !headers["Admin-Secret"]) {
    headers["Admin-Secret"] = adminSecret;
  }

  try {
    const response = await fetch(url, { ...options, headers });

    if (response.status === 401 && !endpoint.includes("/api/login")) {
      if (endpoint.startsWith("/api/admin/")) {
        store.state.isAdminAuthenticated = false;
        localStorage.removeItem(CONFIG.STORAGE_KEYS.ADMIN_SECRET);
        throw new Error("管理员鉴权失败，请重新输入 Admin-Secret");
      }
      store.clearUserState();
      throw new Error("登录状态已过期，请重新登录");
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) {
      throw new Error(data.error || `请求失败 (${response.status})`);
    }
    return data;
  } catch (err) {
    console.error(`API [${endpoint}]:`, err.message);
    throw err;
  }
}
