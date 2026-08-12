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
   * @param {string} [type=""] 可选：'shared' | 'custom' | 'both'
   */
  async fetchPlans(type = "") {
    const query = type ? `?type=${encodeURIComponent(String(type))}` : "";
    return request(`/api/plans${query}`);
  },

  /**
   * 校验优惠码并返回折后价
   * @param {string|number} planId 套餐ID
   * @param {string} promoCode 优惠码
   * @param {number} [quantity=1] 定制时传「组数」，通用传 1
   */
  async checkPromo(planId, promoCode, quantity = 1) {
    return request("/api/promo/check", {
      method: "POST",
      body: JSON.stringify({
        plan_id: planId,
        promo_code: promoCode ? String(promoCode).trim().toUpperCase() : "",
        quantity: Math.max(1, Number(quantity) || 1),
      }),
    });
  },

  /**
   * 计算定制组数
   * @param {number} symbolCount 标的只数
   * @param {number} [perGroup=3] 每组只数（后台 custom_max_symbols，默认 3）
   * @returns {number} 组数
   */
  calcCustomGroups(symbolCount, perGroup = 3) {
    const n = Math.max(0, Number(symbolCount) || 0);
    const g = Math.max(1, Number(perGroup) || 3);
    if (n <= 0) return 0;
    return Math.ceil(n / g);
  },

  /**
   * 提交开通/充值订单
   * @param {Object} orderData 订单数据
   * @param {string|number} orderData.planId
   * @param {number} orderData.amount
   * @param {string} [orderData.txId]
   * @param {string} [orderData.promoCode]
   * @param {string} [orderData.orderType] 'vip' | 'custom_watchlist' 等
   * @param {string} [orderData.registerUsername]
   * @param {string} [orderData.registerPassword]
   * @param {string} [orderData.refCode]
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
