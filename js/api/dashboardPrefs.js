/**
 * 会员看板：收藏 + 自定义排序
 */
import { request } from "./http.js";

export const dashboardPrefsApi = {
  async fetch() {
    return request("/api/user/dashboard-prefs");
  },
  async toggleFavorite(etfCode) {
    return request("/api/user/dashboard-prefs", {
      method: "POST",
      body: JSON.stringify({ action: "toggle_favorite", etf_code: etfCode }),
    });
  },
  async saveOrder(order, favorites) {
    const body = { order };
    if (favorites) body.favorites = favorites;
    return request("/api/user/dashboard-prefs", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
