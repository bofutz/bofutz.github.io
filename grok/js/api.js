/**
 * 统一 API 封装
 */
import { API_BASE } from "./config.js";

/** 前台：带 Bearer Token */
export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem("etf_token");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  if (res.status === 401) {
    // 由调用方处理 logout，这里只抛错
    throw new Error("登录已过期，请重新登录");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || "请求失败");
  return data;
}

/** 后台：带 Admin-Secret */
export async function adminFetch(endpoint, adminSecret, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Admin-Secret": adminSecret,
      ...options.headers,
    },
  });
  if (res.status === 401) {
    throw new Error("鉴权失败");
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j.error) msg = j.error;
    } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}

// ===== 监控投票 =====
export async function fetchVoteList(limit = 200) {
  return apiFetch(`/api/vote/list?limit=${limit}`);
}

export async function fetchMyVotes() {
  return apiFetch("/api/vote/my");
}

export async function submitVote(payload) {
  return apiFetch("/api/vote", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
