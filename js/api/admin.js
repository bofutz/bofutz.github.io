/**
 * 波幅探长 - 管理后台综合 API 服务集
 * js/api/admin.js
 *
 * 设置类（票选门槛 / ETF 限制 / 打赏 / 广告 / 社交平台）统一走
 * fetchSettings / saveSettings，无需单独接口。
 */
import { request } from "./http.js";

export const adminApi = {
  // 1. 数据概览
  async fetchStats() {
    return request("/api/admin/stats");
  },

  // 2. 用户管理
  async fetchUsers() {
    return request("/api/admin/users");
  },
  async chargeUser(userId, addDays, setDays = null) {
    return request("/api/admin/users/charge", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        add_days: addDays,
        set_days: setDays,
      }),
    });
  },
  async batchChargeUsers(userIds, addDays) {
    return request("/api/admin/users/batch_charge", {
      method: "POST",
      body: JSON.stringify({ user_ids: userIds, add_days: addDays }),
    });
  },
  async resetPassword(userId, adminConfirmSecret) {
    return request("/api/admin/users/reset_password", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        admin_confirm: adminConfirmSecret,
      }),
    });
  },
  async deleteUser(userId, adminConfirmSecret) {
    return request("/api/admin/users", {
      method: "DELETE",
      body: JSON.stringify({
        user_id: userId,
        admin_confirm: adminConfirmSecret,
      }),
    });
  },
  /** 手动调整会员等级 0~4（可选，与充天数配合） */
  async setUserLevel(userId, vipLevel) {
    return request("/api/admin/users/set_level", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        vip_level: Math.max(0, Math.min(4, parseInt(vipLevel, 10) || 0)),
      }),
    });
  },

  // 3. 订单审核
  async fetchOrders(status = "") {
    const query = status ? `?status=${encodeURIComponent(String(status))}` : "";
    return request(`/api/admin/orders${query}`);
  },
  async approveOrder(orderId, userId, addDays) {
    return request("/api/admin/orders/approve", {
      method: "POST",
      body: JSON.stringify({
        order_id: orderId,
        user_id: userId,
        add_days: addDays,
      }),
    });
  },
  async rejectOrder(orderId) {
    return request("/api/admin/orders/reject", {
      method: "POST",
      body: JSON.stringify({ order_id: orderId }),
    });
  },

  // 4. 套餐管理 (支持 shared / custom / both)
  async fetchPlans() {
    return request("/api/admin/plans");
  },
  async savePlan(planData) {
    return request("/api/admin/plans", {
      method: "POST",
      body: JSON.stringify(planData),
    });
  },
  async deletePlan(id) {
    return request("/api/admin/plans", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
  },

  // 5. 通用监控管理
  async fetchSharedWatchlist() {
    return request("/api/admin/watchlist/shared");
  },
  async saveSharedItem(item) {
    return request("/api/admin/watchlist/shared", {
      method: "POST",
      body: JSON.stringify(item),
    });
  },
  async batchImportShared(items) {
    return request("/api/admin/watchlist/shared/batch", {
      method: "POST",
      body: JSON.stringify({ items }),
    });
  },
  async deleteSharedItem(id) {
    return request("/api/admin/watchlist/shared", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
  },

  // 自主查询 / 次数套餐
  async fetchChartQueries(status = "") {
    const q = status ? `?status=${encodeURIComponent(String(status))}` : "";
    return request(`/api/admin/chart-queries${q}`);
  },
  async fetchChartCreditPlans() {
    return request("/api/admin/chart-credit-plans");
  },
  async saveChartCreditPlan(data) {
    return request("/api/admin/chart-credit-plans", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  async deleteChartCreditPlan(id) {
    return request("/api/admin/chart-credit-plans", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
  },

  // 6. 定制监控管理（兼容旧数据，前台已下线）
  async fetchCustomWatchlist() {
    return request("/api/admin/watchlist/custom");
  },
  async saveCustomItem(item) {
    return request("/api/admin/watchlist/custom", {
      method: "POST",
      body: JSON.stringify(item),
    });
  },
  async deleteCustomItem(id) {
    return request("/api/admin/watchlist/custom", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
  },
  /** 将过期定制标的批量标记为 expired（也可由 Worker 定时任务执行） */
  async expireCustomWatchlist() {
    return request("/api/admin/watchlist/custom/expire", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  // 7. 优惠码管理
  async fetchPromos() {
    return request("/api/admin/promos");
  },
  async savePromo(promoData) {
    return request("/api/admin/promos", {
      method: "POST",
      body: JSON.stringify(promoData),
    });
  },
  async deletePromo(id) {
    return request("/api/admin/promos", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
  },

  // 8. 系统设置（含：票选门槛、ETF限制、打赏、广告、社交平台 JSON）
  async fetchSettings() {
    return request("/api/admin/settings");
  },
  async saveSettings(settingsData) {
    return request("/api/admin/settings", {
      method: "POST",
      body: JSON.stringify(settingsData),
    });
  },

  // 9. 工单回复与一键广播
  async fetchTickets() {
    return request("/api/admin/tickets");
  },
  async replyTicket(ticketId, replyMessage, replyImages = []) {
    return request("/api/admin/tickets/reply", {
      method: "POST",
      body: JSON.stringify({
        ticket_id: ticketId,
        reply_message: replyMessage,
        reply_images: Array.isArray(replyImages) ? replyImages : [],
      }),
    });
  },
  async deleteTickets(ids, adminConfirmSecret) {
    return request("/api/admin/tickets", {
      method: "DELETE",
      body: JSON.stringify({ ids, admin_confirm: adminConfirmSecret }),
    });
  },
  async purgeInactiveUsers(days, adminConfirmSecret, dryRun = false) {
    return request("/api/admin/users/purge_inactive", {
      method: "POST",
      body: JSON.stringify({ days, admin_confirm: adminConfirmSecret, dry_run: dryRun }),
    });
  },
  async broadcastNotice(title, content, alsoTg = true) {
    return request("/api/admin/broadcast", {
      method: "POST",
      body: JSON.stringify({ title, content, also_tg: alsoTg }),
    });
  },
};
