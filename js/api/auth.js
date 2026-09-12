/* ========================= FILE: .\js\api\auth.js ========================= */
import { request } from "./http.js";
import { CONFIG } from "../config.js";

export const authApi = {
  /** 账号是否可用 */
  async checkUsername(username) {
    const q = encodeURIComponent(String(username || "").trim());
    return request(`/api/check-username?username=${q}`);
  },

  /** 常规账号密码登录 */
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
   * 【新增核心接口】微信公众号动态验证码免密直登 (未注册自动完成注册)
   * 后端 Worker 验证通过后直接下发 token 与用户信息
   */
  async wechatLogin({ code, refCode }) {
    return request("/api/wechat-login", {
      method: "POST",
      body: JSON.stringify({
        code: String(code || "").trim(),
        ref_code: refCode ? String(refCode).trim().toUpperCase() : undefined,
      }),
    });
  },

  /** 当前登录用户信息 */
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

  /** 修改密码 */
  async changePassword(oldPassword, newPassword) {
    return request("/api/user/change-password", {
      method: "POST",
      body: JSON.stringify({
        old_password: oldPassword,
        new_password: newPassword,
      }),
    });
  },

  /** 邀请列表与邀请码 */
  async getInvitees() {
    return request("/api/user/invitees");
  },
  async setReferralCode(code) {
    return request("/api/user/referral-code", {
      method: "POST",
      body: JSON.stringify({ code: String(code || "").trim() }),
    });
  },

  /** 安全问题接口 */
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
