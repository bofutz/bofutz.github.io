/**
 * 会员赞助监控标的 & 优惠码 & 自由打赏 API (v5.1)
 * 一人赞助 → 全体注册会员可见；看板展示赞助者昵称且对赞助者本人默认置顶；支持交易条件识别与修改
 */
import { request } from "./http.js";

export const sponsorApi = {
  /** 公开有效赞助列表（含点赞数、赞助者昵称、交易制度） */
  async fetchActive() {
    return request("/api/sponsor/active");
  },

  /** 我的赞助（含过期、剩余天数、交易制度） */
  async fetchMine() {
    return request("/api/sponsor/mine");
  },

  /** 校验优惠码并计算赞助折扣 */
  async checkPromo({ base_amount, promo_code }) {
    return request("/api/promo/check", {
      method: "POST",
      body: JSON.stringify({
        base_amount: Number(base_amount),
        promo_code: String(promo_code || "").trim().toUpperCase(),
      }),
    });
  },

  /**
   * 提交赞助订单：items=[{etf_code,etf_name,trade_mode}], days, amount, original_amount, promo_code?, tx_id_last6
   */
  async submitOrder(payload) {
    return request("/api/sponsor/order", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /** 提交自由打赏登记 */
  async submitTip({ amount, tx_id_last6, tip_note }) {
    return request("/api/tip/order", {
      method: "POST",
      body: JSON.stringify({
        amount: Number(amount),
        tx_id_last6: tx_id_last6 ? String(tx_id_last6).trim() : "",
        tip_note: tip_note ? String(tip_note).trim() : "",
      }),
    });
  },

  /** 有效期内修改标的或交易规则 */
  async updateSymbol(id, { etf_code, etf_name, trade_mode }) {
    return request("/api/sponsor/update", {
      method: "POST",
      body: JSON.stringify({
        id: Number(id),
        etf_code: String(etf_code || "").trim().toUpperCase(),
        etf_name: etf_name ? String(etf_name).trim() : undefined,
        trade_mode: trade_mode || undefined,
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
