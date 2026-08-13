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
   * 计算定制组数
   * @param {number} symbolCount 标的只数
   * @param {number} perGroup 每组只数（后台 custom_max_symbols，默认 3）
   */
  calcCustomGroups(symbolCount, perGroup = 3) {
    const n = Math.max(0, Number(symbolCount) || 0);
    const g = Math.max(1, Number(perGroup) || 3);
    if (n <= 0) return 0;
    return Math.ceil(n / g);
  },

  /**
   * 提交开通/充值订单
   * - orderType: 'vip' | 'custom_watchlist'
   * - customItems: [{ etf_code, etf_name }] 定制订单必填，可超过每组只数
   * - groups: 定制组数（可选，后端也会按 custom_items 重算）
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
