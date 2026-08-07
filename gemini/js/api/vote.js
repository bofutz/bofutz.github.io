/**
 * 波幅探长 - 票选监控 API 服务
 * js/api/vote.js
 */
import { request } from "./http.js";

export const voteApi = {
  // 【前台】获取票选排行榜（支持搜索，最多200）
  async fetchRankings(keyword = "") {
    const query = keyword ? `?q=${encodeURIComponent(keyword)}` : "";
    return request(`/api/vote/rankings${query}`);
  },

  // 【前台】获取当前用户投票状态
  async fetchUserVoteStatus() {
    return request("/api/vote/status");
  },

  // 【前台】提交投票
  async submitVote(etfCode, etfName = "") {
    return request("/api/vote/submit", {
      method: "POST",
      body: JSON.stringify({
        etf_code: String(etfCode).trim().toUpperCase(),
        etf_name: etfName ? etfName.trim() : undefined,
      }),
    });
  },

  // 【前台】撤销投票
  async cancelVote(voteId) {
    return request("/api/vote/cancel", {
      method: "POST",
      body: JSON.stringify({ vote_id: voteId }),
    });
  },

  // 【后台】获取投票管理数据
  async fetchAdminVoteStats() {
    return request("/api/admin/vote/stats");
  },

  // 【后台】清空本月投票
  async clearMonthlyVotes() {
    return request("/api/admin/vote/clear", {
      method: "POST",
    });
  },

  // 【后台】同步前 N 名至通用监控
  async syncTopVotesToShared(topN = 50) {
    return request("/api/admin/vote/sync-to-shared", {
      method: "POST",
      body: JSON.stringify({ top_n: topN }),
    });
  },
};
