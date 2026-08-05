/**
 * 波幅探长 - 答疑工单与系统广播 API 服务
 * js/api/ticket.js
 */
import { request } from "./http.js";

export const ticketApi = {
  // 获取当前用户的答疑工单列表
  async fetchUserTickets() {
    return request("/api/tickets");
  },

  // 提交新建答疑工单
  async submitTicket(subject, level, message) {
    return request("/api/tickets", {
      method: "POST",
      body: JSON.stringify({
        subject: subject.trim(),
        level: level || "medium",
        message: message.trim(),
      }),
    });
  },

  // 获取全局广播公告列表
  async fetchAnnouncements() {
    return request("/api/announcements");
  },
};
