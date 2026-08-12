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

  /** 
   * 移除一只定制标的 
   * @param {string|number} id - 标的ID
   */
  async removeCustomItem(id) {
    return request("/api/watchlist/custom", {
      method: "DELETE",
      body: JSON.stringify({ id: String(id) }),
    });
  },

  /** 
   * 可选：用户侧写入/更新（正式开通仍以订单审核为准）
   * @param {Object} item
   * @param {string|number} [item.id]
   * @param {string} item.etf_code
   * @param {string} [item.etf_name]
   */
  async saveCustomItem(item) {
    return request("/api/watchlist/custom", {
      method: "POST",
      body: JSON.stringify({
        id: item.id || undefined,
        etf_code: String(item.etf_code || "").trim().toUpperCase(),
        etf_name: item.etf_name ? String(item.etf_name).trim() : undefined,
      }),
    });
  },
};
