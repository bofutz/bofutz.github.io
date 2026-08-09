/**
 * 波幅探长 - 账号认证与用户中心 API
 * js/api/auth.js
 */
import { request } from "./http.js";
import { CONFIG } from "../config.js";

export const authApi = {
  /** 账号登录 */
  async login(username, password) {
    return request("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: username.trim(),
        password,
      }),
    });
  },

  /** 账号注册 */
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

  /** 当前登录用户信息（含最新 VIP 天数） */
  async getMe() {
    return request("/api/user/me");
  },

/** 发送邮箱验证码（经主 API 转发，避免跨域） */
async sendEmailCode(email, turnstileToken) {
  return request("/api/send-code", {
    method: "POST",
    body: JSON.stringify({
      email: email.trim(),
      turnstileToken,
    }),
  });
},

  /** 安全问题是否已设置 */
  async getSecurityStatus() {
    return request("/api/user/security-status");
  },

  /** 设置三个安全问题 */
  async setSecurityQuestions({ q1, a1, q2, a2, q3, a3 }) {
    return request("/api/user/security-questions", {
      method: "POST",
      body: JSON.stringify({ q1, a1, q2, a2, q3, a3 }),
    });
  },

  /** 忘记密码：开始，拿随机两题 */
  async passwordResetStart(username) {
    return request("/api/password-reset/start", {
      method: "POST",
      body: JSON.stringify({ username: username.trim() }),
    });
  },

  /** 忘记密码：提交答案 + 新密码 */
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

  /** 我邀请的用户列表 */
  async getInvitees() {
    return request("/api/user/invitees");
  },
};
