/**
 * 会员赞助监控标的 API
 * 一人购买 → 全体注册会员可见；赞助者有效期内可改代码/名称
 */
import { request } from "./http.js";

export const sponsorApi = {
  /** 公开有效赞助列表（含点赞数、赞助者昵称） */
  async fetchActive() {
    return request("/api/sponsor/active");
  },

  /** 我的赞助（含过期） */
  async fetchMine() {
    return request("/api/sponsor/mine");
  },

  /** 下单：items=[{etf_code,etf_name}], days, amount, tx_id_last6, promo? */
  async submitOrder(payload) {
    return request("/api/sponsor/order", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /** 有效期内修改标的 */
  async updateSymbol(id, { etf_code, etf_name }) {
    return request("/api/sponsor/update", {
      method: "POST",
      body: JSON.stringify({
        id: Number(id),
        etf_code: String(etf_code || "").trim().toUpperCase(),
        etf_name: etf_name ? String(etf_name).trim() : undefined,
      }),
    });
  },

  /** 点赞感谢赞助者 */
  async like(sponsorId) {
    return request("/api/sponsor/like", {
      method: "POST",
      body: JSON.stringify({ sponsor_id: Number(sponsorId) }),
    });
  },

  async unlike(sponsorId) {
    return request("/api/sponsor/unlike", {
      method: "POST",
      body: JSON.stringify({ sponsor_id: Number(sponsorId) }),
    });
  },
};
