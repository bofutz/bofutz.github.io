import { request } from "./http.js";

export const chartQueryApi = {
  async fetchCreditPlans() {
    return request("/api/chart-credit/plans");
  },

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

  async delete(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    return request("/api/chart-query/delete", {
      method: "POST",
      body: JSON.stringify({ ids: list.map((x) => Number(x)) }),
    });
  },
};
