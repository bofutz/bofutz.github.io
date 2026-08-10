/**
 * 波幅探长 - 客服工单 API
 * js/api/ticket.js
 * 上传前自动压缩图片（最长边 1280，质量 0.72）
 */
import { request } from "./http.js";
import { CONFIG } from "../config.js";

/** 将图片压缩为 JPEG Blob，控制体积 */
async function compressImage(file, maxSide = 1280, quality = 0.65) {
  if (!file || !file.type.startsWith("image/")) return file;
  // gif 不动，避免丢动画
  if (file.type === "image/gif") return file;

  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    const scale = Math.min(1, maxSide / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);

    const canvas = typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement("canvas"), { width, height });

    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    let blob;
    if (canvas.convertToBlob) {
      blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
    } else {
      blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality)
      );
    }

    if (!blob) return file;
    // 压缩后反而更大则用原图
    if (blob.size >= file.size) return file;

    const name = (file.name || "image").replace(/\.\w+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch (e) {
    console.warn("compressImage failed, use original:", e);
    return file;
  }
}

export const ticketApi = {
  async fetchUserTickets() {
    return request("/api/tickets");
  },

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

  /** 压缩后上传到 R2，返回 { success, url } */
  async uploadImage(file) {
    const compressed = await compressImage(file);

    const formData = new FormData();
    formData.append("file", compressed);

    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    // 不要手动设 Content-Type，让浏览器带 multipart boundary

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

  async fetchAnnouncements() {
    return request("/api/announcements");
  },

  /** 会员删除自己的工单 ids: number[] */
  async deleteTickets(ids) {
    return request("/api/tickets", {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
  },
};
