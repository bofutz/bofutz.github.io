/**
 * 波幅探长 - 票选监控 API
 * 前台：/api/vote/*
 * 后台：/api/admin/vote/*
 */
import { request } from "./http.js";

export const voteApi = {
  // ========== 前台 ==========

  /** 排行榜（含 seed 的 0 票标的） */
  async fetchRankings(keyword = "") {
    const q = keyword ? `?q=${encodeURIComponent(keyword)}` : "";
    return request(`/api/vote/rankings${q}`);
  },

  /** 当前用户本月投票状态 */
  async fetchUserVoteStatus() {
    return request("/api/vote/status");
  },

  /** 投票 / 新增标的进池 */
  async submitVote(etfCode, etfName = "") {
    return request("/api/vote/submit", {
      method: "POST",
      body: JSON.stringify({
        etf_code: String(etfCode).trim().toUpperCase(),
        etf_name: etfName ? String(etfName).trim() : undefined,
      }),
    });
  },

  /** 撤销本月投票 */
  async cancelVote(voteId) {
    return request("/api/vote/cancel", {
      method: "POST",
      body: JSON.stringify({ vote_id: voteId }),
    });
  },

  // ========== 后台 ==========

  async batchSeedVotes(items) {
    return request("/api/admin/vote/seed", {
      method: "POST",
      body: JSON.stringify({ items }),
    });
  },

  async fetchAdminVoteStats() {
    return request("/api/admin/vote/stats");
  },

  async clearMonthlyVotes() {
    return request("/api/admin/vote/clear", { method: "POST" });
  },

  async syncTopVotesToShared(topN = 50) {
    return request("/api/admin/vote/sync-to-shared", {
      method: "POST",
      body: JSON.stringify({ top_n: topN }),
    });
  },
};
