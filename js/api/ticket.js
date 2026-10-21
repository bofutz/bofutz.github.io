import { request } from "./http.js";
import { CONFIG } from "../config.js";

async function compressImage(file, maxSide = 1024, quality = 0.65) {
  if (!file || !file.type.startsWith("image/")) return file;
  if (file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    const scale = Math.min(1, maxSide / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);
    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(width, height)
        : Object.assign(document.createElement("canvas"), { width, height });
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    let blob;
    if (canvas.convertToBlob) {
      blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
    } else {
      blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    }
    if (!blob || blob.size >= file.size) return file;
    const name = (file.name || "image").replace(/\.\w+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch (e) {
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

  async uploadImage(file) {
    const compressed = await compressImage(file);
    const formData = new FormData();
    formData.append("file", compressed);
    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${CONFIG.API_BASE}/api/tickets/upload`, {
      method: "POST",
      headers,
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || "图片上传失败");
    return data;
  },

  async fetchAnnouncements() {
    return request("/api/announcements");
  },

  async deleteTickets(ids) {
    return request("/api/tickets", {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
  },
};
