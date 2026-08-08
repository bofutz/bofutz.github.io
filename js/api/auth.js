/**
 * 波幅探长 - 账号认证与用户中心 API 服务
 * js/api/auth.js
 */
import { request } from "./http.js";
import { CONFIG } from "../config.js";

export const authApi = {
  // 账号登录
  async login(username, password) {
    return request("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: username.trim(),
        password,
      }),
    });
  },

  // 账号注册
  async register({ username, password, refCode, emailCode }) {
    return request("/api/register", {
      method: "POST",
      body: JSON.stringify({
        username: username.trim(),
        password,
        ref_code: refCode ? refCode.trim() : undefined,
        code: emailCode ? emailCode.trim() : undefined,
      }),
    });
  },

  // 获取当前登录用户信息（含最新 VIP 天数）
  async getMe() {
    return request("/api/user/me");
  },
  
  // 发送邮箱验证码
  async sendEmailCode(email, turnstileToken) {
    return request(`${CONFIG.MAIL_API_BASE}/api/send-code`, {
      method: "POST",
      body: JSON.stringify({
        email: email.trim(),
        turnstileToken,
      }),
    });
  },

  // 修改密码（已对齐 Worker 路径）
  async changePassword(oldPassword, newPassword) {
    return request("/api/user/change-password", {
      method: "POST",
      body: JSON.stringify({
        old_password: oldPassword,
        new_password: newPassword,
      }),
    });
  },

  // 获取我邀请的用户列表
  async getInvitees() {
    return request("/api/user/invitees");
  },
};
