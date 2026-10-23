import { request } from "./http.js";

export const etfApi = {
  async fetchEtfRawData() {
    const rawUrl = atob("aHR0cHM6Ly9ldGYuaGFoYWd3LmV1Lm9yZy8=");
    const res = await fetch(rawUrl).catch(() => null);
    if (!res || !res.ok) throw new Error("获取远程行情数据失败");
    return res.json();
  },

  /** 合并后的监控列表：默认 + 当前会员定制标的 + 其他会员分享的定制标的 */
  async fetchWatchlist() {
    return request("/api/watchlist");
  },

  async fetchChartsMap() {
    return request("/api/etfs");
  },

  async fetchPublicSettings() {
    return request("/api/settings/public");
  },
};
