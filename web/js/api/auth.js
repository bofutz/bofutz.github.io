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

  async register({ username, password, emailCode, nickname }) {
    return request("/api/register", {
      method: "POST",
      body: JSON.stringify({
        username: username.trim(),
        password,
        code: emailCode ? emailCode.trim() : undefined,
        nickname: nickname ? nickname.trim() : undefined,
      }),
    });
  },

  async getMe() {
    return request("/api/user/me");
  },

  async updateNickname(nickname) {
    return request("/api/user/nickname", {
      method: "POST",
      body: JSON.stringify({ nickname: String(nickname || "").trim() }),
    });
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
