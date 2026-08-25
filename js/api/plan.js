/**
 * 波幅探长 - 套餐、优惠码与订单 API
 * js/api/plan.js
 *
 * 支持 orderType: vip | chart_credits
 * 后端按 symbol_count / 组数计费与开通
 */
import { request } from "./http.js";

export const planApi = {
  /**
   * 获取已启用套餐
   * @param {string} type 可选：'shared' | 'custom' | 'both'
   */
  /**
   * 已登录时后端应附带：
   *   max_buy_times   每用户限购次数，0=不限
   *   user_bought_count 当前用户已成功购买该套餐次数
   * 达到上限的套餐可由后端直接过滤，或由前端按上述字段隐藏。
   */
  async fetchPlans(type = "") {
    const query = type ? `?type=${encodeURIComponent(type)}` : "";
    return request(`/api/plans${query}`);
  },

  /**
   * 校验优惠码并返回折后价
   * @param {number} quantity 定制时传「组数」，通用传 1
   */
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

  /**
   * 提交开通/充值订单
   * orderType: 'vip' | 'chart_credits'
   */
  async submitOrder(orderData) {
    const body = {
      plan_id: orderData.planId,
      amount: Number(orderData.amount),
      tx_id_last6: String(orderData.txId || "").trim(),
      promo_code: orderData.promoCode
        ? String(orderData.promoCode).trim().toUpperCase()
        : undefined,
      // vip = 监控天数；chart_credits = 图表次数包
      order_type: orderData.orderType || "vip",

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
