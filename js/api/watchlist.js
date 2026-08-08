/**
 * 波幅探长 - 用户定制监控 API 服务
 * js/api/watchlist.js
 *
 * 对齐后端：
 *   GET    /api/user/watchlist/custom   → 当前用户的定制列表
 *   DELETE /api/user/watchlist/custom   → 移除一只（body: { id }）
 *   POST   /api/user/watchlist/custom   → 用户侧补充/更新（可选，后台审核通过后也会写入）
 */
import { request } from "./http.js";

export const watchlistApi = {
  /**
   * 获取当前登录用户的定制监控列表
   * 期望返回：{ success: true, data: [ { id, etf_code, etf_name, status, expire_at, ... } ] }
   */
  async fetchUserCustomWatchlist() {
    return request("/api/user/watchlist/custom");
  },

  /**
   * 移除个人的某只定制监控标的
   * @param {number|string} id  watchlist_custom.id
   */
  async removeCustomItem(id) {
    return request("/api/user/watchlist/custom", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
  },

  /**
   * （可选）用户侧主动添加/更新定制标的草稿
   * 正式开通仍以订单审核通过后 Worker 写入为准
   */
  async saveCustomItem(item) {
    return request("/api/user/watchlist/custom", {
      method: "POST",
      body: JSON.stringify({
        id: item.id || undefined,
        etf_code: String(item.etf_code || "").trim().toUpperCase(),
        etf_name: (item.etf_name || "").trim() || undefined,
      }),
    });
  },
};
