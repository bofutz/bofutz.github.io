/**
 * 会员定制监控标的 & 优惠码 & 自由打赏 API
 * 支持定制标的默认仅本人可见，购买会员可自主选择是否公开分享（is_shared）
 * 已删除点赞相关接口
 */
import { request } from "./http.js";

export const sponsorApi = {
  /** 公开分享的定制标的列表（仅返回会员主动选择分享的有效定制标的） */
  async fetchActive() {
    return request("/api/sponsor/active");
  },

  /** 我的定制标的（含私密与已分享、剩余天数、交易制度） */
  async fetchMine() {
    return request("/api/sponsor/mine");
  },

  /** 校验优惠码并计算定制折扣 */
  async checkPromo({ base_amount, promo_code }) {
    return request("/api/promo/check", {
      method: "POST",
      body: JSON.stringify({
        base_amount: Number(base_amount),
        promo_code: String(promo_code || "").trim().toUpperCase(),
      }),
    });
  },

  /** 提交定制标的订单 */
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

  /** 有效期内修改标的代码、名称、交易规则或是否公开分享 */
  async updateSymbol(id, { etf_code, etf_name, trade_mode, is_shared }) {
    const body = { id: Number(id) };
    if (etf_code !== undefined) body.etf_code = String(etf_code || "").trim().toUpperCase();
    if (etf_name !== undefined) body.etf_name = String(etf_name || "").trim();
    if (trade_mode !== undefined) body.trade_mode = trade_mode;
    if (is_shared !== undefined) body.is_shared = is_shared ? 1 : 0;
    return request("/api/sponsor/update", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
