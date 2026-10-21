/**
 * 管理后台 API (v5.1)
 * 完整映射前台所有功能：统计概览、用户与昵称管理、订单审核、默认监控列表(含T+0/T+1属性)、赞助标的管理(含署名与交易规则)、优惠码管理、工单与系统设置
 */
import { request } from "./http.js";

export const adminApi = {
  async fetchStats() {
    return request("/api/admin/stats");
  },

  async fetchUsers() {
    return request("/api/admin/users");
  },
  async updateUserNickname(userId, nickname) {
    return request("/api/admin/users/nickname", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, nickname }),
    });
  },
  async resetPassword(userId, adminConfirmSecret) {
    return request("/api/admin/users/reset_password", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, admin_confirm: adminConfirmSecret }),
    });
  },
  async deleteUser(userId, adminConfirmSecret) {
    return request("/api/admin/users", {
      method: "DELETE",
      body: JSON.stringify({ user_id: userId, admin_confirm: adminConfirmSecret }),
    });
  },
  async purgeInactiveUsers(days, adminConfirmSecret, dryRun = false) {
    return request("/api/admin/users/purge_inactive", {
      method: "POST",
      body: JSON.stringify({ days, admin_confirm: adminConfirmSecret, dry_run: dryRun }),
    });
  },

  async fetchOrders(status = "") {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return request(`/api/admin/orders${query}`);
  },
  async approveOrder(orderId, userId) {
    return request("/api/admin/orders/approve", {
      method: "POST",
      body: JSON.stringify({ order_id: orderId, user_id: userId }),
    });
  },
  async rejectOrder(orderId) {
    return request("/api/admin/orders/reject", {
      method: "POST",
      body: JSON.stringify({ order_id: orderId }),
    });
  },
  async deleteOrders(ids, adminPassword) {
    return request("/api/admin/orders/delete", {
      method: "POST",
      body: JSON.stringify({
        ids: Array.isArray(ids) ? ids : [ids],
        admin_password: adminPassword,
      }),
    });
  },

  /** 默认监控列表（支持 trade_mode: auto | t+0 | t+1） */
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

  /** 赞助标的管理（支持管理员新增/编辑赞助标的、赞助昵称署名、交易制度 T+0/T+1） */
  async fetchSponsors(status = "") {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    return request(`/api/admin/sponsors${q}`);
  },
  async saveSponsor(payload) {
    return request("/api/admin/sponsors/save", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async forceExpireSponsor(id, adminPassword) {
    return request("/api/admin/sponsors/expire", {
      method: "POST",
      body: JSON.stringify({ id, admin_password: adminPassword }),
    });
  },

  /** 优惠码管理 */
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
      method: "POST",
      body: JSON.stringify({ id, action: "delete" }),
    });
  },

  async fetchSettings() {
    return request("/api/admin/settings");
  },
  async saveSettings(settingsData) {
    return request("/api/admin/settings", {
      method: "POST",
      body: JSON.stringify(settingsData),
    });
  },

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
  async broadcastNotice(title, content, alsoTg = true) {
    return request("/api/admin/broadcast", {
      method: "POST",
      body: JSON.stringify({ title, content, also_tg: alsoTg }),
    });
  },
};
