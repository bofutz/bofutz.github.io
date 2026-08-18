/**
 * 自主查询（按次）API
 * js/api/chartQuery.js
 *
 * interval 可选：
 *   half_day_closed | half_day_next
 *   daily_closed    | daily_next
 *   weekly_closed   | weekly_next
 * 旧值 half_day / daily / weekly 由后端映射为 *_closed
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
  async submit({ etfCode, etfName, interval = "daily_closed" }) {
    return request("/api/chart-query/submit", {
      method: "POST",
      body: JSON.stringify({
        etf_code: String(etfCode || "").trim().toUpperCase(),
        etf_name: etfName ? String(etfName).trim() : undefined,
        interval: interval || "daily_closed",
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
