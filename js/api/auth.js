/* ========================= FILE: .\js\api\auth.js ========================= */

/**
 * 波幅探长 - 账号认证与用户中心 API
 * js/api/auth.js
 */
import { request } from "./http.js";
import { CONFIG } from "../config.js";

export const authApi = {
  /** 账号是否可用（纯字母数字 + 唯一） */
  async checkUsername(username) {
    const q = encodeURIComponent(String(username || "").trim());
    return request(`/api/check-username?username=${q}`);
  },

  /** 账号密码登录 */
  async login(username, password) {
    return request("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: username.trim(),
        password,
      }),
    });
  },

  /** 常规账号注册 */
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

  /** 
   * 微信公众号动态口令免密登录 / 静默独立开户
   * 支持传入自定义昵称进行账户唯一隔离
   */
  async wechatLogin({ code, nickname, refCode }) {
    return request("/api/wechat-login", {
      method: "POST",
      body: JSON.stringify({
        code: String(code || "").trim(),
        nickname: String(nickname || "").trim(),
        ref_code: refCode ? String(refCode).trim().toUpperCase() : undefined,
      }),
    });
  },

  /** 当前登录用户信息（含最新 VIP 天数） */
  async getMe() {
    return request("/api/user/me");
  },

  /** 发送邮箱验证码 */
  async sendEmailCode(email, turnstileToken) {
    return request("/api/send-code", {
      method: "POST",
      body: JSON.stringify({
        email: email.trim(),
        turnstileToken,
      }),
    });
  },

  /** 修改密码（已登录） */
  async changePassword(oldPassword, newPassword) {
    return request("/api/user/change-password", {
      method: "POST",
      body: JSON.stringify({
        old_password: oldPassword,
        new_password: newPassword,
      }),
    });
  },

  /** 我邀请的用户列表 */
  async getInvitees() {
    return request("/api/user/invitees");
  },

  /** 用户自设邀请码 */
  async setReferralCode(code) {
    return request("/api/user/referral-code", {
      method: "POST",
      body: JSON.stringify({ code: String(code || "").trim() }),
    });
  },

  // ========== 安全问题 / 密码找回 ==========
  async getSecurityStatus() {
    return request("/api/user/security-status");
  },

  async setSecurityQuestions({ q1, a1, q2, a2, q3, a3 }) {
    return request("/api/user/security-questions", {
      method: "POST",
      body: JSON.stringify({ q1, a1, q2, a2, q3, a3 }),
    });
  },

  async passwordResetStart(username) {
    return request("/api/password-reset/start", {
      method: "POST",
      body: JSON.stringify({ username: String(username || "").trim() }),
    });
  },

  async passwordResetConfirm({ challengeId, answers, newPassword }) {
    return request("/api/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify({
        challenge_id: challengeId,
        answers,
        new_password: newPassword,
      }),
    });
  },
};
