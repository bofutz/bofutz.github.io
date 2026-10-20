/**
 * 次数套餐与订单（监控 VIP 已下线；保留次数包）
 */
import { request } from "./http.js";

export const planApi = {
  async fetchCreditPlans() {
    return request("/api/chart-credit/plans");
  },

  async checkPromo(planId, promoCode, quantity = 1) {
    return request("/api/promo/check", {
      method: "POST",
      body: JSON.stringify({
        plan_id: planId,
        promo_code: promoCode ? promoCode.trim().toUpperCase() : "",
        quantity: Math.max(1, Number(quantity) || 1),
      }),
    });
  },

  async submitOrder(orderData) {
    const body = {
      plan_id: orderData.planId,
      amount: Number(orderData.amount),
      tx_id_last6: String(orderData.txId || "").trim(),
      promo_code: orderData.promoCode
        ? String(orderData.promoCode).trim().toUpperCase()
        : undefined,
      order_type: orderData.orderType || "chart_credits",
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

  async fetchUserOrders() {
    return request("/api/user/orders");
  },
};
