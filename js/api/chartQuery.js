/**
 * 自主查询（按次）API
 * js/api/chartQuery.js
 *
 * interval 可选（可多选）：
 *   half_day_closed | half_day_next
 *   daily_closed    | daily_next
 *   weekly_closed   | weekly_next
 */
import { request } from "./http.js";

export const chartQueryApi = {
  async fetchCreditPlans() {
    return request("/api/chart-credit/plans");
  },

  /**
   * 提交查询（支持多周期）
   * @param {{ etfCode: string, etfName?: string, interval?: string, intervals?: string[] }}
   */
  async submit({ etfCode, etfName, interval, intervals }) {
    const list =
      Array.isArray(intervals) && intervals.length
        ? intervals
        : interval
        ? [interval]
        : ["daily_closed"];
    return request("/api/chart-query/submit", {
      method: "POST",
      body: JSON.stringify({
        etf_code: String(etfCode || "").trim().toUpperCase(),
        etf_name: etfName ? String(etfName).trim() : undefined,
        intervals: list,
        interval: list[0],
      }),
    });
  },

  async fetchMyQueries() {
    return request("/api/chart-query/my");
  },

  async fetchStatus(id) {
    return request(`/api/chart-query/status?id=${encodeURIComponent(id)}`);
  },

  async cancel(id) {
    return request("/api/chart-query/cancel", {
      method: "POST",
      body: JSON.stringify({ id: Number(id) }),
    });
  },
};
