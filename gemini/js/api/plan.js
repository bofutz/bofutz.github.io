/**
 * 波幅探长 - 套餐、优惠码与订单 API 服务
 * js/api/plan.js
 */
import { request } from "./http.js";

export const planApi = {
  // 获取已启用的套餐列表 (支持类型过滤: 'shared' | 'custom' | 'both')
  async fetchPlans(type = "") {
    const query = type ? `?type=${encodeURIComponent(type)}` : "";
    return request(`/api/plans${query}`);
  },

  // 校验优惠码并计算折扣价格
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

  // 提交开通/充值订单（支持游客支付即注册，支持定制/通用/双重套餐）
  async submitOrder(orderData) {
    return request("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        plan_id: orderData.planId,
        amount: Number(orderData.amount),
        tx_id_last6: String(orderData.txId).trim(),
        promo_code: orderData.promoCode ? orderData.promoCode.trim().toUpperCase() : undefined,
        order_type: orderData.orderType, // 'vip' | 'custom_watchlist'
        custom_items: orderData.customItems || undefined,
        
        // 未登录游客支付即注册字段
        register_username: orderData.registerUsername ? orderData.registerUsername.trim() : undefined,
        register_password: orderData.registerPassword || undefined,
        ref_code: orderData.refCode ? orderData.refCode.trim().toUpperCase() : undefined,
      }),
    });
  },

  // 获取当前登录用户的历史订单列表
  async fetchUserOrders() {
    return request("/api/user/orders");
  },
};
