/**
 * 波幅探长 - 客服工单 API 服务
 * js/api/ticket.js
 */
import { request } from "./http.js";
import { CONFIG } from "../config.js";

export const ticketApi = {
  // 获取当前用户的工单列表
  async fetchUserTickets() {
    return request("/api/tickets");
  },

  // 提交新建工单（支持图片数组）
  async submitTicket({ subject, message, images = [] }) {
    return request("/api/tickets", {
      method: "POST",
      body: JSON.stringify({
        subject: subject.trim(),
        message: (message || "").trim(),
        images: Array.isArray(images) ? images : [],
      }),
    });
  },

  // 上传图片到 R2（返回公开 URL）
  async uploadImage(file) {
    const formData = new FormData();
    formData.append("file", file);

    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${CONFIG.API_BASE}/api/tickets/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      throw new Error(data.error || "图片上传失败");
    }
    return data; // { success: true, url: "..." }
  },

  // 获取全局广播公告列表
  async fetchAnnouncements() {
    return request("/api/announcements");
  },
};
