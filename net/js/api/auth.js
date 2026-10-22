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

  async sendEmailCode(email, turnstileToken, scene = "register") {
    return request("/api/send-code", {
      method: "POST",
      body: JSON.stringify({ email: email.trim(), turnstileToken, scene }),
    });
  },

  async resetPasswordByEmail({ email, emailCode, newPassword }) {
    return request("/api/password-reset", {
      method: "POST",
      body: JSON.stringify({
        email: String(email || "").trim(),
        code: String(emailCode || "").trim(),
        new_password: newPassword,
      }),
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
};
