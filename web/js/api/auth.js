import { request } from "./http.js";

export const authApi = {
  async checkUsername(username) {
    const q = encodeURIComponent(String(username || "").trim());
    return request(`/api/check-username?username=${q}`);
  },

  async login(username, password) {
    return request("/api/login", {
      method: "POST",
      body: JSON.stringify({ username: username.trim(), password }),
    });
  },

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

  async getMe() {
    return request("/api/user/me");
  },

  async sendEmailCode(email, turnstileToken) {
    return request("/api/send-code", {
      method: "POST",
      body: JSON.stringify({ email: email.trim(), turnstileToken }),
    });
  },

  async changePassword(oldPassword, newPassword) {
    return request("/api/user/change-password", {
      method: "POST",
      body: JSON.stringify({
        old_password: oldPassword,
        new_password: newPassword,
      }),
    });
  },

  async getInvitees() {
    return request("/api/user/invitees");
  },

  async setReferralCode(code) {
    return request("/api/user/referral-code", {
      method: "POST",
      body: JSON.stringify({ code: String(code || "").trim() }),
    });
  },

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
