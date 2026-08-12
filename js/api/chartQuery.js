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
   * @param {Object} params
   * @param {string} params.etfCode
   * @param {string} [params.etfName]
   * @param {string} [params.interval]
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
    // 补充 String 显式转换，防止传入 Number 等非字符串类型导致 Linter/TS 告警
    return request(`/api/chart-query/status?id=${encodeURIComponent(String(id))}`);
  },
};
