/**
 * 波幅探长 - 套餐、优惠码与订单 API
 * js/api/plan.js
 */
import { request } from "./http.js";

export const planApi = {
  /**
   * 获取已启用套餐
   * @param {string} type 可选：'shared' | 'custom' | 'both'
   */
  async fetchPlans(type = "") {
    const query = type ? `?type=${encodeURIComponent(type)}` : "";
    return request(`/api/plans${query}`);
  },

  /**
   * 校验优惠码并返回折后价
   */
  async checkPromo(planId, promoCode, quantity = 1) {
    return request("/api/promo/check", {
      method: "POST",
      body: JSON.stringify({
        plan_id: planId,
        promo_code: promoCode ? promoCode.trim().toUpperCase() : "",
        quantity,
      }),
    });
  },

  /**
   * 提交开通/充值订单
   * - orderType: 'vip' | 'custom_watchlist'
   * - customItems: [{ etf_code, etf_name }] 仅定制订单需要
   */
  async submitOrder(orderData) {
    const body = {
      plan_id: orderData.planId,
      amount: Number(orderData.amount),
      tx_id_last6: String(orderData.txId || "").trim(),
      promo_code: orderData.promoCode
        ? String(orderData.promoCode).trim().toUpperCase()
        : undefined,
      order_type: orderData.orderType || "vip",
      // 定制标的（与 Worker 字段名 custom_items 对齐）
      custom_items:
        orderData.orderType === "custom_watchlist" && Array.isArray(orderData.customItems)
          ? orderData.customItems
              .map((it) => ({
                etf_code: String(it.etf_code || it.code || "")
                  .trim()
                  .toUpperCase(),
                etf_name: String(it.etf_name || it.name || "").trim() || undefined,
              }))
              .filter((it) => /^\d{6}$/.test(it.etf_code))
          : undefined,

      // 游客支付即注册
      register_username: orderData.registerUsername
        ? String(orderData.registerUsername).trim()
        : undefined,
      register_password: orderData.registerPassword || undefined,
      ref_code: orderData.refCode
        ? String(orderData.refCode).trim().toUpperCase()
        : undefined,
    };

    return request("/api/orders", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  /** 当前用户历史订单 */
  async fetchUserOrders() {
    return request("/api/user/orders");
  },
};
