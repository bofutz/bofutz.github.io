/**
 * 自主查询（按次）API
 * js/api/chartQuery.js
 */
import { request } from "./http.js";

export const chartQueryApi = {
  /** 次数套餐列表 */
  async fetchCreditPlans() {
    return request("/api/chart-credit/plans");
  },

  /**
   * 提交查询
   * @param {{ etfCode: string, etfName?: string, interval?: string }}
   */
  async submit({ etfCode, etfName, interval = "daily" }) {
    return request("/api/chart-query/submit", {
      method: "POST",
      body: JSON.stringify({
        etf_code: String(etfCode || "").trim().toUpperCase(),
        etf_name: etfName ? String(etfName).trim() : undefined,
        interval: interval || "daily",
      }),
    });
  },

  /** 我的查询记录 */
  async fetchMyQueries() {
    return request("/api/chart-query/my");
  },

  async fetchStatus(id) {
    return request(`/api/chart-query/status?id=${encodeURIComponent(id)}`);
  },
};
