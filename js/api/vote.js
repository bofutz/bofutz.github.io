/**
 * 波幅探长 - 票选监控 API 服务
 * js/api/vote.js
 *
 * 前台：
 *   GET  /api/vote/rankings?q=   → 排行榜（含 0 票的 seed 标的也应出现）
 *   GET  /api/vote/status       → 当前用户本月投票状态
 *   POST /api/vote/submit       → 投票/新增
 *   POST /api/vote/cancel       → 撤销
 *
 * 后台：
 *   GET  /api/admin/vote/stats
 *   POST /api/admin/vote/seed
 *   POST /api/admin/vote/clear
 *   POST /api/admin/vote/sync-to-shared
 */
import { request } from "./http.js";

export const voteApi = {
  // ---------- 前台 ----------

  /**
   * 票选排行榜（最多 200）
   * 期望：{ success: true, data: [ { etf_code, etf_name, vote_count, voters_count, percentage } ] }
   */
  async fetchRankings(keyword = "") {
    const q = keyword ? `?q=${encodeURIComponent(keyword)}` : "";
    return request(`/api/vote/rankings${q}`);
  },

  /**
   * 当前用户投票资格与本月已用额度
   * 期望：{ success, has_qualified, monthly_limit, votes_used, votes_remaining, my_votes: [] }
   */
  async fetchUserVoteStatus() {
    return request("/api/vote/status");
  },

  /**
   * 提交投票（已有则 +1，没有则新增进池）
   */
  async submitVote(etfCode, etfName = "") {
    return request("/api/vote/submit", {
      method: "POST",
      body: JSON.stringify({
        etf_code: String(etfCode).trim().toUpperCase(),
        etf_name: etfName ? String(etfName).trim() : undefined,
      }),
    });
  },

  /**
   * 撤销本月某次投票（返还名额）
   */
  async cancelVote(voteId) {
    return request("/api/vote/cancel", {
      method: "POST",
      body: JSON.stringify({ vote_id: voteId }),
    });
  },

  // ---------- 后台 ----------

  /**
   * 批量导入初始标的（进入票选池，初始票数可为 0）
   * body: { items: [ { etf_code, etf_name } ] }
   */
  async batchSeedVotes(items) {
    return request("/api/admin/vote/seed", {
      method: "POST",
      body: JSON.stringify({ items }),
    });
  },

  /**
   * 后台票选统计 + 排行列表
   * 期望：{ success, data: { valid_symbols_count, total_vote_interactions, monthly_limit, list: [] } }
   */
  async fetchAdminVoteStats() {
    return request("/api/admin/vote/stats");
  },

  /**
   * 清空本月投票（慎用）
   */
  async clearMonthlyVotes() {
    return request("/api/admin/vote/clear", {
      method: "POST",
    });
  },

  /**
   * 同步前 N 名至通用监控
   */
  async syncTopVotesToShared(topN = 50) {
    return request("/api/admin/vote/sync-to-shared", {
      method: "POST",
      body: JSON.stringify({ top_n: topN }),
    });
  },
};
