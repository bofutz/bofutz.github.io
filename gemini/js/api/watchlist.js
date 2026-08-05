/**
 * 波幅探长 - 用户定制监控 API 服务
 * js/api/watchlist.js
 */
import { request } from "./http.js";

export const watchlistApi = {
  // 获取当前用户的定制监控列表
  async fetchUserCustomWatchlist() {
    return request("/api/user/watchlist/custom");
  },

  // 移除个人的某只定制监控标的
  async removeCustomItem(id) {
    return request("/api/watchlist/custom", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
  },
};
