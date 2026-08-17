/**
 * 定制监控已下线（保留空模块避免旧 import 报错）
 * js/api/watchlist.js
 */
import { request } from "./http.js";

export const watchlistApi = {
  async fetchUserCustomWatchlist() {
    return { success: false, data: [], error: "定制监控已下线" };
  },
  async removeCustomItem() {
    throw new Error("定制监控已下线");
  },
  async saveCustomItem() {
    throw new Error("定制监控已下线");
  },
};
