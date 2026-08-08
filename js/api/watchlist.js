/**
 * 波幅探长 - 用户定制监控 API
 * 对齐 Worker：/api/watchlist/custom（注意：不是 /api/user/...）
 */
import { request } from "./http.js";

export const watchlistApi = {
  /** 当前登录用户的定制监控列表 */
  async fetchUserCustomWatchlist() {
    return request("/api/watchlist/custom");
  },

  /** 移除一只定制标的 body: { id } */
  async removeCustomItem(id) {
    return request("/api/watchlist/custom", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
  },

  /** 可选：用户侧写入/更新（正式开通仍以订单审核为准） */
  async saveCustomItem(item) {
    return request("/api/watchlist/custom", {
      method: "POST",
      body: JSON.stringify({
        id: item.id || undefined,
        etf_code: String(item.etf_code || "").trim().toUpperCase(),
        etf_name: (item.etf_name || "").trim() || undefined,
      }),
    });
  },
};
